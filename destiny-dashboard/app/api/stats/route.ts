import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateWithdrawn IS NULL)                                                     AS totalItems,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE PatronID IS NOT NULL AND DateReturned IS NULL)                             AS checkedOut,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE PatronID IS NOT NULL AND DateReturned IS NULL AND DateDue < GETDATE())     AS overdue,
        (SELECT COUNT(*) FROM ${t(p,'Patron')})                                                                               AS patrons
    `);
    return NextResponse.json(result.recordset[0]);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
