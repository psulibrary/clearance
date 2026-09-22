import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { cacheKey, cacheGet, cacheSet, withCacheMeta } from '@/lib/cache';

// BibType codes that represent online/digital materials (see collection-by-materialtype).
const ONLINE_MATERIAL_TYPES: Record<number, string> = {
  3: 'Web Resource',
  4: 'e-Book / Digital',
};

type Row = { year: number; quarter: number; bibType: number; items: number };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const by = searchParams.get('by');
  const key = cacheKey('/api/public/online-materials-count', searchParams);
  if (by !== 'quarter') {
    return NextResponse.json({ error: "Only by=quarter is currently supported" }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT
        YEAR(c.Acquired) AS year,
        DATEPART(QUARTER, c.Acquired) AS quarter,
        bm.BibType AS bibType,
        COUNT(*) AS items
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm ON c.BibID = bm.BibID
      WHERE c.DateWithdrawn IS NULL
        AND c.Acquired IS NOT NULL
        AND YEAR(c.Acquired) >= 2015
        AND bm.BibType IN (${Object.keys(ONLINE_MATERIAL_TYPES).join(',')})
      GROUP BY YEAR(c.Acquired), DATEPART(QUARTER, c.Acquired), bm.BibType
      ORDER BY year ASC, quarter ASC
    `);

    const byQuarter = new Map<string, Record<string, number | string>>();
    for (const r of result.recordset as Row[]) {
      const quarterKey = `${r.year}-${r.quarter}`;
      if (!byQuarter.has(quarterKey)) {
        byQuarter.set(quarterKey, { year: r.year, quarter: r.quarter, label: `Q${r.quarter} ${r.year}` });
      }
      const label = ONLINE_MATERIAL_TYPES[r.bibType] ?? `Type ${r.bibType}`;
      byQuarter.get(quarterKey)![label] = r.items;
    }
    const data = Array.from(byQuarter.values()).sort((a, b) =>
      (a.year as number) - (b.year as number) || (a.quarter as number) - (b.quarter as number)
    );

    const json = { data, materialTypes: Object.values(ONLINE_MATERIAL_TYPES) };
    cacheSet(key, json);
    return NextResponse.json(json);
  } catch (err: unknown) {
    const cached = await cacheGet(key);
    if (cached) return NextResponse.json(withCacheMeta(cached));
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
