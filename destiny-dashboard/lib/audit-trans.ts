/** Common Destiny Audit.TransType labels (tinyint codes). */
export const TRANS_TYPE_LABELS: Record<number, string> = {
  1: 'Checked out',
  2: 'Checked in',
  3: 'Renewed',
  4: 'Lost',
  5: 'Found',
  6: 'Fine created',
  7: 'Fine paid',
  8: 'Fine waived',
  9: 'Fine deleted',
  10: 'Hold placed',
  11: 'Hold deleted',
  12: 'Copy added',
  13: 'Copy deleted',
  14: 'Stolen',
  15: 'Damaged',
  16: 'Sold',
  17: 'Withdrawn',
  18: 'Transferred',
  19: 'In-library use',
  20: 'Inventory',
  21: 'Historical note',
  22: 'Status change',
  23: 'Location change',
  24: 'Condition change',
  25: 'In-library use',
  26: 'In-library use',
};

export function labelTransType(code: number | null | undefined): string {
  if (code == null) return '(unknown)';
  return TRANS_TYPE_LABELS[code] ?? `Type ${code}`;
}

export function labelTransCombo(type: number, modifier: number): string {
  const typeLabel = labelTransType(type);
  if (!modifier) return typeLabel;
  return `${typeLabel} / mod ${modifier}`;
}
