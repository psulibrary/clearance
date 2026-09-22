import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { cacheKey, cacheGet, cacheSet } from '@/lib/cache';

// Destiny stores in-library use in the Audit table.
// TransType (tinyint) = check-in action code
// TransModifier (int)  = modifier; the in-library modifier value is discovered at runtime
//                        by looking for the modifier that appears alongside check-in transactions
//                        when ConfigSite.LibraryInLibraryUse = 1

export async function GET(request: NextRequest) {
  const year = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()));
  // Default display cap stays 20; export uses a much higher explicit limit.
  const topLimit = Math.min(5000, Math.max(5, parseInt(request.nextUrl.searchParams.get('topLimit') ?? '20', 10)));
  const key = cacheKey('/api/charts/room-use', request.nextUrl.searchParams);

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();

    // Step 1: discover all TransType + TransModifier combinations in Audit
    // so we can identify which combination represents in-library use.
    const combosRes = await pool.request().query(`
      SELECT TransType, TransModifier, COUNT(*) AS cnt
      FROM ${t(p, 'Audit')}
      GROUP BY TransType, TransModifier
      ORDER BY cnt DESC
    `);
    const combos: { TransType: number; TransModifier: number; cnt: number }[] = combosRes.recordset;

    // Step 2: check ConfigSite to see if in-library use is enabled and get any hint
    let inLibEnabled = false;
    try {
      const cfg = await pool.request().query(`
        SELECT TOP 1 LibraryInLibraryUse FROM ${t(p, 'ConfigSite')}
      `);
      inLibEnabled = cfg.recordset[0]?.LibraryInLibraryUse === true || cfg.recordset[0]?.LibraryInLibraryUse === 1;
    } catch (_) { /* optional */ }

    // Step 3: Try to find the in-library modifier value.
    // Strategy: TransModifier values that are NOT 0 (or the most common) on check-in transactions
    // are likely the in-library modifier. We treat 0 as "normal checkout" and non-zero as modifiers.
    // In Destiny XML exports TransModifier='In-Library' maps to a specific int (commonly 3 or 4).
    // We'll query with the most likely non-zero TransModifier values, and also expose all combos
    // in the debug output so the admin can confirm.

    // Find the most common TransType (likely check-in = highest volume)
    const topType = combos[0]?.TransType ?? 1;

    // Aggregate non-zero modifiers across ALL TransTypes to find the in-library flag.
    // TransType 30 uses unique large modifier values (looks like timestamps/IDs), so exclude it.
    // The in-library modifier is whichever non-zero value appears most frequently.
    const modifierTotals: Record<number, number> = {};
    for (const c of combos) {
      if (c.TransType === 30) continue;
      if (c.TransModifier === 0) continue;
      modifierTotals[c.TransModifier] = (modifierTotals[c.TransModifier] ?? 0) + c.cnt;
    }
    const sortedModifiers = Object.entries(modifierTotals)
      .map(([mod, total]) => ({ mod: Number(mod), total }))
      .sort((a, b) => b.total - a.total);

    // In-library candidates: all entries for the top modifier value
    const inLibCandidates = sortedModifiers.length > 0
      ? combos.filter(c => c.TransModifier === sortedModifiers[0].mod && c.TransType !== 30)
      : [];

    // The in-library modifier (most common non-zero modifier across all TransTypes)
    const inLibModifier: number | null = sortedModifiers.length > 0 ? sortedModifiers[0].mod : null;

    // In Destiny, in-library use = Check In (TransType 2) with the in-library modifier.
    // If TransType 2 exists with this modifier, use it; otherwise use all TransTypes with that modifier.
    const checkInType = inLibCandidates.find(c => c.TransType === 2)?.TransType ?? inLibCandidates[0]?.TransType ?? topType;

    const req = pool.request();
    req.input('year', sql.Int, year);

    let totalThisYear = 0;
    let totalAllTime = 0;
    let byMonth: { mo: number; uses: number }[] = [];
    let byPatronType: { patronType: string; uses: number }[] = [];
    let topTitles: { Title: string; Author: string; inLibraryUses: number }[] = [];

    if (inLibModifier !== null) {
      req.input('mod', sql.Int, inLibModifier);
      req.input('typ', sql.TinyInt, checkInType);
      req.input('topLimit', sql.Int, topLimit);

      const summaryRes = await req.query(`
        SELECT COUNT(*) AS totalThisYear
        FROM ${t(p, 'Audit')}
        WHERE TransType = @typ AND TransModifier = @mod AND YEAR(Created) = @year
      `);
      totalThisYear = summaryRes.recordset[0]?.totalThisYear ?? 0;

      const allTimeRes = await req.query(`
        SELECT COUNT(*) AS totalAllTime
        FROM ${t(p, 'Audit')}
        WHERE TransType = @typ AND TransModifier = @mod
      `);
      totalAllTime = allTimeRes.recordset[0]?.totalAllTime ?? 0;

      const byMonthRes = await req.query(`
        SELECT MONTH(Created) AS mo, COUNT(*) AS uses
        FROM ${t(p, 'Audit')}
        WHERE TransType = @typ AND TransModifier = @mod AND YEAR(Created) = @year
        GROUP BY MONTH(Created) ORDER BY mo
      `);
      byMonth = byMonthRes.recordset;

      // Patron type via direct PatronTypeID on Audit
      try {
        const ptRes = await req.query(`
          SELECT pt.PatronTypeDescription AS patronType, COUNT(*) AS uses
          FROM ${t(p, 'Audit')} a
          JOIN ${t(p, 'PatronType')} pt ON pt.PatronTypeID = a.PatronTypeID
          WHERE a.TransType = @typ AND a.TransModifier = @mod AND YEAR(a.Created) = @year
          GROUP BY pt.PatronTypeDescription ORDER BY uses DESC
        `);
        byPatronType = ptRes.recordset;
      } catch (_) { /* skip if join fails */ }

      // Top titles via BibID → BibMaster (direct, no Copy join needed)
      try {
        const ttRes = await req.query(`
          SELECT TOP (@topLimit) bm.Title, bm.Author, COUNT(*) AS inLibraryUses
          FROM ${t(p, 'Audit')} a
          JOIN ${t(p, 'BibMaster')} bm ON bm.BibID = a.BibID
          WHERE a.TransType = @typ AND a.TransModifier = @mod AND YEAR(a.Created) = @year
          GROUP BY bm.Title, bm.Author ORDER BY inLibraryUses DESC
        `);
        topTitles = ttRes.recordset;
      } catch (_) { /* skip if join fails */ }
    }

    const json = {
      source: 'audit',
      year,
      totalThisYear,
      totalAllTime,
      byMonth,
      byPatronType,
      topTitles,
      inLibEnabled,
      debug: {
        inLibModifier,
        checkInType,
        topType,
        inLibCandidates,
        sortedModifiers,
        allCombos: combos,
      },
    };
    cacheSet(key, json);
    return NextResponse.json(json);

  } catch (err: unknown) {
    const cached = await cacheGet(key);
    if (cached) return NextResponse.json(cached.payload);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
