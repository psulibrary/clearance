import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') ?? '10', 10)));
  const year  = new Date().getFullYear();

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const req = pool.request();
    req.input('limit', sql.Int, limit);
    req.input('year', sql.Int, year);

    const result = await req.query(`
      SELECT TOP (@limit)
        sp.PatronBarcode,
        p.LastName,
        p.FirstName,
        ISNULL(pt.PatronTypeDescription, 'Unknown') AS PatronType,
        COUNT(c.CopyID)                              AS totalCheckouts,
        COUNT(CASE WHEN YEAR(c.DateReturned) = @year
                     OR (c.DateReturned IS NULL AND c.PatronID IS NOT NULL)
                   THEN 1 END)                       AS checkoutsThisYear,
        COUNT(CASE WHEN c.DateReturned IS NULL
                    AND c.PatronID IS NOT NULL
                    AND c.DateDue IS NOT NULL
                    AND DATEDIFF(day, c.DateDue, GETDATE()) >= 1
                   THEN 1 END)                       AS overdueCount
      FROM ${t(p,'Patron')} p
      JOIN ${t(p,'SitePatron')} sp  ON sp.PatronID = p.PatronID
      LEFT JOIN ${t(p,'PatronType')} pt ON sp.PatronTypeID = pt.PatronTypeID
      LEFT JOIN ${t(p,'Copy')} c    ON c.PatronID = p.PatronID AND c.DateWithdrawn IS NULL
      GROUP BY sp.PatronBarcode, p.LastName, p.FirstName, pt.PatronTypeDescription
      HAVING COUNT(c.CopyID) > 0
      ORDER BY totalCheckouts DESC
    `);

    return NextResponse.json(result.recordset);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
