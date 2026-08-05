import { NextResponse } from 'next/server';
import { getSlimsCampuses, getSlimsStats, withSlimsConnection } from '@/lib/slims-db';
import { supabaseServer } from '@/lib/supabase-server';

export interface SlimsSyncResult {
  campus: string;
  ok: boolean;
  error?: string;
}

export async function runSlimsSync(): Promise<SlimsSyncResult[]> {
  const campuses = getSlimsCampuses();
  const today = new Date().toISOString().slice(0, 10);
  const results: SlimsSyncResult[] = [];

  for (const cfg of campuses) {
    try {
      const stats = await withSlimsConnection(cfg, getSlimsStats);
      const { error } = await supabaseServer.from('campus_stats').upsert({
        campus: cfg.name,
        source: 'slims',
        period_type: 'daily',
        period_date: today,
        total_items: stats.totalItems,
        checked_out: stats.checkedOut,
        total_patrons: stats.totalPatrons,
        active_patrons: stats.activePatrons,
        checkouts: stats.checkoutsYtd,
        new_items: stats.newItemsYtd,
      }, { onConflict: 'campus,period_type,period_date' });
      if (error) throw new Error(error.message);
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
