import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const schema = p.replace(/\.$/, '');
    const result = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME LIKE '%Copy%' OR TABLE_NAME LIKE '%copy%'
      ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
    `);
    const schemas = await pool.request().query(`
      SELECT DISTINCT TABLE_SCHEMA, TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `);
    return NextResponse.json({ detectedSchema: schema, copyColumns: result.recordset, allTables: schemas.recordset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
