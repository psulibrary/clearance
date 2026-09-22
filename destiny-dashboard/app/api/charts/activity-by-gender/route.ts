import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { getRoomUseConfig } from '@/lib/audit-room-use';
import { cacheGet, cacheSet, withCacheMeta } from '@/lib/cache';

const CACHE_KEY = '/api/charts/activity-by-gender';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const cfg = await getRoomUseConfig();

    // Base checkout stats by gender
    const result = await pool.request().query(`
      SELECT
        CASE LTRIM(RTRIM(p.Gender))
          WHEN 'M' THEN 'Male'
          WHEN 'F' THEN 'Female'
          ELSE 'Unspecified'
        END AS gender,
        COUNT(DISTINCT p.PatronID)                                                                          AS totalPatrons,
        COUNT(DISTINCT CASE WHEN c.PatronID IS NOT NULL AND c.DateWithdrawn IS NULL THEN p.PatronID END)   AS patronsWithCheckouts,
        COUNT(CASE WHEN c.PatronID IS NOT NULL AND c.DateWithdrawn IS NULL THEN c.CopyID END)              AS totalCheckouts,
        COUNT(CASE WHEN c.PatronID IS NOT NULL AND c.DateReturned IS NULL AND c.DateWithdrawn IS NULL AND c.DateDue < GETDATE() THEN c.CopyID END) AS overdueItems
      FROM ${t(p,'Patron')} p
      LEFT JOIN ${t(p,'Copy')} c ON c.PatronID = p.PatronID
      GROUP BY LTRIM(RTRIM(p.Gender))
      ORDER BY totalPatrons DESC
    `);

    // Room use counts by gender (via Audit → PatronID → Patron.Gender)
    const roomUseMap: Record<string, { roomUse: number; roomUsePatrons: number }> = {};
    if (cfg) {
      try {
        const ruRes = await pool.request().query(`
          SELECT
            CASE LTRIM(RTRIM(p.Gender))
              WHEN 'M' THEN 'Male'
              WHEN 'F' THEN 'Female'
              ELSE 'Unspecified'
            END AS gender,
            COUNT(*) AS roomUse,
            COUNT(DISTINCT a.PatronID) AS roomUsePatrons
          FROM ${t(p,'Audit')} a
          JOIN ${t(p,'Patron')} p ON p.PatronID = a.PatronID
          WHERE a.TransType = ${cfg.checkInType} AND a.TransModifier = ${cfg.inLibMod}
            AND DATEPART(hour, a.Created) >= 8 AND DATEPART(hour, a.Created) < 19
          GROUP BY LTRIM(RTRIM(p.Gender))
        `);
        for (const r of ruRes.recordset as { gender: string; roomUse: number; roomUsePatrons: number }[]) {
          roomUseMap[r.gender] = r;
        }
      } catch { /* skip */ }
    }

    const data = result.recordset.map((r: {
      gender: string; totalPatrons: number; patronsWithCheckouts: number;
      totalCheckouts: number; overdueItems: number;
    }) => {
      const ru = roomUseMap[r.gender];
      const roomUse = ru?.roomUse ?? 0;
      const roomUsePatrons = ru?.roomUsePatrons ?? 0;
      // activePatrons = anyone who checked out OR had room use
      const activePatrons = Math.max(r.patronsWithCheckouts, roomUsePatrons);
      const totalBorrows = r.totalCheckouts + roomUse;
      return {
        name:               r.gender,
        totalPatrons:       r.totalPatrons,
        activePatrons,
        totalCheckouts:     r.totalCheckouts,
        roomUse,
        totalBorrows,
        overdueItems:       r.overdueItems,
        activeRate:         r.totalPatrons ? parseFloat((activePatrons / r.totalPatrons * 100).toFixed(1)) : 0,
        checkoutsPerPatron: r.totalPatrons ? parseFloat((r.totalCheckouts / r.totalPatrons).toFixed(2)) : 0,
        borrowsPerPatron:   r.totalPatrons ? parseFloat((totalBorrows / r.totalPatrons).toFixed(2)) : 0,
      };
    });

    const json = { data, roomUseAware: cfg !== null };
    cacheSet(CACHE_KEY, json);
    return NextResponse.json(json);
  } catch (err: unknown) {
    const cached = await cacheGet(CACHE_KEY);
    if (cached) return NextResponse.json(withCacheMeta(cached));
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
