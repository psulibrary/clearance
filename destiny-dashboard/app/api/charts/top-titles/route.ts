import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { getRoomUseConfig } from '@/lib/audit-room-use';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') ?? '20', 10)));

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const cfg = await getRoomUseConfig();
    const req = pool.request();
    req.input('limit', sql.Int, limit);

    const checkoutResult = await req.query(`
      SELECT TOP (@limit)
        bm.Title,
        ISNULL(bm.Author, 'Unknown') AS Author,
        bm.BibID,
        COUNT(c.CopyID) AS checkoutCount,
        COUNT(CASE WHEN c.DateReturned IS NULL AND c.PatronID IS NOT NULL THEN 1 END) AS currentlyOut
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
        AND (c.DateReturned IS NOT NULL OR c.PatronID IS NOT NULL)
      GROUP BY bm.BibID, bm.Title, bm.Author
      ORDER BY checkoutCount DESC
    `);

    type TitleRow = { Title: string; Author: string; BibID: number; checkoutCount: number; currentlyOut: number };
    const rows: TitleRow[] = checkoutResult.recordset;

    if (!cfg || rows.length === 0) {
      return NextResponse.json(rows.map(r => ({ ...r, roomUse: 0, totalUse: r.checkoutCount, roomUseAware: false })));
    }

    // Enrich with room use by BibID via Audit → CopyID → Copy.BibID
    const bibIds = rows.map(r => r.BibID).join(',');
    try {
      const ruRes = await pool.request().query(`
        SELECT c.BibID, COUNT(*) AS roomUse
        FROM ${t(p,'Audit')} a
        JOIN ${t(p,'Copy')} c ON c.CopyID = a.CopyID
        WHERE a.TransType = ${cfg.checkInType} AND a.TransModifier = ${cfg.inLibMod}
          AND DATEPART(hour, a.Created) >= 8 AND DATEPART(hour, a.Created) < 19
          AND c.BibID IN (${bibIds})
        GROUP BY c.BibID
      `);
      const ruMap: Record<number, number> = {};
      for (const r of ruRes.recordset as { BibID: number; roomUse: number }[]) {
        ruMap[r.BibID] = r.roomUse;
      }
      const enriched = rows.map(r => ({
        ...r,
        roomUse: ruMap[r.BibID] ?? 0,
        totalUse: r.checkoutCount + (ruMap[r.BibID] ?? 0),
      })).sort((a, b) => b.totalUse - a.totalUse);
      return NextResponse.json({ data: enriched, roomUseAware: true });
    } catch {
      return NextResponse.json({ data: rows.map(r => ({ ...r, roomUse: 0, totalUse: r.checkoutCount })), roomUseAware: false });
    }
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
