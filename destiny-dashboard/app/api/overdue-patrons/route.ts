import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { getSchemaPrefix, t } from '@/lib/schema';
import sql from 'mssql';

/**
 * GET /api/overdue-patrons
 *
 * Returns patrons with overdue items.
 *
 * Query parameters:
 *   minDays      (number, default 1)  — minimum days overdue to include
 *   maxDays      (number, optional)   — maximum days overdue (e.g. 30 for "1–30 days only")
 *   patronTypeID (number, optional)   — filter by patron type
 *   format       "json" | "csv"       — default "json"; "csv" returns a plain-text CSV
 *
 * JSON response shape:
 * {
 *   count: number,
 *   generatedAt: string (ISO datetime),
 *   filters: { minDays, maxDays, patronTypeID },
 *   patrons: [
 *     {
 *       patronBarcode: string,
 *       lastName: string,
 *       firstName: string,
 *       email: string,
 *       patronType: string,
 *       overdueCount: number,
 *       oldestDueDays: number,    // how long the longest-overdue item has been out
 *       itemBarcodes: string[],   // barcode of each overdue copy
 *       titles: string[],         // title of each overdue copy
 *       dueDates: string[],       // ISO due date strings, parallel to itemBarcodes
 *     },
 *     ...
 *   ]
 * }
 *
 * CSV response: one row per patron, columns match the JSON fields.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minDays      = Math.max(1, parseInt(searchParams.get('minDays') ?? '1', 10));
  const maxDays      = searchParams.get('maxDays') ? parseInt(searchParams.get('maxDays')!, 10) : null;
  const patronTypeID = searchParams.get('patronTypeID') ? parseInt(searchParams.get('patronTypeID')!, 10) : null;
  const format       = searchParams.get('format') === 'csv' ? 'csv' : 'json';

  try {
    const pool = await getPool();
    const p    = await getSchemaPrefix();

    const req = pool.request();
    req.input('minDays', sql.Int, minDays);

    let patronTypeJoin  = '';
    let patronTypeWhere = '';
    if (patronTypeID !== null) {
      req.input('patronTypeID', sql.Int, patronTypeID);
      patronTypeJoin  = `JOIN ${t(p,'SitePatron')} sp2 ON sp2.PatronID = p.PatronID AND sp2.PatronTypeID = @patronTypeID`;
      patronTypeWhere = '';
    }

    const maxDaysFilter = maxDays !== null ? `AND DATEDIFF(day, c.DateDue, GETDATE()) <= ${maxDays}` : '';

    // One row per overdue copy, grouped by patron in application layer
    const result = await req.query(`
      SELECT
        sp.PatronBarcode,
        p.LastName,
        p.FirstName,
        ISNULL(p.EmailAddress1, '')                             AS Email,
        ISNULL(pt.PatronTypeDescription, 'Unknown')             AS PatronType,
        c.CopyBarcode                                           AS ItemBarcode,
        bm.Title,
        CONVERT(varchar(10), c.DateDue, 23)                     AS DueDate,
        DATEDIFF(day, c.DateDue, GETDATE())                     AS DaysOverdue
      FROM ${t(p,'Copy')} c
      JOIN ${t(p,'Patron')} p       ON c.PatronID = p.PatronID
      JOIN ${t(p,'SitePatron')} sp  ON sp.PatronID = p.PatronID
      LEFT JOIN ${t(p,'PatronType')} pt ON sp.PatronTypeID = pt.PatronTypeID
      LEFT JOIN ${t(p,'BibMaster')} bm  ON bm.BibID = c.BibID
      ${patronTypeJoin}
      WHERE c.DateReturned IS NULL
        AND c.DateWithdrawn IS NULL
        AND c.PatronID IS NOT NULL
        AND c.DateDue IS NOT NULL
        AND DATEDIFF(day, c.DateDue, GETDATE()) >= @minDays
        ${maxDaysFilter}
      ORDER BY sp.PatronBarcode, DATEDIFF(day, c.DateDue, GETDATE()) DESC
    `);

    // Group rows by patron barcode
    type PatronRow = {
      patronBarcode: string;
      lastName: string;
      firstName: string;
      email: string;
      patronType: string;
      overdueCount: number;
      oldestDueDays: number;
      itemBarcodes: string[];
      titles: string[];
      dueDates: string[];
    };
    const patronMap = new Map<string, PatronRow>();

    for (const row of result.recordset as {
      PatronBarcode: string; LastName: string; FirstName: string; Email: string;
      PatronType: string; ItemBarcode: string; Title: string; DueDate: string; DaysOverdue: number;
    }[]) {
      const key = row.PatronBarcode ?? `NO-BARCODE-${row.LastName}-${row.FirstName}`;
      if (!patronMap.has(key)) {
        patronMap.set(key, {
          patronBarcode: row.PatronBarcode ?? '',
          lastName:      row.LastName,
          firstName:     row.FirstName,
          email:         row.Email,
          patronType:    row.PatronType,
          overdueCount:  0,
          oldestDueDays: 0,
          itemBarcodes:  [],
          titles:        [],
          dueDates:      [],
        });
      }
      const patron = patronMap.get(key)!;
      patron.overdueCount++;
      patron.oldestDueDays = Math.max(patron.oldestDueDays, row.DaysOverdue);
      patron.itemBarcodes.push(row.ItemBarcode ?? '');
      patron.titles.push(row.Title ?? '');
      patron.dueDates.push(row.DueDate ?? '');
    }

    const patrons = Array.from(patronMap.values())
      .sort((a, b) => b.oldestDueDays - a.oldestDueDays); // worst overdue first

    if (format === 'csv') {
      const lines: string[] = [
        'PatronBarcode,LastName,FirstName,Email,PatronType,OverdueCount,OldestDueDays,ItemBarcodes,Titles,DueDates'
      ];
      for (const pat of patrons) {
        lines.push([
          `"${pat.patronBarcode}"`,
          `"${pat.lastName}"`,
          `"${pat.firstName}"`,
          `"${pat.email}"`,
          `"${pat.patronType}"`,
          pat.overdueCount,
          pat.oldestDueDays,
          `"${pat.itemBarcodes.join(' | ')}"`,
          `"${pat.titles.join(' | ').replace(/"/g, "'")}"`,
          `"${pat.dueDates.join(' | ')}"`,
        ].join(','));
      }
      return new Response(lines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="overdue-patrons-${new Date().toISOString().slice(0,10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      count:       patrons.length,
      generatedAt: new Date().toISOString(),
      filters:     { minDays, maxDays, patronTypeID },
      patrons,
    });

  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
