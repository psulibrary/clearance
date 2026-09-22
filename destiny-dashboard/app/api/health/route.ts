import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { supabaseServer } from '@/lib/supabase-server';

// Cheap connectivity probe the dashboard polls to decide whether to show
// the "showing cached data" banner. Doesn't touch the response cache itself.
export async function GET() {
  let mssqlOk = false;
  let mssqlError: string | undefined;
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1');
    mssqlOk = true;
  } catch (err: unknown) {
    mssqlError = err instanceof Error ? err.message : String(err);
  }

  let cacheAsOf: string | null = null;
  try {
    const { data } = await supabaseServer
      .from('api_cache')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    cacheAsOf = data?.synced_at ?? null;
  } catch {
    // Supabase itself unreachable — leave cacheAsOf null, mssqlOk still reflects reality
  }

  return NextResponse.json({ mssqlOk, mssqlError, cacheAsOf });
}
