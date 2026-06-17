import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchema, pick, col } from '@/lib/schema';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search') || '';

  try {
    const pool = await getPool();
    const schema = await getSchema();
    const { tables } = schema;

    const titleTable = pick(tables, 'BibTitle', 'Title', 'Titles', 'Bib');
    const copyTable  = pick(tables, 'BibCopy', 'Copy', 'Item', 'Items', 'Holdings');
    const checkTable = pick(tables, 'Checkout', 'CircCheckout', 'Circ', 'Loan', 'Loans', 'CircLoan');

    if (!titleTable) {
      return NextResponse.json({ items: [], message: `No title/bib table found. Tables: ${tables.join(', ')}` });
    }

    const c = (table: string, ...candidates: string[]) => col(schema, table, ...candidates);

    const titId      = c(titleTable, 'TitleID', 'title_id', 'BibID', 'RecordID');
    const titTitle   = c(titleTable, 'Title', 'title', 'BibTitle', 'Name');
    const titAuthor  = c(titleTable, 'Author', 'author', 'AuthorName', 'Creator');
    const titISBN    = c(titleTable, 'ISBN', 'isbn', 'ISBN13', 'ISBN10');
    const titCall    = c(titleTable, 'CallNumber', 'call_number', 'CallNo', 'ShelfMark');

    const selectCols: string[] = [];
    if (titId)     selectCols.push(`t.[${titId}] as TitleID`);
    if (titTitle)  selectCols.push(`t.[${titTitle}] as Title`);
    if (titAuthor) selectCols.push(`t.[${titAuthor}] as Author`);
    if (titISBN)   selectCols.push(`t.[${titISBN}] as ISBN`);
    if (titCall)   selectCols.push(`t.[${titCall}] as CallNumber`);

    const joins: string[] = [];
    let copiesExpr = `0 as TotalCopies, 0 as CheckedOut`;

    if (copyTable && titId) {
      const cpId      = c(copyTable, 'CopyID', 'copy_id', 'ItemID', 'HoldingID');
      const cpTitleId = c(copyTable, 'TitleID', 'title_id', 'BibID', 'RecordID');

      if (cpId && cpTitleId) {
        joins.push(`LEFT JOIN [${copyTable}] cp ON t.[${titId}] = cp.[${cpTitleId}]`);

        if (checkTable) {
          const chkCopyId = c(checkTable, 'CopyID', 'copy_id', 'ItemID', 'HoldingID');
          const retCol    = c(checkTable, 'ReturnDate', 'return_date', 'CheckinDate', 'DateReturned');
          if (chkCopyId && retCol) {
            joins.push(`LEFT JOIN [${checkTable}] ch ON cp.[${cpId}] = ch.[${chkCopyId}] AND ch.[${retCol}] IS NULL`);
            copiesExpr = `COUNT(DISTINCT cp.[${cpId}]) as TotalCopies, COUNT(ch.[${chkCopyId}]) as CheckedOut`;
          } else {
            copiesExpr = `COUNT(DISTINCT cp.[${cpId}]) as TotalCopies, 0 as CheckedOut`;
          }
        } else {
          copiesExpr = `COUNT(DISTINCT cp.[${cpId}]) as TotalCopies, 0 as CheckedOut`;
        }
      }
    }

    const safe = (s: string) => s.replace(/'/g, "''");
    const whereClause = (search && titTitle)
      ? `WHERE t.[${titTitle}] LIKE '%${safe(search)}%'${titAuthor ? ` OR t.[${titAuthor}] LIKE '%${safe(search)}%'` : ''}`
      : '';

    const groupCols = selectCols.map(c => c.split(' as ')[0]);
    const groupBy = groupCols.length ? `GROUP BY ${groupCols.join(', ')}` : '';
    const orderBy = titTitle ? `ORDER BY t.[${titTitle}]` : '';

    const query = `
      SELECT TOP 100 ${selectCols.join(', ')}, ${copiesExpr}
      FROM [${titleTable}] t
      ${joins.join('\n')}
      ${whereClause}
      ${groupBy}
      ${orderBy}
    `;

    const result = await pool.request().query(query);
    return NextResponse.json({ items: result.recordset });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
