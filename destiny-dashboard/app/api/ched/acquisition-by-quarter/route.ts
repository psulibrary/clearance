import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { cacheGet, cacheSet, withCacheMeta } from '@/lib/cache';

const CACHE_KEY = '/api/ched/acquisition-by-quarter';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT
        YEAR(Acquired) AS year,
        DATEPART(QUARTER, Acquired) AS quarter,
        COUNT(*) AS items,
        COUNT(DISTINCT BibID) AS titles,
        ISNULL(SUM(Price),0) / 100.0 AS spend
      FROM ${t(p,'Copy')}
      WHERE DateWithdrawn IS NULL
        AND Acquired IS NOT NULL
        AND YEAR(Acquired) >= 2015
      GROUP BY YEAR(Acquired), DATEPART(QUARTER, Acquired)
      ORDER BY year ASC, quarter ASC
    `);
    const data = result.recordset.map((r: { year: number; quarter: number; items: number; titles: number; spend: number }) => ({
      ...r,
      label: `Q${r.quarter} ${r.year}`,
    }));
    const json = { data };
    cacheSet(CACHE_KEY, json);
    return NextResponse.json(json);
  } catch (err: unknown) {
    const cached = await cacheGet(CACHE_KEY);
    if (cached) return NextResponse.json(withCacheMeta(cached));
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
