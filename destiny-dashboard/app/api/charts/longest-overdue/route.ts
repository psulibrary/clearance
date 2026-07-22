import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { cacheKey, cacheGet, cacheSet } from '@/lib/cache';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') ?? '10', 10)));
  const key = cacheKey('/api/charts/longest-overdue', searchParams);

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const req = pool.request();
    req.input('limit', sql.Int, limit);

    const result = await req.query(`
      SELECT TOP (@limit)
        c.CopyBarcode,
        bm.Title,
        ISNULL(bm.Author, 'Unknown')                AS Author,
        sp.PatronBarcode,
        ISNULL(pt.PatronTypeDescription, 'Unknown') AS PatronType,
        CONVERT(varchar(10), c.DateDue, 23)          AS DateDue,
        DATEDIFF(day, c.DateDue, GETDATE())          AS DaysOverdue,
        ISNULL(c.Price / 100.0, 0)                  AS ReplacementCost
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm   ON bm.BibID = c.BibID
      JOIN ${t(p,'SitePatron')} sp  ON sp.PatronID = c.PatronID AND sp.SiteID = c.SiteID
      LEFT JOIN ${t(p,'PatronType')} pt ON sp.PatronTypeID = pt.PatronTypeID
      WHERE c.DateReturned IS NULL
        AND c.DateWithdrawn IS NULL
        AND c.PatronID IS NOT NULL
        AND c.DateDue IS NOT NULL
        AND DATEDIFF(day, c.DateDue, GETDATE()) >= 1
      ORDER BY DaysOverdue DESC
    `);

    cacheSet(key, result.recordset);
    return NextResponse.json(result.recordset);
  } catch (err: unknown) {
    const cached = await cacheGet(key);
    if (cached) return NextResponse.json(cached.payload);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
