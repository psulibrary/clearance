import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

const DEWEY_LABELS: Record<string, string> = {
  '0': '000 – Computer Science & Generalities',
  '1': '100 – Philosophy & Psychology',
  '2': '200 – Religion & Theology',
  '3': '300 – Social Sciences',
  '4': '400 – Language & Linguistics',
  '5': '500 – Pure Sciences',
  '6': '600 – Applied Sciences & Technology',
  '7': '700 – Arts & Recreation',
  '8': '800 – Literature',
  '9': '900 – History & Geography',
};

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();

    const result = await pool.request().query(`
      SELECT
        LEFT(LTRIM(c.CallNumber), 1)                AS firstDigit,
        COUNT(c.CopyID)                              AS items,
        COUNT(DISTINCT c.BibID)                      AS titles,
        COUNT(CASE WHEN c.DateReturned IS NOT NULL
                     OR (c.PatronID IS NOT NULL AND c.DateReturned IS NULL)
                   THEN 1 END)                       AS checkouts
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
        AND c.CallNumber IS NOT NULL
        AND c.CallNumber != ''
        AND LEFT(LTRIM(c.CallNumber), 1) BETWEEN '0' AND '9'
      GROUP BY LEFT(LTRIM(c.CallNumber), 1)
      ORDER BY firstDigit
    `);

    const rows = result.recordset.map((r: { firstDigit: string; items: number; titles: number; checkouts: number }) => ({
      range:     DEWEY_LABELS[r.firstDigit] ?? `${r.firstDigit}00s`,
      firstDigit: r.firstDigit,
      items:     r.items,
      titles:    r.titles,
      checkouts: r.checkouts,
      utilRate:  r.items > 0 ? parseFloat(((r.checkouts / r.items) * 100).toFixed(1)) : 0,
    }));

    return NextResponse.json(rows);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
