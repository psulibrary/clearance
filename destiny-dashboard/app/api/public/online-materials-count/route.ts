import { NextResponse } from 'next/server';
import { cacheGet, cacheSet, withCacheMeta } from '@/lib/cache';

const CACHE_KEY = '/api/public/online-materials-count';

// Online materials (subscribed e-books, journals, institutional repository)
// are vendor subscriptions with no per-copy "Acquired" date in Destiny — they
// only exist as current totals, tracked by this separate public API rather
// than the Destiny ILS. This route just proxies it, with the same
// cache-fallback pattern as the rest of this app's external calls (see
// lib/facebook.ts) so a hiccup upstream doesn't blank the dashboard widget.
const UPSTREAM_URL = 'https://psulibbiblio.vercel.app/api/public/online-materials-count';

export interface OnlineMaterialsCount {
  count: number;
  label: string;
  breakdown: { id: string; label: string; count: number }[];
  generatedAt: string;
}

export async function GET() {
  try {
    const res = await fetch(UPSTREAM_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Upstream returned ${res.status}`);
    const json = (await res.json()) as OnlineMaterialsCount;
    cacheSet(CACHE_KEY, json);
    return NextResponse.json(json);
  } catch (err: unknown) {
    const cached = await cacheGet<OnlineMaterialsCount>(CACHE_KEY);
    if (cached) return NextResponse.json(withCacheMeta(cached));
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
