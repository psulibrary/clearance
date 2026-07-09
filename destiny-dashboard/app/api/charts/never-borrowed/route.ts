import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();

    // Count never-borrowed by Dewey range
    const byDewey = await pool.request().query(`
      SELECT
        LEFT(LTRIM(c.CallNumber), 1)  AS firstDigit,
        COUNT(DISTINCT bm.BibID)       AS neverBorrowedTitles,
        COUNT(c.CopyID)                AS neverBorrowedItems
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
        AND c.PatronID IS NULL
        AND c.DateReturned IS NULL
        AND c.CallNumber IS NOT NULL AND c.CallNumber != ''
        AND LEFT(LTRIM(c.CallNumber), 1) BETWEEN '0' AND '9'
      GROUP BY LEFT(LTRIM(c.CallNumber), 1)
      ORDER BY neverBorrowedItems DESC
    `);

    // Overall totals
    const totals = await pool.request().query(`
      SELECT
        COUNT(DISTINCT bm.BibID) AS totalTitles,
        COUNT(c.CopyID)          AS totalItems,
        SUM(CASE WHEN c.PatronID IS NULL AND c.DateReturned IS NULL THEN 1 ELSE 0 END) AS neverBorrowedItems,
        COUNT(DISTINCT CASE WHEN c.PatronID IS NULL AND c.DateReturned IS NULL THEN bm.BibID END) AS neverBorrowedTitles
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
    `);

    return NextResponse.json({ byDewey: byDewey.recordset, totals: totals.recordset[0] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
