import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = await getPool();
    // Find which table/column holds patron type data
    const cols = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE COLUMN_NAME LIKE '%PatronType%'
         OR COLUMN_NAME LIKE '%Patron_Type%'
         OR COLUMN_NAME LIKE '%patrontype%'
      ORDER BY TABLE_NAME, COLUMN_NAME
    `);
    return NextResponse.json({ columns: cols.recordset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
