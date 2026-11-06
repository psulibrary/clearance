import { NextResponse } from 'next/server';
import { cacheGet, cacheSet, cacheKey, withCacheMeta } from '@/lib/cache';

/**
 * Server-side proxy to the library attendance API (https://stat.palawansulibrary.com/api/v1).
 * The key stays on the server (STAT_API_KEY) and never reaches the browser. A successful answer is
 * cached so the Attendance tab still shows the last known data if the stats site is unreachable.
 *
 *   GET /api/stat/summary|trend|breakdown|yearly|heatmap|options?from=&to=&college=&group_by=...
 */
const DATASETS = ['summary', 'trend', 'breakdown', 'yearly', 'heatmap', 'options'] as const;
const FILTERS = ['from', 'to', 'college', 'program', 'major', 'section', 'purpose', 'role', 'interval', 'group_by', 'limit', 'years'];
const BASE = (process.env.STAT_API_URL || 'https://stat.palawansulibrary.com/api/v1').replace(/\/+$/, '');

export async function GET(request: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  if (!(DATASETS as readonly string[]).includes(dataset)) {
    return NextResponse.json({ error: 'Unknown dataset' }, { status: 404 });
  }
  const key = process.env.STAT_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'STAT_API_KEY is not set on the server.' }, { status: 503 });
  }

  const incoming = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const name of FILTERS) {
    const v = incoming.get(name);
    if (v) query.set(name, v);
  }
  const ck = cacheKey(`/api/stat/${dataset}`, query);

  try {
    const res = await fetch(`${BASE}/${dataset}${query.toString() ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      throw new Error(body?.message || `The stats site answered ${res.status}`);
    }
    cacheSet(ck, body);
    return NextResponse.json(body);
  } catch (err: unknown) {
    const cached = await cacheGet<Record<string, unknown>>(ck);
    if (cached) return NextResponse.json(withCacheMeta(cached));
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
