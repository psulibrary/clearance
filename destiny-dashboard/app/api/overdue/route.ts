import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export async function GET() {
  try {
    const pool = await getPool();

    const queries = [
      `SELECT TOP 100
         p.LastName, p.FirstName, p.BarCode as PatronBarcode, p.Email,
         t.Title, cp.BarCode as ItemBarcode,
         c.DueDate,
         DATEDIFF(day, c.DueDate, GETDATE()) as DaysOverdue
       FROM Checkout c
       JOIN Patron p ON c.PatronID = p.PatronID
       JOIN Copy cp ON c.CopyID = cp.CopyID
       JOIN Title t ON cp.TitleID = t.TitleID
       WHERE c.ReturnDate IS NULL AND c.DueDate < GETDATE()
       ORDER BY c.DueDate ASC`,
      `SELECT TOP 100
         p.LastName, p.FirstName, p.BarCode as PatronBarcode, p.Email,
         t.Title, cp.BarCode as ItemBarcode,
         c.DueDate,
         DATEDIFF(day, c.DueDate, GETDATE()) as DaysOverdue
       FROM Circ c
       JOIN Patron p ON c.PatronID = p.PatronID
       JOIN Copy cp ON c.CopyID = cp.CopyID
       JOIN Title t ON cp.TitleID = t.TitleID
       WHERE c.ReturnDate IS NULL AND c.DueDate < GETDATE()
       ORDER BY c.DueDate ASC`,
    ];

    let result;
    for (const q of queries) {
      try {
        result = await pool.request().query(q);
        break;
      } catch {
        continue;
      }
    }

    if (!result) {
      return NextResponse.json({ items: [], message: 'Could not query overdue items.' });
    }

    return NextResponse.json({ items: result.recordset });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
