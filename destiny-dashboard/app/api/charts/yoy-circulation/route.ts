import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const req = pool.request();
    req.input('baseYear', sql.Int, new Date().getFullYear() - 4);

    const result = await req.query(`
      WITH Years AS (
        SELECT YEAR(GETDATE())     AS yr UNION ALL
        SELECT YEAR(GETDATE()) - 1 UNION ALL
        SELECT YEAR(GETDATE()) - 2 UNION ALL
        SELECT YEAR(GETDATE()) - 3 UNION ALL
        SELECT YEAR(GETDATE()) - 4
      ),
      Circ AS (
        SELECT
          CASE
            WHEN DateReturned IS NOT NULL THEN YEAR(DateReturned)
            ELSE YEAR(DateOut)
          END AS yr,
          CopyID
        FROM ${t(p, 'Copy')}
        WHERE DateWithdrawn IS NULL
          AND (
            (DateReturned IS NOT NULL AND YEAR(DateReturned) >= @baseYear)
            OR
            (DateReturned IS NULL AND PatronID IS NOT NULL AND YEAR(DateOut) >= @baseYear)
          )
      ),
      PatronCounts AS (
        SELECT YEAR(Created) AS yr, COUNT(*) AS cnt
        FROM ${t(p, 'Patron')}
        WHERE Created IS NOT NULL AND YEAR(Created) >= @baseYear
        GROUP BY YEAR(Created)
      ),
      ItemCounts AS (
        SELECT YEAR(Created) AS yr, COUNT(*) AS cnt
        FROM ${t(p, 'Copy')}
        WHERE DateWithdrawn IS NULL AND Created IS NOT NULL AND YEAR(Created) >= @baseYear
        GROUP BY YEAR(Created)
      )
      SELECT
        y.yr                          AS year,
        COUNT(c.CopyID)               AS checkouts,
        ISNULL(pc.cnt, 0)             AS newPatrons,
        ISNULL(ic.cnt, 0)             AS newItems
      FROM Years y
      LEFT JOIN Circ c         ON c.yr  = y.yr
      LEFT JOIN PatronCounts pc ON pc.yr = y.yr
      LEFT JOIN ItemCounts ic   ON ic.yr = y.yr
      GROUP BY y.yr, pc.cnt, ic.cnt
      ORDER BY y.yr ASC
    `);

    const years = result.recordset.map((r: {
      year: number;
      checkouts: number;
      newPatrons: number;
      newItems: number;
    }) => ({
      year:       r.year,
      checkouts:  r.checkouts,
      newPatrons: r.newPatrons,
      newItems:   r.newItems,
    }));

    return NextResponse.json({ years });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
