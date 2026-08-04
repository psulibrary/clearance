import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix } from '@/lib/schema';

// One-time check: does this Destiny instance's BibMaster (and related bib
// tables) actually populate the MARC-derived fields Destiny's own
// "Collection Analysis" report uses for Fiction/Non-Fiction, Audience,
// Language, and reading-level (F&P/AR/RC) breakdowns? Column names vary
// by Destiny version/install, so this inspects the real schema instead of
// guessing — hit this once, then we know what's safe to build against.
export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const schema = p.replace(/^\[|\]\.?$|\.$/g, '');

    const columns = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}'
        AND (
          COLUMN_NAME LIKE '%Literary%' OR COLUMN_NAME LIKE '%Fiction%'
          OR COLUMN_NAME LIKE '%Audience%' OR COLUMN_NAME LIKE '%Interest%'
          OR COLUMN_NAME LIKE '%Language%'
          OR COLUMN_NAME LIKE '%Lexile%' OR COLUMN_NAME LIKE '%ReadingLevel%'
          OR COLUMN_NAME LIKE '%FountasPinnell%' OR COLUMN_NAME LIKE '%FP%'
          OR COLUMN_NAME LIKE '%AR%' OR COLUMN_NAME LIKE '%AcceleratedReader%'
          OR COLUMN_NAME LIKE '%ReadingCounts%' OR COLUMN_NAME LIKE '%RC%'
        )
      ORDER BY TABLE_NAME, COLUMN_NAME
    `);

    // Sample a few live BibMaster rows so we can eyeball whether the
    // candidate columns are actually populated, not just present-but-null.
    let sampleRows: Record<string, unknown>[] = [];
    const candidateCols = [...new Set(
      (columns.recordset as { TABLE_NAME: string; COLUMN_NAME: string }[])
        .filter(c => c.TABLE_NAME === 'BibMaster')
        .map(c => c.COLUMN_NAME)
    )];
    if (candidateCols.length > 0) {
      const colList = candidateCols.map(c => `[${c}]`).join(', ');
      const sample = await pool.request().query(`SELECT TOP 5 ${colList} FROM ${p}[BibMaster] WHERE BibID IS NOT NULL`);
      sampleRows = sample.recordset;
    }

    return NextResponse.json({ schema, matchingColumns: columns.recordset, sampleRows });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
