import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

/** Staff user IDs to include in the Staff Transactions report */
const STAFF_USER_IDS = [572608, 963453];

export async function GET(request: NextRequest) {
  const year = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()));

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const schema = p.replace(/^\[|\]\.?$|\.$/g, '');

    // Confirm Audit table exists
    const tablesRes = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = N'${schema}' AND TABLE_NAME = N'Audit'
    `);
    if (tablesRes.recordset.length === 0) {
      return NextResponse.json({
        source: 'none',
        year,
        staffUserIds: STAFF_USER_IDS,
        message: 'Audit table not found in this Destiny schema.',
      });
    }

    // Discover columns (case-safe)
    const colsRes = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = N'${schema}' AND TABLE_NAME = N'Audit'
      ORDER BY ORDINAL_POSITION
    `);
    const colsOrig: string[] = colsRes.recordset.map((r: { COLUMN_NAME: string }) => r.COLUMN_NAME);
    const actual = (candidates: string[]): string | null => {
      for (const c of candidates) {
        const found = colsOrig.find((col) => col.toLowerCase() === c.toLowerCase());
        if (found) return found;
      }
      return null;
    };

    const dateCol = actual(['Created', 'TransDate', 'TransactionDate', 'Date']);
    const userCol = actual(['OriginatorUserID', 'OriginatorUserId', 'UserID']);
    const typeCol = actual(['TransType', 'TransactionType', 'Type']);
    const modCol = actual(['TransModifier', 'Modifier']);

    if (!dateCol || !userCol) {
      return NextResponse.json({
        source: 'none',
        year,
        staffUserIds: STAFF_USER_IDS,
        message: 'Audit table is missing Created or OriginatorUserID columns.',
        debug: { cols: colsOrig },
      });
    }

    const audit = t(p, 'Audit');
    const req = pool.request();
    req.input('year', sql.Int, year);
    STAFF_USER_IDS.forEach((id, i) => req.input(`uid${i}`, sql.Int, id));
    const uidList = STAFF_USER_IDS.map((_, i) => `@uid${i}`).join(', ');

    const whereYear = `WHERE a.${userCol} IN (${uidList}) AND YEAR(a.${dateCol}) = @year`;

    // Summary totals
    const summary = await req.query(`
      SELECT COUNT(*) AS totalThisYear
      FROM ${audit} a
      ${whereYear}
    `);

    const allTimeReq = pool.request();
    STAFF_USER_IDS.forEach((id, i) => allTimeReq.input(`uid${i}`, sql.Int, id));
    const allTime = await allTimeReq.query(`
      SELECT COUNT(*) AS totalAllTime
      FROM ${audit} a
      WHERE a.${userCol} IN (${uidList})
    `);

    // Monthly totals (combined + per staff)
    const byMonth = await req.query(`
      SELECT
        MONTH(a.${dateCol}) AS mo,
        a.${userCol} AS originatorUserID,
        COUNT(*) AS transactions
      FROM ${audit} a
      ${whereYear}
      GROUP BY MONTH(a.${dateCol}), a.${userCol}
      ORDER BY mo, originatorUserID
    `);

    const byMonthTotal = await req.query(`
      SELECT MONTH(a.${dateCol}) AS mo, COUNT(*) AS transactions
      FROM ${audit} a
      ${whereYear}
      GROUP BY MONTH(a.${dateCol})
      ORDER BY mo
    `);

    // By staff user
    const byStaff = await req.query(`
      SELECT a.${userCol} AS originatorUserID, COUNT(*) AS transactions
      FROM ${audit} a
      ${whereYear}
      GROUP BY a.${userCol}
      ORDER BY transactions DESC
    `);

    // By transaction type
    let byTransType: { transType: string; transactions: number }[] = [];
    if (typeCol) {
      const typeSelect = modCol
        ? `CONCAT(a.${typeCol}, CASE WHEN a.${modCol} IS NULL OR a.${modCol} = '' THEN '' ELSE ' / ' + a.${modCol} END)`
        : `a.${typeCol}`;
      const tt = await req.query(`
        SELECT ${typeSelect} AS transType, COUNT(*) AS transactions
        FROM ${audit} a
        ${whereYear}
        GROUP BY ${typeSelect}
        ORDER BY transactions DESC
      `);
      byTransType = tt.recordset;
    }

    // Resolve login IDs from Users if available
    const loginByUser: Record<number, string> = {};
    try {
      const usersTable = await pool.request().query(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = N'${schema}' AND TABLE_NAME = N'Users'
      `);
      if (usersTable.recordset.length > 0) {
        const userReq = pool.request();
        STAFF_USER_IDS.forEach((id, i) => userReq.input(`uid${i}`, sql.Int, id));
        const users = await userReq.query(`
          SELECT UserID, LoginID FROM ${t(p, 'Users')}
          WHERE UserID IN (${uidList})
        `);
        for (const row of users.recordset as { UserID: number; LoginID: string }[]) {
          loginByUser[row.UserID] = row.LoginID;
        }
      }
    } catch {
      /* optional join */
    }

    const staff = STAFF_USER_IDS.map((id) => ({
      originatorUserID: id,
      loginID: loginByUser[id] ?? null,
      transactions: (byStaff.recordset as { originatorUserID: number; transactions: number }[])
        .find((r) => Number(r.originatorUserID) === id)?.transactions ?? 0,
    }));

    return NextResponse.json({
      source: 'audit',
      year,
      staffUserIds: STAFF_USER_IDS,
      totalThisYear: summary.recordset[0]?.totalThisYear ?? 0,
      totalAllTime: allTime.recordset[0]?.totalAllTime ?? 0,
      staff,
      byMonth: byMonthTotal.recordset,
      byMonthByStaff: byMonth.recordset,
      byTransType,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
