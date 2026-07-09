import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();

    const result = await pool.request().query(`
      SELECT
        DATEPART(weekday, DateOut) - 1  AS dayOfWeek,
        COUNT(*)                         AS checkouts
      FROM ${t(p,'Copy')}
      WHERE DateOut IS NOT NULL
      GROUP BY DATEPART(weekday, DateOut)
      ORDER BY dayOfWeek
    `);

    const rows = result.recordset.map((r: { dayOfWeek: number; checkouts: number }) => ({
      day: DAY_NAMES[r.dayOfWeek] ?? `Day ${r.dayOfWeek}`,
      checkouts: r.checkouts,
    }));

    return NextResponse.json(rows);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
