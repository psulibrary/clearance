import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const req = pool.request();
    req.input('baseYear', sql.Int, new Date().getFullYear() - 4);

    // Discover in-library modifier from Audit (same pattern as room-use API)
    let inLibMod: number | null = null;
    let checkInType: number = 2;
    try {
      const combosRes = await pool.request().query(`
        SELECT TransType, TransModifier, COUNT(*) AS cnt
        FROM ${t(p, 'Audit')}
        WHERE TransType != 30
        GROUP BY TransType, TransModifier
      `);
      const combos: { TransType: number; TransModifier: number; cnt: number }[] = combosRes.recordset;
      const modTotals: Record<number, number> = {};
      for (const c of combos) {
        if (c.TransModifier === 0) continue;
        modTotals[c.TransModifier] = (modTotals[c.TransModifier] ?? 0) + c.cnt;
      }
      const sorted = Object.entries(modTotals).sort((a, b) => Number(b[1]) - Number(a[1]));
      if (sorted.length > 0) {
        inLibMod = Number(sorted[0][0]);
        const hasCheckIn = combos.find(c => c.TransModifier === inLibMod && c.TransType === 2);
        checkInType = hasCheckIn ? 2 : (combos.find(c => c.TransModifier === inLibMod)?.TransType ?? 2);
      }
    } catch (_) { /* Audit may not be present */ }

    req.input('mod', sql.Int, inLibMod ?? -1);
    req.input('typ', sql.TinyInt, checkInType);

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
      RoomUse AS (
        SELECT YEAR(Created) AS yr, COUNT(*) AS cnt
        FROM ${t(p, 'Audit')}
        WHERE TransType = @typ AND TransModifier = @mod
          AND YEAR(Created) >= @baseYear
        GROUP BY YEAR(Created)
      ),
      ActiveUsers AS (
        SELECT YEAR(Created) AS yr, COUNT(DISTINCT PatronID) AS cnt
        FROM ${t(p, 'Audit')}
        WHERE PatronID IS NOT NULL
          AND YEAR(Created) >= @baseYear
          AND (TransModifier = 0 OR (TransType = @typ AND TransModifier = @mod))
        GROUP BY YEAR(Created)
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
        ISNULL(ru.cnt, 0)             AS roomUse,
        ISNULL(au.cnt, 0)             AS activeUsers,
        ISNULL(pc.cnt, 0)             AS newPatrons,
        ISNULL(ic.cnt, 0)             AS newItems
      FROM Years y
      LEFT JOIN Circ c          ON c.yr  = y.yr
      LEFT JOIN RoomUse ru      ON ru.yr = y.yr
      LEFT JOIN ActiveUsers au  ON au.yr = y.yr
      LEFT JOIN PatronCounts pc ON pc.yr = y.yr
      LEFT JOIN ItemCounts ic   ON ic.yr = y.yr
      GROUP BY y.yr, ru.cnt, au.cnt, pc.cnt, ic.cnt
      ORDER BY y.yr ASC
    `);

    const years = result.recordset.map((r: {
      year: number; checkouts: number; roomUse: number;
      activeUsers: number; newPatrons: number; newItems: number;
    }) => ({
      year:        r.year,
      checkouts:   r.checkouts,
      roomUse:     r.roomUse,
      totalUse:    r.checkouts + r.roomUse,
      activeUsers: r.activeUsers,
      newPatrons:  r.newPatrons,
      newItems:    r.newItems,
    }));

    return NextResponse.json({ years, roomUseAware: inLibMod !== null });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
