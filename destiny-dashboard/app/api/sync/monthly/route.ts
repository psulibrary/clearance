import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { supabaseServer } from '@/lib/supabase-server';
import { getRoomUseConfig } from '@/lib/audit-room-use';

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const monthsBack = parseInt(searchParams.get('months') ?? '24', 10);

  if (isNaN(monthsBack) || monthsBack < 1 || monthsBack > 120) {
    return NextResponse.json({ error: 'months must be 1–120' }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const cfg = await getRoomUseConfig();
    const req = pool.request();
    req.input('monthsBack', sql.Int, monthsBack);

    const result = await req.query(`
      WITH Months AS (
        SELECT
          YEAR(DATEADD(month, -n, GETDATE()))  AS yr,
          MONTH(DATEADD(month, -n, GETDATE())) AS mo
        FROM (
          SELECT TOP (@monthsBack) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS n
          FROM sys.all_objects
        ) nums
      ),
      Checkouts AS (
        SELECT
          YEAR(CASE WHEN DateReturned IS NOT NULL THEN DateReturned ELSE DateOut END)  AS yr,
          MONTH(CASE WHEN DateReturned IS NOT NULL THEN DateReturned ELSE DateOut END) AS mo,
          COUNT(*) AS cnt
        FROM ${t(p,'Copy')}
        WHERE DateWithdrawn IS NULL
          AND (DateReturned IS NOT NULL OR (PatronID IS NOT NULL AND DateReturned IS NULL))
        GROUP BY
          YEAR(CASE WHEN DateReturned IS NOT NULL THEN DateReturned ELSE DateOut END),
          MONTH(CASE WHEN DateReturned IS NOT NULL THEN DateReturned ELSE DateOut END)
      ),
      Checkins AS (
        SELECT YEAR(DateReturned) AS yr, MONTH(DateReturned) AS mo, COUNT(*) AS cnt
        FROM ${t(p,'Copy')}
        WHERE DateWithdrawn IS NULL AND DateReturned IS NOT NULL
        GROUP BY YEAR(DateReturned), MONTH(DateReturned)
      ),
      ActivePatrons AS (
        SELECT YEAR(DateReturned) AS yr, MONTH(DateReturned) AS mo, COUNT(DISTINCT PatronID) AS cnt
        FROM ${t(p,'Copy')}
        WHERE DateWithdrawn IS NULL AND PatronID IS NOT NULL AND DateReturned IS NOT NULL
        GROUP BY YEAR(DateReturned), MONTH(DateReturned)
      ),
      NewPatrons AS (
        SELECT YEAR(Created) AS yr, MONTH(Created) AS mo, COUNT(*) AS cnt
        FROM ${t(p,'Patron')}
        WHERE Created IS NOT NULL
        GROUP BY YEAR(Created), MONTH(Created)
      ),
      NewItems AS (
        SELECT YEAR(Created) AS yr, MONTH(Created) AS mo, COUNT(*) AS cnt
        FROM ${t(p,'Copy')}
        WHERE DateWithdrawn IS NULL AND Created IS NOT NULL
        GROUP BY YEAR(Created), MONTH(Created)
      )
      SELECT
        m.yr                      AS year,
        m.mo                      AS month,
        ISNULL(co.cnt, 0)         AS checkouts,
        ISNULL(ci.cnt, 0)         AS checkins,
        ISNULL(ap.cnt, 0)         AS activePatrons,
        ISNULL(np.cnt, 0)         AS newPatrons,
        ISNULL(ni.cnt, 0)         AS newItems
      FROM Months m
      LEFT JOIN Checkouts    co ON co.yr = m.yr AND co.mo = m.mo
      LEFT JOIN Checkins     ci ON ci.yr = m.yr AND ci.mo = m.mo
      LEFT JOIN ActivePatrons ap ON ap.yr = m.yr AND ap.mo = m.mo
      LEFT JOIN NewPatrons   np ON np.yr = m.yr AND np.mo = m.mo
      LEFT JOIN NewItems     ni ON ni.yr = m.yr AND ni.mo = m.mo
      ORDER BY m.yr ASC, m.mo ASC
    `);

    type MonthRow = { year: number; month: number; checkouts: number; checkins: number; activePatrons: number; newPatrons: number; newItems: number };
    const rows = result.recordset as MonthRow[];

    // Enrich with room use per month if Audit is available
    const roomUseByMonth: Record<string, number> = {};
    if (cfg) {
      try {
        const ruRes = await pool.request().query(`
          SELECT YEAR(Created) AS yr, MONTH(Created) AS mo, COUNT(*) AS cnt
          FROM ${t(p,'Audit')}
          WHERE TransType = ${cfg.checkInType} AND TransModifier = ${cfg.inLibMod}
            AND DATEPART(hour, Created) >= 8 AND DATEPART(hour, Created) < 19
          GROUP BY YEAR(Created), MONTH(Created)
        `);
        for (const r of ruRes.recordset as { yr: number; mo: number; cnt: number }[]) {
          roomUseByMonth[`${r.yr}-${r.mo}`] = r.cnt;
        }
      } catch { /* skip */ }
    }

    const upsertRows = rows.map(r => {
      const roomUse = roomUseByMonth[`${r.year}-${r.month}`] ?? 0;
      return {
        year:           r.year,
        month:          r.month,
        checkouts:      r.checkouts,
        checkins:       r.checkins,
        active_patrons: r.activePatrons,
        new_patrons:    r.newPatrons,
        new_items:      r.newItems,
        room_use:       roomUse,
        total_borrows:  r.checkouts + roomUse,
      };
    });

    const { error } = await supabaseServer.from('monthly_circulation').upsert(upsertRows, { onConflict: 'year,month' });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, rows: upsertRows.length, roomUseAware: cfg !== null });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
