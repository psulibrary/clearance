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
        COUNT(DISTINCT bm.BibID)                                                                                AS titles,
        COUNT(c.CopyID)                                                                                         AS items,
        SUM(CASE WHEN c.PatronID IS NOT NULL AND c.DateReturned IS NULL AND c.DateWithdrawn IS NULL THEN 1 ELSE 0 END) AS checkedOut,
        SUM(CASE WHEN c.PatronID IS NULL AND c.DateReturned IS NULL AND c.DateWithdrawn IS NULL THEN 1 ELSE 0 END)     AS available
      FROM ${t(p,'BibMaster')} bm
      JOIN ${t(p,'Copy')} c ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
      GROUP BY bm.BibType
      ORDER BY items DESC
    `);

    const data = result.recordset.map((r: { BibType: number; titles: number; items: number; checkedOut: number; available: number }) => ({
      name:       BIB_TYPE_LABELS[r.BibType] ?? `Type ${r.BibType ?? 'Unknown'}`,
      titles:     r.titles,
      items:      r.items,
      checkedOut: r.checkedOut,
      available:  r.available,
      utilRate:   r.items ? parseFloat((r.checkedOut / r.items * 100).toFixed(1)) : 0,
    }));

    return NextResponse.json({ data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
