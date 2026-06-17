import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    // CopyCategory in Destiny is a text field like "500-599 Science"
    const result = await pool.request().query(`
      SELECT TOP 15
        ISNULL(NULLIF(CopyCategory,''), 'Uncategorized') AS name,
        COUNT(*) AS total,
        SUM(CASE WHEN PatronID IS NOT NULL AND DateReturned IS NULL AND DateWithdrawn IS NULL THEN 1 ELSE 0 END) AS checkedOut
      FROM ${t(p,'Copy')}
      WHERE DateWithdrawn IS NULL
      GROUP BY CopyCategory
      ORDER BY total DESC
    `);
    return NextResponse.json({ data: result.recordset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
