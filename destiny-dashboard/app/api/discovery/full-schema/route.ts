import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix } from '@/lib/schema';

// GET /api/discovery/full-schema
// Returns every table and column in the CircCatAdmin schema.
// Use ?table=Copy to filter to a single table.
// Use ?format=csv to download as a spreadsheet.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tableFilter = searchParams.get('table');
  const format      = searchParams.get('format') === 'csv' ? 'csv' : 'json';

  try {
    const pool = await getPool();
    const p    = await getSchemaPrefix();
    const schema = p.replace(/^\[|\]\.?$|\.$/g, '');

    const result = await pool.request().query(`
      SELECT
        t.TABLE_NAME,
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.IS_NULLABLE,
        c.ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.TABLES t
      JOIN INFORMATION_SCHEMA.COLUMNS c
        ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME
      WHERE t.TABLE_SCHEMA = '${schema}'
        ${tableFilter ? `AND t.TABLE_NAME = '${tableFilter.replace(/'/g, "''")}'` : ''}
      ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
    `);

    type Row = {
      TABLE_NAME: string; COLUMN_NAME: string; DATA_TYPE: string;
      CHARACTER_MAXIMUM_LENGTH: number | null; IS_NULLABLE: string; ORDINAL_POSITION: number;
    };

    if (format === 'csv') {
      const lines = ['TABLE_NAME,COLUMN_NAME,DATA_TYPE,MAX_LENGTH,NULLABLE,POSITION'];
      for (const r of result.recordset as Row[]) {
        lines.push(`"${r.TABLE_NAME}","${r.COLUMN_NAME}","${r.DATA_TYPE}",${r.CHARACTER_MAXIMUM_LENGTH ?? ''},"${r.IS_NULLABLE}",${r.ORDINAL_POSITION}`);
      }
      return new Response(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="destiny-schema-${schema}.csv"`,
        },
      });
    }

    // Group by table for easier reading
    const grouped: Record<string, { column: string; type: string; maxLength: number | null; nullable: string }[]> = {};
    for (const r of result.recordset as Row[]) {
      if (!grouped[r.TABLE_NAME]) grouped[r.TABLE_NAME] = [];
      grouped[r.TABLE_NAME].push({
        column:    r.COLUMN_NAME,
        type:      r.DATA_TYPE,
        maxLength: r.CHARACTER_MAXIMUM_LENGTH,
        nullable:  r.IS_NULLABLE,
      });
    }

    return NextResponse.json({
      schema,
      tableCount:  Object.keys(grouped).length,
      columnCount: result.recordset.length,
      tables:      grouped,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
