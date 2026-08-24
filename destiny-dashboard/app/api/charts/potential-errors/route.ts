import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { cacheKey, cacheGet, cacheSet } from '@/lib/cache';

// Mirrors Destiny's "Collection by Year > Potential Errors" bucket (blank/
// future publication year) plus three more cataloging-integrity checks:
// duplicate bib records (same title under different BibIDs — usually a
// new copy accidentally catalogued as a new title instead of added to the
// existing one), duplicate barcodes (should never happen — a scanning or
// re-issue mistake), and copies with no call number at all. Each has its
// own limit param so the page load stays light but a per-section export
// button can pull the full set.
export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const capped = (param: string, def: number, max = 5000) => Math.min(max, Math.max(5, parseInt(searchParams.get(param) ?? String(def), 10)));
  const limit = capped('limit', 25);
  const dupTitleLimit = capped('dupTitleLimit', 100);
  const dupBarcodeLimit = capped('dupBarcodeLimit', 100);
  const missingCallNumberLimit = capped('missingCallNumberLimit', 25);
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

    // Duplicate bib records: same normalized title under 2+ different
    // BibIDs. Flat rows here (not pre-grouped) — the client groups by
    // normTitle so it can render each cluster together.
    const dupTitleReq = pool.request();
    dupTitleReq.input('dupTitleLimit', sql.Int, dupTitleLimit);
    const dupTitles = await dupTitleReq.query(`
      WITH BibAgg AS (
        SELECT bm.BibID, bm.Title, ISNULL(bm.Author,'Unknown') AS Author, bm.PublicationYear,
               bm.DisplayableISBNOrISSN AS ISBN, bm.DefaultCallNumber AS CallNumber,
               COUNT(c.CopyID) AS itemCount,
               LOWER(LTRIM(RTRIM(bm.Title))) AS normTitle
        FROM ${t(p,'BibMaster')} bm
        LEFT JOIN ${t(p,'Copy')} c ON c.BibID = bm.BibID AND c.DateWithdrawn IS NULL
        WHERE bm.Title IS NOT NULL AND LTRIM(RTRIM(bm.Title)) != ''
        GROUP BY bm.BibID, bm.Title, bm.Author, bm.PublicationYear, bm.DisplayableISBNOrISSN, bm.DefaultCallNumber
      ),
      Dupes AS (
        SELECT normTitle FROM BibAgg GROUP BY normTitle HAVING COUNT(*) > 1
      )
      SELECT TOP (@dupTitleLimit) b.*
      FROM BibAgg b
      JOIN Dupes d ON d.normTitle = b.normTitle
      ORDER BY b.normTitle, b.BibID
    `);

    // Duplicate barcodes: the same CopyBarcode on more than one active
    // copy. Flat per-copy rows so the client can group by barcode and
    // show which (possibly different!) titles are colliding.
    const dupBarcodeReq = pool.request();
    dupBarcodeReq.input('dupBarcodeLimit', sql.Int, dupBarcodeLimit);
    const dupBarcodes = await dupBarcodeReq.query(`
      WITH Dup AS (
        SELECT CopyBarcode FROM ${t(p,'Copy')}
        WHERE DateWithdrawn IS NULL AND CopyBarcode IS NOT NULL AND CopyBarcode != ''
        GROUP BY CopyBarcode HAVING COUNT(*) > 1
      )
      SELECT TOP (@dupBarcodeLimit) c.CopyBarcode AS Barcode, bm.Title, ISNULL(bm.Author,'Unknown') AS Author, c.BibID
      FROM ${t(p,'Copy')} c
      JOIN Dup d ON d.CopyBarcode = c.CopyBarcode
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
      ORDER BY c.CopyBarcode
    `);

    // Missing call number: active copies with a blank/null CallNumber —
    // effectively unshelvable/unbrowsable.
    const missingCallNumberCountRes = await pool.request().query(`
      SELECT COUNT(*) AS n FROM ${t(p,'Copy')} c
      WHERE c.DateWithdrawn IS NULL AND (c.CallNumber IS NULL OR LTRIM(RTRIM(c.CallNumber)) = '')
    `);
    const missingCallNumberReq = pool.request();
    missingCallNumberReq.input('missingCallNumberLimit', sql.Int, missingCallNumberLimit);
    const missingCallNumberSamples = await missingCallNumberReq.query(`
      SELECT TOP (@missingCallNumberLimit) c.CopyBarcode AS Barcode, bm.Title, ISNULL(bm.Author,'Unknown') AS Author
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL AND (c.CallNumber IS NULL OR LTRIM(RTRIM(c.CallNumber)) = '')
      ORDER BY bm.Title
    `);

    const row = totals.recordset[0] as { totalActiveItems: number; blankPubYear: number; futurePubYear: number };
    const dupTitleBibIds = new Set((dupTitles.recordset as { BibID: number }[]).map(r => r.BibID));
    const dupBarcodeSet = new Set((dupBarcodes.recordset as { Barcode: string }[]).map(r => r.Barcode));

    const json = {
      totalActiveItems: row.totalActiveItems,
      blankPubYear: row.blankPubYear ?? 0,
      futurePubYear: row.futurePubYear ?? 0,
      samples: samples.recordset,
      duplicateTitleBibCount: dupTitleBibIds.size,
      duplicateTitleBibs: dupTitles.recordset,
      duplicateBarcodeCount: dupBarcodeSet.size,
      duplicateBarcodeCopies: dupBarcodes.recordset,
      missingCallNumberCount: (missingCallNumberCountRes.recordset[0] as { n: number }).n ?? 0,
      missingCallNumberSamples: missingCallNumberSamples.recordset,
    };
    cacheSet(key, json);
    return NextResponse.json(json);
  } catch (err: unknown) {
    const cached = await cacheGet(key);
    if (cached) return NextResponse.json(cached.payload);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
