import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { cacheGet, cacheSet } from '@/lib/cache';

const CACHE_KEY = '/api/charts/gender';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT
        CASE WHEN Gender IS NULL OR Gender = '' THEN 'Unknown' ELSE Gender END AS name,
        COUNT(*) AS value
      FROM ${t(p,'Patron')}
      GROUP BY Gender
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
