import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT DISTINCT Gender
      FROM ${t(p,'Patron')}
      WHERE Gender IS NOT NULL AND Gender <> ''
      ORDER BY Gender
    `);
    return NextResponse.json({ genders: result.recordset.map((r: { Gender: string }) => r.Gender) });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
