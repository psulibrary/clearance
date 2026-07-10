import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { labelTransCombo, labelTransType } from '@/lib/audit-trans';

// Destiny stores circulation history in Audit (not CopyTransaction).
// TransType / TransModifier are numeric. In-library use is typically its own
// TransType (often 19/25/26) or a check-in (2) with a non-zero modifier.
// We auto-detect from live data when possible.

const IN_LIB_TYPE_CANDIDATES = [19, 25, 26, 27, 28];

type TypeRow = { transType: number; transModifier: number; cnt: number; nullPatron: number };

async function detectInLibraryFilter(
  pool: Awaited<ReturnType<typeof getPool>>,
  audit: string,
  year: number,
): Promise<{ where: string; detected: { transType: number; transModifier: number | null; method: string }; breakdown: TypeRow[] }> {
  const req = pool.request();
  req.input('year', sql.Int, year);

  const breakdownRes = await req.query(`
    SELECT TOP 40
      a.TransType AS transType,
      a.TransModifier AS transModifier,
      COUNT(*) AS cnt,
      SUM(CASE WHEN a.PatronID IS NULL THEN 1 ELSE 0 END) AS nullPatron
    FROM ${audit} a
    WHERE YEAR(a.Created) = @year AND a.CopyID IS NOT NULL
    GROUP BY a.TransType, a.TransModifier
    ORDER BY cnt DESC
  `);
  const breakdown: TypeRow[] = breakdownRes.recordset.map((r: TypeRow) => ({
    transType: Number(r.transType),
    transModifier: Number(r.transModifier),
    cnt: Number(r.cnt),
    nullPatron: Number(r.nullPatron),
  }));

  // 1) Known in-library TransType codes present in data
  const known = breakdown.filter((r) => IN_LIB_TYPE_CANDIDATES.includes(r.transType));
  if (known.length > 0) {
    const types = [...new Set(known.map((r) => r.transType))];
    return {
      where: `a.TransType IN (${types.join(',')})`,
      detected: { transType: types[0], transModifier: null, method: 'known_transtype' },
      breakdown,
    };
  }

  // 2) Heuristic: combo with CopyID, mostly null PatronID, not checkout (1) / renew (3)
  const heuristic = breakdown
    .filter((r) => r.transType !== 1 && r.transType !== 3 && r.cnt >= 5)
    .filter((r) => r.nullPatron / r.cnt >= 0.8)
    .sort((a, b) => b.cnt - a.cnt)[0];
  if (heuristic) {
    return {
      where: `a.TransType = ${heuristic.transType} AND a.TransModifier = ${heuristic.transModifier}`,
      detected: { transType: heuristic.transType, transModifier: heuristic.transModifier, method: 'null_patron_heuristic' },
      breakdown,
    };
  }

  // 3) Check-in (2) with non-zero modifier
  const checkInMod = breakdown
    .filter((r) => r.transType === 2 && r.transModifier !== 0)
    .sort((a, b) => b.cnt - a.cnt)[0];
  if (checkInMod) {
    return {
      where: `a.TransType = 2 AND a.TransModifier = ${checkInMod.transModifier}`,
      detected: { transType: 2, transModifier: checkInMod.transModifier, method: 'checkin_modifier' },
      breakdown,
    };
  }

  // 4) Fallback: any TransType labeled as in-library in our map that appears at all (all-time probe)
  const allTime = await pool.request().query(`
    SELECT TOP 1 a.TransType AS transType, COUNT(*) AS cnt
    FROM ${audit} a
    WHERE a.TransType IN (${IN_LIB_TYPE_CANDIDATES.join(',')}) AND a.CopyID IS NOT NULL
    GROUP BY a.TransType
    ORDER BY cnt DESC
  `);
  if (allTime.recordset[0]) {
    const tt = Number(allTime.recordset[0].transType);
    return {
      where: `a.TransType = ${tt}`,
      detected: { transType: tt, transModifier: null, method: 'alltime_known_transtype' },
      breakdown,
    };
  }

  return {
    where: '1 = 0',
    detected: { transType: -1, transModifier: null, method: 'none' },
    breakdown,
  };
}

export async function GET(request: NextRequest) {
  const year = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()));

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const schema = p.replace(/^\[|\]\.?$|\.$/g, '');

    const tablesRes = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = N'${schema}' AND TABLE_NAME = N'Audit'
    `);
    if (tablesRes.recordset.length === 0) {
      return NextResponse.json({
        source: 'none',
        year,
        message: 'Audit table not found. Destiny stores in-library use in CircCatAdmin.Audit.',
      });
    }

    const audit = t(p, 'Audit');
    const { where: inLibWhere, detected, breakdown } = await detectInLibraryFilter(pool, audit, year);

    if (detected.method === 'none') {
      return NextResponse.json({
        source: 'none',
        year,
        message: 'Could not identify in-library use TransType/TransModifier in Audit for this year. See debug.typeBreakdown.',
        debug: {
          typeBreakdown: breakdown.map((r) => ({
            ...r,
            label: labelTransCombo(r.transType, r.transModifier),
          })),
        },
      });
    }

    const req = pool.request();
    req.input('year', sql.Int, year);
    const yearFilter = `YEAR(a.Created) = @year AND ${inLibWhere}`;

    const summary = await req.query(`
      SELECT COUNT(*) AS totalThisYear FROM ${audit} a WHERE ${yearFilter}
    `);

    const allTimeReq = pool.request();
    const allTime = await allTimeReq.query(`
      SELECT COUNT(*) AS totalAllTime FROM ${audit} a WHERE ${inLibWhere}
    `);

    const byMonth = await req.query(`
      SELECT MONTH(a.Created) AS mo, COUNT(*) AS uses
      FROM ${audit} a
      WHERE ${yearFilter}
      GROUP BY MONTH(a.Created)
      ORDER BY mo
    `);

    let byPatronType: { patronType: string; uses: number }[] = [];
    try {
      const pt = await req.query(`
        SELECT ISNULL(pt.PatronTypeDescription, '(no patron)') AS patronType, COUNT(*) AS uses
        FROM ${audit} a
        LEFT JOIN ${t(p, 'PatronType')} pt ON pt.PatronTypeID = a.PatronTypeID
        WHERE ${yearFilter}
        GROUP BY pt.PatronTypeDescription
        ORDER BY uses DESC
      `);
      byPatronType = pt.recordset;
    } catch {
      /* optional */
    }

    let topTitles: { Title: string; Author: string; inLibraryUses: number; copies: number }[] = [];
    try {
      const tt = await req.query(`
        SELECT TOP 20
          bm.Title,
          bm.Author,
          COUNT(*) AS inLibraryUses,
          COUNT(DISTINCT a.CopyID) AS copies
        FROM ${audit} a
        JOIN ${t(p, 'BibMaster')} bm ON bm.BibID = a.BibID
        WHERE ${yearFilter}
        GROUP BY bm.Title, bm.Author
        ORDER BY inLibraryUses DESC
      `);
      topTitles = tt.recordset;
    } catch {
      /* optional */
    }

    return NextResponse.json({
      source: 'audit',
      year,
      totalThisYear: summary.recordset[0]?.totalThisYear ?? 0,
      totalAllTime: allTime.recordset[0]?.totalAllTime ?? 0,
      byMonth: byMonth.recordset,
      byPatronType,
      topTitles,
      debug: {
        detected,
        detectedLabel: labelTransType(detected.transType),
        inLibWhere,
        typeBreakdown: breakdown.slice(0, 15).map((r) => ({
          ...r,
          label: labelTransCombo(r.transType, r.transModifier),
        })),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
