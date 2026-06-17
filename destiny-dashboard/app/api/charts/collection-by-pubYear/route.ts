import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    // Group by decade for readability; exclude nulls and obviously bad years
    const result = await pool.request().query(`
      SELECT
        CAST(FLOOR(bm.PublicationYear / 10) * 10 AS INT) AS decade,
        COUNT(DISTINCT bm.BibID) AS titles,
        COUNT(c.CopyID) AS items
      FROM ${t(p,'BibMaster')} bm
      JOIN ${t(p,'Copy')} c ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
        AND bm.PublicationYear IS NOT NULL
        AND bm.PublicationYear >= 1950
        AND bm.PublicationYear <= YEAR(GETDATE())
      GROUP BY CAST(FLOOR(bm.PublicationYear / 10) * 10 AS INT)
      ORDER BY decade ASC
    `);

    const data = result.recordset.map((r: { decade: number; titles: number; items: number }) => ({
      name: `${r.decade}s`,
      titles: r.titles,
      items: r.items,
    }));

    return NextResponse.json({ data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
