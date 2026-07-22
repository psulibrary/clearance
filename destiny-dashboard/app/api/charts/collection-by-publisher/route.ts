import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { cacheGet, cacheSet } from '@/lib/cache';

const CACHE_KEY = '/api/charts/collection-by-publisher';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT TOP 20
        ISNULL(NULLIF(LTRIM(RTRIM(bm.Publisher)),''), 'Unknown Publisher') AS name,
        COUNT(DISTINCT bm.BibID) AS titles,
        COUNT(c.CopyID) AS items
      FROM ${t(p,'BibMaster')} bm
      JOIN ${t(p,'Copy')} c ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
      GROUP BY LTRIM(RTRIM(bm.Publisher))
      ORDER BY titles DESC
    `);
    cacheSet(CACHE_KEY, { data: result.recordset });
    return NextResponse.json({ data: result.recordset });
  } catch (err: unknown) {
    const cached = await cacheGet(CACHE_KEY);
    if (cached) return NextResponse.json(cached.payload);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
