import { supabaseServer } from './supabase-server';

export interface AuditEntry {
  entityType: string;
  entityKey: string;
  oldValue: unknown;
  newValue: unknown;
  source: string;
  flagged?: boolean;
  flagReason?: string | null;
}

export async function recordAudit(entry: AuditEntry) {
  await supabaseServer.from('audit_log').insert({
    entity_type: entry.entityType,
    entity_key: entry.entityKey,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
    source: entry.source,
    flagged: entry.flagged ?? false,
    flag_reason: entry.flagReason ?? null,
  });
}

// Flags a sync write as anomalous when it deviates too sharply from the
// last known value for the same entity — e.g. a SLiMS connection blip
// that returns an empty result set instead of erroring outright, or a
// Koha CSV with a mistyped column. Dropping to 0 from a nonzero value is
// always flagged, since a query silently returning nothing is the most
// common failure mode for this kind of sync.
export function detectAnomaly(oldValue: number | null | undefined, newValue: number | null | undefined): string | null {
  if (oldValue == null || newValue == null) return null;
  if (oldValue > 0 && newValue === 0) return `dropped to 0 from ${oldValue}`;
  if (oldValue > 10 && newValue < oldValue * 0.3) return `dropped ${Math.round((1 - newValue / oldValue) * 100)}% (${oldValue} → ${newValue})`;
  if (oldValue > 0 && newValue > oldValue * 4) return `spiked ${Math.round((newValue / oldValue - 1) * 100)}% (${oldValue} → ${newValue})`;
  return null;
}
