import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 200
        c.CopyID,
        c.CopyBarcode         AS ItemBarcode,
        c.CallNumber,
        c.DateOut             AS CheckoutDate,
        c.DateDue             AS DueDate,
        p.LastName,
        p.FirstName,
        p.EmailAddress1       AS Email,
        sp.PatronBarcode,
        bm.Title,
        bm.Author,
        cs.SiteName,
        CASE WHEN c.DateDue < GETDATE() THEN 1 ELSE 0 END AS IsOverdue,
        DATEDIFF(day, c.DateDue, GETDATE())               AS DaysOverdue
      FROM Copy c
      JOIN Patron p   ON c.PatronID = p.PatronID
      JOIN BibMaster bm ON c.BibID = bm.BibID
      LEFT JOIN SitePatron sp ON c.PatronID = sp.PatronID AND c.SiteID = sp.SiteID
      LEFT JOIN ConfigSite cs ON c.SiteID = cs.SiteID
      WHERE c.PatronID IS NOT NULL
        AND c.DateReturned IS NULL
      ORDER BY c.DateDue ASC
    `);
    return NextResponse.json({ items: result.recordset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
