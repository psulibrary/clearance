import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getPool, sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search') || '';

  try {
    const pool = await getPool();
    const req = pool.request();

    const whereClause = search
      ? `WHERE (bm.Title LIKE @search OR bm.Author LIKE @search OR bm.DisplayableISBNOrISSN LIKE @search)`
      : '';

    if (search) {
      req.input('search', sql.NVarChar, `%${search}%`);
    }

    const result = await req.query(`
      SELECT TOP 100
        bm.BibID,
        bm.Title,
        bm.Author,
        bm.PublicationYear,
        bm.Publisher,
        bm.DisplayableISBNOrISSN        AS ISBN,
        bm.DefaultCallNumber            AS CallNumber,
        COUNT(DISTINCT c.CopyID)        AS TotalCopies,
        SUM(CASE WHEN c.PatronID IS NOT NULL AND c.DateReturned IS NULL THEN 1 ELSE 0 END) AS CheckedOut
      FROM BibMaster bm
      LEFT JOIN Copy c ON bm.BibID = c.BibID AND c.DateWithdrawn IS NULL
      ${whereClause}
      GROUP BY bm.BibID, bm.Title, bm.Author, bm.PublicationYear, bm.Publisher,
               bm.DisplayableISBNOrISSN, bm.DefaultCallNumber
      ORDER BY bm.Title
    `);

    return NextResponse.json({ items: result.recordset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
