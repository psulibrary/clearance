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
      return NextResponse.json({
        items: [],
        message: `No checkout table found. Tables available: ${tables.join(', ')}`,
      });
    }

    // Discover column names in each table
    const c = (table: string, ...candidates: string[]) => col(schema, table, ...candidates);

    const retCol     = c(checkTable, 'ReturnDate', 'return_date', 'CheckinDate', 'DateReturned');
    const dueCol     = c(checkTable, 'DueDate', 'due_date', 'DateDue', 'ExpirationDate');
    const outDateCol = c(checkTable, 'CheckoutDate', 'checkout_date', 'DateOut', 'LoanDate', 'DateCheckedOut');

    // Patron join columns
    const chkPatronId = checkTable ? c(checkTable, 'PatronID', 'patron_id', 'StudentID', 'BorrowerID', 'UserID') : null;
    const patId       = patronTable ? c(patronTable, 'PatronID', 'patron_id', 'StudentID', 'BorrowerID', 'UserID') : null;
    const patLast     = patronTable ? c(patronTable, 'LastName', 'last_name', 'Surname', 'FamilyName') : null;
    const patFirst    = patronTable ? c(patronTable, 'FirstName', 'first_name', 'GivenName') : null;
    const patBarcode  = patronTable ? c(patronTable, 'BarCode', 'Barcode', 'barcode', 'PatronBarcode', 'CardNumber') : null;

    // Copy join columns
    const chkCopyId  = c(checkTable, 'CopyID', 'copy_id', 'ItemID', 'HoldingID');
    const cpId       = copyTable ? c(copyTable, 'CopyID', 'copy_id', 'ItemID', 'HoldingID') : null;
    const cpBarcode  = copyTable ? c(copyTable, 'BarCode', 'Barcode', 'barcode', 'ItemBarcode') : null;
    const cpTitleId  = copyTable ? c(copyTable, 'TitleID', 'title_id', 'BibID', 'RecordID') : null;

    // Title join columns
    const titId      = titleTable ? c(titleTable, 'TitleID', 'title_id', 'BibID', 'RecordID') : null;
    const titTitle   = titleTable ? c(titleTable, 'Title', 'title', 'BibTitle', 'Name') : null;

    // Build the best query we can from discovered columns
    const selectCols: string[] = [];
    const joins: string[] = [];

    selectCols.push(`ch.*`);

    if (patronTable && chkPatronId && patId && patLast) {
      joins.push(`LEFT JOIN [${patronTable}] p ON ch.[${chkPatronId}] = p.[${patId}]`);
      if (patLast)    selectCols.push(`p.[${patLast}] as LastName`);
      if (patFirst)   selectCols.push(`p.[${patFirst}] as FirstName`);
      if (patBarcode) selectCols.push(`p.[${patBarcode}] as PatronBarcode`);
    }

    if (copyTable && chkCopyId && cpId) {
      joins.push(`LEFT JOIN [${copyTable}] cp ON ch.[${chkCopyId}] = cp.[${cpId}]`);
      if (cpBarcode) selectCols.push(`cp.[${cpBarcode}] as ItemBarcode`);

      if (titleTable && cpTitleId && titId && titTitle) {
        joins.push(`LEFT JOIN [${titleTable}] t ON cp.[${cpTitleId}] = t.[${titId}]`);
        selectCols.push(`t.[${titTitle}] as Title`);
      }
    }

    const whereClause = retCol ? `WHERE ch.[${retCol}] IS NULL` : '';
    const orderClause = dueCol ? `ORDER BY ch.[${dueCol}] ASC` : '';
    const overdueExpr = (retCol && dueCol)
      ? `, CASE WHEN ch.[${dueCol}] < GETDATE() AND ch.[${retCol}] IS NULL THEN 1 ELSE 0 END as IsOverdue`
      : '';

    const query = `
      SELECT TOP 100 ${selectCols.join(', ')}${overdueExpr},
        ${dueCol ? `ch.[${dueCol}] as DueDate,` : ''}
        ${outDateCol ? `ch.[${outDateCol}] as CheckoutDate,` : ''}
        1 as _placeholder
      FROM [${checkTable}] ch
      ${joins.join('\n')}
      ${whereClause}
      ${orderClause}
    `;

    const result = await pool.request().query(query);
    return NextResponse.json({ items: result.recordset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
