import { describe, it, expect } from 'vitest';
import { OPPORTUNITIES, LEADS, ACCOUNTS } from '@/lib/salesforce/seed';
import { TODAY, daysBetween, isOpenStage } from '@/lib/salesforce/types';

function daysSinceActivity(o: typeof OPPORTUNITIES[number]): number {
  const ref = o.LastActivityDate ?? o.CreatedDate;
  return daysBetween(TODAY, ref);
}

describe('beacon plumbing dataset', () => {
  it('generates PRD-scale volumes (Section 6.4)', () => {
    expect(ACCOUNTS.length).toBeGreaterThanOrEqual(200);
    expect(LEADS.length).toBeGreaterThanOrEqual(1200);
    expect(OPPORTUNITIES.length).toBeGreaterThanOrEqual(700);
  });

  it('contains at least 10 at-risk open opps', () => {
    const atRisk = OPPORTUNITIES.filter(o => {
      const open = isOpenStage(o.StageName);
      const dsa = daysSinceActivity(o);
      if (open && o.CloseDate < TODAY) return true;
      if (open && dsa >= 30) return true;
      if (open && (!o.NextStep || o.NextStep.trim() === '')) return true;
      return false;
    });
    expect(atRisk.length).toBeGreaterThanOrEqual(10);
  });

  it('contains open opps missing NextStep (hygiene)', () => {
    const missing = OPPORTUNITIES.filter(o =>
      isOpenStage(o.StageName) && (!o.NextStep || o.NextStep.trim() === ''),
    );
    expect(missing.length).toBeGreaterThanOrEqual(5);
  });

  it('plants the stuck-in-quote scenario (Quoted 60+ days, high value)', () => {
    const stuck = OPPORTUNITIES.find(o => o.Id === '006900001');
    expect(stuck).toBeTruthy();
    expect(stuck!.StageName).toBe('Quoted');
    expect(daysSinceActivity(stuck!)).toBeGreaterThanOrEqual(60);
    expect(stuck!.Amount).toBeGreaterThanOrEqual(50000);
  });

  it('plants a forecast-concentration cluster of large open commercial deals', () => {
    const big = OPPORTUNITIES.filter(o =>
      ['0069004000', '0069004001', '0069004002'].includes(o.Id),
    );
    expect(big.length).toBe(3);
    expect(big.every(o => isOpenStage(o.StageName) && o.Amount >= 90000)).toBe(true);
  });
});
