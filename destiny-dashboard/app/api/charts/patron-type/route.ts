import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { cacheGet, cacheSet } from '@/lib/cache';

const CACHE_KEY = '/api/charts/patron-type';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT TOP 15
        pt.PatronTypeDescription AS name,
        COUNT(sp.PatronID) AS value
      FROM ${t(p,'SitePatron')} sp
      JOIN ${t(p,'PatronType')} pt ON sp.PatronTypeID = pt.PatronTypeID
      GROUP BY pt.PatronTypeDescription
      ORDER BY value DESC
    `);
    cacheSet(CACHE_KEY, { data: result.recordset });
    return NextResponse.json({ data: result.recordset });
  } catch (err: unknown) {
    const cached = await cacheGet(CACHE_KEY);
    if (cached) return NextResponse.json(cached.payload);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
