import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search') || '';
  try {
    const pool = await getPool();

    const queries = [
      `SELECT TOP 100
         t.TitleID, t.Title, t.Author, t.ISBN, t.CallNumber,
         COUNT(c.CopyID) as TotalCopies,
         SUM(CASE WHEN ch.ReturnDate IS NULL AND ch.CheckoutDate IS NOT NULL THEN 1 ELSE 0 END) as CheckedOut
       FROM Title t
       LEFT JOIN Copy c ON t.TitleID = c.TitleID
       LEFT JOIN Checkout ch ON c.CopyID = ch.CopyID
       WHERE ${search ? `(t.Title LIKE '%${search.replace(/'/g, "''")}%' OR t.Author LIKE '%${search.replace(/'/g, "''")}%')` : '1=1'}
       GROUP BY t.TitleID, t.Title, t.Author, t.ISBN, t.CallNumber
       ORDER BY t.Title`,
    ];

    let result;
    for (const q of queries) {
      try {
        result = await pool.request().query(q);
        break;
      } catch {
        continue;
      }
    }

    if (!result) {
      return NextResponse.json({ items: [], message: 'Title/Copy tables not found.' });
    }

    return NextResponse.json({ items: result.recordset });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
