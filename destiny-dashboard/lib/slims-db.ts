import mysql from 'mysql2/promise';

// Other campuses that run SLiMS (Senayan Library Management System) instead
// of Destiny. Each campus's DB connection is configured via the
// SLIMS_CAMPUSES env var — a JSON array, e.g.:
//   [{"name":"Aborlan Campus","host":"1.2.3.4","port":3306,"user":"...","password":"...","database":"slims"}]
// Table/column names below follow the standard SLiMS 9.x schema
// (mst_item, mst_biblio, mst_member, loan) — verify against the campus's
// actual installed version before relying on the numbers, since older or
// customized SLiMS forks can differ.
export interface SlimsCampusConfig {
  name: string;
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
}

export function getSlimsCampuses(): SlimsCampusConfig[] {
  const raw = process.env.SLIMS_CAMPUSES;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function withSlimsConnection<T>(
  cfg: SlimsCampusConfig,
  fn: (conn: mysql.Connection) => Promise<T>,
): Promise<T> {
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port ?? 3306,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    connectTimeout: 10000,
  });
  try {
    return await fn(conn);
  } finally {
    await conn.end();
  }
}

export interface SlimsStats {
  totalItems: number;
  checkedOut: number;
  totalPatrons: number;
  activePatrons: number;
  checkoutsYtd: number;
  newItemsYtd: number;
}

async function scalarCount(conn: mysql.Connection, sql: string, params: unknown[] = []): Promise<number> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(sql, params);
  const value = (rows[0] as Record<string, unknown> | undefined)?.[Object.keys(rows[0] ?? {})[0]];
  return Number(value ?? 0);
}

export async function getSlimsStats(conn: mysql.Connection): Promise<SlimsStats> {
  const ytdStart = `${new Date().getFullYear()}-01-01`;

  const [totalItems, checkedOut, totalPatrons, activePatrons, checkoutsYtd, newItemsYtd] = await Promise.all([
    scalarCount(conn, `SELECT COUNT(*) AS n FROM mst_item`),
    scalarCount(conn, `SELECT COUNT(*) AS n FROM loan WHERE return_date IS NULL`),
    scalarCount(conn, `SELECT COUNT(*) AS n FROM mst_member`),
    scalarCount(conn, `SELECT COUNT(DISTINCT member_id) AS n FROM loan WHERE loan_date >= ?`, [ytdStart]),
    scalarCount(conn, `SELECT COUNT(*) AS n FROM loan WHERE loan_date >= ?`, [ytdStart]),
    scalarCount(conn, `SELECT COUNT(*) AS n FROM mst_item WHERE input_date >= ?`, [ytdStart]),
  ]);

  return { totalItems, checkedOut, totalPatrons, activePatrons, checkoutsYtd, newItemsYtd };
}
