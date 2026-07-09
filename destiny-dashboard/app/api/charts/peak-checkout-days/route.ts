import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { getRoomUseConfig } from '@/lib/audit-room-use';

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// Named periods within operating hours (8am–7pm)
const PERIOD_NAMES = [
  'Morning (8–10am)',
  'Late Morning (10am–12pm)',
  'Lunch (12–2pm)',
  'Afternoon (2–4pm)',
  'Late Afternoon (4–6pm)',
  'Closing (6–7pm)',
];

function hourToPeriodIndex(h: number): number {
  if (h < 8)   return -1; // before open
  if (h < 10)  return 0;
  if (h < 12)  return 1;
  if (h < 14)  return 2;
  if (h < 16)  return 3;
  if (h < 18)  return 4;
  if (h < 19)  return 5;
  return -1; // after 7pm close
}

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
          AND DATEPART(hour, Created) >= 8 AND DATEPART(hour, Created) < 19
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

    // ── Time-of-day: checkouts by hour (operating hours only) ──
    const hourCheckoutRes = await pool.request().query(`
      SELECT
        DATEPART(hour, DateOut) AS hr,
        COUNT(*)                AS cnt
      FROM ${t(p,'Copy')}
      WHERE DateOut IS NOT NULL
        AND DATEPART(hour, DateOut) >= 8 AND DATEPART(hour, DateOut) < 19
      GROUP BY DATEPART(hour, DateOut)
    `);
    const hourCheckoutMap: Record<number, number> = {};
    for (const r of hourCheckoutRes.recordset as { hr: number; cnt: number }[]) {
      hourCheckoutMap[r.hr] = r.cnt;
    }

    // Time-of-day: room use by hour from Audit.Created
    const hourRoomUseMap: Record<number, number> = {};
    if (cfg) {
      try {
        const hrRuRes = await pool.request().query(`
          SELECT
            DATEPART(hour, Created) AS hr,
            COUNT(*)                AS cnt
          FROM ${t(p,'Audit')}
          WHERE TransType = ${cfg.checkInType} AND TransModifier = ${cfg.inLibMod}
            AND DATEPART(hour, Created) >= 8 AND DATEPART(hour, Created) < 19
          GROUP BY DATEPART(hour, Created)
        `);
        for (const r of hrRuRes.recordset as { hr: number; cnt: number }[]) {
          hourRoomUseMap[r.hr] = r.cnt;
        }
      } catch { /* skip */ }
    }

    // Build named periods array
    const periodMap: Record<number, { checkouts: number; roomUse: number }> = {};
    for (let h = 0; h < 24; h++) {
      const pi = hourToPeriodIndex(h);
      if (pi < 0) continue;
      if (!periodMap[pi]) periodMap[pi] = { checkouts: 0, roomUse: 0 };
      periodMap[pi].checkouts += hourCheckoutMap[h] ?? 0;
      periodMap[pi].roomUse   += hourRoomUseMap[h]  ?? 0;
    }
    const byPeriod = PERIOD_NAMES.map((period, i) => {
      const d = periodMap[i] ?? { checkouts: 0, roomUse: 0 };
      return { period, checkouts: d.checkouts, roomUse: d.roomUse, totalUse: d.checkouts + d.roomUse };
    }).filter(r => r.totalUse > 0);

    // Hourly heatmap — operating hours only (8am to 7pm)
    const byHour: { hour: number; label: string; checkouts: number; roomUse: number; totalUse: number }[] = [];
    for (let h = 8; h < 19; h++) {
      const co = hourCheckoutMap[h] ?? 0;
      const ru = hourRoomUseMap[h]  ?? 0;
      const ampm = h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
      byHour.push({ hour: h, label: ampm, checkouts: co, roomUse: ru, totalUse: co + ru });
    }

    return NextResponse.json({ rows, byPeriod, byHour, roomUseAware: cfg !== null });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
