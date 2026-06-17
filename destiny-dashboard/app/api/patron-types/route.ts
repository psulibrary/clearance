import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT DISTINCT PatronType
      FROM ${t(p,'Patron')}
      WHERE PatronType IS NOT NULL AND PatronType <> ''
      ORDER BY PatronType
    `);
    return NextResponse.json({ types: result.recordset.map((r: { PatronType: string }) => r.PatronType) });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
