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
    req.input('lastYear', sql.Int, year - 1);

    const result = await req.query(`
      WITH active_last AS (
        SELECT DISTINCT PatronID FROM ${t(p,'Copy')}
        WHERE PatronID IS NOT NULL AND YEAR(DateReturned) = @lastYear
      ),
      active_this AS (
        SELECT DISTINCT PatronID FROM ${t(p,'Copy')}
        WHERE PatronID IS NOT NULL
          AND (YEAR(DateReturned) = @year OR (DateReturned IS NULL AND DateWithdrawn IS NULL))
      ),
      lapsed AS (
        SELECT al.PatronID FROM active_last al
        WHERE NOT EXISTS (SELECT 1 FROM active_this at2 WHERE at2.PatronID = al.PatronID)
      )
      SELECT
        (SELECT COUNT(*) FROM active_last)  AS activeLastYear,
        (SELECT COUNT(*) FROM active_this)  AS activeThisYear,
        (SELECT COUNT(*) FROM lapsed)       AS lapsedCount
    `);

    const r = result.recordset[0];
    const lapsedRate = r.activeLastYear > 0
      ? parseFloat(((r.lapsedCount / r.activeLastYear) * 100).toFixed(1))
      : 0;

    // Lapsed by patron type
    const byType = await pool.request()
      .input('y', sql.Int, year)
      .input('ly', sql.Int, year - 1)
      .query(`
        WITH active_last AS (
          SELECT DISTINCT PatronID FROM ${t(p,'Copy')}
          WHERE PatronID IS NOT NULL AND YEAR(DateReturned) = @ly
        ),
        active_this AS (
          SELECT DISTINCT PatronID FROM ${t(p,'Copy')}
          WHERE PatronID IS NOT NULL
            AND (YEAR(DateReturned) = @y OR (DateReturned IS NULL AND DateWithdrawn IS NULL))
        ),
        lapsed AS (
          SELECT al.PatronID FROM active_last al
          WHERE NOT EXISTS (SELECT 1 FROM active_this at2 WHERE at2.PatronID = al.PatronID)
        )
        SELECT
          ISNULL(pt.PatronTypeDescription, 'Unknown') AS patronType,
          COUNT(*) AS lapsedCount
        FROM lapsed l
        JOIN ${t(p,'SitePatron')} sp ON sp.PatronID = l.PatronID
        LEFT JOIN ${t(p,'PatronType')} pt ON pt.PatronTypeID = sp.PatronTypeID
        GROUP BY pt.PatronTypeDescription
        ORDER BY lapsedCount DESC
      `);

    return NextResponse.json({ ...r, lapsedRate, year, byType: byType.recordset });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
