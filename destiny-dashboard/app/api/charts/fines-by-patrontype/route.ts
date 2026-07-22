import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { cacheGet, cacheSet } from '@/lib/cache';

const CACHE_KEY = '/api/charts/fines-by-patrontype';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const year = new Date().getFullYear();
    const req = pool.request();
    req.input('year', sql.Int, year);

    const result = await req.query(`
      SELECT
        ISNULL(pt.PatronTypeDescription, 'Unknown') AS patronType,
        COUNT(DISTINCT f.PatronID)                   AS patronsWithFines,
        COUNT(f.FineID)                              AS fineCount,
        SUM(f.Amount / 100.0)                        AS totalFines,
        AVG(f.Amount / 100.0)                        AS avgFine
      FROM ${t(p,'Fine')} f
      JOIN ${t(p,'SitePatron')} sp ON sp.PatronID = f.PatronID
      LEFT JOIN ${t(p,'PatronType')} pt ON pt.PatronTypeID = sp.PatronTypeID
      WHERE YEAR(f.Created) = @year
        AND f.Active = 1
      GROUP BY pt.PatronTypeDescription
      ORDER BY totalFines DESC
    `);

    cacheSet(CACHE_KEY, result.recordset);
    return NextResponse.json(result.recordset);
  } catch (err: unknown) {
    const cached = await cacheGet(CACHE_KEY);
    if (cached) return NextResponse.json(cached.payload);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
