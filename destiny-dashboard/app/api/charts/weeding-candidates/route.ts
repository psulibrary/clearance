import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const years  = Math.min(10, Math.max(1, parseInt(searchParams.get('years') ?? '3', 10)));
  const limit  = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') ?? '20', 10)));

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();

    // Discover the in-library modifier from Audit (same logic as room-use API)
    let inLibMod: number | null = null;
    let checkInType: number = 2;
    try {
      const combosRes = await pool.request().query(`
        SELECT TransType, TransModifier, COUNT(*) AS cnt
        FROM ${t(p, 'Audit')}
        WHERE TransType != 30
        GROUP BY TransType, TransModifier
      `);
      const combos: { TransType: number; TransModifier: number; cnt: number }[] = combosRes.recordset;
      const modTotals: Record<number, number> = {};
      for (const c of combos) {
        if (c.TransModifier === 0) continue;
        modTotals[c.TransModifier] = (modTotals[c.TransModifier] ?? 0) + c.cnt;
      }
      const sorted = Object.entries(modTotals).sort((a, b) => Number(b[1]) - Number(a[1]));
      if (sorted.length > 0) {
        inLibMod = Number(sorted[0][0]);
        // Prefer TransType 2 (Check In) with this modifier for in-library use
        const hasCheckIn = combos.find(c => c.TransModifier === inLibMod && c.TransType === 2);
        checkInType = hasCheckIn ? 2 : (combos.find(c => c.TransModifier === inLibMod)?.TransType ?? 2);
      }
    } catch (_) { /* Audit table may not exist on all systems */ }

    const req = pool.request();
    req.input('years', sql.Int, years);
    req.input('limit', sql.Int, limit);

    // Base weeding condition: not withdrawn, not currently checked out, no activity in N years
    const weedCondition = `
      c.DateWithdrawn IS NULL
      AND c.PatronID IS NULL
      AND (c.DateReturned IS NULL OR DATEDIFF(year, c.DateReturned, GETDATE()) >= @years)
      AND DATEDIFF(year, ISNULL(c.DateReturned, c.Acquired), GETDATE()) >= @years
    `;

    let result, summary;

    if (inLibMod !== null) {
      // Exclude items that have recent in-library use in Audit
      req.input('mod', sql.Int, inLibMod);
      req.input('typ', sql.TinyInt, checkInType);
      req.input('years2', sql.Int, years);

      result = await req.query(`
        SELECT TOP (@limit)
          bm.Title,
          ISNULL(bm.Author, 'Unknown') AS Author,
          c.CallNumber,
          c.CopyBarcode,
          CONVERT(varchar(10), c.Acquired, 23)        AS Acquired,
          CONVERT(varchar(10), c.DateReturned, 23)    AS LastBorrowed,
          ISNULL(DATEDIFF(day, c.DateReturned, GETDATE()), DATEDIFF(day, c.Acquired, GETDATE())) AS daysSinceActivity,
          ISNULL(c.Price / 100.0, 0)                  AS Price,
          CONVERT(varchar(10), MAX(a.Created), 23)    AS LastRoomUse,
          COUNT(a.AuditID)                             AS roomUseCount
        FROM ${t(p,'Copy')} c
        JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
        LEFT JOIN ${t(p,'Audit')} a
          ON a.CopyID = c.CopyID
          AND a.TransType = @typ
          AND a.TransModifier = @mod
        WHERE ${weedCondition}
        GROUP BY
          bm.Title, bm.Author, c.CallNumber, c.CopyBarcode,
          c.Acquired, c.DateReturned, c.Price
        HAVING
          COUNT(a.AuditID) = 0
          OR MAX(a.Created) IS NULL
          OR DATEDIFF(year, MAX(a.Created), GETDATE()) >= @years2
        ORDER BY daysSinceActivity DESC
      `);

      summary = await pool.request()
        .input('y', sql.Int, years)
        .input('m', sql.Int, inLibMod)
        .input('tt', sql.TinyInt, checkInType)
        .query(`
          SELECT
            COUNT(*) AS candidateCount,
            SUM(ISNULL(c.Price / 100.0, 0)) AS totalValue
          FROM ${t(p,'Copy')} c
          LEFT JOIN (
            SELECT CopyID, MAX(Created) AS lastUse
            FROM ${t(p,'Audit')}
            WHERE TransType = @tt AND TransModifier = @m
            GROUP BY CopyID
          ) ru ON ru.CopyID = c.CopyID
          WHERE c.DateWithdrawn IS NULL
            AND c.PatronID IS NULL
            AND (c.DateReturned IS NULL OR DATEDIFF(year, c.DateReturned, GETDATE()) >= @y)
            AND DATEDIFF(year, ISNULL(c.DateReturned, c.Acquired), GETDATE()) >= @y
            AND (ru.lastUse IS NULL OR DATEDIFF(year, ru.lastUse, GETDATE()) >= @y)
        `);
    } else {
      // Fallback: checkout-only (no Audit data available)
      result = await pool.request()
        .input('years', sql.Int, years)
        .input('limit', sql.Int, limit)
        .query(`
          SELECT TOP (@limit)
            bm.Title,
            ISNULL(bm.Author, 'Unknown') AS Author,
            c.CallNumber,
            c.CopyBarcode,
            CONVERT(varchar(10), c.Acquired, 23)        AS Acquired,
            CONVERT(varchar(10), c.DateReturned, 23)    AS LastBorrowed,
            ISNULL(DATEDIFF(day, c.DateReturned, GETDATE()), DATEDIFF(day, c.Acquired, GETDATE())) AS daysSinceActivity,
            ISNULL(c.Price / 100.0, 0)                  AS Price,
            NULL AS LastRoomUse,
            0    AS roomUseCount
          FROM ${t(p,'Copy')} c
          JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
          WHERE ${weedCondition}
          ORDER BY daysSinceActivity DESC
        `);

      summary = await pool.request()
        .input('years2', sql.Int, years)
        .query(`
          SELECT COUNT(*) AS candidateCount, SUM(ISNULL(Price / 100.0, 0)) AS totalValue
          FROM ${t(p,'Copy')}
          WHERE DateWithdrawn IS NULL
            AND PatronID IS NULL
            AND (DateReturned IS NULL OR DATEDIFF(year, DateReturned, GETDATE()) >= @years2)
            AND DATEDIFF(year, ISNULL(DateReturned, Acquired), GETDATE()) >= @years2
        `);
    }

    return NextResponse.json({
      items: result.recordset,
      summary: summary.recordset[0],
      yearsThreshold: years,
      roomUseAware: inLibMod !== null,
      debug: { inLibMod, checkInType },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
