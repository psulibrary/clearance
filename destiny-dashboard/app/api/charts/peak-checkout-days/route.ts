import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { getRoomUseConfig } from '@/lib/audit-room-use';

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const cfg = await getRoomUseConfig();

    // Checkouts by day of week
    const checkoutsRes = await pool.request().query(`
      SELECT
        DATEPART(weekday, DateOut) - 1  AS dayOfWeek,
        COUNT(*)                         AS checkouts
      FROM ${t(p,'Copy')}
      WHERE DateOut IS NOT NULL
      GROUP BY DATEPART(weekday, DateOut)
      ORDER BY dayOfWeek
    `);
    const checkoutMap: Record<number, number> = {};
    for (const r of checkoutsRes.recordset as { dayOfWeek: number; checkouts: number }[]) {
      checkoutMap[r.dayOfWeek] = r.checkouts;
    }

    // Room use by day of week (from Audit)
    const roomUseMap: Record<number, number> = {};
    if (cfg) {
      const ruRes = await pool.request().query(`
        SELECT
          DATEPART(weekday, Created) - 1  AS dayOfWeek,
          COUNT(*)                         AS roomUse
        FROM ${t(p,'Audit')}
        WHERE TransType = ${cfg.checkInType} AND TransModifier = ${cfg.inLibMod}
        GROUP BY DATEPART(weekday, Created)
        ORDER BY dayOfWeek
      `);
      for (const r of ruRes.recordset as { dayOfWeek: number; roomUse: number }[]) {
        roomUseMap[r.dayOfWeek] = r.roomUse;
      }
    }

    const rows = DAY_NAMES.map((day, i) => {
      const checkouts = checkoutMap[i] ?? 0;
      const roomUse   = roomUseMap[i]  ?? 0;
      return { day, checkouts, roomUse, totalUse: checkouts + roomUse };
    });

    return NextResponse.json({ rows, roomUseAware: cfg !== null });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
