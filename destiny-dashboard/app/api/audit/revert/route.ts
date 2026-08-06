import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { recordAudit } from '@/lib/audit';

// Restores an audited row to its old_value. Protected by the same password
// used to unlock manual-entry sections elsewhere in this dashboard — not
// real security (it's a client-visible string, same as those forms), just
// enough to keep this from being a bare, unauthenticated write endpoint.
// campus_stats itself has no public write RLS policy, so this route (using
// the service-role key) is the only way to undo a bad sync short of
// editing Supabase directly.
const ADMIN_PASSWORD = 'palstateu';

export async function POST(request: NextRequest) {
  const { auditId, password } = await request.json();
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!auditId) {
    return NextResponse.json({ error: 'Missing auditId' }, { status: 400 });
  }

  const { data: entry, error: lookupError } = await supabaseServer.from('audit_log').select('*').eq('id', auditId).maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!entry) return NextResponse.json({ error: 'Audit entry not found' }, { status: 404 });
  if (!entry.old_value) return NextResponse.json({ error: 'Nothing to revert to — this was the first recorded value' }, { status: 400 });

  if (entry.entity_type === 'campus_stats') {
    const [campus, period_type, period_date] = entry.entity_key.split('|');
    const { error } = await supabaseServer
      .from('campus_stats')
      .upsert({ ...entry.old_value, campus, period_type, period_date }, { onConflict: 'campus,period_type,period_date' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    return NextResponse.json({ error: `Revert not supported for entity_type "${entry.entity_type}"` }, { status: 400 });
  }

  await recordAudit({
    entityType: entry.entity_type, entityKey: entry.entity_key, source: 'revert',
    oldValue: entry.new_value, newValue: entry.old_value,
  });
  await supabaseServer.from('audit_log').update({ reverted: true }).eq('id', auditId);

  return NextResponse.json({ ok: true });
}
