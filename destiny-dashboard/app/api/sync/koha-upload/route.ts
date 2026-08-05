import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

// Local-only Koha campuses have no network path back to this dashboard for
// a live sync, so their staff run a report on-site and POST the resulting
// CSV here on whatever schedule is realistic (daily, weekly — whatever the
// campus can manage). Protected by a shared secret since this is otherwise
// an open write endpoint.
//
// POST /api/sync/koha-upload?campus=<name>
// Authorization: Bearer <KOHA_UPLOAD_TOKEN>
// Body (text/csv), one header row + 1+ data rows (for backfilling missed days):
//   date,total_items,checked_out,total_patrons,active_patrons,checkouts,new_items
//   2026-08-01,12000,340,2100,410,58,3
const REQUIRED_COLUMNS = ['date', 'total_items', 'checked_out', 'total_patrons', 'active_patrons', 'checkouts', 'new_items'];

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.KOHA_UPLOAD_TOKEN || token !== process.env.KOHA_UPLOAD_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const campus = request.nextUrl.searchParams.get('campus');
  if (!campus) {
    return NextResponse.json({ error: 'Missing ?campus=<name> query param' }, { status: 400 });
  }

  const body = await request.text();
  const lines = body.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) {
    return NextResponse.json({ error: 'Expected a header row plus at least one data row' }, { status: 400 });
  }

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const colIdx = (name: string) => header.indexOf(name);
  const missing = REQUIRED_COLUMNS.filter(c => colIdx(c) === -1);
  if (missing.length > 0) {
    return NextResponse.json({ error: `CSV header missing column(s): ${missing.join(', ')}. Expected: ${REQUIRED_COLUMNS.join(',')}` }, { status: 400 });
  }

  const rows = lines.slice(1).map(line => {
    const cells = line.split(',').map(c => c.trim());
    const num = (col: string) => {
      const v = Number(cells[colIdx(col)]);
      return Number.isFinite(v) ? v : null;
    };
    return {
      campus,
      source: 'koha' as const,
      period_type: 'daily' as const,
      period_date: cells[colIdx('date')],
      total_items: num('total_items'),
      checked_out: num('checked_out'),
      total_patrons: num('total_patrons'),
      active_patrons: num('active_patrons'),
      checkouts: num('checkouts'),
      new_items: num('new_items'),
    };
  });

  const { error } = await supabaseServer
    .from('campus_stats')
    .upsert(rows, { onConflict: 'campus,period_type,period_date' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, campus, rowsUpserted: rows.length });
}
