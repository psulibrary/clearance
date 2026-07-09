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
    const req = pool.request();
    req.input('year', sql.Int, year);

    // Discover columns on CopyTransaction to find the in-library use flag
    const ctColsRes = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME = 'CopyTransaction'
      ORDER BY ORDINAL_POSITION
    `);
    const ctCols: { COLUMN_NAME: string; DATA_TYPE: string }[] = ctColsRes.recordset;
    const ctColNames = ctCols.map(c => c.COLUMN_NAME.toLowerCase());

    if (ctCols.length === 0) {
      // Table doesn't exist — return debug info
      const allTablesRes = await pool.request().query(`
        SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = '${schema}' ORDER BY TABLE_NAME
      `);
      return NextResponse.json({
        source: 'none',
        year,
        message: 'CopyTransaction table not found.',
        debug: { allTables: allTablesRes.recordset.map((r: { TABLE_NAME: string }) => r.TABLE_NAME) },
      });
    }

    // Find the in-library use flag column (bit/boolean that marks in-library vs checkout)
    const inLibFlag = ctCols.find(c => {
      const n = c.COLUMN_NAME.toLowerCase();
      return n.includes('inlibrary') || n.includes('localuse') || n.includes('inhouse')
        || n.includes('roomuse') || n === 'islocaluse' || n === 'isinlibrary'
        || n === 'transactiontype' || n === 'type' || n === 'circtypeid';
    })?.COLUMN_NAME ?? null;

    // Find the date column
    const dateCol = ctCols.find(c => {
      const n = c.COLUMN_NAME.toLowerCase();
      return n === 'transactiondate' || n === 'date' || n === 'dateout'
        || n === 'datecheckedout' || n === 'created' || n === 'transdate';
    })?.COLUMN_NAME ?? null;

    // Find patron/copy link columns
    const copyIdCol  = ctCols.find(c => c.COLUMN_NAME.toLowerCase() === 'copyid')?.COLUMN_NAME ?? null;
    const patronIdCol = ctCols.find(c => c.COLUMN_NAME.toLowerCase() === 'patronid')?.COLUMN_NAME ?? null;

    if (!dateCol) {
      return NextResponse.json({
        source: 'none',
        year,
        message: 'CopyTransaction table found but no date column identified.',
        debug: { ctCols: ctColNames },
      });
    }

    // Determine WHERE clause for in-library use records
    // Destiny uses a flag column or a specific transaction type value
    let inLibWhere = '';
    if (inLibFlag) {
      const fl = inLibFlag.toLowerCase();
      if (fl.includes('type') || fl === 'circtypeid') {
        // TransactionType or CircTypeID — in-library use is typically type 3 or 'L'
        // Try both; we'll return counts by type so the user can confirm
        inLibWhere = ''; // no filter yet — return all and let counts guide us
      } else {
        // Boolean flag
        inLibWhere = `AND ${inLibFlag} = 1`;
      }
    }

    // ── Summary: total in-library uses this year ──
    const summary = await req.query(`
      SELECT COUNT(*) AS totalThisYear
      FROM ${t(p,'CopyTransaction')}
      WHERE YEAR(${dateCol}) = @year ${inLibWhere}
    `);

    // ── Monthly breakdown ──
    const byMonth = await req.query(`
      SELECT MONTH(${dateCol}) AS mo, COUNT(*) AS uses
      FROM ${t(p,'CopyTransaction')}
      WHERE YEAR(${dateCol}) = @year ${inLibWhere}
      GROUP BY MONTH(${dateCol})
      ORDER BY mo
    `);

    // ── All-time total ──
    const allTime = await req.query(`
      SELECT COUNT(*) AS totalAllTime
      FROM ${t(p,'CopyTransaction')} ${inLibWhere ? `WHERE ${inLibWhere.replace('AND ','')}` : ''}
    `);

    // ── If TransactionType exists, show distribution so we can identify the right value ──
    let typeBreakdown: { type: unknown; cnt: number }[] = [];
    if (inLibFlag && (inLibFlag.toLowerCase().includes('type') || inLibFlag.toLowerCase() === 'circtypeid')) {
      const tb = await req.query(`
        SELECT TOP 20 ${inLibFlag} AS type, COUNT(*) AS cnt
        FROM ${t(p,'CopyTransaction')}
        WHERE YEAR(${dateCol}) = @year
        GROUP BY ${inLibFlag}
        ORDER BY cnt DESC
      `);
      typeBreakdown = tb.recordset;
    }

    // ── Top titles by in-library use (if CopyID links to Copy/BibMaster) ──
    let topTitles: { Title: string; Author: string; inLibraryUses: number; copies: number }[] = [];
    if (copyIdCol) {
      try {
        const tt = await req.query(`
          SELECT TOP 20 bm.Title, bm.Author,
            COUNT(ct.${copyIdCol}) AS inLibraryUses,
            COUNT(DISTINCT ct.${copyIdCol}) AS copies
          FROM ${t(p,'CopyTransaction')} ct
          JOIN ${t(p,'Copy')} c ON c.CopyID = ct.${copyIdCol}
          JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
          WHERE YEAR(ct.${dateCol}) = @year ${inLibWhere}
          GROUP BY bm.Title, bm.Author
          ORDER BY inLibraryUses DESC
        `);
        topTitles = tt.recordset;
      } catch (_) {
        // join failed — skip top titles
      }
    }

    // ── Top patron types using in-library ──
    let byPatronType: { patronType: string; uses: number }[] = [];
    if (patronIdCol) {
      try {
        const pt = await req.query(`
          SELECT sp.PatronTypeDescription AS patronType, COUNT(*) AS uses
          FROM ${t(p,'CopyTransaction')} ct
          JOIN ${t(p,'SitePatron')} spt ON spt.PatronID = ct.${patronIdCol}
          JOIN ${t(p,'PatronType')} sp ON sp.PatronTypeID = spt.PatronTypeID
          WHERE YEAR(ct.${dateCol}) = @year ${inLibWhere}
          GROUP BY sp.PatronTypeDescription
          ORDER BY uses DESC
        `);
        byPatronType = pt.recordset;
      } catch (_) {
        // join failed — skip
      }
    }

    return NextResponse.json({
      source: 'copy_transaction',
      year,
      totalThisYear: summary.recordset[0]?.totalThisYear ?? 0,
      totalAllTime: allTime.recordset[0]?.totalAllTime ?? 0,
      byMonth: byMonth.recordset,
      topTitles,
      byPatronType,
      debug: {
        ctCols: ctColNames,
        dateCol,
        inLibFlag,
        inLibWhere,
        typeBreakdown: typeBreakdown.length ? typeBreakdown : undefined,
      },
    });

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
