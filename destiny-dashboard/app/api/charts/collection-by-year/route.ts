import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT
        YEAR(Acquired) AS year,
        COUNT(*) AS items,
        COUNT(DISTINCT BibID) AS titles
      FROM ${t(p,'Copy')}
      WHERE DateWithdrawn IS NULL
        AND Acquired IS NOT NULL
        AND YEAR(Acquired) >= 2010
      GROUP BY YEAR(Acquired)
      ORDER BY year ASC
    `);
    return NextResponse.json({ data: result.recordset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
