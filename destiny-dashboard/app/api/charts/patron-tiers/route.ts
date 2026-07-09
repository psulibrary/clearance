import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { getRoomUseConfig } from '@/lib/audit-room-use';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10);

  if (isNaN(year) || year < 1900 || year > 9999) {
    return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const cfg = await getRoomUseConfig();
    const req = pool.request();
    req.input('year', sql.Int, year);

    // Patrons active via checkout this year
    const checkoutActive = await req.query(`
      SELECT COUNT(DISTINCT PatronID) AS cnt
      FROM ${t(p, 'Copy')}
      WHERE DateWithdrawn IS NULL AND PatronID IS NOT NULL
        AND (
          (DateReturned IS NOT NULL AND YEAR(DateReturned) = @year)
          OR (DateReturned IS NULL AND YEAR(DateOut) = @year)
        )
    `);
    let activeThisYear: number = checkoutActive.recordset[0]?.cnt ?? 0;

    // Patrons active via room use this year
    let roomUsePatronsThisYear = 0;
    if (cfg) {
      try {
        const ru = await pool.request().input('year2', sql.Int, year).query(`
          SELECT COUNT(DISTINCT PatronID) AS cnt
          FROM ${t(p, 'Audit')}
          WHERE TransType = ${cfg.checkInType} AND TransModifier = ${cfg.inLibMod}
            AND YEAR(Created) = @year2 AND PatronID IS NOT NULL
        `);
        roomUsePatronsThisYear = ru.recordset[0]?.cnt ?? 0;
      } catch { /* skip */ }
    }

    // Combined active = checkout OR room use (use the larger; exact union needs subquery)
    // Best approximation without a full UNION: use combined-use API logic
    if (cfg && roomUsePatronsThisYear > 0) {
      try {
        const combined = await pool.request().input('y', sql.Int, year).query(`
          SELECT COUNT(DISTINCT PatronID) AS cnt
          FROM ${t(p, 'Audit')}
          WHERE PatronID IS NOT NULL AND YEAR(Created) = @y
            AND (
              TransModifier = 0
              OR (TransType = ${cfg.checkInType} AND TransModifier = ${cfg.inLibMod})
            )
        `);
        activeThisYear = combined.recordset[0]?.cnt ?? activeThisYear;
      } catch { /* fall back to max */
        activeThisYear = Math.max(activeThisYear, roomUsePatronsThisYear);
      }
    }

    // Patrons with NO checkout AND NO room use = "never used"
    const neverUsedRes = await pool.request().query(`
      SELECT COUNT(*) AS cnt
      FROM ${t(p, 'Patron')} p
      WHERE NOT EXISTS (
        SELECT 1 FROM ${t(p, 'Copy')} c WHERE c.PatronID = p.PatronID
      )
      ${cfg ? `AND NOT EXISTS (
        SELECT 1 FROM ${t(p, 'Audit')} a
        WHERE a.PatronID = p.PatronID
          AND a.TransType = ${cfg.checkInType} AND a.TransModifier = ${cfg.inLibMod}
      )` : ''}
    `);
    const neverBorrowed = neverUsedRes.recordset[0]?.cnt ?? 0;

    const totalRes = await pool.request().query(`SELECT COUNT(*) AS cnt FROM ${t(p, 'Patron')}`);
    const totalPatrons = totalRes.recordset[0]?.cnt ?? 0;

    const newRes = await pool.request().input('y3', sql.Int, year).query(`
      SELECT COUNT(*) AS cnt FROM ${t(p, 'Patron')}
      WHERE Created IS NOT NULL AND YEAR(Created) = @y3
    `);
    const newThisYear = newRes.recordset[0]?.cnt ?? 0;

    const lapsed = Math.max(0, totalPatrons - activeThisYear - neverBorrowed);

    return NextResponse.json({
      totalPatrons,
      activeThisYear,
      lapsed,
      neverBorrowed,
      newThisYear,
      year,
      roomUseAware: cfg !== null,
      roomUsePatronsThisYear,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
