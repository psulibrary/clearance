import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const year = new Date().getFullYear();
    const req = pool.request();
    req.input('year', sql.Int, year);

    const result = await req.query(`
      SELECT
        /* Active borrowers: patrons with checkout activity this year */
        (SELECT COUNT(DISTINCT PatronID) FROM ${t(p,'Copy')}
          WHERE PatronID IS NOT NULL
            AND DateWithdrawn IS NULL
            AND (DateReturned IS NULL OR YEAR(DateReturned) = @year))
          AS activeBorrowersThisYear,

        /* Total registered patrons */
        (SELECT COUNT(*) FROM ${t(p,'Patron')})
          AS totalPatrons,

        /* Checkouts with activity this year */
        (SELECT COUNT(*) FROM ${t(p,'Copy')}
          WHERE DateWithdrawn IS NULL
            AND ((DateReturned IS NULL AND PatronID IS NOT NULL)
                 OR YEAR(DateReturned) = @year))
          AS checkoutsThisYear,

        /* Total active items */
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateWithdrawn IS NULL)
          AS totalItems,

        /* Total unique titles */
        (SELECT COUNT(DISTINCT BibID) FROM ${t(p,'BibMaster')})
          AS totalTitles,

        /* Items acquired in last 10 years (collection currency) */
        (SELECT COUNT(*) FROM ${t(p,'Copy')}
          WHERE DateWithdrawn IS NULL
            AND Acquired >= DATEADD(year, -10, GETDATE()))
          AS itemsLast10Years,

        /* Overdue items count */
        (SELECT COUNT(*) FROM ${t(p,'Copy')}
          WHERE DateReturned IS NULL
            AND DateWithdrawn IS NULL
            AND PatronID IS NOT NULL
            AND DateDue IS NOT NULL
            AND DATEDIFF(day, DateDue, GETDATE()) >= 1)
          AS overdueCount,

        /* Average days overdue (for currently overdue items) */
        (SELECT ISNULL(AVG(CAST(DATEDIFF(day, DateDue, GETDATE()) AS float)), 0)
          FROM ${t(p,'Copy')}
          WHERE DateReturned IS NULL
            AND DateWithdrawn IS NULL
            AND PatronID IS NOT NULL
            AND DateDue IS NOT NULL
            AND DATEDIFF(day, DateDue, GETDATE()) >= 1)
          AS avgDaysOverdue,

        /* Fine revenue this year */
        (SELECT ISNULL(SUM(Amount), 0) / 100.0
          FROM ${t(p,'Fine')}
          WHERE YEAR(DateCharged) = @year)
          AS fineRevenueThisYear,

        /* New patron registrations this year */
        (SELECT COUNT(*) FROM ${t(p,'Patron')}
          WHERE YEAR(DateEntered) = @year)
          AS newPatronsThisYear
    `);

    return NextResponse.json({ ...result.recordset[0], year });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
