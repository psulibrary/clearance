import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET(request: NextRequest) {
  const year = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()));

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const schema = p.replace(/^\[|\]\.?$|\.$/g, '');

    // Discover which column Destiny uses for in-library use count on the Copy table
    const colCheck = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = 'Copy'
        AND LOWER(COLUMN_NAME) IN ('localusecount','inhousecount','inlibrarycount','localuse','inhouse')
    `);
    const useCol = colCheck.recordset[0]?.COLUMN_NAME ?? null;

    // Check for a separate CopyLocalUse / InHouseUse transaction table
    const txTableCheck = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${schema}'
        AND LOWER(TABLE_NAME) IN ('copylocaluse','inhouseuse','localuse','inlibraryuse')
    `);
    const txTable = txTableCheck.recordset[0]?.TABLE_NAME ?? null;

    // Also check Copy table for a DateLocalUse or similar date column
    const dateColCheck = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = 'Copy'
        AND LOWER(COLUMN_NAME) IN ('datelocaluse','dateinhouseuse','datelastlocaluse','datelastinhouse')
    `);
    const dateCol = dateColCheck.recordset[0]?.COLUMN_NAME ?? null;

    const req = pool.request();
    req.input('year', sql.Int, year);

    // ── Strategy 1: transaction table with date column (most granular) ──
    if (txTable) {
      // Discover columns on the transaction table
      const txCols = await pool.request().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${txTable}'
        ORDER BY ORDINAL_POSITION
      `);
      const cols = txCols.recordset.map((r: { COLUMN_NAME: string }) => r.COLUMN_NAME.toLowerCase());
      const hasYear  = cols.some((c: string) => c.includes('date') || c.includes('year'));
      const dateColName = txCols.recordset.find((r: { COLUMN_NAME: string }) => r.COLUMN_NAME.toLowerCase().includes('date'))?.COLUMN_NAME;

      if (hasYear && dateColName) {
        const summary = await req.query(`
          SELECT
            COUNT(*) AS totalThisYear,
            COUNT(DISTINCT MONTH(${dateColName})) AS monthsWithData
          FROM [${schema}].[${txTable}]
          WHERE YEAR(${dateColName}) = @year
        `);

        const byMonth = await req.query(`
          SELECT MONTH(${dateColName}) AS mo, COUNT(*) AS uses
          FROM [${schema}].[${txTable}]
          WHERE YEAR(${dateColName}) = @year
          GROUP BY MONTH(${dateColName})
          ORDER BY mo
        `);

        return NextResponse.json({
          source: 'transaction_table',
          table: txTable,
          year,
          totalThisYear: summary.recordset[0]?.totalThisYear ?? 0,
          byMonth: byMonth.recordset,
        });
      }
    }

    // ── Strategy 2: LocalUseCount column on Copy table ──
    if (useCol) {
      const summary = await req.query(`
        SELECT
          SUM(${useCol}) AS totalAllTime,
          COUNT(CASE WHEN ${useCol} > 0 THEN 1 END) AS titlesWithUse,
          COUNT(*) AS totalItems
        FROM ${t(p,'Copy')}
        WHERE DateWithdrawn IS NULL
      `);

      // Top titles by in-library use
      const topTitles = await req.query(`
        SELECT TOP 20
          bm.Title, bm.Author,
          SUM(c.${useCol}) AS inLibraryUses,
          COUNT(c.CopyID) AS copies
        FROM ${t(p,'Copy')} c
        JOIN ${t(p,'BibMaster')} bm ON c.BibID = bm.BibID
        WHERE c.DateWithdrawn IS NULL AND c.${useCol} > 0
        GROUP BY bm.Title, bm.Author
        ORDER BY inLibraryUses DESC
      `);

      // If there's also a date column, add year filter context
      let yearTotal = null;
      if (dateCol) {
        const yr = await req.query(`
          SELECT COUNT(*) AS cnt FROM ${t(p,'Copy')}
          WHERE YEAR(${dateCol}) = @year AND DateWithdrawn IS NULL
        `);
        yearTotal = yr.recordset[0]?.cnt ?? null;
      }

      return NextResponse.json({
        source: 'copy_column',
        column: useCol,
        year,
        totalAllTime: summary.recordset[0]?.totalAllTime ?? 0,
        titlesWithUse: summary.recordset[0]?.titlesWithUse ?? 0,
        totalItems: summary.recordset[0]?.totalItems ?? 0,
        yearTotal,
        topTitles: topTitles.recordset,
      });
    }

    // ── Strategy 3: no in-library use data found ──
    return NextResponse.json({
      source: 'none',
      year,
      message: 'No in-library use columns or tables found. Make sure "Record in-library use" is checked in Destiny Circulation > Check In when re-shelving items used in-library.',
    });

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
