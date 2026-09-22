import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { supabaseServer } from '@/lib/supabase-server';

// Large catalogs can take a while to upsert into Supabase in batches.
// 60s is the Vercel Hobby ceiling; bump this (and your plan) if your
// catalog is large enough to still time out.
export const maxDuration = 60;

const BATCH_SIZE = 1000;

type CopyRow = {
  CopyID: number;
  Barcode: string | null;
  CallNumber: string | null;
  Title: string | null;
  Author: string | null;
  Publisher: string | null;
  PublicationYear: number | null;
  Sublocation: string | null;
};

async function runSync() {
  const pool = await getPool();
  const p = await getSchemaPrefix();
  const syncStartedAt = new Date().toISOString();

  const result = await pool.request().query(`
    SELECT
      c.CopyID,
      c.CopyBarcode      AS Barcode,
      c.CallNumber       AS CallNumber,
      bm.Title           AS Title,
      bm.Author          AS Author,
      bm.Publisher       AS Publisher,
      bm.PublicationYear AS PublicationYear,
      clv.Sublocation    AS Sublocation
    FROM ${t(p,'Copy')} c
    JOIN ${t(p,'BibMaster')} bm             ON bm.BibID = c.BibID
    LEFT JOIN ${t(p,'CopyLibraryView')} clv ON clv.CopyID = c.CopyID
    WHERE c.DateWithdrawn IS NULL
  `);

  const rows: CopyRow[] = result.recordset;

  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map(r => ({
      copy_id:          r.CopyID,
      barcode:          r.Barcode,
      call_number:      r.CallNumber,
      title:            r.Title,
      author:           r.Author,
      publisher:        r.Publisher,
      publication_year: r.PublicationYear,
      sublocation:      r.Sublocation,
      synced_at:        syncStartedAt,
    }));
    const { error } = await supabaseServer.from('library_catalog').upsert(batch, { onConflict: 'copy_id' });
    if (error) throw new Error(error.message);
    upserted += batch.length;
  }

  // Anything not touched by this run was withdrawn/removed since the last sync.
  const { error: deleteError, count } = await supabaseServer
    .from('library_catalog')
    .delete({ count: 'exact' })
    .lt('synced_at', syncStartedAt);
  if (deleteError) throw new Error(deleteError.message);

  return { upserted, removed: count ?? 0, syncedAt: syncStartedAt };
}

// Called by Vercel Cron (GET with Authorization header)
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const summary = await runSync();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// Called manually (e.g. from the dashboard, or by hand while setting this up)
export async function POST() {
  try {
    const summary = await runSync();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
