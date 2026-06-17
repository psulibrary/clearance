import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchema, pick, col } from '@/lib/schema';

async function count(pool: Awaited<ReturnType<typeof getPool>>, q: string): Promise<number> {
  try {
    const r = await pool.request().query(q);
    const row = r.recordset[0] ?? {};
    return Number(Object.values(row)[0] ?? 0);
  } catch { return -1; }
}

export async function GET() {
  try {
    const pool = await getPool();
    const schema = await getSchema();
    const { tables } = schema;

    const copyTable   = pick(tables, 'BibCopy', 'Copy', 'Item', 'Items', 'Holdings');
    const titleTable  = pick(tables, 'BibTitle', 'Title', 'Titles', 'Bib');
    const patronTable = pick(tables, 'Patron', 'Patrons', 'Student', 'Borrower', 'User');
    const checkTable  = pick(tables, 'Checkout', 'CircCheckout', 'Circ', 'Loan', 'Loans', 'CircLoan');

    const dueDateCol  = checkTable ? col(schema, checkTable, 'DueDate', 'due_date', 'DateDue', 'ExpirationDate') : null;
    const retCol      = checkTable ? col(schema, checkTable, 'ReturnDate', 'return_date', 'CheckinDate', 'DateReturned') : null;

    const [totalItems, checkedOut, overdue, patrons] = await Promise.all([
      copyTable  ? count(pool, `SELECT COUNT(*) as n FROM [${copyTable}]`) : Promise.resolve(-1),
      checkTable && retCol
        ? count(pool, `SELECT COUNT(*) as n FROM [${checkTable}] WHERE [${retCol}] IS NULL`)
        : Promise.resolve(-1),
      checkTable && retCol && dueDateCol
        ? count(pool, `SELECT COUNT(*) as n FROM [${checkTable}] WHERE [${retCol}] IS NULL AND [${dueDateCol}] < GETDATE()`)
        : Promise.resolve(-1),
      patronTable ? count(pool, `SELECT COUNT(*) as n FROM [${patronTable}]`) : Promise.resolve(-1),
    ]);

    return NextResponse.json({
      totalItems, checkedOut, overdue, patrons,
      _debug: { copyTable, titleTable, patronTable, checkTable },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
