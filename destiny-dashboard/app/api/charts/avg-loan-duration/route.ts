import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();

    const result = await pool.request().query(`
      SELECT
        ISNULL(pt.PatronTypeDescription, 'Unknown') AS patronType,
        COUNT(*)                                     AS totalReturned,
        AVG(CAST(DATEDIFF(day, c.DateCheckedOut, c.DateReturned) AS float)) AS avgDays,
        AVG(CAST(DATEDIFF(day, c.DateCheckedOut, c.DateDue) AS float))      AS avgLoanPeriod
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'SitePatron')} sp ON sp.PatronID = c.PatronID AND sp.SiteID = c.SiteID
      LEFT JOIN ${t(p,'PatronType')} pt ON pt.PatronTypeID = sp.PatronTypeID
      WHERE c.DateReturned IS NOT NULL
        AND c.DateCheckedOut IS NOT NULL
        AND c.DateWithdrawn IS NULL
        AND DATEDIFF(day, c.DateCheckedOut, c.DateReturned) BETWEEN 0 AND 365
      GROUP BY pt.PatronTypeDescription
      ORDER BY avgDays DESC
    `);

    const overall = await pool.request().query(`
      SELECT
        AVG(CAST(DATEDIFF(day, DateCheckedOut, DateReturned) AS float)) AS avgDays,
        AVG(CAST(DATEDIFF(day, DateCheckedOut, DateDue) AS float))      AS avgLoanPeriod,
        COUNT(*) AS totalReturned
      FROM ${t(p,'Copy')}
      WHERE DateReturned IS NOT NULL
        AND DateCheckedOut IS NOT NULL
        AND DateWithdrawn IS NULL
        AND DATEDIFF(day, DateCheckedOut, DateReturned) BETWEEN 0 AND 365
    `);

    return NextResponse.json({
      byPatronType: result.recordset,
      overall: overall.recordset[0],
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
