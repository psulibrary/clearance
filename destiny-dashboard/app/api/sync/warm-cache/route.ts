import { NextResponse } from 'next/server';

// Every route below writes its own successful response into the Supabase
// api_cache table (see lib/cache.ts). Hitting them here on a schedule keeps
// the cache warm even during long stretches with no dashboard traffic, so
// there's always something recent to fall back to if Destiny (MS SQL
// Server) goes offline. Paths mirror the default queries app/page.tsx
// issues on load.
const WARM_PATHS = [
  '/api/stats',
  '/api/strategic/stats',
  '/api/ched/stats',
  '/api/ched/acquisition-by-year',
  '/api/genders',
  '/api/patron-types',
  '/api/charts/activity-by-gender',
  '/api/charts/activity-by-patrontype',
  '/api/charts/avg-collection-age',
  '/api/charts/avg-loan-duration',
  '/api/charts/by-callnumber',
  '/api/charts/collection-age',
  '/api/charts/collection-by-category',
  '/api/charts/collection-by-circtype',
  '/api/charts/collection-by-funding',
  '/api/charts/collection-by-materialtype',
  '/api/charts/collection-by-pubYear',
  '/api/charts/collection-by-publisher',
  '/api/charts/collection-by-sublocation',
  '/api/charts/collection-by-year',
  '/api/charts/combined-use',
  '/api/charts/fines-by-patrontype',
  '/api/charts/gender',
  '/api/charts/lapsed-patrons',
  '/api/charts/longest-overdue?limit=10',
  '/api/charts/never-borrowed',
  '/api/charts/patron-growth?years=3',
  '/api/charts/patron-retention',
  '/api/charts/patron-tiers',
  '/api/charts/patron-type',
  '/api/charts/peak-checkout-days',
  '/api/charts/room-use',
  '/api/charts/top-active-patrons?limit=10',
  '/api/charts/top-titles',
  '/api/charts/weeding-candidates?years=3&limit=20',
  '/api/charts/yoy-circulation',
];

async function warmOne(baseUrl: string, path: string): Promise<{ path: string; ok: boolean; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${baseUrl}${path}`, { signal: controller.signal, cache: 'no-store' });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.error) return { path, ok: false, error: body?.error ?? `HTTP ${res.status}` };
    return { path, ok: true };
  } catch (err: unknown) {
    return { path, ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

async function runWarm(request: Request) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const results = await Promise.all(WARM_PATHS.map(path => warmOne(baseUrl, path)));
  const failed = results.filter(r => !r.ok);
  return { warmed: results.length - failed.length, failed };
}

// Called by Vercel Cron (GET with Authorization header)
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const summary = await runWarm(request);
  return NextResponse.json({ ok: true, ...summary });
}

// Called manually from the dashboard UI
export async function POST(request: Request) {
  const summary = await runWarm(request);
  return NextResponse.json({ ok: true, ...summary });
}
