import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const years  = Math.min(10, Math.max(1, parseInt(searchParams.get('years') ?? '3', 10)));
  const limit  = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') ?? '20', 10)));

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const req = pool.request();
    req.input('years', sql.Int, years);
    req.input('limit', sql.Int, limit);

    const result = await req.query(`
      SELECT TOP (@limit)
        bm.Title,
        ISNULL(bm.Author, 'Unknown') AS Author,
        c.CallNumber,
        c.CopyBarcode,
        CONVERT(varchar(10), c.Acquired, 23)        AS Acquired,
        CONVERT(varchar(10), c.DateReturned, 23)    AS LastBorrowed,
        ISNULL(DATEDIFF(day, c.DateReturned, GETDATE()), DATEDIFF(day, c.Acquired, GETDATE())) AS daysSinceActivity,
        ISNULL(c.Price / 100.0, 0)                  AS Price
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
        AND c.PatronID IS NULL
        AND (
          c.DateReturned IS NULL
          OR DATEDIFF(year, c.DateReturned, GETDATE()) >= @years
        )
        AND DATEDIFF(year, ISNULL(c.DateReturned, c.Acquired), GETDATE()) >= @years
      ORDER BY daysSinceActivity DESC
    `);

    const summary = await pool.request().input('years2', sql.Int, years).query(`
      SELECT
        COUNT(*) AS candidateCount,
        SUM(ISNULL(Price / 100.0, 0)) AS totalValue
      FROM ${t(p,'Copy')}
      WHERE DateWithdrawn IS NULL
        AND PatronID IS NULL
        AND (
          DateReturned IS NULL
          OR DATEDIFF(year, DateReturned, GETDATE()) >= @years2
        )
        AND DATEDIFF(year, ISNULL(DateReturned, Acquired), GETDATE()) >= @years2
    `);

    return NextResponse.json({ items: result.recordset, summary: summary.recordset[0], yearsThreshold: years });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
