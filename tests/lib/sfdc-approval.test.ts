import { describe, it, expect } from 'vitest';
import { classifyStake, approvalPolicyFor, type Stake } from '@/lib/policy/approvalPolicy';

type Case = {
  recordCount: number;
  reversible: boolean;
  externallyVisible: boolean;
  expected: Stake;
};

const CASES: Case[] = [
  // recordCount = 0 → read-only regardless of other flags
  { recordCount: 0, reversible: true,  externallyVisible: false, expected: 'read-only' },
  { recordCount: 0, reversible: false, externallyVisible: false, expected: 'read-only' },
  { recordCount: 0, reversible: true,  externallyVisible: true,  expected: 'read-only' },
  // 1 record, reversible, not externally visible → single-record-edit
  { recordCount: 1, reversible: true,  externallyVisible: false, expected: 'single-record-edit' },
  // 1 record but irreversible → mass-action
  { recordCount: 1, reversible: false, externallyVisible: false, expected: 'mass-action' },
  // 1 record, externally visible → mass-action
  { recordCount: 1, reversible: true,  externallyVisible: true,  expected: 'mass-action' },
  // 2..25 reversible → bulk-update
  { recordCount: 2,  reversible: true, externallyVisible: false, expected: 'bulk-update' },
  { recordCount: 25, reversible: true, externallyVisible: false, expected: 'bulk-update' },
  // 26 → mass-action regardless
  { recordCount: 26, reversible: true, externallyVisible: false, expected: 'mass-action' },
  // irreversible always mass-action
  { recordCount: 25, reversible: false, externallyVisible: false, expected: 'mass-action' },
  // externally visible always mass-action
  { recordCount: 25, reversible: true,  externallyVisible: true,  expected: 'mass-action' },
];

describe('classifyStake', () => {
  for (const c of CASES) {
    it(`recordCount=${c.recordCount} reversible=${c.reversible} externallyVisible=${c.externallyVisible} → ${c.expected}`, () => {
      expect(classifyStake({
        recordCount: c.recordCount,
        reversible: c.reversible,
        externallyVisible: c.externallyVisible,
      })).toBe(c.expected);
    });
  }
});

describe('approvalPolicyFor', () => {
  it('read-only is auto-approvable', () => {
    expect(approvalPolicyFor('read-only')).toBe('auto-approvable');
  });
  it('single-record-edit is single-approver', () => {
    expect(approvalPolicyFor('single-record-edit')).toBe('single-approver');
  });
  it('bulk-update is single-approver', () => {
    expect(approvalPolicyFor('bulk-update')).toBe('single-approver');
  });
  it('mass-action is requires-dual-control', () => {
    expect(approvalPolicyFor('mass-action')).toBe('requires-dual-control');
  });
});
