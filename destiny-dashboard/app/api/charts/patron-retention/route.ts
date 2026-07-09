import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const year = new Date().getFullYear();
    const req = pool.request();
    req.input('year', sql.Int, year);
    req.input('lastYear', sql.Int, year - 1);

    const result = await req.query(`
      WITH last_year AS (
        SELECT DISTINCT PatronID FROM ${t(p,'Copy')}
        WHERE PatronID IS NOT NULL AND YEAR(DateReturned) = @lastYear
      ),
      this_year AS (
        SELECT DISTINCT PatronID FROM ${t(p,'Copy')}
        WHERE PatronID IS NOT NULL
          AND (YEAR(DateReturned) = @year OR (DateReturned IS NULL AND DateWithdrawn IS NULL))
      )
      SELECT
        (SELECT COUNT(*) FROM last_year)                                         AS activeLastYear,
        (SELECT COUNT(*) FROM this_year)                                         AS activeThisYear,
        (SELECT COUNT(*) FROM this_year ty WHERE EXISTS
          (SELECT 1 FROM last_year ly WHERE ly.PatronID = ty.PatronID))          AS retained,
        (SELECT COUNT(*) FROM this_year ty WHERE NOT EXISTS
          (SELECT 1 FROM last_year ly WHERE ly.PatronID = ty.PatronID))          AS newBorrowers
    `);

    const r = result.recordset[0];
    const retentionRate = r.activeLastYear > 0
      ? parseFloat(((r.retained / r.activeLastYear) * 100).toFixed(1))
      : 0;
    return NextResponse.json({ ...r, retentionRate, year });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
