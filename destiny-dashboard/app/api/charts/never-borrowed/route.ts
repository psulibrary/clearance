import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { getRoomUseConfig } from '@/lib/audit-room-use';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const cfg = await getRoomUseConfig();

    // Items with no checkout AND no room use (truly never used)
    const ruExclude = cfg
      ? `AND NOT EXISTS (
          SELECT 1 FROM ${t(p,'Audit')} a
          WHERE a.CopyID = c.CopyID
            AND a.TransType = ${cfg.checkInType} AND a.TransModifier = ${cfg.inLibMod}
        )`
      : '';

    const byDewey = await pool.request().query(`
      SELECT
        LEFT(LTRIM(c.CallNumber), 1)  AS firstDigit,
        COUNT(DISTINCT bm.BibID)       AS neverUsedTitles,
        COUNT(c.CopyID)                AS neverUsedItems
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
        AND c.PatronID IS NULL
        AND c.DateReturned IS NULL
        AND c.CallNumber IS NOT NULL AND c.CallNumber != ''
        AND LEFT(LTRIM(c.CallNumber), 1) BETWEEN '0' AND '9'
        ${ruExclude}
      GROUP BY LEFT(LTRIM(c.CallNumber), 1)
      ORDER BY neverUsedItems DESC
    `);

    const ruOnlyExpr = cfg
      ? `SUM(CASE WHEN c.PatronID IS NULL AND c.DateReturned IS NULL
                       AND EXISTS (
                         SELECT 1 FROM ${t(p,'Audit')} a
                         WHERE a.CopyID = c.CopyID
                           AND a.TransType = ${cfg.checkInType} AND a.TransModifier = ${cfg.inLibMod}
                       )
                  THEN 1 ELSE 0 END)`
      : '0';

    const neverUsedWhere = cfg
      ? `AND NOT EXISTS (
           SELECT 1 FROM ${t(p,'Audit')} a
           WHERE a.CopyID = c.CopyID
             AND a.TransType = ${cfg.checkInType} AND a.TransModifier = ${cfg.inLibMod}
         )`
      : '';

    const totals = await pool.request().query(`
      SELECT
        COUNT(DISTINCT bm.BibID) AS totalTitles,
        COUNT(c.CopyID)          AS totalItems,
        SUM(CASE WHEN c.PatronID IS NULL AND c.DateReturned IS NULL ${neverUsedWhere}
                 THEN 1 ELSE 0 END) AS neverUsedItems,
        COUNT(DISTINCT CASE WHEN c.PatronID IS NULL AND c.DateReturned IS NULL ${neverUsedWhere}
                            THEN bm.BibID END) AS neverUsedTitles,
        ${ruOnlyExpr} AS roomUseOnlyItems
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
    `);

    return NextResponse.json({
      byDewey: byDewey.recordset,
      totals: totals.recordset[0],
      roomUseAware: cfg !== null,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
