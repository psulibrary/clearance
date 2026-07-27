import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { getRoomUseConfig } from '@/lib/audit-room-use';
import { cacheGet, cacheSet } from '@/lib/cache';

const CACHE_KEY = '/api/charts/never-borrowed';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const cfg = await getRoomUseConfig();

    // Items with no checkout AND no room use (truly never used). Room-use
    // activity is precomputed into a CTE and LEFT JOINed rather than checked
    // via a correlated EXISTS inside the aggregate expressions below — SQL
    // Server rejects "aggregate function on an expression containing an
    // aggregate or a subquery" for the latter in some query shapes.
    const roomUseCte = cfg
      ? `WITH RoomUseCopies AS (
           SELECT DISTINCT CopyID
           FROM ${t(p,'Audit')}
           WHERE TransType = ${cfg.checkInType} AND TransModifier = ${cfg.inLibMod}
             AND DATEPART(hour, Created) >= 8 AND DATEPART(hour, Created) < 19
         )`
      : '';
    const roomUseJoin = cfg ? `LEFT JOIN RoomUseCopies ru ON ru.CopyID = c.CopyID` : '';
    const neverUsedCond = cfg ? 'ru.CopyID IS NULL' : '1 = 1';

    const byDewey = await pool.request().query(`
      ${roomUseCte}
      SELECT
        LEFT(LTRIM(c.CallNumber), 1)  AS firstDigit,
        COUNT(DISTINCT bm.BibID)       AS neverUsedTitles,
        COUNT(c.CopyID)                AS neverUsedItems
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      ${roomUseJoin}
      WHERE c.DateWithdrawn IS NULL
        AND c.PatronID IS NULL
        AND c.DateReturned IS NULL
        AND c.CallNumber IS NOT NULL AND c.CallNumber != ''
        AND LEFT(LTRIM(c.CallNumber), 1) BETWEEN '0' AND '9'
        AND ${neverUsedCond}
      GROUP BY LEFT(LTRIM(c.CallNumber), 1)
      ORDER BY neverUsedItems DESC
    `);

    const totals = await pool.request().query(`
      ${roomUseCte}
      SELECT
        COUNT(DISTINCT bm.BibID) AS totalTitles,
        COUNT(c.CopyID)          AS totalItems,
        SUM(CASE WHEN c.PatronID IS NULL AND c.DateReturned IS NULL AND ${neverUsedCond}
                 THEN 1 ELSE 0 END) AS neverUsedItems,
        COUNT(DISTINCT CASE WHEN c.PatronID IS NULL AND c.DateReturned IS NULL AND ${neverUsedCond}
                            THEN bm.BibID END) AS neverUsedTitles,
        SUM(CASE WHEN c.PatronID IS NULL AND c.DateReturned IS NULL AND ${cfg ? 'ru.CopyID IS NOT NULL' : '1 = 0'}
                 THEN 1 ELSE 0 END) AS roomUseOnlyItems
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      ${roomUseJoin}
      WHERE c.DateWithdrawn IS NULL
    `);

    const json = {
      byDewey: byDewey.recordset,
      totals: totals.recordset[0],
      roomUseAware: cfg !== null,
    };
    cacheSet(CACHE_KEY, json);
    return NextResponse.json(json);
  } catch (err: unknown) {
    const cached = await cacheGet(CACHE_KEY);
    if (cached) return NextResponse.json(cached.payload);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
