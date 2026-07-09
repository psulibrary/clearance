import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const schema = p.replace(/^\[|\]\.?$|\.$/g, '');

    // Get all columns from MediaBibTypeCircPolicy
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = 'MediaBibTypeCircPolicy'
      ORDER BY ORDINAL_POSITION
    `);

    // Sample the table data
    const rows = await pool.request().query(`SELECT TOP 50 * FROM ${t(p,'MediaBibTypeCircPolicy')}`);

    return NextResponse.json({ columns: cols.recordset, rows: rows.recordset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
