import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT PatronTypeID, PatronTypeDescription
      FROM ${t(p,'PatronType')}
      WHERE PatronTypeDescription IS NOT NULL AND PatronTypeDescription <> ''
      ORDER BY PatronTypeDescription
    `);
    return NextResponse.json({ types: result.recordset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
