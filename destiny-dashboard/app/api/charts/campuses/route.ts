import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { supabaseServer } from '@/lib/supabase-server';
import { cacheGet, cacheSet } from '@/lib/cache';

const CACHE_KEY = '/api/charts/campuses';

interface CampusStatRow {
  campus: string;
  source: 'slims' | 'koha';
  period_type: string;
  period_date: string;
  total_items: number | null;
  checked_out: number | null;
  total_patrons: number | null;
  active_patrons: number | null;
  checkouts: number | null;
  new_items: number | null;
  synced_at: string;
}

export async function GET() {
  // The whole point of this dashboard is staying useful when Destiny is
  // unreachable — so a Destiny outage should only blank the Sublocation
  // half of this response, never hide the independently-sourced
  // SLiMS/Koha campus_stats rows (and vice versa).
  let sublocations: { name: string; totalItems: number; checkedOut: number }[] = [];
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    // Destiny's Sublocation field is a shared union catalog across
    // campuses — it covers item counts for every campus even for the ones
    // whose circulation is tracked in their own SLiMS/Koha instead.
    const subloc = await pool.request().query(`
      SELECT
        ISNULL(NULLIF(Sublocation,''), 'Unassigned') AS name,
        COUNT(*) AS totalItems,
        SUM(CASE WHEN PatronID IS NOT NULL AND DateReturned IS NULL AND DateWithdrawn IS NULL THEN 1 ELSE 0 END) AS checkedOut
      FROM ${t(p,'CopyLibraryView')}
      WHERE DateWithdrawn IS NULL
      GROUP BY Sublocation
      ORDER BY totalItems DESC
    `);
    sublocations = subloc.recordset;
  } catch { /* fall through with sublocations = [] */ }

  let campuses: CampusStatRow[] = [];
  try {
    const { data: campusRows } = await supabaseServer
      .from('campus_stats')
      .select('*')
      .order('period_date', { ascending: false });
    const latestByCampus = new Map<string, CampusStatRow>();
    for (const row of (campusRows ?? []) as CampusStatRow[]) {
      if (!latestByCampus.has(row.campus)) latestByCampus.set(row.campus, row);
    }
    campuses = [...latestByCampus.values()];
  } catch { /* fall through with campuses = [] */ }

  const json = { sublocations, campuses };
  if (sublocations.length > 0 || campuses.length > 0) cacheSet(CACHE_KEY, json);
  else {
    const cached = await cacheGet(CACHE_KEY);
    if (cached) return NextResponse.json(cached.payload);
  }
  return NextResponse.json(json);
}
