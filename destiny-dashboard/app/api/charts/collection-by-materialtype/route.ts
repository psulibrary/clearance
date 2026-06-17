import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

const BIB_TYPE_LABELS: Record<number, string> = {
  0:  'Equipment',
  2:  'Book',
  3:  'Web Resource',
  4:  'e-Book / Digital',
  5:  'Manuscript / Pamphlet',
  8:  'Thesis / Dissertation',
  14: 'Audiovisual',
  15: 'Periodical / Serial',
  16: 'Other Print',
};

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT
        bm.BibType,
        COUNT(DISTINCT bm.BibID) AS titles,
        COUNT(c.CopyID)          AS items
      FROM ${t(p,'BibMaster')} bm
      JOIN ${t(p,'Copy')} c ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
      GROUP BY bm.BibType
      ORDER BY items DESC
    `);

    const data = result.recordset.map((r: { BibType: number; titles: number; items: number }) => ({
      name:   BIB_TYPE_LABELS[r.BibType] ?? `Type ${r.BibType ?? 'Unknown'}`,
      titles: r.titles,
      items:  r.items,
    }));

    return NextResponse.json({ data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
