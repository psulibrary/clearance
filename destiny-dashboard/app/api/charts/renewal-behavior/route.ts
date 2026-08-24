import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { cacheKey, cacheGet, cacheSet } from '@/lib/cache';

// Separates two situations that look identical in a plain checkout-count
// ranking: a title being renewed repeatedly by the same patron (loan
// period too short) vs. a title genuinely being borrowed by many
// different patrons (needs more copies, not a longer loan period).
// TransType 1 = Checked out, 3 = Renewed (see lib/audit-trans.ts).
const MIN_TRANSACTIONS = 5;
const LIMIT = 300;

export async function GET(request: Request) {
  const key = cacheKey('/api/charts/renewal-behavior', new URL(request.url).searchParams);

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const req = pool.request();
    req.input('limit', sql.Int, LIMIT);
    req.input('minTransactions', sql.Int, MIN_TRANSACTIONS);

    const result = await req.query(`
      SELECT TOP (@limit)
        bm.BibID,
        bm.Title,
        ISNULL(bm.Author, 'Unknown') AS Author,
        COUNT(DISTINCT a.PatronID) AS uniqueBorrowers,
        SUM(CASE WHEN a.TransType = 1 THEN 1 ELSE 0 END) AS checkouts,
        SUM(CASE WHEN a.TransType = 3 THEN 1 ELSE 0 END) AS renewals,
        SUM(CASE WHEN a.TransType IN (1,3) THEN 1 ELSE 0 END) AS totalTransactions
      FROM ${t(p,'Audit')} a
      JOIN ${t(p,'Copy')} c ON c.CopyID = a.CopyID
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE a.TransType IN (1,3) AND a.PatronID IS NOT NULL
      GROUP BY bm.BibID, bm.Title, bm.Author
      HAVING SUM(CASE WHEN a.TransType IN (1,3) THEN 1 ELSE 0 END) >= @minTransactions
      ORDER BY totalTransactions DESC
    `);

    type Row = { BibID: number; Title: string; Author: string; uniqueBorrowers: number; checkouts: number; renewals: number; totalTransactions: number };
    const rows = (result.recordset as Row[]).map(r => ({
      ...r,
      renewalRatio: r.totalTransactions ? r.renewals / r.totalTransactions : 0,
      transactionsPerBorrower: r.uniqueBorrowers ? r.totalTransactions / r.uniqueBorrowers : 0,
    }));

    // Titles where volume is mostly the same one or two patrons renewing —
    // candidates for a longer loan period rather than more copies.
    const renewalDriven = [...rows]
      .sort((a, b) => b.renewalRatio - a.renewalRatio || b.totalTransactions - a.totalTransactions)
      .slice(0, 25);

    // Titles with the broadest genuine demand — the opposite case, where
    // more copies (not a longer loan period) is the right lever.
    const broadDemand = [...rows]
      .sort((a, b) => b.uniqueBorrowers - a.uniqueBorrowers)
      .slice(0, 25);

    const json = { renewalDriven, broadDemand, minTransactions: MIN_TRANSACTIONS };
    cacheSet(key, json);
    return NextResponse.json(json);
  } catch (err: unknown) {
    const cached = await cacheGet(key);
    if (cached) return NextResponse.json(cached.payload);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
