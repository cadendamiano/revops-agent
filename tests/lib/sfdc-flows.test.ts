import { describe, it, expect } from 'vitest';
import { FLOWS, matchFlow } from '@/lib/flows';
import { classifyStake } from '@/lib/policy/approvalPolicy';
import { DEMO_PROMPTS } from '@/lib/data';

describe('matchFlow', () => {
  it('resolves the demo prompts to the right flow id', () => {
    const expected: Record<string, string | null> = {
      "What's our Q2 forecast?": 'forecast_review',
      'Show my pipeline as a kanban': 'pipeline_kanban',
      'Tell me about Cascade Property Group': 'account_360',
      'Qualify hot leads from the last 7 days': 'lead_qualification',
      'Which service tickets are breaching SLA?': 'case_sla_review',
      'Run a SOQL for the top open opps closing this quarter': 'soql_explore',
    };
    for (const prompt of DEMO_PROMPTS) {
      expect(matchFlow(prompt)).toBe(expected[prompt]);
    }
  });

  it('returns null for unrelated text', () => {
    expect(matchFlow('write me a haiku about clouds')).toBeNull();
  });
});

describe('FLOWS', () => {
  it('has the 6 expected entries', () => {
    expect(Object.keys(FLOWS).sort()).toEqual([
      'account_360', 'case_sla_review', 'forecast_review',
      'lead_qualification', 'pipeline_kanban', 'soql_explore',
    ]);
  });

  it('approval-bearing flows have a stake matching classifyStake for their recordCount', () => {
    for (const flow of Object.values(FLOWS)) {
      for (const step of flow.steps) {
        if (step.kind !== 'approval') continue;
        const { recordCount, stake } = step.payload;
        // Current approval flow (lead_qualification) is reversible + not externally visible.
        const expected = classifyStake({ recordCount, reversible: true, externallyVisible: false });
        expect(stake).toBe(expected);
      }
    }
  });
});
