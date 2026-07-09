import { getPool } from '@/lib/db';

// Schema is read from env var first, then auto-detected, then falls back to CircCatAdmin
// (Follett Destiny always uses CircCatAdmin on SQL Server installations)
const ENV_SCHEMA = process.env.DB_SCHEMA ?? '';

let schemaPrefix = '';
let resolved = false;

/** Returns e.g. "[CircCatAdmin]." */
export async function getSchemaPrefix(): Promise<string> {
  if (resolved) return schemaPrefix;

  // Use env override if set
  if (ENV_SCHEMA) {
    schemaPrefix = `[${ENV_SCHEMA}].`;
    resolved = true;
    return schemaPrefix;
  }

  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT TOP 1 TABLE_SCHEMA
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME IN ('Copy','BibMaster','Patron','SitePatron')
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    const s: string = r.recordset[0]?.TABLE_SCHEMA ?? 'CircCatAdmin';
    schemaPrefix = `[${s}].`;
  } catch {
    // Destiny always uses CircCatAdmin — safe default
    schemaPrefix = '[CircCatAdmin].';
  }
  resolved = true;
  return schemaPrefix;
}

/** Fully qualified table reference, e.g. [CircCatAdmin].[Copy] */
export function t(prefix: string, table: string): string {
  return `${prefix}[${table}]`;
}
