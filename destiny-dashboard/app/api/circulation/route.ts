import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = await getPool();

    // Try Destiny Checkout table first, then common alternatives
    let result;
    const queries = [
      `SELECT TOP 50
         c.CheckoutID, p.LastName, p.FirstName, p.BarCode as PatronBarcode,
         b.Title, cp.BarCode as ItemBarcode, c.CheckoutDate, c.DueDate,
         CASE WHEN c.DueDate < GETDATE() AND c.ReturnDate IS NULL THEN 1 ELSE 0 END as IsOverdue
       FROM Checkout c
       JOIN Patron p ON c.PatronID = p.PatronID
       JOIN Copy cp ON c.CopyID = cp.CopyID
       JOIN Title b ON cp.TitleID = b.TitleID
       WHERE c.ReturnDate IS NULL
       ORDER BY c.DueDate ASC`,
      `SELECT TOP 50
         c.CircID as CheckoutID, p.LastName, p.FirstName, p.BarCode as PatronBarcode,
         t.Title, cp.BarCode as ItemBarcode, c.CheckoutDate, c.DueDate,
         CASE WHEN c.DueDate < GETDATE() AND c.ReturnDate IS NULL THEN 1 ELSE 0 END as IsOverdue
       FROM Circ c
       JOIN Patron p ON c.PatronID = p.PatronID
       JOIN Copy cp ON c.CopyID = cp.CopyID
       JOIN Title t ON cp.TitleID = t.TitleID
       WHERE c.ReturnDate IS NULL
       ORDER BY c.DueDate ASC`,
    ];

    for (const q of queries) {
      try {
        result = await pool.request().query(q);
        break;
      } catch {
        continue;
      }
    }

    if (!result) {
      // Fallback: show raw table data
      result = await pool.request().query(`
        SELECT TOP 50 * FROM (
          SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'
        ) t
      `);
      return NextResponse.json({ items: [], message: 'Could not query circulation tables. Use /api/tables to explore schema.' });
    }

    return NextResponse.json({ items: result.recordset });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
