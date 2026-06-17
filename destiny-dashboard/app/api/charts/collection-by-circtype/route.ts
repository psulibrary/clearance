import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    // Try CircTypeName first, fall back to CircTypeID label
    const result = await pool.request().query(`
      SELECT TOP 20
        ISNULL(ct.CircTypeName, 'Type ' + CAST(c.CircTypeID AS NVARCHAR)) AS name,
        COUNT(*) AS total,
        SUM(CASE WHEN c.PatronID IS NOT NULL AND c.DateReturned IS NULL AND c.DateWithdrawn IS NULL THEN 1 ELSE 0 END) AS checkedOut,
        SUM(CASE WHEN c.DateWithdrawn IS NULL AND c.PatronID IS NULL AND c.DateReturned IS NULL THEN 1 ELSE 0 END) AS available
      FROM ${t(p,'Copy')} c
      LEFT JOIN ${t(p,'CircType')} ct ON c.CircTypeID = ct.CircTypeID
      WHERE c.DateWithdrawn IS NULL
      GROUP BY c.CircTypeID, ct.CircTypeName
      ORDER BY total DESC
    `);
    return NextResponse.json({ data: result.recordset });
  } catch (err: unknown) {
    // Retry without CircTypeName if column doesn't exist
    try {
      const pool2 = await getPool();
      const p2 = await getSchemaPrefix();
      const r2 = await pool2.request().query(`
        SELECT TOP 20
          CAST(CircTypeID AS NVARCHAR) AS name,
          COUNT(*) AS total,
          SUM(CASE WHEN PatronID IS NOT NULL AND DateReturned IS NULL AND DateWithdrawn IS NULL THEN 1 ELSE 0 END) AS checkedOut,
          SUM(CASE WHEN DateWithdrawn IS NULL AND PatronID IS NULL AND DateReturned IS NULL THEN 1 ELSE 0 END) AS available
        FROM ${t(p2,'Copy')}
        WHERE DateWithdrawn IS NULL
        GROUP BY CircTypeID
        ORDER BY total DESC
      `);
      return NextResponse.json({ data: r2.recordset });
    } catch (err2: unknown) {
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }
}
