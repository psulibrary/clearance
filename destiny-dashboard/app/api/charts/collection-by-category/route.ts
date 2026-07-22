import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { cacheGet, cacheSet } from '@/lib/cache';

const CACHE_KEY = '/api/charts/collection-by-category';

// Maps Dewey hundreds to class name
const DEWEY: Record<number, string> = {
  0:   '000–099 General Works',
  100: '100–199 Philosophy & Psychology',
  200: '200–299 Religion',
  300: '300–399 Social Sciences',
  400: '400–499 Language',
  500: '500–599 Natural Sciences',
  600: '600–699 Technology',
  700: '700–799 Arts & Recreation',
  800: '800–899 Literature',
  900: '900–999 History & Geography',
};

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    // Group by Dewey hundreds using Copy.DeweyNumber (decimal)
    const result = await pool.request().query(`
      SELECT
        CASE
          WHEN DeweyNumber IS NULL THEN -1
          ELSE CAST(FLOOR(DeweyNumber / 100) * 100 AS INT)
        END AS deweyClass,
        COUNT(*) AS total,
        SUM(CASE WHEN PatronID IS NOT NULL AND DateReturned IS NULL AND DateWithdrawn IS NULL THEN 1 ELSE 0 END) AS checkedOut
      FROM ${t(p,'Copy')}
      WHERE DateWithdrawn IS NULL
      GROUP BY CASE WHEN DeweyNumber IS NULL THEN -1 ELSE CAST(FLOOR(DeweyNumber / 100) * 100 AS INT) END
      ORDER BY total DESC
    `);

    const data = result.recordset.map((r: { deweyClass: number; total: number; checkedOut: number }) => ({
      name: r.deweyClass === -1 ? 'No Dewey / Other' : (DEWEY[r.deweyClass] ?? `${r.deweyClass}–${r.deweyClass + 99}`),
      total: r.total,
      checkedOut: r.checkedOut,
    }));

    cacheSet(CACHE_KEY, { data });
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const cached = await cacheGet(CACHE_KEY);
    if (cached) return NextResponse.json(cached.payload);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
