import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT DISTINCT GradeLevel
      FROM ${t(p,'Patron')}
      WHERE GradeLevel IS NOT NULL AND GradeLevel <> ''
      ORDER BY GradeLevel
    `);
    return NextResponse.json({ levels: result.recordset.map((r: { GradeLevel: string }) => r.GradeLevel) });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
