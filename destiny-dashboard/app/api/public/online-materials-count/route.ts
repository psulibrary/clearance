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

// Counts change whenever a librarian updates the upstream subscription
// numbers, so this route (and the browser's own request) must never serve a
// cached copy — force-dynamic keeps the platform from caching the route
// itself, and the no-store fetch + response header cover the two remaining
// caches (upstream's CDN and the browser's HTTP cache).
export const dynamic = 'force-dynamic';

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
    return NextResponse.json(json, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: unknown) {
    const cached = await cacheGet<OnlineMaterialsCount>(CACHE_KEY);
    if (cached) return NextResponse.json(withCacheMeta(cached), { headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
