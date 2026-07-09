import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

// Returns combined use statistics where "borrow" = checkout OR in-library room use.
// Used to correct metrics that previously only counted checkouts.
export async function GET(request: NextRequest) {
  const year = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()));

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();

    // Discover in-library modifier from Audit (same logic as room-use API)
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

    const req = pool.request();
    req.input('year', sql.Int, year);

    if (inLibMod === null) {
      // Fallback: no room use data, return checkout-only stats with flag
      const r = await req.query(`
        SELECT
          COUNT(DISTINCT CASE WHEN YEAR(a.DateOut) = @year OR YEAR(a.DateReturned) = @year THEN a.PatronID END) AS activeUsersThisYear,
          COUNT(DISTINCT CASE WHEN a.PatronID IS NOT NULL THEN a.PatronID END) AS usersWithAnyCheckout,
          COUNT(CASE WHEN c.TimesCheckedOut = 0 OR c.TimesCheckedOut IS NULL THEN 1 END) AS neverUsedItems,
          COUNT(*) AS totalItems
        FROM ${t(p, 'Copy')} c
        LEFT JOIN ${t(p, 'Audit')} a ON a.CopyID = c.CopyID
        WHERE c.DateWithdrawn IS NULL
      `);
      return NextResponse.json({
        year,
        roomUseAware: false,
        activeUsersThisYear: r.recordset[0]?.activeUsersThisYear ?? 0,
        usersWithAnyCheckout: r.recordset[0]?.usersWithAnyCheckout ?? 0,
        roomUseOnlyUsersThisYear: 0,
        neverUsedItems: r.recordset[0]?.neverUsedItems ?? 0,
        totalItems: r.recordset[0]?.totalItems ?? 0,
      });
    }

    req.input('mod', sql.Int, inLibMod);
    req.input('typ', sql.TinyInt, checkInType);

    // Patrons who checked out this year
    const checkoutPatrons = await req.query(`
      SELECT COUNT(DISTINCT PatronID) AS cnt
      FROM ${t(p, 'Audit')}
      WHERE TransModifier = 0
        AND PatronID IS NOT NULL
        AND YEAR(Created) = @year
    `);

    // Patrons who used room use this year
    const roomUsePatrons = await req.query(`
      SELECT COUNT(DISTINCT PatronID) AS cnt
      FROM ${t(p, 'Audit')}
      WHERE TransType = @typ AND TransModifier = @mod
        AND PatronID IS NOT NULL
        AND YEAR(Created) = @year
    `);

    // Patrons who ONLY used room use this year (no checkout this year)
    const roomOnlyPatrons = await req.query(`
      SELECT COUNT(DISTINCT ru.PatronID) AS cnt
      FROM (
        SELECT DISTINCT PatronID FROM ${t(p, 'Audit')}
        WHERE TransType = @typ AND TransModifier = @mod
          AND PatronID IS NOT NULL AND YEAR(Created) = @year
      ) ru
      WHERE ru.PatronID NOT IN (
        SELECT DISTINCT PatronID FROM ${t(p, 'Audit')}
        WHERE TransModifier = 0 AND PatronID IS NOT NULL AND YEAR(Created) = @year
      )
    `);

    // Active users this year = checked out OR used room use
    const activeUsers = await req.query(`
      SELECT COUNT(DISTINCT PatronID) AS cnt
      FROM ${t(p, 'Audit')}
      WHERE PatronID IS NOT NULL
        AND YEAR(Created) = @year
        AND (
          TransModifier = 0
          OR (TransType = @typ AND TransModifier = @mod)
        )
    `);

    // Items never used at all: no checkout (TimesCheckedOut=0 or null) AND no room-use Audit record
    const neverUsed = await req.query(`
      SELECT COUNT(*) AS cnt
      FROM ${t(p, 'Copy')} c
      WHERE c.DateWithdrawn IS NULL
        AND (c.TimesCheckedOut = 0 OR c.TimesCheckedOut IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM ${t(p, 'Audit')} a
          WHERE a.CopyID = c.CopyID
            AND a.TransType = @typ AND a.TransModifier = @mod
        )
    `);

    // Items with room use only this year (no checkout but had in-library use)
    const roomUseOnlyItems = await req.query(`
      SELECT COUNT(DISTINCT a.CopyID) AS cnt
      FROM ${t(p, 'Audit')} a
      JOIN ${t(p, 'Copy')} c ON c.CopyID = a.CopyID
      WHERE a.TransType = @typ AND a.TransModifier = @mod
        AND YEAR(a.Created) = @year
        AND (c.TimesCheckedOut = 0 OR c.TimesCheckedOut IS NULL)
        AND c.DateWithdrawn IS NULL
    `);

    return NextResponse.json({
      year,
      roomUseAware: true,
      checkoutPatronsThisYear: checkoutPatrons.recordset[0]?.cnt ?? 0,
      roomUsePatronsThisYear: roomUsePatrons.recordset[0]?.cnt ?? 0,
      roomUseOnlyUsersThisYear: roomOnlyPatrons.recordset[0]?.cnt ?? 0,
      activeUsersThisYear: activeUsers.recordset[0]?.cnt ?? 0,
      neverUsedItems: neverUsed.recordset[0]?.cnt ?? 0,
      roomUseOnlyItems: roomUseOnlyItems.recordset[0]?.cnt ?? 0,
      debug: { inLibMod, checkInType },
    });

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
