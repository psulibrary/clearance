import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') ?? '20', 10)));

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const req = pool.request();
    req.input('limit', sql.Int, limit);

    const result = await req.query(`
      SELECT TOP (@limit)
        bm.Title,
        ISNULL(bm.Author, 'Unknown') AS Author,
        bm.BibID,
        COUNT(c.CopyID) AS checkoutCount,
        COUNT(CASE WHEN c.DateReturned IS NULL AND c.PatronID IS NOT NULL THEN 1 END) AS currentlyOut
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
        AND (c.DateReturned IS NOT NULL OR c.PatronID IS NOT NULL)
      GROUP BY bm.BibID, bm.Title, bm.Author
      ORDER BY checkoutCount DESC
    `);

    return NextResponse.json(result.recordset);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
