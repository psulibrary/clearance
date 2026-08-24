import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { cacheKey, cacheGet, cacheSet } from '@/lib/cache';

// Mirrors Destiny's "Collection by Year > Potential Errors" bucket:
// items with a blank or future publication year — usually a cataloging
// data-entry issue worth cleaning up before it skews other reports.
export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  // Default display cap stays 25; export uses a much higher explicit limit.
  const limit = Math.min(5000, Math.max(5, parseInt(searchParams.get('limit') ?? '25', 10)));
  const key = cacheKey('/api/charts/potential-errors', searchParams);

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();

    const totals = await pool.request().query(`
      SELECT
        COUNT(*) AS totalActiveItems,
        SUM(CASE WHEN bm.PublicationYear IS NULL THEN 1 ELSE 0 END) AS blankPubYear,
        SUM(CASE WHEN bm.PublicationYear IS NOT NULL AND bm.PublicationYear > YEAR(GETDATE()) THEN 1 ELSE 0 END) AS futurePubYear
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
    `);

    const samplesReq = pool.request();
    samplesReq.input('limit', sql.Int, limit);
    const samples = await samplesReq.query(`
      SELECT TOP (@limit)
        c.CopyBarcode AS Barcode,
        bm.Title,
        bm.Author,
        bm.PublicationYear,
        CASE
          WHEN bm.PublicationYear IS NULL THEN 'blank'
          WHEN bm.PublicationYear > YEAR(GETDATE()) THEN 'future'
        END AS issueType
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
        AND (bm.PublicationYear IS NULL OR bm.PublicationYear > YEAR(GETDATE()))
      ORDER BY bm.Title
    `);

    const row = totals.recordset[0] as { totalActiveItems: number; blankPubYear: number; futurePubYear: number };
    const json = {
      totalActiveItems: row.totalActiveItems,
      blankPubYear: row.blankPubYear ?? 0,
      futurePubYear: row.futurePubYear ?? 0,
      samples: samples.recordset,
    };
    cacheSet(key, json);
    return NextResponse.json(json);
  } catch (err: unknown) {
    const cached = await cacheGet(key);
    if (cached) return NextResponse.json(cached.payload);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
