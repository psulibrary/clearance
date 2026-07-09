import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
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
        (SELECT ISNULL(SUM(Balance), 0) FROM ${t(p,'Fine')} WHERE Balance > 0)                                  AS totalFinesBalance,
        -- holds
        (SELECT COUNT(*) FROM ${t(p,'Hold')} WHERE IsReady = 0 AND ExpireDate > GETDATE())                      AS pendingHolds,
        -- never checked out
        (SELECT COUNT(*) FROM ${t(p,'Copy')}
          WHERE DateWithdrawn IS NULL AND PatronID IS NULL AND DateReturned IS NULL)                             AS neverCheckedOut
    `);

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
    }, { onConflict: 'snapshot_date' });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, snapshot_date: snapshotDate });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
