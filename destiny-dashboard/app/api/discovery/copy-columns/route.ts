import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const schema = p.replace(/^\[|\]\.?$|\.$/g, '');
    const result = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}'
        AND TABLE_NAME IN ('BibMaster','BibLibrary','BibAllView','BibHeadings','MediaHeadings','CircType','MediaType','MaterialType','CopyMaterialType','BibFormat','Format')
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);
    return NextResponse.json({ schema, columns: result.recordset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
