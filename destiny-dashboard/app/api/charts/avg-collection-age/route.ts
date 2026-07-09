import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

const DEWEY_LABELS: Record<string, string> = {
  '0': '000s – CS & Generalities',
  '1': '100s – Philosophy',
  '2': '200s – Religion',
  '3': '300s – Social Sciences',
  '4': '400s – Language',
  '5': '500s – Pure Sciences',
  '6': '600s – Applied Sciences',
  '7': '700s – Arts',
  '8': '800s – Literature',
  '9': '900s – History',
};

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();

    const result = await pool.request().query(`
      SELECT
        LEFT(LTRIM(bm.CallNumber), 1)                           AS firstDigit,
        AVG(CAST(YEAR(GETDATE()) - YEAR(c.Acquired) AS float)) AS avgAgeYears,
        COUNT(c.CopyID)                                         AS itemCount,
        MIN(YEAR(c.Acquired))                                   AS oldestYear,
        MAX(YEAR(c.Acquired))                                   AS newestYear
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
        AND c.Acquired IS NOT NULL
        AND YEAR(c.Acquired) > 1900
        AND bm.CallNumber IS NOT NULL AND bm.CallNumber != ''
        AND LEFT(LTRIM(bm.CallNumber), 1) BETWEEN '0' AND '9'
      GROUP BY LEFT(LTRIM(bm.CallNumber), 1)
      ORDER BY firstDigit
    `);

    const rows = result.recordset.map((r: { firstDigit: string; avgAgeYears: number; itemCount: number; oldestYear: number; newestYear: number }) => ({
      range: DEWEY_LABELS[r.firstDigit] ?? `${r.firstDigit}00s`,
      firstDigit: r.firstDigit,
      avgAgeYears: parseFloat(r.avgAgeYears.toFixed(1)),
      itemCount: r.itemCount,
      oldestYear: r.oldestYear,
      newestYear: r.newestYear,
    }));

    return NextResponse.json(rows);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
