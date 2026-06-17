import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT TOP 15
        ISNULL(pt.PatronTypeDescription, 'Unassigned')                                                     AS patronType,
        COUNT(DISTINCT sp.PatronID)                                                                         AS totalPatrons,
        COUNT(DISTINCT CASE WHEN c.PatronID IS NOT NULL AND c.DateReturned IS NULL AND c.DateWithdrawn IS NULL THEN sp.PatronID END) AS activePatrons,
        COUNT(CASE WHEN c.PatronID IS NOT NULL AND c.DateWithdrawn IS NULL THEN c.CopyID END)               AS totalCheckouts,
        COUNT(CASE WHEN c.PatronID IS NOT NULL AND c.DateReturned IS NULL AND c.DateWithdrawn IS NULL AND c.DateDue < GETDATE() THEN c.CopyID END) AS overdueItems
      FROM ${t(p,'SitePatron')} sp
      LEFT JOIN ${t(p,'PatronType')} pt  ON sp.PatronTypeID = pt.PatronTypeID
      LEFT JOIN ${t(p,'Patron')} pa      ON sp.PatronID = pa.PatronID
      LEFT JOIN ${t(p,'Copy')} c         ON c.PatronID = sp.PatronID
      GROUP BY pt.PatronTypeDescription
      ORDER BY totalPatrons DESC
    `);

    const data = result.recordset.map((r: {
      patronType: string; totalPatrons: number; activePatrons: number;
      totalCheckouts: number; overdueItems: number;
    }) => ({
      name:               r.patronType,
      totalPatrons:       r.totalPatrons,
      activePatrons:      r.activePatrons,
      totalCheckouts:     r.totalCheckouts,
      overdueItems:       r.overdueItems,
      activeRate:         r.totalPatrons ? parseFloat((r.activePatrons / r.totalPatrons * 100).toFixed(1)) : 0,
      checkoutsPerPatron: r.totalPatrons ? parseFloat((r.totalCheckouts / r.totalPatrons).toFixed(2)) : 0,
    }));

    return NextResponse.json({ data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
