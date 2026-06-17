import { getPool } from '@/lib/db';

interface TableRow { TABLE_NAME: string; }
interface ColumnRow { TABLE_NAME: string; COLUMN_NAME: string; DATA_TYPE: string; }

export interface DestinySchema {
  tables: string[];
  /** map of table -> columns */
  columns: Record<string, string[]>;
}

let cached: DestinySchema | null = null;

export async function getSchema(): Promise<DestinySchema> {
  if (cached) return cached;
  const pool = await getPool();

  const [tablesRes, colsRes] = await Promise.all([
    pool.request().query<TableRow>(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME`
    ),
    pool.request().query<ColumnRow>(
      `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS ORDER BY TABLE_NAME, ORDINAL_POSITION`
    ),
  ]);

  const tables = tablesRes.recordset.map(r => r.TABLE_NAME);
  const columns: Record<string, string[]> = {};
  for (const r of colsRes.recordset) {
    if (!columns[r.TABLE_NAME]) columns[r.TABLE_NAME] = [];
    columns[r.TABLE_NAME].push(r.COLUMN_NAME);
  }

  cached = { tables, columns };
  return cached;
}

/** Find the first table name (case-insensitive) matching any of the candidates */
export function pick(tables: string[], ...candidates: string[]): string | null {
  const lower = tables.map(t => t.toLowerCase());
  for (const c of candidates) {
    const i = lower.indexOf(c.toLowerCase());
    if (i !== -1) return tables[i];
  }
  return null;
}

/** Find a column in a table (case-insensitive), return actual name or null */
export function col(schema: DestinySchema, table: string, ...candidates: string[]): string | null {
  const cols = schema.columns[table] ?? [];
  const lower = cols.map(c => c.toLowerCase());
  for (const c of candidates) {
    const i = lower.indexOf(c.toLowerCase());
    if (i !== -1) return cols[i];
  }
  return null;
}
