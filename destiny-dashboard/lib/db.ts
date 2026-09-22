import sql from 'mssql';

const config: sql.config = {
  server: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  options: {
    trustServerCertificate: true,
    encrypt: false,
  },
  connectionTimeout: 15000,
  requestTimeout: 30000,
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool;
  pool = await sql.connect(config);
  return pool;
}

export { sql };
