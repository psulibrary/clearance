import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT TOP 20
        ISNULL(ct.CircTypeDescription, 'Unassigned') AS name,
        COUNT(*) AS total,
        SUM(CASE WHEN c.PatronID IS NOT NULL AND c.DateReturned IS NULL AND c.DateWithdrawn IS NULL THEN 1 ELSE 0 END) AS checkedOut,
        SUM(CASE WHEN c.DateWithdrawn IS NULL AND c.PatronID IS NULL AND c.DateReturned IS NULL THEN 1 ELSE 0 END) AS available
      FROM ${t(p,'Copy')} c
      LEFT JOIN ${t(p,'CircType')} ct ON c.CircTypeID = ct.CircTypeID
      WHERE c.DateWithdrawn IS NULL
      GROUP BY ct.CircTypeDescription
      ORDER BY total DESC
    `);
    return NextResponse.json({ data: result.recordset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
