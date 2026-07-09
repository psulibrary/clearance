import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();

    const result = await pool.request().query(`
      SELECT
        YEAR(Acquired)           AS acqYear,
        COUNT(*)                 AS items,
        COUNT(DISTINCT BibID)    AS titles,
        COUNT(CASE WHEN DateReturned IS NOT NULL OR PatronID IS NOT NULL THEN 1 END) AS everBorrowed
      FROM ${t(p,'Copy')}
      WHERE DateWithdrawn IS NULL
        AND Acquired IS NOT NULL
        AND YEAR(Acquired) >= 1980
        AND YEAR(Acquired) <= YEAR(GETDATE())
      GROUP BY YEAR(Acquired)
      ORDER BY acqYear
    `);

    return NextResponse.json(result.recordset);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
