import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

// GET /api/discovery/db-info
// Returns current database name, all schemas, and first 50 table names.
// Use this to diagnose connection issues or find the right schema/table names.
export async function GET() {
  try {
    const pool = await getPool();

    const [dbName, schemas, tables] = await Promise.all([
      pool.request().query(`SELECT DB_NAME() AS dbName, @@SERVERNAME AS serverName`),
      pool.request().query(`SELECT DISTINCT TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES ORDER BY TABLE_SCHEMA`),
      pool.request().query(`
        SELECT TOP 100 TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
        FROM INFORMATION_SCHEMA.TABLES
        ORDER BY TABLE_SCHEMA, TABLE_NAME
      `),
    ]);

    return NextResponse.json({
      server:   dbName.recordset[0]?.serverName,
      database: dbName.recordset[0]?.dbName,
      schemas:  schemas.recordset.map((r: { TABLE_SCHEMA: string }) => r.TABLE_SCHEMA),
      tables:   tables.recordset,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
