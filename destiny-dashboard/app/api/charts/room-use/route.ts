import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

// In Destiny, in-library use transactions have:
//   TransType    = 'Checked in'
//   TransModifier = 'In-Library'
// This is set when staff use Check In with "Record in-library use" checked.

export async function GET(request: NextRequest) {
  const year = parseInt(request.nextUrl.searchParams.get('year') || String(new Date().getFullYear()));

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const schema = p.replace(/^\[|\]\.?$|\.$/g, '');
    const req = pool.request();
    req.input('year', sql.Int, year);

    // Find all tables — try CopyTransaction and common alternate names
    const allTablesRes = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${schema}' ORDER BY TABLE_NAME
    `);
    const allTables: string[] = allTablesRes.recordset.map((r: { TABLE_NAME: string }) => r.TABLE_NAME);

    // Pick the transaction table — Destiny uses CopyTransaction but some versions differ
    const TX_CANDIDATES = ['CopyTransaction','CopyTrans','CircTransaction','CircTrans','Transaction','CopyHistory','CircHistory','CopyLog','CircLog'];
    const txTableName = TX_CANDIDATES.find(n => allTables.includes(n)) ?? null;

    if (!txTableName) {
      return NextResponse.json({
        source: 'none',
        year,
        message: 'Transaction table not found. See debug.allTables for all tables in this Destiny schema.',
        debug: { allTables },
      });
    }

    // Discover column names on the found table
    const ctColsRes = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = '${txTableName}'
      ORDER BY ORDINAL_POSITION
    `);
    const ctCols: string[] = ctColsRes.recordset.map((r: { COLUMN_NAME: string }) => r.COLUMN_NAME.toLowerCase());

    if (ctCols.length === 0) {
      return NextResponse.json({ source: 'none', year, message: `Table ${txTableName} found but has no columns.`, debug: { allTables } });
    }

    // Map to actual column names (case-sensitive for SQL Server)
    const actual = (candidates: string[]): string | null => {
      const colsOrig: string[] = ctColsRes.recordset.map((r: { COLUMN_NAME: string }) => r.COLUMN_NAME);
      for (const c of candidates) {
        const found = colsOrig.find((col: string) => col.toLowerCase() === c);
        if (found) return found;
      }
      return null;
    };

    const dateCol     = actual(['transdate','transactiondate','date','dateout','created','datecreated']);
    const typeCol     = actual(['transtype','transactiontype','type','circtranstype']);
    const modCol      = actual(['transmodifier','modifier','transmod','transactionmodifier']);
    const copyIdCol   = actual(['copyid']);
    const patronIdCol = actual(['patronid']);
    const titleCol    = actual(['title']);
    const authorCol   = actual(['author']);
    const patronTypeCol = actual(['patrontype','patrontyped','patrontypedescription']);

    if (!dateCol) {
      return NextResponse.json({ source: 'none', year, message: `No date column found on ${txTableName}.`, debug: { allTables, txTableName, ctCols } });
    }

    // WHERE clause: TransModifier = 'In-Library' (and optionally TransType = 'Checked in')
    const inLibWhere = modCol
      ? `WHERE ${modCol} = 'In-Library' AND YEAR(${dateCol}) = @year`
      : typeCol
        ? `WHERE ${typeCol} = 'Checked in' AND YEAR(${dateCol}) = @year`
        : `WHERE YEAR(${dateCol}) = @year`;

    const inLibWhereAllTime = modCol
      ? `WHERE ${modCol} = 'In-Library'`
      : typeCol
        ? `WHERE ${typeCol} = 'Checked in'`
        : '';

    // ── Summary ──
    const summary = await req.query(`
      SELECT COUNT(*) AS totalThisYear FROM ${`[${schema}].[${txTableName}]`} ${inLibWhere}
    `);
    const allTime = await req.query(`
      SELECT COUNT(*) AS totalAllTime FROM ${`[${schema}].[${txTableName}]`} ${inLibWhereAllTime}
    `);

    // ── Monthly breakdown ──
    const byMonth = await req.query(`
      SELECT MONTH(${dateCol}) AS mo, COUNT(*) AS uses
      FROM ${`[${schema}].[${txTableName}]`} ${inLibWhere}
      GROUP BY MONTH(${dateCol}) ORDER BY mo
    `);

    // ── By patron type ──
    let byPatronType: { patronType: string; uses: number }[] = [];
    if (patronTypeCol) {
      // patron type stored directly on CopyTransaction
      const pt = await req.query(`
        SELECT ${patronTypeCol} AS patronType, COUNT(*) AS uses
        FROM ${`[${schema}].[${txTableName}]`} ${inLibWhere}
        GROUP BY ${patronTypeCol} ORDER BY uses DESC
      `);
      byPatronType = pt.recordset;
    } else if (patronIdCol) {
      // join to SitePatron → PatronType
      try {
        const pt = await req.query(`
          SELECT sp.PatronTypeDescription AS patronType, COUNT(*) AS uses
          FROM ${`[${schema}].[${txTableName}]`} ct
          JOIN ${t(p,'SitePatron')} spt ON spt.PatronID = ct.${patronIdCol}
          JOIN ${t(p,'PatronType')} sp ON sp.PatronTypeID = spt.PatronTypeID
          ${inLibWhere.replace('WHERE', 'WHERE ct.'+ dateCol + ' IS NOT NULL AND').replace('YEAR('+dateCol+')', 'YEAR(ct.'+dateCol+')')}
          GROUP BY sp.PatronTypeDescription ORDER BY uses DESC
        `);
        byPatronType = pt.recordset;
      } catch (_) { /* skip if join fails */ }
    }

    // ── Top titles ──
    let topTitles: { Title: string; Author: string; inLibraryUses: number }[] = [];
    if (titleCol) {
      // Title stored directly on CopyTransaction
      const tt = await req.query(`
        SELECT TOP 20
          ${titleCol} AS Title,
          ${authorCol ? authorCol + ' AS Author' : 'NULL AS Author'},
          COUNT(*) AS inLibraryUses
        FROM ${`[${schema}].[${txTableName}]`} ${inLibWhere}
        GROUP BY ${titleCol}${authorCol ? ', ' + authorCol : ''}
        ORDER BY inLibraryUses DESC
      `);
      topTitles = tt.recordset;
    } else if (copyIdCol) {
      // Join CopyID → Copy → BibMaster
      try {
        const tt = await req.query(`
          SELECT TOP 20 bm.Title, bm.Author, COUNT(*) AS inLibraryUses
          FROM ${`[${schema}].[${txTableName}]`} ct
          JOIN ${t(p,'Copy')} c ON c.CopyID = ct.${copyIdCol}
          JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
          ${inLibWhere.replace('WHERE','WHERE ct.'+ dateCol + ' IS NOT NULL AND').replace('YEAR('+dateCol+')','YEAR(ct.'+dateCol+')')}
          GROUP BY bm.Title, bm.Author
          ORDER BY inLibraryUses DESC
        `);
        topTitles = tt.recordset;
      } catch (_) { /* skip */ }
    }

    return NextResponse.json({
      source: 'copy_transaction',
      year,
      totalThisYear: summary.recordset[0]?.totalThisYear ?? 0,
      totalAllTime: allTime.recordset[0]?.totalAllTime ?? 0,
      byMonth: byMonth.recordset,
      byPatronType,
      topTitles,
      debug: { txTableName, ctCols, dateCol, typeCol, modCol, patronTypeCol, copyIdCol, titleCol },
    });

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
