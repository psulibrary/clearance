import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchema, pick, col } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const schema = await getSchema();
    const { tables } = schema;

    const checkTable  = pick(tables, 'Checkout', 'CircCheckout', 'Circ', 'Loan', 'Loans', 'CircLoan');
    const copyTable   = pick(tables, 'BibCopy', 'Copy', 'Item', 'Items', 'Holdings');
    const titleTable  = pick(tables, 'BibTitle', 'Title', 'Titles', 'Bib');
    const patronTable = pick(tables, 'Patron', 'Patrons', 'Student', 'Borrower', 'User');

    if (!checkTable) {
      return NextResponse.json({ items: [], message: `No checkout table found. Tables: ${tables.join(', ')}` });
    }

    const c = (table: string, ...candidates: string[]) => col(schema, table, ...candidates);

    const retCol     = c(checkTable, 'ReturnDate', 'return_date', 'CheckinDate', 'DateReturned');
    const dueCol     = c(checkTable, 'DueDate', 'due_date', 'DateDue', 'ExpirationDate');
    const chkPatId   = c(checkTable, 'PatronID', 'patron_id', 'StudentID', 'BorrowerID', 'UserID');
    const chkCopyId  = c(checkTable, 'CopyID', 'copy_id', 'ItemID', 'HoldingID');

    if (!retCol || !dueCol) {
      return NextResponse.json({ items: [], message: `Cannot identify due/return date columns in ${checkTable}.` });
    }

    const selectCols = [`ch.[${dueCol}] as DueDate`, `DATEDIFF(day, ch.[${dueCol}], GETDATE()) as DaysOverdue`];
    const joins: string[] = [];

    if (patronTable && chkPatId) {
      const patId      = c(patronTable, 'PatronID', 'patron_id', 'StudentID', 'BorrowerID', 'UserID');
      const patLast    = c(patronTable, 'LastName', 'last_name', 'Surname');
      const patFirst   = c(patronTable, 'FirstName', 'first_name', 'GivenName');
      const patEmail   = c(patronTable, 'Email', 'email', 'EmailAddress');
      const patBarcode = c(patronTable, 'BarCode', 'Barcode', 'barcode', 'CardNumber');
      if (patId) {
        joins.push(`LEFT JOIN [${patronTable}] p ON ch.[${chkPatId}] = p.[${patId}]`);
        if (patLast)    selectCols.push(`p.[${patLast}] as LastName`);
        if (patFirst)   selectCols.push(`p.[${patFirst}] as FirstName`);
        if (patEmail)   selectCols.push(`p.[${patEmail}] as Email`);
        if (patBarcode) selectCols.push(`p.[${patBarcode}] as PatronBarcode`);
      }
    }

    if (copyTable && chkCopyId) {
      const cpId      = c(copyTable, 'CopyID', 'copy_id', 'ItemID', 'HoldingID');
      const cpBarcode = c(copyTable, 'BarCode', 'Barcode', 'barcode', 'ItemBarcode');
      const cpTitleId = c(copyTable, 'TitleID', 'title_id', 'BibID', 'RecordID');
      if (cpId) {
        joins.push(`LEFT JOIN [${copyTable}] cp ON ch.[${chkCopyId}] = cp.[${cpId}]`);
        if (cpBarcode) selectCols.push(`cp.[${cpBarcode}] as ItemBarcode`);

        if (titleTable && cpTitleId) {
          const titId    = c(titleTable, 'TitleID', 'title_id', 'BibID', 'RecordID');
          const titTitle = c(titleTable, 'Title', 'title', 'BibTitle', 'Name');
          if (titId && titTitle) {
            joins.push(`LEFT JOIN [${titleTable}] t ON cp.[${cpTitleId}] = t.[${titId}]`);
            selectCols.push(`t.[${titTitle}] as Title`);
          }
        }
      }
    }

    const query = `
      SELECT TOP 100 ${selectCols.join(', ')}
      FROM [${checkTable}] ch
      ${joins.join('\n')}
      WHERE ch.[${retCol}] IS NULL AND ch.[${dueCol}] < GETDATE()
      ORDER BY ch.[${dueCol}] ASC
    `;

    const result = await pool.request().query(query);
    return NextResponse.json({ items: result.recordset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
