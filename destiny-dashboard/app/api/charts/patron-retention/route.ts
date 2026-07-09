import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { getRoomUseConfig } from '@/lib/audit-room-use';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const cfg = await getRoomUseConfig();
    const year = new Date().getFullYear();
    const req = pool.request();
    req.input('year', sql.Int, year);
    req.input('lastYear', sql.Int, year - 1);

    // Checkout-based active sets (always available)
    const checkoutResult = await req.query(`
      WITH last_year AS (
        SELECT DISTINCT PatronID FROM ${t(p,'Copy')}
        WHERE PatronID IS NOT NULL AND YEAR(DateReturned) = @lastYear
      ),
      this_year AS (
        SELECT DISTINCT PatronID FROM ${t(p,'Copy')}
        WHERE PatronID IS NOT NULL
          AND (YEAR(DateReturned) = @year OR (DateReturned IS NULL AND DateWithdrawn IS NULL))
      )
      SELECT
        (SELECT COUNT(*) FROM last_year)                                         AS activeLastYear,
        (SELECT COUNT(*) FROM this_year)                                         AS activeThisYear,
        (SELECT COUNT(*) FROM this_year ty WHERE EXISTS
          (SELECT 1 FROM last_year ly WHERE ly.PatronID = ty.PatronID))          AS retained,
        (SELECT COUNT(*) FROM this_year ty WHERE NOT EXISTS
          (SELECT 1 FROM last_year ly WHERE ly.PatronID = ty.PatronID))          AS newBorrowers
    `);

    let r = checkoutResult.recordset[0];
    let roomUseAware = false;

    if (cfg) {
      try {
        const ruResult = await pool.request()
          .input('y', sql.Int, year)
          .input('ly', sql.Int, year - 1)
          .query(`
            WITH last_year AS (
              SELECT DISTINCT PatronID FROM ${t(p,'Copy')}
              WHERE PatronID IS NOT NULL AND YEAR(DateReturned) = @ly
              UNION
              SELECT DISTINCT PatronID FROM ${t(p,'Audit')}
              WHERE PatronID IS NOT NULL AND YEAR(Created) = @ly
                AND TransType = ${cfg.checkInType} AND TransModifier = ${cfg.inLibMod}
                AND DATEPART(hour, Created) >= 8 AND DATEPART(hour, Created) < 19
            ),
            this_year AS (
              SELECT DISTINCT PatronID FROM ${t(p,'Copy')}
              WHERE PatronID IS NOT NULL
                AND (YEAR(DateReturned) = @y OR (DateReturned IS NULL AND DateWithdrawn IS NULL))
              UNION
              SELECT DISTINCT PatronID FROM ${t(p,'Audit')}
              WHERE PatronID IS NOT NULL AND YEAR(Created) = @y
                AND TransType = ${cfg.checkInType} AND TransModifier = ${cfg.inLibMod}
                AND DATEPART(hour, Created) >= 8 AND DATEPART(hour, Created) < 19
            )
            SELECT
              (SELECT COUNT(*) FROM last_year)                                         AS activeLastYear,
              (SELECT COUNT(*) FROM this_year)                                         AS activeThisYear,
              (SELECT COUNT(*) FROM this_year ty WHERE EXISTS
                (SELECT 1 FROM last_year ly WHERE ly.PatronID = ty.PatronID))          AS retained,
              (SELECT COUNT(*) FROM this_year ty WHERE NOT EXISTS
                (SELECT 1 FROM last_year ly WHERE ly.PatronID = ty.PatronID))          AS newBorrowers
          `);
        r = ruResult.recordset[0];
        roomUseAware = true;
      } catch { /* fall through to checkout-only */ }
    }

    const retentionRate = r.activeLastYear > 0
      ? parseFloat(((r.retained / r.activeLastYear) * 100).toFixed(1))
      : 0;
    return NextResponse.json({ ...r, retentionRate, year, roomUseAware });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
