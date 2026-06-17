import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT
        ISNULL(NULLIF(LTRIM(RTRIM(p.Gender)),''), 'Unspecified') AS gender,
        COUNT(DISTINCT p.PatronID)                                                                          AS totalPatrons,
        COUNT(DISTINCT CASE WHEN c.PatronID IS NOT NULL AND c.DateReturned IS NULL AND c.DateWithdrawn IS NULL THEN p.PatronID END) AS activePatrons,
        COUNT(CASE WHEN c.PatronID IS NOT NULL AND c.DateWithdrawn IS NULL THEN c.CopyID END)               AS totalCheckouts,
        COUNT(CASE WHEN c.PatronID IS NOT NULL AND c.DateReturned IS NULL AND c.DateWithdrawn IS NULL AND c.DateDue < GETDATE() THEN c.CopyID END) AS overdueItems
      FROM ${t(p,'Patron')} p
      LEFT JOIN ${t(p,'Copy')} c ON c.PatronID = p.PatronID
      GROUP BY LTRIM(RTRIM(p.Gender))
      ORDER BY totalPatrons DESC
    `);

    const data = result.recordset.map((r: {
      gender: string; totalPatrons: number; activePatrons: number;
      totalCheckouts: number; overdueItems: number;
    }) => ({
      name:           r.gender,
      totalPatrons:   r.totalPatrons,
      activePatrons:  r.activePatrons,
      totalCheckouts: r.totalCheckouts,
      overdueItems:   r.overdueItems,
      activeRate:     r.totalPatrons ? parseFloat((r.activePatrons / r.totalPatrons * 100).toFixed(1)) : 0,
      checkoutsPerPatron: r.totalPatrons ? parseFloat((r.totalCheckouts / r.totalPatrons).toFixed(2)) : 0,
    }));

    return NextResponse.json({ data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
