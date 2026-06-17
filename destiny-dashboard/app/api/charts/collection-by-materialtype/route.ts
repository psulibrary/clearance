import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

// Follett Destiny BibType integer codes
const BIB_TYPE_LABELS: Record<number, string> = {
  1:  'Book',
  2:  'Periodical / Serial',
  3:  'Sound Recording',
  4:  'Video Recording',
  5:  'Computer File / Software',
  6:  'Map',
  7:  'Music Score',
  8:  'Kit',
  9:  'Equipment',
  10: 'Manuscript',
  11: 'Picture / Graphic',
  12: 'Mixed Materials',
  13: 'e-Book',
  14: 'e-Resource',
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
