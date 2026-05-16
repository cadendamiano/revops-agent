import { describe, it, expect } from 'vitest';
import { OPPORTUNITIES } from '@/lib/salesforce/seed';
import { TODAY, daysBetween, isOpenStage } from '@/lib/salesforce/types';

function daysSinceActivity(o: typeof OPPORTUNITIES[number]): number {
  const ref = o.LastActivityDate ?? o.CreatedDate;
  return daysBetween(TODAY, ref);
}

describe('sfdc seed', () => {
  it('contains at least 10 at-risk opps (any open opp with 1+ risk)', () => {
    const atRisk = OPPORTUNITIES.filter(o => {
      const open = isOpenStage(o.StageName);
      const dsa = daysSinceActivity(o);
      if (open && o.CloseDate < TODAY) return true;
      if (open && dsa >= 30) return true;
      if (
        (o.Amount === 0 || o.Amount == null) &&
        (o.StageName === 'Discovery' || o.StageName === 'Proposal' || o.StageName === 'Negotiation')
      ) return true;
      if (o.StageName === 'Negotiation' && dsa >= 60) return true;
      if (open && (!o.NextStep || o.NextStep.trim() === '')) return true;
      return false;
    });
    expect(atRisk.length).toBeGreaterThanOrEqual(10);
  });

  it('contains at least 14 open-stage opps missing NextStep', () => {
    const missing = OPPORTUNITIES.filter(o =>
      isOpenStage(o.StageName) && (!o.NextStep || o.NextStep.trim() === ''),
    );
    expect(missing.length).toBeGreaterThanOrEqual(14);
  });

  it('contains at least 28 Negotiation opps with LastActivityDate >= 60 days ago', () => {
    const stale = OPPORTUNITIES.filter(o =>
      o.StageName === 'Negotiation' && daysSinceActivity(o) >= 60,
    );
    expect(stale.length).toBeGreaterThanOrEqual(28);
  });
});
