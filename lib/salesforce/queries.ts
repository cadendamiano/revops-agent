// Private query helpers — risk/stale/missing-field math used by the SOQL parser
// and any other tools that want canonical CRM logic.
import { OPPORTUNITIES, USERS } from './seed';
import {
  daysBetween, isOpenStage, TODAY,
  type Opportunity, type OpportunityStage, type User,
} from './types';

export type AtRiskOpp = {
  Id: string;
  Name: string;
  StageName: OpportunityStage;
  Amount: number;
  ownerId: string;
  ownerName: string;
  risks: string[];
  daysSinceActivity: number;
};

export function daysSinceActivity(o: Opportunity): number {
  const ref = o.LastActivityDate ?? o.CreatedDate;
  return daysBetween(TODAY, ref);
}

export function computeRisks(o: Opportunity): string[] {
  const risks: string[] = [];
  const open = isOpenStage(o.StageName);
  if (open && o.CloseDate < TODAY) risks.push('CloseDate in past');
  const dsa = daysSinceActivity(o);
  if (open && dsa >= 30) risks.push('No activity 30d+');
  if ((o.Amount === 0 || o.Amount == null) && (o.StageName === 'Quoted' || o.StageName === 'Scheduled' || o.StageName === 'Job Complete')) {
    risks.push('Missing Amount');
  }
  if (o.StageName === 'Quoted' && dsa >= 60) risks.push('Stuck in quote');
  if (open && (o.NextStep == null || o.NextStep.trim() === '')) risks.push('Missing NextStep');
  return risks;
}

export function ownerName(id: string): string {
  return USERS.find(u => u.Id === id)?.Name ?? id;
}

export function findAtRiskOpps(limit = 10): AtRiskOpp[] {
  const tagged = OPPORTUNITIES
    .map(o => ({
      Id: o.Id,
      Name: o.Name,
      StageName: o.StageName,
      Amount: o.Amount,
      ownerId: o.OwnerId,
      ownerName: ownerName(o.OwnerId),
      risks: computeRisks(o),
      daysSinceActivity: daysSinceActivity(o),
    }))
    .filter(o => o.risks.length > 0);
  tagged.sort((a, b) => b.risks.length - a.risks.length || b.Amount - a.Amount);
  return tagged.slice(0, limit);
}

export function findStaleOpps(minDaysSinceActivity: number, stage?: OpportunityStage): Opportunity[] {
  return OPPORTUNITIES.filter(o => {
    if (stage && o.StageName !== stage) return false;
    return daysSinceActivity(o) >= minDaysSinceActivity;
  });
}

export function findOppsMissingField(field: 'NextStep' | 'Amount' | 'CloseDate'): Opportunity[] {
  return OPPORTUNITIES.filter(o => {
    if (!isOpenStage(o.StageName)) return false;
    if (field === 'NextStep') return !o.NextStep || o.NextStep.trim() === '';
    if (field === 'Amount') return !o.Amount || o.Amount === 0;
    if (field === 'CloseDate') return !o.CloseDate || o.CloseDate.trim() === '';
    return false;
  });
}

// ─── Forecast math (used by analytics report) ────────────────────────

export type ForecastByStage = {
  stage: OpportunityStage;
  count: number;
  unweighted: number;
  weighted: number;
};

export type ForecastByOwner = {
  ownerId: string;
  ownerName: string;
  quota: number;
  weighted: number;
  attainmentPct: number;
};

export type PipelineForecast = {
  quarter: 'Q2' | 'Q3';
  totalUnweighted: number;
  totalWeighted: number;
  byStage: ForecastByStage[];
  byOwner: ForecastByOwner[];
  quotaTotal: number;
  attainmentPct: number;
};

const Q_RANGES: Record<'Q2' | 'Q3', { start: string; end: string }> = {
  Q2: { start: '2026-04-01', end: '2026-06-30' },
  Q3: { start: '2026-07-01', end: '2026-09-30' },
};

export function weightedAmount(o: Opportunity): number {
  if (o.StageName === 'Closed Won') return o.Amount;
  if (o.StageName === 'Closed Lost') return 0;
  return o.Amount * (o.Probability / 100);
}

export function getPipelineForecast(quarter: 'Q2' | 'Q3'): PipelineForecast {
  const { start, end } = Q_RANGES[quarter];
  const inRange = OPPORTUNITIES.filter(o => o.CloseDate >= start && o.CloseDate <= end);

  const totalUnweighted = inRange.reduce((s, o) => s + o.Amount, 0);
  const totalWeighted = inRange.reduce((s, o) => s + weightedAmount(o), 0);

  const stages: OpportunityStage[] = [
    'Qualified', 'Quoted', 'Scheduled', 'Job Complete',
    'Invoiced', 'Closed Won', 'Closed Lost',
  ];
  const byStage: ForecastByStage[] = stages.map(stage => {
    const items = inRange.filter(o => o.StageName === stage);
    return {
      stage,
      count: items.length,
      unweighted: items.reduce((s, o) => s + o.Amount, 0),
      weighted: items.reduce((s, o) => s + weightedAmount(o), 0),
    };
  }).filter(s => s.count > 0);

  const aes: User[] = USERS.filter(u => u.Role === 'InsideSales');
  const byOwner: ForecastByOwner[] = aes.map(u => {
    const weighted = inRange
      .filter(o => o.OwnerId === u.Id)
      .reduce((s, o) => s + weightedAmount(o), 0);
    const quota = u.Quota ?? 0;
    const attainmentPct = quota > 0 ? Math.round((weighted / quota) * 1000) / 10 : 0;
    return { ownerId: u.Id, ownerName: u.Name, quota, weighted, attainmentPct };
  });

  const quotaTotal = aes.reduce((s, u) => s + (u.Quota ?? 0), 0);
  const attainmentPct = quotaTotal > 0
    ? Math.round((totalWeighted / quotaTotal) * 1000) / 10
    : 0;

  return {
    quarter,
    totalUnweighted,
    totalWeighted,
    byStage,
    byOwner,
    quotaTotal,
    attainmentPct,
  };
}
