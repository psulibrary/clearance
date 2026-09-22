import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const schema = p.replace(/^\[|\]\.?$|\.$/g, '');

    // Find all tables that might contain material/media type info
    const tables = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}'
        AND (
          LOWER(TABLE_NAME) LIKE '%material%'
          OR LOWER(TABLE_NAME) LIKE '%mediatype%'
          OR LOWER(TABLE_NAME) LIKE '%bibformat%'
          OR LOWER(TABLE_NAME) LIKE '%format%'
          OR LOWER(COLUMN_NAME) LIKE '%materialtype%'
          OR LOWER(COLUMN_NAME) LIKE '%mediatype%'
          OR LOWER(COLUMN_NAME) LIKE '%bibformat%'
          OR (LOWER(COLUMN_NAME) LIKE '%format%' AND TABLE_NAME IN ('BibMaster','Copy','CopyLibrary','CopyLibraryView'))
        )
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `);

    // Also sample BibMaster columns to see what's there
    const bibCols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = 'BibMaster'
      ORDER BY ORDINAL_POSITION
    `);

    return NextResponse.json({ schema, materialTypeTables: tables.recordset, bibMasterColumns: bibCols.recordset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
