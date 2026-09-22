import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const result: Record<string, unknown> = {
    NEXT_PUBLIC_SUPABASE_URL:      url     ? `✅ Set (${url})` : '❌ NOT SET',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: key     ? `✅ Set (${key.slice(0, 20)}…)` : '❌ NOT SET',
  };

  if (!url || !key) {
    return NextResponse.json({ ...result, tableCheck: '⏭️ Skipped — env vars missing' });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('green_metrics')
      .select('count')
      .limit(1);

    if (error) {
      result.tableCheck = `❌ Query failed: ${error.message} (code: ${error.code})`;
      result.hint = error.code === '42P01'
        ? 'Table "green_metrics" does not exist — run the CREATE TABLE SQL in Supabase SQL Editor'
        : 'Check RLS policies or anon key permissions';
    } else {
      result.tableCheck = `✅ green_metrics table exists and is readable`;
      result.data = data;
    }
  } catch (err: unknown) {
    result.tableCheck = `❌ Exception: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json(result, { status: 200 });
}
