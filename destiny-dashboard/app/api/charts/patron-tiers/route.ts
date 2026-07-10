import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10);

  if (isNaN(year) || year < 1900 || year > 9999) {
    return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const req = pool.request();
    req.input('year', sql.Int, year);

    const result = await req.query(`
      WITH ActiveThisYear AS (
        SELECT DISTINCT PatronID
        FROM ${t(p, 'Copy')}
        WHERE DateWithdrawn IS NULL
          AND PatronID IS NOT NULL
          AND (
            (DateReturned IS NOT NULL AND YEAR(DateReturned) = @year)
            OR
            (DateReturned IS NULL AND YEAR(DateOut) = @year)
          )
      ),
      NeverBorrowed AS (
        SELECT p.PatronID
        FROM ${t(p, 'Patron')} p
        WHERE NOT EXISTS (
          SELECT 1
          FROM ${t(p, 'Copy')} c
          WHERE c.PatronID = p.PatronID
        )
      )
      SELECT
        (SELECT COUNT(*) FROM ${t(p, 'Patron')})                              AS totalPatrons,
        (SELECT COUNT(*) FROM ActiveThisYear)                                  AS activeThisYear,
        (SELECT COUNT(*) FROM NeverBorrowed)                                   AS neverBorrowed,
        (SELECT COUNT(*) FROM ${t(p, 'Patron')}
          WHERE Created IS NOT NULL AND YEAR(Created) = @year)                 AS newThisYear
    `);

    const row = result.recordset[0] as {
      totalPatrons:  number;
      activeThisYear: number;
      neverBorrowed:  number;
      newThisYear:    number;
    };

    const lapsed = row.totalPatrons - row.activeThisYear - row.neverBorrowed;

    return NextResponse.json({
      totalPatrons:   row.totalPatrons,
      activeThisYear: row.activeThisYear,
      lapsed:         lapsed < 0 ? 0 : lapsed,
      neverBorrowed:  row.neverBorrowed,
      newThisYear:    row.newThisYear,
      year,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
