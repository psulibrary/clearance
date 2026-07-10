import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

const IN_LIB_TYPE_CANDIDATES = [19, 25, 26, 27, 28];

async function findInLibraryCopySubquery(
  pool: Awaited<ReturnType<typeof getPool>>,
  schema: string,
): Promise<{ subquery: string | null; txTableName: string | null }> {
  // Destiny stores in-library use in Audit (numeric TransType/TransModifier)
  const auditExists = await pool.request().query(`
    SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = N'${schema}' AND TABLE_NAME = N'Audit'
  `);
  if (auditExists.recordset.length === 0) return { subquery: null, txTableName: null };

  const audit = `[${schema}].[Audit]`;

  // Prefer known in-library TransType codes
  const known = await pool.request().query(`
    SELECT TOP 1 a.TransType AS transType, COUNT(*) AS cnt
    FROM ${audit} a
    WHERE a.TransType IN (${IN_LIB_TYPE_CANDIDATES.join(',')}) AND a.CopyID IS NOT NULL
    GROUP BY a.TransType
    ORDER BY cnt DESC
  `);
  if (known.recordset[0]) {
    const tt = Number(known.recordset[0].transType);
    return {
      subquery: `
        SELECT DISTINCT a.CopyID
        FROM ${audit} a
        WHERE a.TransType = ${tt} AND a.CopyID IS NOT NULL
      `,
      txTableName: 'Audit',
    };
  }

  // Heuristic: non-checkout/renew combos that usually have no patron
  const heuristic = await pool.request().query(`
    SELECT TOP 1 a.TransType AS transType, a.TransModifier AS transModifier, COUNT(*) AS cnt
    FROM ${audit} a
    WHERE a.CopyID IS NOT NULL
      AND a.TransType NOT IN (1, 3)
      AND a.PatronID IS NULL
    GROUP BY a.TransType, a.TransModifier
    HAVING COUNT(*) >= 5
    ORDER BY cnt DESC
  `);
  if (heuristic.recordset[0]) {
    const tt = Number(heuristic.recordset[0].transType);
    const tm = Number(heuristic.recordset[0].transModifier);
    return {
      subquery: `
        SELECT DISTINCT a.CopyID
        FROM ${audit} a
        WHERE a.TransType = ${tt} AND a.TransModifier = ${tm} AND a.CopyID IS NOT NULL
      `,
      txTableName: 'Audit',
    };
  }

  // Check-in with non-zero modifier
  const checkIn = await pool.request().query(`
    SELECT TOP 1 a.TransModifier AS transModifier, COUNT(*) AS cnt
    FROM ${audit} a
    WHERE a.TransType = 2 AND a.TransModifier <> 0 AND a.CopyID IS NOT NULL
    GROUP BY a.TransModifier
    ORDER BY cnt DESC
  `);
  if (checkIn.recordset[0]) {
    const tm = Number(checkIn.recordset[0].transModifier);
    return {
      subquery: `
        SELECT DISTINCT a.CopyID
        FROM ${audit} a
        WHERE a.TransType = 2 AND a.TransModifier = ${tm} AND a.CopyID IS NOT NULL
      `,
      txTableName: 'Audit',
    };
  }

  return { subquery: null, txTableName: 'Audit' };
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
