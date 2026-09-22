import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const schema = p.replace(/^\[|\]\.?$|\.$/g, '');

    // Look for in-house use / room use tables
    const tables = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${schema}'
        AND (
          LOWER(TABLE_NAME) LIKE '%inhouse%'
          OR LOWER(TABLE_NAME) LIKE '%in_house%'
          OR LOWER(TABLE_NAME) LIKE '%roomuse%'
          OR LOWER(TABLE_NAME) LIKE '%room_use%'
          OR LOWER(TABLE_NAME) LIKE '%localuse%'
          OR LOWER(TABLE_NAME) LIKE '%local_use%'
          OR LOWER(TABLE_NAME) LIKE '%libraryuse%'
          OR LOWER(TABLE_NAME) LIKE '%transact%'
          OR LOWER(TABLE_NAME) LIKE '%circhist%'
          OR LOWER(TABLE_NAME) LIKE '%circ_hist%'
          OR LOWER(TABLE_NAME) LIKE '%checkouthist%'
          OR LOWER(TABLE_NAME) LIKE '%loanhistory%'
          OR LOWER(TABLE_NAME) LIKE '%copyhistory%'
        )
      ORDER BY TABLE_NAME
    `);

    // Check CircType for reserve/room-use policies
    const circTypes = await pool.request().query(`
      SELECT ct.CircTypeID, ct.CircTypeDescription,
        COUNT(c.CopyID) AS totalCopies,
        SUM(CASE WHEN c.DateWithdrawn IS NULL THEN 1 ELSE 0 END) AS activeCopies
      FROM ${t(p,'CircType')} ct
      LEFT JOIN ${t(p,'Copy')} c ON c.CircTypeID = ct.CircTypeID
      GROUP BY ct.CircTypeID, ct.CircTypeDescription
      ORDER BY totalCopies DESC
    `);

    // Check if there's a separate checkout history table
    const historyTables = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${schema}'
        AND (
          LOWER(TABLE_NAME) LIKE '%history%'
          OR LOWER(TABLE_NAME) LIKE '%log%'
          OR LOWER(TABLE_NAME) LIKE '%audit%'
        )
      ORDER BY TABLE_NAME
    `);

    return NextResponse.json({
      inHouseUseTables: tables.recordset,
      historyAndLogTables: historyTables.recordset,
      circTypes: circTypes.recordset,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
