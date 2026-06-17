import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = await getPool();
    const [tablesRes, colsRes] = await Promise.all([
      pool.request().query<{ TABLE_SCHEMA: string; TABLE_NAME: string }>(
        `SELECT TABLE_SCHEMA, TABLE_NAME
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_TYPE = 'BASE TABLE'
         ORDER BY TABLE_SCHEMA, TABLE_NAME`
      ),
      pool.request().query<{ TABLE_NAME: string; COLUMN_NAME: string; DATA_TYPE: string }>(
        `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
         FROM INFORMATION_SCHEMA.COLUMNS
         ORDER BY TABLE_NAME, ORDINAL_POSITION`
      ),
    ]);

    const tables = tablesRes.recordset.map(r => `${r.TABLE_SCHEMA}.${r.TABLE_NAME}`);
    const columns: Record<string, string[]> = {};
    for (const r of colsRes.recordset) {
      if (!columns[r.TABLE_NAME]) columns[r.TABLE_NAME] = [];
      columns[r.TABLE_NAME].push(`${r.COLUMN_NAME} (${r.DATA_TYPE})`);
    }

    return NextResponse.json({ tables, columns });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
