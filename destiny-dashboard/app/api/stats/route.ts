import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getPool, sql } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const year       = parseInt(sp.get('year')  || String(new Date().getFullYear()));
  const month      = parseInt(sp.get('month') || '0');   // 0 = all months
  const gradeLevel = sp.get('gradeLevel') || '';

  try {
    const pool = await getPool();
    const p = await getSchemaPrefix();
    const req = pool.request();
    req.input('year',       sql.Int,     year);
    req.input('month',      sql.Int,     month);
    req.input('gradeLevel', sql.NVarChar, gradeLevel);

    const yearFilter  = `YEAR(c2.DateOut) = @year`;
    const monthFilter = month ? `MONTH(c2.DateOut) = @month AND ${yearFilter}` : yearFilter;

    // When gradeLevel is set, join Copy to Patron and filter by GradeLevel
    const glJoin  = gradeLevel ? `JOIN ${t(p,'Patron')} gl ON c2.PatronID = gl.PatronID AND gl.GradeLevel = @gradeLevel` : '';
    const glWhere = gradeLevel ? `AND gl.GradeLevel = @gradeLevel` : '';

    const result = await req.query(`
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
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE YEAR(Created) = @year AND DateWithdrawn IS NULL)
          AS newItemsThisYear,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE MONTH(Created) = MONTH(GETDATE()) AND YEAR(Created) = @year AND DateWithdrawn IS NULL)
          AS newItemsThisMonth,
        (SELECT COUNT(DISTINCT BibID) FROM ${t(p,'BibMaster')} WHERE CollectionType = 0)
          AS uniqueTitles,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateWithdrawn IS NOT NULL)
          AS withdrawnItems,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateOut IS NULL AND DateWithdrawn IS NULL)
          AS neverCheckedOut,

        /* ── Circulation (filtered by year/month/gradeLevel) ── */
        (SELECT COUNT(*) FROM ${t(p,'Copy')} c2 ${glJoin}
           WHERE c2.DateOut >= DATEADD(day,-7,GETDATE()))
          AS checkoutsLast7Days,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} c2 ${glJoin}
           WHERE c2.DateOut >= DATEADD(day,-30,GETDATE()))
          AS checkoutsLast30Days,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} c2 ${glJoin}
           WHERE ${monthFilter})
          AS checkoutsThisYear,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateReturned >= DATEADD(day,-7,GETDATE()))
          AS checkinsLast7Days,
        (SELECT COUNT(*) FROM ${t(p,'Copy')} WHERE DateReturned >= DATEADD(day,-30,GETDATE()))
          AS checkinsLast30Days,
        (SELECT ISNULL(AVG(CAST(DATEDIFF(day, c2.DateOut, ISNULL(c2.DateReturned, GETDATE())) AS FLOAT)), 0)
           FROM ${t(p,'Copy')} c2 ${glJoin} WHERE c2.DateOut IS NOT NULL AND ${monthFilter})
          AS avgLoanDays,

        /* ── Holds ── */
        (SELECT COUNT(*) FROM ${t(p,'Hold')} WHERE IsReady = 0 AND ExpireDate > GETDATE())
          AS pendingHolds,
        (SELECT COUNT(*) FROM ${t(p,'Hold')} WHERE IsReady = 1 AND ExpireDate > GETDATE())
          AS readyHolds,


        /* ── Patrons (gradeLevel filter applied) ── */
        (SELECT COUNT(*) FROM ${t(p,'Patron')}
           WHERE ('' = @gradeLevel OR GradeLevel = @gradeLevel))
          AS totalPatrons,
        (SELECT COUNT(DISTINCT c2.PatronID) FROM ${t(p,'Copy')} c2 ${glJoin}
           WHERE c2.PatronID IS NOT NULL AND c2.DateReturned IS NULL AND c2.DateWithdrawn IS NULL)
          AS patronsWithCheckouts,
        (SELECT COUNT(DISTINCT c2.PatronID) FROM ${t(p,'Copy')} c2 ${glJoin}
           WHERE c2.PatronID IS NOT NULL AND c2.DateReturned IS NULL AND c2.DateWithdrawn IS NULL AND c2.DateDue < GETDATE())
          AS patronsWithOverdue,
        (SELECT COUNT(*) FROM ${t(p,'Patron')}
           WHERE YEAR(Created) = @year AND ('' = @gradeLevel OR GradeLevel = @gradeLevel))
          AS newPatronsThisYear,
        (SELECT COUNT(DISTINCT c2.PatronID) FROM ${t(p,'Copy')} c2 ${glJoin}
           WHERE ${monthFilter})
          AS activePatronsThisYear,
        (SELECT COUNT(DISTINCT c2.PatronID) FROM ${t(p,'Copy')} c2 ${glJoin}
           WHERE c2.DateOut >= DATEADD(day,-30,GETDATE()))
          AS activePatronsLast30Days,

        /* ── Fines ── */
        (SELECT COUNT(*) FROM ${t(p,'Fine')} WHERE Active = 1 AND (Amount - AmountPaid - AmountWaived) > 0)
          AS activeFines,
        (SELECT ISNULL(SUM(Amount - AmountPaid - AmountWaived), 0) / 100.0
           FROM ${t(p,'Fine')} WHERE Active = 1 AND (Amount - AmountPaid - AmountWaived) > 0)
          AS totalFinesBalance,
        (SELECT ISNULL(SUM(AmountPaid), 0) / 100.0 FROM ${t(p,'Fine')})
          AS totalFinesEverCollected
    `);

    return NextResponse.json({ ...result.recordset[0], year, month, gradeLevel });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
