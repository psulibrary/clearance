import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

// Broaden the search — Destiny uses different column names across versions
const INLIB_COL_PATTERNS = [
  'localusecount', 'inhousecount', 'inlibrarycount',
  'localuse', 'inhouse', 'inlibrary',
  'roomuse', 'roomusecount', 'inroomuse',
  'usecount', 'browsercount',
  'inlibraryusecount', 'locirccount',
];

const INLIB_TABLE_PATTERNS = [
  'copylocaluse', 'inhouseuse', 'localuse', 'inlibraryuse',
  'roomuse', 'circtransaction', 'circhistory', 'loanhistory',
];

export async function GET(request: NextRequest) {
  const year = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()));

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const schema = p.replace(/^\[|\]\.?$|\.$/g, '');

    // ── 1. Get ALL columns on Copy table so we can see exactly what's there ──
    const copyColsRes = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = 'Copy'
      ORDER BY ORDINAL_POSITION
    `);
    const copyCols: { COLUMN_NAME: string; DATA_TYPE: string }[] = copyColsRes.recordset;
    const copyColNames = copyCols.map(c => c.COLUMN_NAME.toLowerCase());

    // ── 2. Find the in-library use column ──
    const useCol = copyCols.find(c =>
      INLIB_COL_PATTERNS.includes(c.COLUMN_NAME.toLowerCase())
    )?.COLUMN_NAME ?? null;

    // ── 3. Find any transaction table ──
    const allTablesRes = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${schema}'
      ORDER BY TABLE_NAME
    `);
    const allTables: string[] = allTablesRes.recordset.map((r: { TABLE_NAME: string }) => r.TABLE_NAME);
    const txTable = allTables.find(name =>
      INLIB_TABLE_PATTERNS.includes(name.toLowerCase())
    ) ?? null;

    const req = pool.request();
    req.input('year', sql.Int, year);

    // ── 4. Strategy: transaction table ──
    if (txTable) {
      const txColsRes = await pool.request().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${txTable}'
        ORDER BY ORDINAL_POSITION
      `);
      const txCols: string[] = txColsRes.recordset.map((r: { COLUMN_NAME: string }) => r.COLUMN_NAME.toLowerCase());
      const dateColName = txColsRes.recordset.find((r: { COLUMN_NAME: string }) =>
        r.COLUMN_NAME.toLowerCase().includes('date')
      )?.COLUMN_NAME;

      if (dateColName) {
        const summary = await req.query(`
          SELECT COUNT(*) AS totalThisYear
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
          debug: { copyCols: copyColNames, allTables, useColFound: useCol },
        });
      }
    }

    // ── 5. Strategy: column on Copy table ──
    if (useCol) {
      const summary = await req.query(`
        SELECT
          SUM(${useCol}) AS totalAllTime,
          COUNT(CASE WHEN ${useCol} > 0 THEN 1 END) AS titlesWithUse
        FROM ${t(p,'Copy')}
        WHERE DateWithdrawn IS NULL
      `);
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
      return NextResponse.json({
        source: 'copy_column',
        column: useCol,
        year,
        totalAllTime: summary.recordset[0]?.totalAllTime ?? 0,
        titlesWithUse: summary.recordset[0]?.titlesWithUse ?? 0,
        topTitles: topTitles.recordset,
        debug: { copyCols: copyColNames, allTables },
      });
    }

    // ── 6. Nothing found — return debug info so we can see the real column names ──
    return NextResponse.json({
      source: 'none',
      year,
      message: 'No in-library use column or table found. Check debug.copyCols and debug.allTables to identify the correct column name in your Destiny version.',
      debug: {
        copyCols: copyColNames,
        allTables,
        patternsSearched: INLIB_COL_PATTERNS,
      },
    });

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
