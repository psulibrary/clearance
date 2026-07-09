import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { getRoomUseConfig } from '@/lib/audit-room-use';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const cfg = await getRoomUseConfig();
    const year = new Date().getFullYear();

    const buildQuery = (ruClause: string) => `
      WITH active_last AS (
        SELECT DISTINCT PatronID FROM ${t(p,'Copy')}
        WHERE PatronID IS NOT NULL AND YEAR(DateReturned) = @ly
        ${ruClause ? `UNION SELECT DISTINCT PatronID FROM ${t(p,'Audit')}
          WHERE PatronID IS NOT NULL AND YEAR(Created) = @ly ${ruClause}` : ''}
      ),
      active_this AS (
        SELECT DISTINCT PatronID FROM ${t(p,'Copy')}
        WHERE PatronID IS NOT NULL
          AND (YEAR(DateReturned) = @y OR (DateReturned IS NULL AND DateWithdrawn IS NULL))
        ${ruClause ? `UNION SELECT DISTINCT PatronID FROM ${t(p,'Audit')}
          WHERE PatronID IS NOT NULL AND YEAR(Created) = @y ${ruClause}` : ''}
      ),
      lapsed AS (
        SELECT al.PatronID FROM active_last al
        WHERE NOT EXISTS (SELECT 1 FROM active_this at2 WHERE at2.PatronID = al.PatronID)
      )
      SELECT
        (SELECT COUNT(*) FROM active_last)  AS activeLastYear,
        (SELECT COUNT(*) FROM active_this)  AS activeThisYear,
        (SELECT COUNT(*) FROM lapsed)       AS lapsedCount
    `;

    const buildByTypeQuery = (ruClause: string) => `
      WITH active_last AS (
        SELECT DISTINCT PatronID FROM ${t(p,'Copy')}
        WHERE PatronID IS NOT NULL AND YEAR(DateReturned) = @ly
        ${ruClause ? `UNION SELECT DISTINCT PatronID FROM ${t(p,'Audit')}
          WHERE PatronID IS NOT NULL AND YEAR(Created) = @ly ${ruClause}` : ''}
      ),
      active_this AS (
        SELECT DISTINCT PatronID FROM ${t(p,'Copy')}
        WHERE PatronID IS NOT NULL
          AND (YEAR(DateReturned) = @y OR (DateReturned IS NULL AND DateWithdrawn IS NULL))
        ${ruClause ? `UNION SELECT DISTINCT PatronID FROM ${t(p,'Audit')}
          WHERE PatronID IS NOT NULL AND YEAR(Created) = @y ${ruClause}` : ''}
      ),
      lapsed AS (
        SELECT al.PatronID FROM active_last al
        WHERE NOT EXISTS (SELECT 1 FROM active_this at2 WHERE at2.PatronID = al.PatronID)
      )
      SELECT
        ISNULL(pt.PatronTypeDescription, 'Unknown') AS patronType,
        COUNT(*) AS lapsedCount
      FROM lapsed l
      JOIN ${t(p,'SitePatron')} sp ON sp.PatronID = l.PatronID
      LEFT JOIN ${t(p,'PatronType')} pt ON pt.PatronTypeID = sp.PatronTypeID
      GROUP BY pt.PatronTypeDescription
      ORDER BY lapsedCount DESC
    `;

    let roomUseAware = false;
    let ruClause = '';
    if (cfg) {
      ruClause = `AND TransType = ${cfg.checkInType} AND TransModifier = ${cfg.inLibMod} AND DATEPART(hour, Created) >= 8 AND DATEPART(hour, Created) < 19`;
      roomUseAware = true;
    }

    const summaryReq = pool.request().input('y', sql.Int, year).input('ly', sql.Int, year - 1);
    const result = await summaryReq.query(buildQuery(ruClause));

    const byTypeReq = pool.request().input('y', sql.Int, year).input('ly', sql.Int, year - 1);
    const byType = await byTypeReq.query(buildByTypeQuery(ruClause));

    const r = result.recordset[0];
    const lapsedRate = r.activeLastYear > 0
      ? parseFloat(((r.lapsedCount / r.activeLastYear) * 100).toFixed(1))
      : 0;

    return NextResponse.json({ ...r, lapsedRate, year, roomUseAware, byType: byType.recordset });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
