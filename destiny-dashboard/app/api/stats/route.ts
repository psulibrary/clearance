import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET() {
  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();

    const result = await pool.request().query(`
      SELECT
        /* ── Collection ── */
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateWithdrawn IS NULL)
          AS totalItems,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE PatronID IS NOT NULL AND DateReturned IS NULL AND DateWithdrawn IS NULL)
          AS checkedOut,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE PatronID IS NOT NULL AND DateReturned IS NULL AND DateWithdrawn IS NULL AND DateDue < GETDATE())
          AS overdue,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE PatronID IS NOT NULL AND DateReturned IS NULL AND DateWithdrawn IS NULL AND DateDue < DATEADD(day,-30,GETDATE()))
          AS overdueOver30Days,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateWithdrawn IS NULL AND PatronID IS NULL AND DateReturned IS NULL)
          AS available,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE YEAR(Created) = YEAR(GETDATE()) AND DateWithdrawn IS NULL)
          AS newItemsThisYear,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE MONTH(Created) = MONTH(GETDATE()) AND YEAR(Created) = YEAR(GETDATE()) AND DateWithdrawn IS NULL)
          AS newItemsThisMonth,
        (SELECT COUNT(DISTINCT BibID) FROM ${t(p,'BibMaster')} WHERE CollectionType = 0)
          AS uniqueTitles,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateWithdrawn IS NOT NULL)
          AS withdrawnItems,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateOut IS NULL AND DateWithdrawn IS NULL)
          AS neverCheckedOut,

        /* ── Circulation activity ── */
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateOut >= DATEADD(day,-7,GETDATE()))
          AS checkoutsLast7Days,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateOut >= DATEADD(day,-30,GETDATE()))
          AS checkoutsLast30Days,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE YEAR(DateOut) = YEAR(GETDATE()))
          AS checkoutsThisYear,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateReturned >= DATEADD(day,-7,GETDATE()))
          AS checkinsLast7Days,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateReturned >= DATEADD(day,-30,GETDATE()))
          AS checkinsLast30Days,
        (SELECT ISNULL(AVG(CAST(DATEDIFF(day, DateOut, ISNULL(DateReturned, GETDATE())) AS FLOAT)), 0)
           FROM ${t(p,'Copy')} WHERE DateOut IS NOT NULL AND YEAR(DateOut) = YEAR(GETDATE()))
          AS avgLoanDaysThisYear,

        /* ── Holds ── */
        (SELECT COUNT(*) FROM ${t(p,'Hold')} WHERE IsReady = 0 AND ExpireDate > GETDATE())
          AS pendingHolds,
        (SELECT COUNT(*) FROM ${t(p,'Hold')} WHERE IsReady = 1 AND ExpireDate > GETDATE())
          AS readyHolds,
        (SELECT COUNT(*) FROM ${t(p,'Hold')} WHERE YEAR(Created) = YEAR(GETDATE()))
          AS holdsPlacedThisYear,

        /* ── Patrons ── */
        (SELECT COUNT(*) FROM ${t(p,'Patron')})
          AS totalPatrons,
        (SELECT COUNT(DISTINCT PatronID) FROM ${t(p,'Copy')} WHERE PatronID IS NOT NULL AND DateReturned IS NULL AND DateWithdrawn IS NULL)
          AS patronsWithCheckouts,
        (SELECT COUNT(DISTINCT PatronID) FROM ${t(p,'Copy')} WHERE PatronID IS NOT NULL AND DateReturned IS NULL AND DateWithdrawn IS NULL AND DateDue < GETDATE())
          AS patronsWithOverdue,
        (SELECT COUNT(*) FROM ${t(p,'Patron')} WHERE YEAR(Created) = YEAR(GETDATE()))
          AS newPatronsThisYear,
        (SELECT COUNT(DISTINCT PatronID) FROM ${t(p,'Copy')} WHERE YEAR(DateOut) = YEAR(GETDATE()))
          AS activePatronsThisYear,
        (SELECT COUNT(DISTINCT PatronID) FROM ${t(p,'Copy')} WHERE DateOut >= DATEADD(day,-30,GETDATE()))
          AS activePatronsLast30Days,

        /* ── Fines ── */
        (SELECT COUNT(*) FROM ${t(p,'Fine')} WHERE Active = 1 AND (Amount - AmountPaid - AmountWaived) > 0)
          AS activeFines,
        (SELECT ISNULL(SUM(Amount - AmountPaid - AmountWaived), 0) / 100.0 FROM ${t(p,'Fine')} WHERE Active = 1 AND (Amount - AmountPaid - AmountWaived) > 0)
          AS totalFinesBalance,
        (SELECT ISNULL(SUM(AmountPaid), 0) / 100.0 FROM ${t(p,'Fine')} WHERE YEAR(Created) = YEAR(GETDATE()))
          AS finesCollectedThisYear,
        (SELECT ISNULL(SUM(AmountPaid), 0) / 100.0 FROM ${t(p,'Fine')} WHERE MONTH(Created) = MONTH(GETDATE()) AND YEAR(Created) = YEAR(GETDATE()))
          AS finesCollectedThisMonth
    `);

    return NextResponse.json(result.recordset[0]);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
