import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export type RoomUseConfig = {
  inLibMod: number;
  checkInType: number;
};

// Discovers the in-library use TransType+TransModifier from the Audit table.
// Caches result in module scope so multiple routes in the same process share one DB call.
let _cached: RoomUseConfig | null | undefined = undefined;

export async function getRoomUseConfig(): Promise<RoomUseConfig | null> {
  if (_cached !== undefined) return _cached;
  try {
    const pool = await getPool();
    const p    = await getSchemaPrefix();
    const combosRes = await pool.request().query(`
      SELECT TransType, TransModifier, COUNT(*) AS cnt
      FROM ${t(p, 'Audit')}
      WHERE TransType != 30
      GROUP BY TransType, TransModifier
    `);
    const combos: { TransType: number; TransModifier: number; cnt: number }[] = combosRes.recordset;
    const modTotals: Record<number, number> = {};
    for (const c of combos) {
      if (c.TransModifier === 0) continue;
      modTotals[c.TransModifier] = (modTotals[c.TransModifier] ?? 0) + c.cnt;
    }
    const sorted = Object.entries(modTotals).sort((a, b) => Number(b[1]) - Number(a[1]));
    if (!sorted.length) { _cached = null; return null; }
    const inLibMod  = Number(sorted[0][0]);
    const hasCheckIn = combos.find(c => c.TransModifier === inLibMod && c.TransType === 2);
    const checkInType = hasCheckIn ? 2 : (combos.find(c => c.TransModifier === inLibMod)?.TransType ?? 2);
    _cached = { inLibMod, checkInType };
    return _cached;
  } catch {
    _cached = null;
    return null;
  }
}

// Library operating hours — records outside this window are system artifacts.
export const OPEN_HOUR  = 8;  // 8:00 AM
export const CLOSE_HOUR = 19; // 7:00 PM (exclusive, i.e. DATEPART(hour,...) < 19)

// SQL fragment that filters Audit for in-library room use records within operating hours.
// alias = table alias for the Audit table in the calling query.
export function roomUseWhere(cfg: RoomUseConfig, alias = 'a', dateCol = 'Created'): string {
  return `${alias}.TransType = ${cfg.checkInType} AND ${alias}.TransModifier = ${cfg.inLibMod}` +
    ` AND DATEPART(hour, ${alias}.${dateCol}) >= ${OPEN_HOUR}` +
    ` AND DATEPART(hour, ${alias}.${dateCol}) < ${CLOSE_HOUR}`;
}
