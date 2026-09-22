import { NextResponse } from 'next/server';
import { getPageInsights } from '@/lib/facebook';
import { cacheGet, cacheSet } from '@/lib/cache';

const CACHE_KEY = '/api/facebook/insights';

export async function GET() {
  try {
    const json = await getPageInsights();
    cacheSet(CACHE_KEY, json);
    return NextResponse.json(json);
  } catch (err: unknown) {
    const cached = await cacheGet(CACHE_KEY);
    if (cached) return NextResponse.json(cached.payload);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
