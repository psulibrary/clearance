import { NextResponse } from 'next/server';
import { getSlimsCampuses, getSlimsStats, withSlimsConnection } from '@/lib/slims-db';
import { supabaseServer } from '@/lib/supabase-server';
import { recordAudit, detectAnomaly } from '@/lib/audit';

export interface SlimsSyncResult {
  campus: string;
  ok: boolean;
  error?: string;
  flagged?: boolean;
}

export async function runSlimsSync(): Promise<SlimsSyncResult[]> {
  const campuses = getSlimsCampuses();
  const today = new Date().toISOString().slice(0, 10);
  const results: SlimsSyncResult[] = [];

  for (const cfg of campuses) {
    try {
      const stats = await withSlimsConnection(cfg, getSlimsStats);
      const newRow = {
        campus: cfg.name,
        source: 'slims' as const,
        period_type: 'daily' as const,
        period_date: today,
        total_items: stats.totalItems,
        checked_out: stats.checkedOut,
        total_patrons: stats.totalPatrons,
        active_patrons: stats.activePatrons,
        checkouts: stats.checkoutsYtd,
        new_items: stats.newItemsYtd,
      };
      const entityKey = `${cfg.name}|daily|${today}`;

      // Compare against the most recent prior reading for this campus
      // (not necessarily yesterday — syncs can be missed) to catch a
      // connection blip that returns an empty/near-empty result set
      // instead of erroring outright.
      const { data: prevRow } = await supabaseServer
        .from('campus_stats')
        .select('*')
        .eq('campus', cfg.name)
        .lt('period_date', today)
        .order('period_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const anomaly = prevRow ? detectAnomaly(prevRow.total_items, stats.totalItems) : null;

      if (anomaly) {
        // Don't let a bad reading clobber the last known-good row — log
        // it as flagged-and-skipped instead of applying it.
        await recordAudit({
          entityType: 'campus_stats', entityKey, source: 'slims_sync',
          oldValue: prevRow, newValue: newRow,
          flagged: true, flagReason: `total_items ${anomaly} — write skipped`,
        });
        results.push({ campus: cfg.name, ok: false, flagged: true, error: `Anomaly detected, skipped: total_items ${anomaly}` });
        continue;
      }

      const { error } = await supabaseServer.from('campus_stats').upsert(newRow, { onConflict: 'campus,period_type,period_date' });
      if (error) throw new Error(error.message);

      await recordAudit({ entityType: 'campus_stats', entityKey, source: 'slims_sync', oldValue: prevRow, newValue: newRow });
      results.push({ campus: cfg.name, ok: true });
    } catch (err: unknown) {
      results.push({ campus: cfg.name, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return results;
}

// Called by Vercel Cron (GET with Authorization header)
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const results = await runSlimsSync();
  return NextResponse.json({ ok: true, results });
}

// Called manually from the dashboard UI
export async function POST() {
  const results = await runSlimsSync();
  return NextResponse.json({ ok: true, results });
}
