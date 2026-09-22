import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();

    // Get 3 sample titles per BibType so labels can be confirmed visually
    const result = await pool.request().query(`
      SELECT BibType, Title, Author
      FROM (
        SELECT
          bm.BibType,
          bm.Title,
          bm.Author,
          ROW_NUMBER() OVER (PARTITION BY bm.BibType ORDER BY bm.BibID) AS rn
        FROM ${t(p,'BibMaster')} bm
        WHERE bm.Title IS NOT NULL AND bm.Title <> ''
      ) x
      WHERE rn <= 3
      ORDER BY BibType, rn
    `);

    // Group by BibType
    const grouped: Record<number, {title: string; author: string}[]> = {};
    for (const row of result.recordset as {BibType: number; Title: string; Author: string}[]) {
      if (!grouped[row.BibType]) grouped[row.BibType] = [];
      grouped[row.BibType].push({ title: row.Title, author: row.Author });
    }

    return NextResponse.json({ samples: grouped });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
