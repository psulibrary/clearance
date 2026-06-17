import { getPool } from '@/lib/db';

let schemaPrefix = '';
let resolved = false;

/** Returns e.g. "[CircCatAdmin]." or "" (dbo) */
export async function getSchemaPrefix(): Promise<string> {
  if (resolved) return schemaPrefix;
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT TOP 1 TABLE_SCHEMA
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'Copy' AND TABLE_TYPE = 'BASE TABLE'
    `);
    const s: string = r.recordset[0]?.TABLE_SCHEMA ?? 'dbo';
    schemaPrefix = s === 'dbo' ? '' : `[${s}].`;
  } catch {
    schemaPrefix = '';
  }
  resolved = true;
  return schemaPrefix;
}

/** Fully qualified table reference, e.g. [CircCatAdmin].[Copy] */
export function t(prefix: string, table: string): string {
  return `${prefix}[${table}]`;
}
