import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM Copy WHERE DateWithdrawn IS NULL)                                      AS totalItems,
        (SELECT COUNT(*) FROM Copy WHERE PatronID IS NOT NULL AND DateReturned IS NULL)              AS checkedOut,
        (SELECT COUNT(*) FROM Copy WHERE PatronID IS NOT NULL AND DateReturned IS NULL AND DateDue < GETDATE()) AS overdue,
        (SELECT COUNT(*) FROM Patron)                                                                AS patrons
    `);
    return NextResponse.json(result.recordset[0]);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
