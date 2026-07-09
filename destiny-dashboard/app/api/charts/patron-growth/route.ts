import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const years = Math.min(5, Math.max(1, parseInt(searchParams.get('years') ?? '3', 10)));

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const req = pool.request();
    req.input('years', sql.Int, years);

    const result = await req.query(`
      SELECT
        YEAR(DateEntered)  AS yr,
        MONTH(DateEntered) AS mo,
        COUNT(*)           AS newPatrons
      FROM ${t(p,'Patron')}
      WHERE DateEntered IS NOT NULL
        AND DateEntered >= DATEADD(year, -@years, GETDATE())
      GROUP BY YEAR(DateEntered), MONTH(DateEntered)
      ORDER BY yr, mo
    `);

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const rows = result.recordset.map((r: { yr: number; mo: number; newPatrons: number }) => ({
      label: `${MONTHS[r.mo - 1]} ${r.yr}`,
      yr: r.yr,
      mo: r.mo,
      newPatrons: r.newPatrons,
    }));

    return NextResponse.json(rows);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
