import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

async function findInLibraryCopySubquery(
  pool: Awaited<ReturnType<typeof getPool>>,
  schema: string,
): Promise<{ subquery: string | null; txTableName: string | null }> {
  const allTablesRes = await pool.request().query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = '${schema}' ORDER BY TABLE_NAME
  `);
  const allTables: string[] = allTablesRes.recordset.map((r: { TABLE_NAME: string }) => r.TABLE_NAME);

  const TX_CANDIDATES = [
    'CopyTransaction', 'CopyTrans', 'CircTransaction', 'CircTrans',
    'Transaction', 'CopyHistory', 'CircHistory', 'CopyLog', 'CircLog',
  ];
  const txTableName = TX_CANDIDATES.find((n) => allTables.includes(n)) ?? null;
  if (!txTableName) return { subquery: null, txTableName: null };

  const ctColsRes = await pool.request().query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${txTableName}'
    ORDER BY ORDINAL_POSITION
  `);
  const colsOrig: string[] = ctColsRes.recordset.map((r: { COLUMN_NAME: string }) => r.COLUMN_NAME);
  const actual = (candidates: string[]): string | null => {
    for (const c of candidates) {
      const found = colsOrig.find((col) => col.toLowerCase() === c);
      if (found) return found;
    }
    return null;
  };

  const copyIdCol = actual(['copyid']);
  const modCol = actual(['transmodifier', 'modifier', 'transmod', 'transactionmodifier']);
  const typeCol = actual(['transtype', 'transactiontype', 'type', 'circtranstype']);
  if (!copyIdCol) return { subquery: null, txTableName };

  const inLibFilter = modCol
    ? `${modCol} = 'In-Library'`
    : typeCol
      ? `${typeCol} = 'Checked in'`
      : null;
  if (!inLibFilter) return { subquery: null, txTableName };

  return {
    subquery: `
      SELECT DISTINCT ${copyIdCol} AS CopyID
      FROM [${schema}].[${txTableName}]
      WHERE ${inLibFilter} AND ${copyIdCol} IS NOT NULL
    `,
    txTableName,
  };
}

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const schema = p.replace(/^\[|\]\.?$|\.$/g, '');
    const { subquery: roomUseSubquery, txTableName } = await findInLibraryCopySubquery(pool, schema);

    // Base: active copies with no checkout history on the Copy row
    const neverCheckedOut = `
      c.DateWithdrawn IS NULL
      AND c.PatronID IS NULL
      AND c.DateReturned IS NULL
    `;

    const roomUseCte = roomUseSubquery
      ? `RoomUseCopies AS (${roomUseSubquery})`
      : null;

    const withCte = (sqlBody: string) =>
      roomUseCte ? `WITH ${roomUseCte} ${sqlBody}` : sqlBody;

    const neverUsedWhere = roomUseSubquery
      ? `${neverCheckedOut} AND NOT EXISTS (SELECT 1 FROM RoomUseCopies ru WHERE ru.CopyID = c.CopyID)`
      : neverCheckedOut;

    const roomUseOnlyWhere = roomUseSubquery
      ? `${neverCheckedOut} AND EXISTS (SELECT 1 FROM RoomUseCopies ru WHERE ru.CopyID = c.CopyID)`
      : '1 = 0';

    const deweyQuery = (whereClause: string) => withCte(`
      SELECT
        LEFT(LTRIM(c.CallNumber), 1) AS firstDigit,
        COUNT(DISTINCT bm.BibID)     AS titles,
        COUNT(c.CopyID)              AS items
      FROM ${t(p, 'Copy')} c
      JOIN ${t(p, 'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE ${whereClause}
        AND c.CallNumber IS NOT NULL AND c.CallNumber != ''
        AND LEFT(LTRIM(c.CallNumber), 1) BETWEEN '0' AND '9'
      GROUP BY LEFT(LTRIM(c.CallNumber), 1)
      ORDER BY items DESC
    `);

    const countQuery = (whereClause: string) => withCte(`
      SELECT
        COUNT(c.CopyID)          AS items,
        COUNT(DISTINCT bm.BibID) AS titles
      FROM ${t(p, 'Copy')} c
      JOIN ${t(p, 'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE ${whereClause}
    `);

    const collectionTotals = await pool.request().query(`
      SELECT
        COUNT(DISTINCT bm.BibID) AS totalTitles,
        COUNT(c.CopyID)          AS totalItems,
        SUM(CASE WHEN c.PatronID IS NULL AND c.DateReturned IS NULL THEN 1 ELSE 0 END) AS neverBorrowedItems,
        COUNT(DISTINCT CASE WHEN c.PatronID IS NULL AND c.DateReturned IS NULL THEN bm.BibID END) AS neverBorrowedTitles
      FROM ${t(p, 'Copy')} c
      JOIN ${t(p, 'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
    `);

    const [neverUsedByDewey, roomUseOnlyByDewey, neverUsedCounts, roomUseOnlyCounts] = await Promise.all([
      pool.request().query(deweyQuery(neverUsedWhere)),
      pool.request().query(deweyQuery(roomUseOnlyWhere)),
      pool.request().query(countQuery(neverUsedWhere)),
      pool.request().query(countQuery(roomUseOnlyWhere)),
    ]);

    const mapDewey = (rows: { firstDigit: string; titles: number; items: number }[]) =>
      rows.map((r) => ({
        firstDigit: r.firstDigit,
        titles: r.titles,
        items: r.items,
        neverBorrowedTitles: r.titles,
        neverBorrowedItems: r.items,
      }));

    const neverUsedItems = neverUsedCounts.recordset[0]?.items ?? 0;
    const neverUsedTitles = neverUsedCounts.recordset[0]?.titles ?? 0;
    const roomUseOnlyItems = roomUseOnlyCounts.recordset[0]?.items ?? 0;
    const roomUseOnlyTitles = roomUseOnlyCounts.recordset[0]?.titles ?? 0;
    const ct = collectionTotals.recordset[0] ?? {};

    return NextResponse.json({
      neverUsed: {
        byDewey: mapDewey(neverUsedByDewey.recordset),
        totals: { items: neverUsedItems, titles: neverUsedTitles },
      },
      roomUseOnly: {
        byDewey: mapDewey(roomUseOnlyByDewey.recordset),
        totals: { items: roomUseOnlyItems, titles: roomUseOnlyTitles },
      },
      byDewey: mapDewey(neverUsedByDewey.recordset),
      totals: {
        totalTitles: ct.totalTitles ?? 0,
        totalItems: ct.totalItems ?? 0,
        neverBorrowedItems: ct.neverBorrowedItems ?? 0,
        neverBorrowedTitles: ct.neverBorrowedTitles ?? 0,
        neverUsedItems,
        neverUsedTitles,
        roomUseOnlyItems,
        roomUseOnlyTitles,
      },
      roomUseAvailable: Boolean(roomUseSubquery),
      debug: { txTableName, roomUseDetected: Boolean(roomUseSubquery) },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
