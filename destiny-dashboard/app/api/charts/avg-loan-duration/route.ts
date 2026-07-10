import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();

    // Current checkouts: DateOut is set while item is out, cleared on return
    const result = await pool.request().query(`
      SELECT
        ISNULL(pt.PatronTypeDescription, 'Unknown') AS patronType,
        COUNT(*)                                     AS currentlyOut,
        AVG(CAST(DATEDIFF(day, c.DateOut, GETDATE()) AS float))  AS avgDaysOut,
        AVG(CASE WHEN DATEDIFF(day, c.DateOut, c.DateDue) > 0 THEN CAST(DATEDIFF(day, c.DateOut, c.DateDue) AS float) ELSE NULL END) AS avgLoanPeriod,
        SUM(CASE WHEN DATEDIFF(day, c.DateDue, GETDATE()) > 0 THEN 1 ELSE 0 END) AS overdueCount
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'SitePatron')} sp ON sp.PatronID = c.PatronID AND sp.SiteID = c.SiteID
      LEFT JOIN ${t(p,'PatronType')} pt ON pt.PatronTypeID = sp.PatronTypeID
      WHERE c.PatronID IS NOT NULL
        AND c.DateReturned IS NULL
        AND c.DateWithdrawn IS NULL
        AND c.DateOut IS NOT NULL
        AND c.DateDue IS NOT NULL
      GROUP BY pt.PatronTypeDescription
      ORDER BY avgDaysOut DESC
    `);

    const overall = await pool.request().query(`
      SELECT
        COUNT(*)                                                   AS currentlyOut,
        AVG(CAST(DATEDIFF(day, DateOut, GETDATE()) AS float))     AS avgDaysOut,
        AVG(CASE WHEN DATEDIFF(day, DateOut, DateDue) > 0 THEN CAST(DATEDIFF(day, DateOut, DateDue) AS float) ELSE NULL END) AS avgLoanPeriod,
        SUM(CASE WHEN DATEDIFF(day, DateDue, GETDATE()) > 0 THEN 1 ELSE 0 END) AS overdueCount
      FROM ${t(p,'Copy')}
      WHERE PatronID IS NOT NULL
        AND DateReturned IS NULL
        AND DateWithdrawn IS NULL
        AND DateOut IS NOT NULL
        AND DateDue IS NOT NULL
    `);

    return NextResponse.json({
      byPatronType: result.recordset,
      overall: overall.recordset[0],
      note: 'Based on currently checked-out items (DateOut is cleared on return in Destiny)',
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
