import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { supabaseServer } from '@/lib/supabase-server';
import { getRoomUseConfig } from '@/lib/audit-room-use';

async function runSync() {
  const pool = await getPool();
  const p = await getSchemaPrefix();
  const cfg = await getRoomUseConfig();
  const req = pool.request();
  const today = new Date();
  req.input('year', sql.Int, today.getFullYear());

  const result = await req.query(`
    DECLARE @today DATE = CAST(GETDATE() AS DATE);
    DECLARE @ago7  DATE = DATEADD(day, -7,  @today);
    DECLARE @ago30 DATE = DATEADD(day, -30, @today);
    DECLARE @ytdStart DATE = DATEFROMPARTS(YEAR(GETDATE()), 1, 1);

    SELECT
      -- items
      (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateWithdrawn IS NULL)                                        AS totalItems,
      (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateWithdrawn IS NULL AND PatronID IS NOT NULL AND DateReturned IS NULL) AS checkedOut,
      (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateWithdrawn IS NULL AND (PatronID IS NULL OR DateReturned IS NOT NULL)) AS available,
      (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateWithdrawn IS NULL AND PatronID IS NOT NULL AND DateReturned IS NULL AND DateOut < @ago30) AS overdue,
      -- patrons
      (SELECT COUNT(*) FROM ${t(p,'Patron')})                                                                  AS totalPatrons,
      (SELECT COUNT(DISTINCT PatronID) FROM ${t(p,'Copy')}
        WHERE DateWithdrawn IS NULL AND PatronID IS NOT NULL
          AND (DateReturned >= @ago30 OR (DateReturned IS NULL AND DateOut >= @ago30)))                        AS activePatrons30d,
      (SELECT COUNT(*) FROM ${t(p,'Patron')} WHERE Created IS NOT NULL AND Created >= @ytdStart)               AS newPatronsYtd,
      -- checkouts
      (SELECT COUNT(*) FROM ${t(p,'Copy')}
        WHERE DateWithdrawn IS NULL
          AND (DateReturned >= @ytdStart OR (DateReturned IS NULL AND PatronID IS NOT NULL AND DateOut >= @ytdStart))) AS checkoutsYtd,
      (SELECT COUNT(*) FROM ${t(p,'Copy')}
        WHERE DateWithdrawn IS NULL
          AND (DateReturned >= @ago7 OR (DateReturned IS NULL AND PatronID IS NOT NULL AND DateOut >= @ago7)))  AS checkouts7d,
      (SELECT COUNT(*) FROM ${t(p,'Copy')}
        WHERE DateWithdrawn IS NULL
          AND (DateReturned >= @ago30 OR (DateReturned IS NULL AND PatronID IS NOT NULL AND DateOut >= @ago30))) AS checkouts30d,
      -- fines
      (SELECT ISNULL(SUM(Amount - AmountPaid - AmountWaived), 0)
        FROM ${t(p,'Fine')} WHERE Active = 1 AND (Amount - AmountPaid - AmountWaived) > 0) AS totalFinesBalance,
      -- holds
      (SELECT COUNT(*) FROM ${t(p,'Hold')} WHERE IsReady = 0 AND ExpireDate > GETDATE())                      AS pendingHolds,
      -- never checked out
      (SELECT COUNT(*) FROM ${t(p,'Copy')}
        WHERE DateWithdrawn IS NULL AND PatronID IS NULL AND DateReturned IS NULL)                             AS neverCheckedOut
  `);

  // Room use enrichment (best-effort)
  let roomUseYtd = 0, roomUse7d = 0, roomUse30d = 0;
  if (cfg) {
    try {
      const ruRes = await pool.request().query(`
        DECLARE @today2 DATE = CAST(GETDATE() AS DATE);
        DECLARE @ago7b  DATE = DATEADD(day, -7,  @today2);
        DECLARE @ago30b DATE = DATEADD(day, -30, @today2);
        DECLARE @ytd2   DATE = DATEFROMPARTS(YEAR(GETDATE()), 1, 1);
        SELECT
          (SELECT COUNT(*) FROM ${t(p,'Audit')}
           WHERE TransType = ${cfg.checkInType} AND TransModifier = ${cfg.inLibMod}
             AND DATEPART(hour, Created) >= 8 AND DATEPART(hour, Created) < 19
             AND Created >= @ytd2)   AS roomUseYtd,
          (SELECT COUNT(*) FROM ${t(p,'Audit')}
           WHERE TransType = ${cfg.checkInType} AND TransModifier = ${cfg.inLibMod}
             AND DATEPART(hour, Created) >= 8 AND DATEPART(hour, Created) < 19
             AND Created >= @ago7b)  AS roomUse7d,
          (SELECT COUNT(*) FROM ${t(p,'Audit')}
           WHERE TransType = ${cfg.checkInType} AND TransModifier = ${cfg.inLibMod}
             AND DATEPART(hour, Created) >= 8 AND DATEPART(hour, Created) < 19
             AND Created >= @ago30b) AS roomUse30d
      `);
      const ru = ruRes.recordset[0] as { roomUseYtd: number; roomUse7d: number; roomUse30d: number };
      roomUseYtd = ru.roomUseYtd;
      roomUse7d  = ru.roomUse7d;
      roomUse30d = ru.roomUse30d;
    } catch { /* skip */ }
  }

  const row = result.recordset[0] as {
    totalItems: number; checkedOut: number; available: number; overdue: number;
    totalPatrons: number; activePatrons30d: number; newPatronsYtd: number;
    checkoutsYtd: number; checkouts7d: number; checkouts30d: number;
    totalFinesBalance: number; pendingHolds: number; neverCheckedOut: number;
  };

  const snapshotDate = today.toISOString().slice(0, 10);

  const { error } = await supabaseServer.from('daily_snapshots').upsert({
    snapshot_date:        snapshotDate,
    total_items:          row.totalItems,
    checked_out:          row.checkedOut,
    available:            row.available,
    overdue:              row.overdue,
    total_patrons:        row.totalPatrons,
    active_patrons_30d:   row.activePatrons30d,
    new_patrons_ytd:      row.newPatronsYtd,
    checkouts_ytd:        row.checkoutsYtd,
    checkouts_7d:         row.checkouts7d,
    checkouts_30d:        row.checkouts30d,
    total_fines_balance:  row.totalFinesBalance,
    pending_holds:        row.pendingHolds,
    never_checked_out:    row.neverCheckedOut,
    room_use_ytd:         roomUseYtd,
    room_use_7d:          roomUse7d,
    room_use_30d:         roomUse30d,
    total_borrows_ytd:    row.checkoutsYtd + roomUseYtd,
    total_borrows_7d:     row.checkouts7d  + roomUse7d,
    total_borrows_30d:    row.checkouts30d + roomUse30d,
  }, { onConflict: 'snapshot_date' });

  if (error) throw new Error(error.message);

  return snapshotDate;
}

// Called by Vercel Cron (GET with Authorization header)
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const snapshotDate = await runSync();
    return NextResponse.json({ ok: true, snapshot_date: snapshotDate });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// Called manually from the dashboard UI
export async function POST() {
  try {
    const snapshotDate = await runSync();
    return NextResponse.json({ ok: true, snapshot_date: snapshotDate });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
