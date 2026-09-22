import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT TOP 200
        f.FineID,
        f.Created,
        f.Amount       / 100.0 AS Amount,
        f.AmountPaid   / 100.0 AS AmountPaid,
        f.AmountWaived / 100.0 AS AmountWaived,
        (f.Amount - f.AmountPaid - f.AmountWaived) / 100.0 AS Balance,
        f.Note,
        p.LastName,
        p.FirstName,
        p.EmailAddress1         AS Email,
        sp.PatronBarcode,
        bm.Title,
        cs.SiteName
      FROM ${t(p,'Fine')} f
      JOIN ${t(p,'Patron')} p     ON f.PatronID = p.PatronID
      LEFT JOIN ${t(p,'BibMaster')} bm ON f.BibID = bm.BibID
      LEFT JOIN ${t(p,'SitePatron')} sp ON f.PatronID = sp.PatronID AND f.SiteID = sp.SiteID
      LEFT JOIN ${t(p,'ConfigSite')} cs ON f.SiteID = cs.SiteID
      WHERE f.Active = 1
        AND (f.Amount - f.AmountPaid - f.AmountWaived) > 0
      ORDER BY f.Created DESC
    `);
    const total = result.recordset.reduce((sum, r) => sum + (Number(r.Balance) || 0), 0);
    return NextResponse.json({ items: result.recordset, totalBalance: total.toFixed(2) });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
