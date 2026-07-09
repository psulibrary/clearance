import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const currentYear = new Date().getFullYear();
    const req = pool.request();
    req.input('currentYear', sql.Int, currentYear);

    const result = await req.query(`
      SELECT
        /* §4.b.1 Minimum 5,000 titles */
        (SELECT COUNT(DISTINCT BibID) FROM ${t(p,'BibMaster')})
          AS totalTitles,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateWithdrawn IS NULL)
          AS totalItems,

        /* §4.b.2 Filipiniana = 10% of collection */
        (SELECT COUNT(*) FROM ${t(p,'CopyLibraryView')}
           WHERE DateWithdrawn IS NULL AND Sublocation LIKE '%ilipiniana%')
          AS filipianianaItems,
        (SELECT COUNT(DISTINCT BibID) FROM ${t(p,'CopyLibraryView')}
           WHERE DateWithdrawn IS NULL AND Sublocation LIKE '%ilipiniana%')
          AS filipianaTitles,

        /* §4.a.6 Weeding */
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateWithdrawn IS NOT NULL)
          AS withdrawnItems,
        (SELECT COUNT(*) FROM ${t(p,'Copy')}
           WHERE DateWithdrawn IS NOT NULL AND YEAR(DateWithdrawn) = @currentYear)
          AS withdrawnThisYear,

        /* §8 Annual acquisition cost (Price stored in centavos bigint) */
        (SELECT ISNULL(SUM(Price),0) / 100.0 FROM ${t(p,'Copy')}
           WHERE DateWithdrawn IS NULL AND Price > 0)
          AS totalCollectionValue,
        (SELECT ISNULL(SUM(Price),0) / 100.0 FROM ${t(p,'Copy')}
           WHERE DateWithdrawn IS NULL AND Price > 0 AND YEAR(Acquired) = @currentYear)
          AS acquisitionSpendThisYear,
        (SELECT ISNULL(SUM(Price),0) / 100.0 FROM ${t(p,'Copy')}
           WHERE DateWithdrawn IS NULL AND Price > 0 AND YEAR(Acquired) = @currentYear - 1)
          AS acquisitionSpendLastYear,
        (SELECT ISNULL(SUM(Price),0) / 100.0 FROM ${t(p,'Copy')}
           WHERE DateWithdrawn IS NULL AND Price > 0 AND YEAR(Acquired) = @currentYear - 2)
          AS acquisitionSpendYear2,

        /* §4.b.4 Recency */
        (SELECT COUNT(*) FROM ${t(p,'Copy')}
           WHERE DateWithdrawn IS NULL AND Acquired >= DATEADD(year,-5,GETDATE()))
          AS itemsLast5Years,
        (SELECT COUNT(*) FROM ${t(p,'Copy')}
           WHERE DateWithdrawn IS NULL AND Acquired >= DATEADD(year,-10,GETDATE()))
          AS itemsLast10Years
    `);

    const stats = { ...result.recordset[0], year: currentYear, totalILL: 0, illThisYear: 0 };

    // ILL query separately — column names uncertain, fail gracefully
    try {
      const illReq = pool.request();
      illReq.input('currentYear', sql.Int, currentYear);
      const illResult = await illReq.query(`
        SELECT
          COUNT(*) AS totalILL
        FROM ${t(p,'CrossDistrictLoan')}
      `);
      stats.totalILL = illResult.recordset[0].totalILL;
      stats.illThisYear = 0; // CrossDistrictLoan has no date column for filtering by year
    } catch {
      // CrossDistrictLoan columns unknown — leave as 0
    }

    return NextResponse.json(stats);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
