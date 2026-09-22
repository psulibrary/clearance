import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { cacheGet, cacheSet } from '@/lib/cache';

const CACHE_KEY = '/api/patron-types';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const result = await pool.request().query(`
      SELECT PatronTypeID, PatronTypeDescription
      FROM ${t(p,'PatronType')}
      WHERE PatronTypeDescription IS NOT NULL AND PatronTypeDescription <> ''
      ORDER BY PatronTypeDescription
    `);
    const json = { types: result.recordset };
    cacheSet(CACHE_KEY, json);
    return NextResponse.json(json);
  } catch (err: unknown) {
    const cached = await cacheGet(CACHE_KEY);
    if (cached) return NextResponse.json(cached.payload);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
