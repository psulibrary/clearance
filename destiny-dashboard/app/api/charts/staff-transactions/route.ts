import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { labelTransCombo } from '@/lib/audit-trans';
import { cacheKey, cacheGet, cacheSet } from '@/lib/cache';

/** Staff user IDs to include in the Staff Transactions report */
const STAFF_USER_IDS = [572608, 963453, 882550];

export async function GET(request: NextRequest) {
  const year = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()));
  const key = cacheKey('/api/charts/staff-transactions', request.nextUrl.searchParams);

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const schema = p.replace(/^\[|\]\.?$|\.$/g, '');

    const tablesRes = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = N'${schema}' AND TABLE_NAME = N'Audit'
    `);
    if (tablesRes.recordset.length === 0) {
      const json = {
        source: 'none',
        year,
        staffUserIds: STAFF_USER_IDS,
        message: 'Audit table not found in this Destiny schema.',
      };
      cacheSet(key, json);
      return NextResponse.json(json);
    }

    const audit = t(p, 'Audit');
    const req = pool.request();
    req.input('year', sql.Int, year);
    STAFF_USER_IDS.forEach((id, i) => req.input(`uid${i}`, sql.Int, id));
    const uidList = STAFF_USER_IDS.map((_, i) => `@uid${i}`).join(', ');

    const whereYear = `WHERE a.OriginatorUserID IN (${uidList}) AND YEAR(a.Created) = @year`;

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
      WHERE a.OriginatorUserID IN (${uidList})
    `);

    const byMonth = await req.query(`
      SELECT
        MONTH(a.Created) AS mo,
        a.OriginatorUserID AS originatorUserID,
        COUNT(*) AS transactions
      FROM ${audit} a
      ${whereYear}
      GROUP BY MONTH(a.Created), a.OriginatorUserID
      ORDER BY mo, originatorUserID
    `);

    const byMonthTotal = await req.query(`
      SELECT MONTH(a.Created) AS mo, COUNT(*) AS transactions
      FROM ${audit} a
      ${whereYear}
      GROUP BY MONTH(a.Created)
      ORDER BY mo
    `);

    const byStaff = await req.query(`
      SELECT a.OriginatorUserID AS originatorUserID, COUNT(*) AS transactions
      FROM ${audit} a
      ${whereYear}
      GROUP BY a.OriginatorUserID
      ORDER BY transactions DESC
    `);

    // TransType/TransModifier are tinyint/int — cast before concatenating
    const tt = await req.query(`
      SELECT
        a.TransType AS transTypeCode,
        a.TransModifier AS transModifier,
        COUNT(*) AS transactions
      FROM ${audit} a
      ${whereYear}
      GROUP BY a.TransType, a.TransModifier
      ORDER BY transactions DESC
    `);
    const byTransType = (tt.recordset as { transTypeCode: number; transModifier: number; transactions: number }[]).map((r) => ({
      transType: labelTransCombo(Number(r.transTypeCode), Number(r.transModifier)),
      transTypeCode: Number(r.transTypeCode),
      transModifier: Number(r.transModifier),
      transactions: Number(r.transactions),
    }));

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
      /* optional */
    }

    const staff = STAFF_USER_IDS.map((id) => ({
      originatorUserID: id,
      loginID: loginByUser[id] ?? null,
      transactions: (byStaff.recordset as { originatorUserID: number; transactions: number }[])
        .find((r) => Number(r.originatorUserID) === id)?.transactions ?? 0,
    }));

    const json = {
      source: 'audit',
      year,
      staffUserIds: STAFF_USER_IDS,
      totalThisYear: summary.recordset[0]?.totalThisYear ?? 0,
      totalAllTime: allTime.recordset[0]?.totalAllTime ?? 0,
      staff,
      byMonth: byMonthTotal.recordset,
      byMonthByStaff: byMonth.recordset,
      byTransType,
    };
    cacheSet(key, json);
    return NextResponse.json(json);
  } catch (err: unknown) {
    const cached = await cacheGet(key);
    if (cached) return NextResponse.json(cached.payload);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
