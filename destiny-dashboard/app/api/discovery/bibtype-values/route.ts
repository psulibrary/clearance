import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();

    // See actual BibType values and counts in the database
    const bibTypeResult = await pool.request().query(`
      SELECT
        bm.BibType,
        COUNT(DISTINCT bm.BibID) AS titles,
        COUNT(c.CopyID) AS items
      FROM ${t(p,'BibMaster')} bm
      JOIN ${t(p,'Copy')} c ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
      GROUP BY bm.BibType
      ORDER BY items DESC
    `);

    // Also check ResoldMaterialType distribution
    const resoldResult = await pool.request().query(`
      SELECT
        bm.ResoldMaterialType,
        COUNT(DISTINCT bm.BibID) AS titles,
        COUNT(c.CopyID) AS items
      FROM ${t(p,'BibMaster')} bm
      JOIN ${t(p,'Copy')} c ON bm.BibID = c.BibID
      WHERE c.DateWithdrawn IS NULL
      GROUP BY bm.ResoldMaterialType
      ORDER BY items DESC
    `);

    // Check if there's a lookup table for material types
    const schema = p.replace(/^\[|\]\.?$|\.$/g, '');
    const lookupTables = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${schema}'
        AND (
          LOWER(TABLE_NAME) LIKE '%materialtype%'
          OR LOWER(TABLE_NAME) LIKE '%mediatype%'
          OR LOWER(TABLE_NAME) LIKE '%bibtype%'
          OR LOWER(TABLE_NAME) LIKE '%resold%'
        )
    `);

    return NextResponse.json({
      bibTypeDistribution: bibTypeResult.recordset,
      resoldMaterialTypeDistribution: resoldResult.recordset,
      lookupTables: lookupTables.recordset,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
