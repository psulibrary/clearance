import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import { labelTransCombo } from '@/lib/audit-trans';

// One-time check for the Renewal Behavior report: is TransType=3 actually
// "Renewed" on THIS Destiny instance, or was that guessed from a generic
// code list? Also checks whether Copy/BibMaster carry their own renewal
// counter independent of Audit logging, since some Destiny configurations
// don't write an Audit row for patron self-service (OPAC) renewals the
// same way they do for staff-desk renewals — which would make Audit-based
// renewal counts an undercount no matter which TransType code is right.
export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const schema = p.replace(/^\[|\]\.?$|\.$/g, '');

    // 1. Full TransType/TransModifier breakdown so we can eyeball which
    //    code is actually "Renewed" here instead of trusting the guess.
    const combos = await pool.request().query(`
      SELECT TransType, TransModifier, COUNT(*) AS cnt, MIN(Created) AS firstSeen, MAX(Created) AS lastSeen
      FROM ${t(p,'Audit')}
      GROUP BY TransType, TransModifier
      ORDER BY cnt DESC
    `);
    const transTypeBreakdown = (combos.recordset as { TransType: number; TransModifier: number; cnt: number; firstSeen: string; lastSeen: string }[])
      .map(r => ({ ...r, label: labelTransCombo(r.TransType, r.TransModifier) }));

    // 2. Sample rows specifically for TransType=3 (the guessed "Renewed"
    //    code) so we can see whether OriginatorUserID/PatronID look right.
    const sample3 = await pool.request().query(`
      SELECT TOP 10 a.CopyID, a.PatronID, a.OriginatorUserID, a.TransType, a.TransModifier, a.Created
      FROM ${t(p,'Audit')} a
      WHERE a.TransType = 3
      ORDER BY a.Created DESC
    `);

    // 3. Does Copy or BibMaster carry its own renewal counter independent
    //    of Audit? If so, that's a more reliable source than Audit logging.
    const renewalColumns = await pool.request().query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${schema}'
        AND (COLUMN_NAME LIKE '%Renew%' OR COLUMN_NAME LIKE '%TimesOut%' OR COLUMN_NAME LIKE '%LoanCount%')
      ORDER BY TABLE_NAME, COLUMN_NAME
    `);

    // 4. Any table dedicated to renewals (separate from Audit/Copy)?
    const renewalTables = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${schema}' AND TABLE_NAME LIKE '%Renew%'
    `);

    return NextResponse.json({
      schema,
      transTypeBreakdown,
      sample_transtype3: sample3.recordset,
      possibleRenewalColumns: renewalColumns.recordset,
      possibleRenewalTables: renewalTables.recordset,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
