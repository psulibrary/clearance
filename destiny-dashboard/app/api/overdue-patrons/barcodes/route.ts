import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import sql from 'mssql';

// GET /api/overdue-patrons/barcodes
// Returns a plain array of patron barcodes who have overdue items.
// Optional: ?minDays=1 (default 1)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minDays = Math.max(1, parseInt(searchParams.get('minDays') ?? '1', 10));

  try {
    const pool = await getPool();
    const p    = await getSchemaPrefix();

    const result = await pool.request()
      .input('minDays', sql.Int, minDays)
      .query(`
        SELECT DISTINCT sp.PatronBarcode
        FROM ${t(p,'Copy')} c
        JOIN ${t(p,'SitePatron')} sp ON sp.PatronID = c.PatronID AND sp.SiteID = c.SiteID
        WHERE c.DateReturned IS NULL
          AND c.DateWithdrawn IS NULL
          AND c.PatronID IS NOT NULL
          AND c.DateDue IS NOT NULL
          AND DATEDIFF(day, c.DateDue, GETDATE()) >= @minDays
        ORDER BY sp.PatronBarcode
      `);

    const barcodes = result.recordset
      .map((r: { PatronBarcode: string }) => r.PatronBarcode)
      .filter(Boolean);

    return NextResponse.json(barcodes);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
