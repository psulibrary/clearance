import { NextResponse } from 'next/server';
import { cacheGet, cacheSet, cacheKey, withCacheMeta } from '@/lib/cache';

/**
 * Server-side proxy to the ThesesVault API (https://thesesvault.palawansulibrary.com/api/v1).
 * The API key stays on the server (THESESVAULT_API_KEY) and never reaches the browser.
 * Like the other routes, a successful answer is cached so the tab still shows the last
 * known data if ThesesVault is unreachable.
 *
 *   GET /api/theses/insights?range=30d|90d|12m|all
 *   GET /api/theses/demand?range=30d|90d|12m|all
 *   GET /api/theses/collection
 */
const DATASETS = ['insights', 'demand', 'collection'] as const;
const RANGES = ['30d', '90d', '12m', 'all'];
const BASE = (process.env.THESESVAULT_API_URL || 'https://thesesvault.palawansulibrary.com/api/v1').replace(/\/+$/, '');

export async function GET(request: Request, { params }: { params: Promise<{ dataset: string }> }) {
  const { dataset } = await params;
  if (!(DATASETS as readonly string[]).includes(dataset)) {
    return NextResponse.json({ error: 'Unknown dataset' }, { status: 404 });
  }
  const key = process.env.THESESVAULT_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'THESESVAULT_API_KEY is not set on the server.' }, { status: 503 });
  }

  const range = new URL(request.url).searchParams.get('range') ?? '';
  const query = new URLSearchParams();
  if (dataset !== 'collection' && RANGES.includes(range)) query.set('range', range);
  const ck = cacheKey(`/api/theses/${dataset}`, query);

  try {
    const res = await fetch(`${BASE}/${dataset}${query.toString() ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) {
      throw new Error(body?.message || `ThesesVault answered ${res.status}`);
    }
    cacheSet(ck, body);
    return NextResponse.json(body);
  } catch (err: unknown) {
    const cached = await cacheGet<Record<string, unknown>>(ck);
    if (cached) return NextResponse.json(withCacheMeta(cached));
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
