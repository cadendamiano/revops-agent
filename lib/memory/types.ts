// Flagged-record memory (PRD §7.11). Scoped to records the agent has flagged
// and the user's disposition on them. Persisted client-side (localStorage) and
// sent to the orchestrator on each turn so the agent does not re-surface an
// issue the user already dismissed unless the record's state has changed.

export type FlagKind = 'risk' | 'opportunity' | 'stale' | 'duplicate' | 'hygiene' | 'other';

// 'open' = surfaced, awaiting a decision. The rest are user dispositions.
export type FlagDisposition = 'open' | 'approved' | 'rejected' | 'dismissed' | 'ignore';

export type FlaggedRecord = {
  recordId: string;
  sobject?: string;
  name?: string;
  flag: FlagKind;
  reason?: string;
  disposition: FlagDisposition;
  flaggedAt: number;
  updatedAt: number;
};

// Input shape the agent's flag_records tool produces.
export type FlagInput = {
  recordId: string;
  sobject?: string;
  name?: string;
  flag?: FlagKind;
  reason?: string;
};

const key = (r: { recordId: string; flag: FlagKind }) => `${r.recordId}::${r.flag}`;

/**
 * Merge newly flagged records into existing memory, de-duplicated by
 * recordId + flag. An existing user disposition is preserved (a dismissed
 * item stays dismissed); only metadata is refreshed.
 */
export function mergeFlags(existing: FlaggedRecord[], incoming: FlagInput[], now = Date.now()): FlaggedRecord[] {
  const byKey = new Map<string, FlaggedRecord>();
  for (const e of existing) byKey.set(key(e), e);
  for (const inc of incoming) {
    const flag: FlagKind = inc.flag ?? 'other';
    const k = key({ recordId: inc.recordId, flag });
    const prev = byKey.get(k);
    if (prev) {
      byKey.set(k, { ...prev, name: inc.name ?? prev.name, sobject: inc.sobject ?? prev.sobject, reason: inc.reason ?? prev.reason, updatedAt: now });
    } else {
      byKey.set(k, { recordId: inc.recordId, sobject: inc.sobject, name: inc.name, flag, reason: inc.reason, disposition: 'open', flaggedAt: now, updatedAt: now });
    }
  }
  return Array.from(byKey.values());
}

/**
 * Compact prompt block describing prior flags. The agent must not re-surface
 * records the user dismissed/ignored unless their state changed.
 */
export function buildMemoryPromptBlock(memory: FlaggedRecord[] | undefined): string {
  if (!memory || memory.length === 0) return '';
  const suppressed = memory.filter(m => m.disposition === 'dismissed' || m.disposition === 'ignore');
  const acted = memory.filter(m => m.disposition === 'approved' || m.disposition === 'rejected');
  const open = memory.filter(m => m.disposition === 'open');
  const lines: string[] = ['FLAGGED-RECORD MEMORY (from prior sessions):'];
  if (suppressed.length) {
    lines.push('- Do NOT re-surface these (user dismissed/ignored) unless the record clearly changed: '
      + suppressed.map(m => `${m.name ?? m.recordId} [${m.flag}]`).join('; '));
  }
  if (acted.length) {
    lines.push('- Already acted on: ' + acted.map(m => `${m.name ?? m.recordId} (${m.disposition})`).join('; '));
  }
  if (open.length) {
    lines.push('- Still open from before: ' + open.map(m => `${m.name ?? m.recordId} [${m.flag}]`).join('; '));
  }
  return lines.join('\n');
}
