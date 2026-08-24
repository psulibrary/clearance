import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { getRoomUseConfig } from '@/lib/audit-room-use';
import { cacheKey, cacheGet, cacheSet } from '@/lib/cache';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Default display cap stays 10; export uses a much higher explicit limit.
  const limit = Math.min(5000, Math.max(5, parseInt(searchParams.get('limit') ?? '10', 10)));
  const year  = new Date().getFullYear();
  const key = cacheKey('/api/charts/top-active-patrons', searchParams);

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const cfg = await getRoomUseConfig();
    const req = pool.request();
    req.input('limit', sql.Int, limit);
    req.input('year',  sql.Int, year);

    // Base query: checkouts per patron
    const checkoutRes = await req.query(`
      SELECT TOP (@limit)
        sp.PatronBarcode,
        p.LastName,
        p.FirstName,
        ISNULL(pt.PatronTypeDescription, 'Unknown') AS PatronType,
        p.PatronID,
        COUNT(c.CopyID)                              AS totalCheckouts,
        COUNT(CASE WHEN YEAR(c.DateReturned) = @year
                     OR (c.DateReturned IS NULL AND c.PatronID IS NOT NULL)
                   THEN 1 END)                       AS checkoutsThisYear,
        COUNT(CASE WHEN c.DateReturned IS NULL
                    AND c.PatronID IS NOT NULL
                    AND c.DateDue IS NOT NULL
                    AND DATEDIFF(day, c.DateDue, GETDATE()) >= 1
                   THEN 1 END)                       AS overdueCount
      FROM ${t(p,'Patron')} p
      JOIN ${t(p,'SitePatron')} sp  ON sp.PatronID = p.PatronID
      LEFT JOIN ${t(p,'PatronType')} pt ON sp.PatronTypeID = pt.PatronTypeID
      LEFT JOIN ${t(p,'Copy')} c    ON c.PatronID = p.PatronID AND c.DateWithdrawn IS NULL
      GROUP BY sp.PatronBarcode, p.LastName, p.FirstName, pt.PatronTypeDescription, p.PatronID
      HAVING COUNT(c.CopyID) > 0
      ORDER BY totalCheckouts DESC
    `);

    type PatronRow = {
      PatronBarcode: string; LastName: string; FirstName: string;
      PatronType: string; PatronID: number;
      totalCheckouts: number; checkoutsThisYear: number; overdueCount: number;
    };
    const rows: PatronRow[] = checkoutRes.recordset;

    // Enrich with room use counts if Audit is available
    let roomUseAware = false;
    if (cfg && rows.length > 0) {
      const patronIds = rows.map(r => r.PatronID).join(',');
      try {
        const ruRes = await pool.request().query(`
          SELECT PatronID,
            COUNT(*) AS totalRoomUse,
            COUNT(CASE WHEN YEAR(Created) = ${year} THEN 1 END) AS roomUseThisYear
          FROM ${t(p,'Audit')}
          WHERE TransType = ${cfg.checkInType} AND TransModifier = ${cfg.inLibMod}
            AND DATEPART(hour, Created) >= 8 AND DATEPART(hour, Created) < 19
            AND PatronID IN (${patronIds})
          GROUP BY PatronID
        `);
        const ruMap: Record<number, { totalRoomUse: number; roomUseThisYear: number }> = {};
        for (const r of ruRes.recordset as { PatronID: number; totalRoomUse: number; roomUseThisYear: number }[]) {
          ruMap[r.PatronID] = r;
        }
        roomUseAware = true;
        const json = {
          roomUseAware: true,
          patrons: rows.map(r => ({
            PatronBarcode: r.PatronBarcode,
            LastName: r.LastName,
            FirstName: r.FirstName,
            PatronType: r.PatronType,
            totalCheckouts: r.totalCheckouts,
            checkoutsThisYear: r.checkoutsThisYear,
            overdueCount: r.overdueCount,
            totalRoomUse: ruMap[r.PatronID]?.totalRoomUse ?? 0,
            roomUseThisYear: ruMap[r.PatronID]?.roomUseThisYear ?? 0,
            totalUse: r.totalCheckouts + (ruMap[r.PatronID]?.totalRoomUse ?? 0),
            totalUseThisYear: r.checkoutsThisYear + (ruMap[r.PatronID]?.roomUseThisYear ?? 0),
          })).sort((a, b) => b.totalUse - a.totalUse),
        };
        cacheSet(key, json);
        return NextResponse.json(json);
      } catch { /* fall through to checkout-only */ }
    }

    const json = {
      roomUseAware,
      patrons: rows.map(r => ({
        PatronBarcode: r.PatronBarcode,
        LastName: r.LastName,
        FirstName: r.FirstName,
        PatronType: r.PatronType,
        totalCheckouts: r.totalCheckouts,
        checkoutsThisYear: r.checkoutsThisYear,
        overdueCount: r.overdueCount,
        totalRoomUse: 0,
        roomUseThisYear: 0,
        totalUse: r.totalCheckouts,
        totalUseThisYear: r.checkoutsThisYear,
      })),
    };
    cacheSet(key, json);
    return NextResponse.json(json);
  } catch (err: unknown) {
    const cached = await cacheGet(key);
    if (cached) return NextResponse.json(cached.payload);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
