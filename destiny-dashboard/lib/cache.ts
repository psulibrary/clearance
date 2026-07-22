import { supabaseServer } from '@/lib/supabase-server';

/**
 * Generic read-through cache for dashboard API routes.
 *
 * Every route that queries the Destiny MS SQL Server can call `cacheSet`
 * with its own successful response before returning it, and `cacheGet` in
 * its catch block to fall back to the last-known-good response when SQL
 * Server is unreachable. This keeps the dashboard showing *something*
 * during an outage instead of a blank widget or a raw error.
 */

export interface CacheEntry<T> {
  payload: T;
  syncedAt: string;
}

/** Build a stable cache key from a route path and its query string. */
export function cacheKey(pathname: string, searchParams?: URLSearchParams): string {
  if (!searchParams || [...searchParams.keys()].length === 0) return pathname;
  const sorted = new URLSearchParams([...searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)));
  return `${pathname}?${sorted.toString()}`;
}

export async function cacheGet<T = Record<string, unknown>>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const { data, error } = await supabaseServer
      .from('api_cache')
      .select('payload,synced_at')
      .eq('route', key)
      .maybeSingle();
    if (error || !data) return null;
    return { payload: data.payload as T, syncedAt: data.synced_at as string };
  } catch {
    return null;
  }
}

/** Fire-and-forget write — never let a cache write fail the live request. */
export function cacheSet(key: string, payload: unknown): void {
  supabaseServer
    .from('api_cache')
    .upsert({ route: key, payload, synced_at: new Date().toISOString() }, { onConflict: 'route' })
    .then(undefined, () => {});
}

/** Wraps a cached payload with the metadata the frontend needs to show a "stale data" banner. */
export function withCacheMeta<T extends object>(entry: CacheEntry<T>): T & { source: 'cache'; asOf: string } {
  return { ...entry.payload, source: 'cache', asOf: entry.syncedAt };
}
