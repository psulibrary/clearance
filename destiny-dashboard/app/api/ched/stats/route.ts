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
          AS itemsLast10Years,

        /* §5.a.iii Interlibrary loans */
        (SELECT COUNT(*) FROM ${t(p,'CrossDistrictLoan')})
          AS totalILL,
        (SELECT COUNT(*) FROM ${t(p,'CrossDistrictLoan')}
           WHERE YEAR(DateShipped) = @currentYear)
          AS illThisYear,

        /* Circulation types count */
        (SELECT COUNT(*) FROM ${t(p,'CircType')})
          AS totalCircTypes
    `);

    return NextResponse.json({ ...result.recordset[0], year: currentYear });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
