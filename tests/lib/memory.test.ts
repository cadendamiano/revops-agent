import { describe, it, expect } from 'vitest';
import { mergeFlags, buildMemoryPromptBlock, type FlaggedRecord } from '@/lib/memory/types';

describe('flagged-record memory', () => {
  it('adds new flags as open', () => {
    const out = mergeFlags([], [{ recordId: '006X', flag: 'stale', name: 'Acme - Repair' }], 1000);
    expect(out).toHaveLength(1);
    expect(out[0].disposition).toBe('open');
    expect(out[0].flaggedAt).toBe(1000);
  });

  it('de-duplicates by recordId + flag and preserves a prior disposition', () => {
    const existing: FlaggedRecord[] = [
      { recordId: '006X', flag: 'stale', disposition: 'dismissed', flaggedAt: 1, updatedAt: 1 },
    ];
    const out = mergeFlags(existing, [{ recordId: '006X', flag: 'stale', reason: 'still no activity' }], 2000);
    expect(out).toHaveLength(1);
    expect(out[0].disposition).toBe('dismissed'); // not reset to open
    expect(out[0].reason).toBe('still no activity');
    expect(out[0].updatedAt).toBe(2000);
  });

  it('treats a different flag on the same record as a separate entry', () => {
    const out = mergeFlags(
      [{ recordId: '006X', flag: 'stale', disposition: 'dismissed', flaggedAt: 1, updatedAt: 1 }],
      [{ recordId: '006X', flag: 'risk' }],
      3000,
    );
    expect(out).toHaveLength(2);
  });

  it('builds a prompt block that suppresses dismissed records', () => {
    const mem: FlaggedRecord[] = [
      { recordId: '006A', flag: 'stale', name: 'Cascade - Install', disposition: 'dismissed', flaggedAt: 1, updatedAt: 1 },
      { recordId: '006B', flag: 'risk', name: 'Emerald - Service', disposition: 'open', flaggedAt: 1, updatedAt: 1 },
    ];
    const block = buildMemoryPromptBlock(mem);
    expect(block).toContain('Do NOT re-surface');
    expect(block).toContain('Cascade - Install');
    expect(block).toContain('Still open');
  });

  it('returns empty string for no memory', () => {
    expect(buildMemoryPromptBlock([])).toBe('');
    expect(buildMemoryPromptBlock(undefined)).toBe('');
  });
});
