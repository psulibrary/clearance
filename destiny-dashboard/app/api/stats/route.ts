import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

async function tryQuery(pool: Awaited<ReturnType<typeof getPool>>, query: string): Promise<number> {
  try {
    const r = await pool.request().query(query);
    return r.recordset[0]?.count ?? r.recordset[0]?.total ?? 0;
  } catch {
    return -1;
  }
}

export async function GET() {
  try {
    const pool = await getPool();

    // Try common Destiny table names with fallbacks
    const [totalItems, checkedOut, overdue, patrons] = await Promise.all([
      tryQuery(pool, `SELECT COUNT(*) as count FROM Copy`).catch(() =>
        tryQuery(pool, `SELECT COUNT(*) as count FROM Item`)),
      tryQuery(pool, `SELECT COUNT(*) as count FROM Checkout WHERE ReturnDate IS NULL`).catch(() =>
        tryQuery(pool, `SELECT COUNT(*) as count FROM Circ WHERE ReturnDate IS NULL`)),
      tryQuery(pool, `SELECT COUNT(*) as count FROM Checkout WHERE ReturnDate IS NULL AND DueDate < GETDATE()`).catch(() =>
        tryQuery(pool, `SELECT COUNT(*) as count FROM Circ WHERE ReturnDate IS NULL AND DueDate < GETDATE()`)),
      tryQuery(pool, `SELECT COUNT(*) as count FROM Patron`).catch(() =>
        tryQuery(pool, `SELECT COUNT(*) as count FROM Borrower`)),
    ]);

    return NextResponse.json({ totalItems, checkedOut, overdue, patrons });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
