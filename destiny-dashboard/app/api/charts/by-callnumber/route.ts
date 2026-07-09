import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { getRoomUseConfig } from '@/lib/audit-room-use';

const DEWEY_LABELS: Record<string, string> = {
  '0': '000 – Computer Science & Generalities',
  '1': '100 – Philosophy & Psychology',
  '2': '200 – Religion & Theology',
  '3': '300 – Social Sciences',
  '4': '400 – Language & Linguistics',
  '5': '500 – Pure Sciences',
  '6': '600 – Applied Sciences & Technology',
  '7': '700 – Arts & Recreation',
  '8': '800 – Literature',
  '9': '900 – History & Geography',
};

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const cfg = await getRoomUseConfig();

    const result = await pool.request().query(`
      SELECT
        LEFT(LTRIM(c.CallNumber), 1)                AS firstDigit,
        COUNT(c.CopyID)                              AS items,
        COUNT(DISTINCT c.BibID)                      AS titles,
        COUNT(CASE WHEN c.DateReturned IS NOT NULL
                     OR (c.PatronID IS NOT NULL AND c.DateReturned IS NULL)
                   THEN 1 END)                       AS checkouts
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
        AND c.CallNumber IS NOT NULL
        AND c.CallNumber != ''
        AND LEFT(LTRIM(c.CallNumber), 1) BETWEEN '0' AND '9'
      GROUP BY LEFT(LTRIM(c.CallNumber), 1)
      ORDER BY firstDigit
    `);

    // Room use by Dewey class via Audit → Copy
    const roomUseMap: Record<string, number> = {};
    if (cfg) {
      try {
        const ruRes = await pool.request().query(`
          SELECT
            LEFT(LTRIM(c.CallNumber), 1) AS firstDigit,
            COUNT(*) AS roomUse
          FROM ${t(p,'Audit')} a
          JOIN ${t(p,'Copy')} c ON c.CopyID = a.CopyID
          WHERE a.TransType = ${cfg.checkInType} AND a.TransModifier = ${cfg.inLibMod}
            AND c.CallNumber IS NOT NULL AND c.CallNumber != ''
            AND LEFT(LTRIM(c.CallNumber), 1) BETWEEN '0' AND '9'
          GROUP BY LEFT(LTRIM(c.CallNumber), 1)
        `);
        for (const r of ruRes.recordset as { firstDigit: string; roomUse: number }[]) {
          roomUseMap[r.firstDigit] = r.roomUse;
        }
      } catch { /* skip */ }
    }

    const rows = result.recordset.map((r: { firstDigit: string; items: number; titles: number; checkouts: number }) => {
      const roomUse = roomUseMap[r.firstDigit] ?? 0;
      const totalUse = r.checkouts + roomUse;
      return {
        range:      DEWEY_LABELS[r.firstDigit] ?? `${r.firstDigit}00s`,
        firstDigit: r.firstDigit,
        items:      r.items,
        titles:     r.titles,
        checkouts:  r.checkouts,
        roomUse,
        totalUse,
        utilRate:   r.items > 0 ? parseFloat(((totalUse / r.items) * 100).toFixed(1)) : 0,
      };
    });

    return NextResponse.json({ rows, roomUseAware: cfg !== null });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
