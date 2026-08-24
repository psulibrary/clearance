import { NextResponse } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { cacheKey, cacheGet, cacheSet } from '@/lib/cache';

// Separates two situations that look identical in a plain checkout-count
// ranking: a title being renewed repeatedly by the same patron (loan
// period too short) vs. a title genuinely being borrowed by many
// different patrons (needs more copies, not a longer loan period).
//
// Renewals do NOT come from Audit.TransType — /api/discovery/renewals
// confirmed this Destiny install has zero Audit rows for a "Renewed"
// transaction type (whichever code that would be), so renewal events
// are apparently never logged there. Copy.RenewalCount is used instead:
// a real, populated per-copy counter independent of Audit. That makes it
// a live snapshot rather than a dated event log, so — unlike checkouts —
// it can't be scoped to a particular year; see `diagnostics` in the
// response for whether it looks like it resets when a copy is checked in
// (if so, it only reflects currently-active loans, not lifetime history).
const MIN_CHECKOUTS = 5;
const LIMIT = 300;

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null;
  const key = cacheKey('/api/charts/renewal-behavior', searchParams);

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();

    const checkoutReq = pool.request();
    checkoutReq.input('limit', sql.Int, LIMIT);
    checkoutReq.input('minCheckouts', sql.Int, MIN_CHECKOUTS);
    if (year) checkoutReq.input('year', sql.Int, year);

    const checkoutResult = await checkoutReq.query(`
      SELECT TOP (@limit)
        bm.BibID,
        bm.Title,
        ISNULL(bm.Author, 'Unknown') AS Author,
        COUNT(DISTINCT a.PatronID) AS uniqueBorrowers,
        COUNT(*) AS checkouts
      FROM ${t(p,'Audit')} a
      JOIN ${t(p,'Copy')} c ON c.CopyID = a.CopyID
      JOIN ${t(p,'BibMaster')} bm ON bm.BibID = c.BibID
      WHERE a.TransType = 1 AND a.PatronID IS NOT NULL
        ${year ? 'AND YEAR(a.Created) = @year' : ''}
      GROUP BY bm.BibID, bm.Title, bm.Author
      HAVING COUNT(*) >= @minCheckouts
      ORDER BY checkouts DESC
    `);

    type CheckoutRow = { BibID: number; Title: string; Author: string; uniqueBorrowers: number; checkouts: number };
    const checkoutRows = checkoutResult.recordset as CheckoutRow[];

    const bibIds = checkoutRows.map(r => r.BibID);
    const renewalByBib: Record<number, number> = {};
    if (bibIds.length > 0) {
      const renewalResult = await pool.request().query(`
        SELECT BibID, SUM(ISNULL(RenewalCount, 0)) AS renewals
        FROM ${t(p,'Copy')}
        WHERE BibID IN (${bibIds.join(',')})
        GROUP BY BibID
      `);
      for (const r of renewalResult.recordset as { BibID: number; renewals: number }[]) {
        renewalByBib[r.BibID] = r.renewals;
      }
    }

    // Diagnostic: does RenewalCount survive a check-in? If available
    // (not-checked-out) copies still carry a nonzero count, it persists —
    // the totals below are real lifetime renewal counts. If it's always 0
    // once returned, these totals only reflect currently active loans.
    const diag = await pool.request().query(`
      SELECT
        SUM(CASE WHEN PatronID IS NULL AND RenewalCount > 0 THEN 1 ELSE 0 END) AS availableWithRenewals,
        SUM(CASE WHEN PatronID IS NULL THEN 1 ELSE 0 END) AS availableTotal
      FROM ${t(p,'Copy')}
      WHERE DateWithdrawn IS NULL
    `);
    const diagRow = diag.recordset[0] as { availableWithRenewals: number; availableTotal: number };
    const diagnostics = {
      availableCopiesWithRenewalCount: diagRow.availableWithRenewals,
      availableCopiesTotal: diagRow.availableTotal,
      likelyPersistsAfterCheckin: diagRow.availableTotal > 0 ? diagRow.availableWithRenewals > 0 : null,
    };

    const rows = checkoutRows.map(r => {
      const renewals = renewalByBib[r.BibID] ?? 0;
      const total = r.checkouts + renewals;
      return {
        ...r,
        renewals,
        totalTransactions: total,
        renewalRatio: total ? renewals / total : 0,
        transactionsPerBorrower: r.uniqueBorrowers ? total / r.uniqueBorrowers : 0,
      };
    });

    // Titles where volume is mostly the same one or two patrons renewing —
    // candidates for a longer loan period rather than more copies. Must
    // have at least one actual renewal: a title with renewals=0 has zero
    // evidence for this hypothesis and shouldn't appear here just because
    // it happens to have high checkout volume.
    const renewalDriven = rows
      .filter(r => r.renewals > 0)
      .sort((a, b) => b.renewalRatio - a.renewalRatio || b.totalTransactions - a.totalTransactions)
      .slice(0, 25);

    // Titles with the broadest genuine demand — the opposite case, where
    // more copies (not a longer loan period) is the right lever.
    const broadDemand = [...rows]
      .sort((a, b) => b.uniqueBorrowers - a.uniqueBorrowers)
      .slice(0, 25);

    // Full set (up to LIMIT), sorted by total transactions — the tables
    // above only show the top 25 of each ranking, so this backs a CSV
    // export covering every title that met the checkout threshold, not
    // just what's visible on screen.
    const all = [...rows].sort((a, b) => b.totalTransactions - a.totalTransactions);

    const json = { renewalDriven, broadDemand, all, minCheckouts: MIN_CHECKOUTS, year, diagnostics };
    cacheSet(key, json);
    return NextResponse.json(json);
  } catch (err: unknown) {
    const cached = await cacheGet(key);
    if (cached) return NextResponse.json(cached.payload);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
