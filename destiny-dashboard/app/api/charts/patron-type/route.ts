import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT TOP 15
        pt.PatronTypeDescription AS name,
        COUNT(sp.PatronID) AS value
      FROM ${t(p,'SitePatron')} sp
      JOIN ${t(p,'PatronType')} pt ON sp.PatronTypeID = pt.PatronTypeID
      GROUP BY pt.PatronTypeDescription
      ORDER BY value DESC
    `);
    return NextResponse.json({ data: result.recordset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
