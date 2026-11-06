import { NextResponse } from 'next/server';
import { cacheGet, cacheSet, cacheKey, withCacheMeta } from '@/lib/cache';

/**
 * Server-side proxy to the library reservation analytics API (https://reserve.palawansulibrary.com/Web/analytics-api.php).
 * The key stays on the server (RESERVE_API_KEY) and never reaches the browser. A successful answer is cached so the
 * Reservations tab still shows the last known data if the reservation site is unreachable.
 *
 *   GET /api/reservations/meta
 *   GET /api/reservations/charts?range=30d|90d|12m|ytd|all&resource=<room id>
 */
const REPORTS = ['meta', 'charts'] as const;
const FILTERS = ['range', 'from', 'to', 'resource'];
const URL_BASE = process.env.RESERVE_API_URL || 'https://reserve.palawansulibrary.com/Web/analytics-api.php';

export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  if (!(REPORTS as readonly string[]).includes(report)) {
    return NextResponse.json({ error: 'Unknown report' }, { status: 404 });
  }
  const key = process.env.RESERVE_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'RESERVE_API_KEY is not set on the server.' }, { status: 503 });
  }

  const incoming = new URL(request.url).searchParams;
  const query = new URLSearchParams({ report });
  if (report === 'charts') {
    for (const name of FILTERS) {
      const v = incoming.get(name);
      if (v) query.set(name, v);
    }
  }
  const ck = cacheKey(`/api/reservations/${report}`, query);

  try {
    const res = await fetch(`${URL_BASE}?${query}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      throw new Error(body?.message || `The reservation site answered ${res.status}`);
    }
    cacheSet(ck, body);
    return NextResponse.json(body);
  } catch (err: unknown) {
    const cached = await cacheGet<Record<string, unknown>>(ck);
    if (cached) return NextResponse.json(withCacheMeta(cached));
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
