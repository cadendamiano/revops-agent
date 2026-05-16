import { describe, it, expect } from 'vitest';
import { FLOWS, matchFlow, isInlineArtifactKind } from '@/lib/flows';
import { classifyStake } from '@/lib/policy/approvalPolicy';
import { DEMO_PROMPTS } from '@/lib/data';

describe('matchFlow', () => {
  it('resolves the demo prompts to the right flow id', () => {
    const expected: Record<string, string | null> = {
      'Show me at-risk opportunities': 'at_risk_opps',
      "What's our Q2 forecast?": 'pipeline_forecast',
      'Update the stale opps missing NextStep': 'hygiene_bulk_update',
      'Close-Lost the silent Negotiation opps': 'mass_stage_correction',
      '/forecast': 'pipeline_forecast',
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
  it('has all 4 expected entries', () => {
    expect(Object.keys(FLOWS).sort()).toEqual([
      'at_risk_opps', 'hygiene_bulk_update', 'mass_stage_correction', 'pipeline_forecast',
    ]);
  });

  it('every scripted flow uses an inline artifact kind (renders in-thread)', () => {
    for (const flow of Object.values(FLOWS)) {
      if (!flow.artifact) continue;
      expect(
        isInlineArtifactKind(flow.artifact.kind),
        `flow ${flow.id} expected inline kind, got ${flow.artifact.kind}`,
      ).toBe(true);
    }
  });

  it('approval-bearing flows have a stake matching classifyStake for their recordCount', () => {
    for (const flow of Object.values(FLOWS)) {
      for (const step of flow.steps) {
        if (step.kind !== 'approval') continue;
        const { recordCount, stake } = step.payload;
        // The hygiene flow is reversible / not externally visible.
        // The mass flow is externally visible (Closed Lost) and irreversible.
        const reversible = flow.id !== 'mass_stage_correction';
        const externallyVisible = flow.id === 'mass_stage_correction';
        const expected = classifyStake({ recordCount, reversible, externallyVisible });
        expect(stake).toBe(expected);
      }
    }
  });
});
