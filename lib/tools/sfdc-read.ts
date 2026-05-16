// Salesforce read-only tools. Pure functions over the deterministic seed.
import { z } from 'zod';
import { defineTool, type DefinedTool } from './defineTool';
import {
  USERS, ACCOUNTS, OPPORTUNITIES, LEADS, SFDC_BUNDLE,
} from '@/lib/salesforce/seed';
import {
  daysBetween, isOpenStage, STAGE_PROBABILITY, TODAY,
  type Opportunity, type OpportunityStage, type User,
} from '@/lib/salesforce/types';

const OppStageEnum = z.enum([
  'Prospecting', 'Qualification', 'Discovery', 'Proposal',
  'Negotiation', 'Closed Won', 'Closed Lost',
]);

function getSfdcBundle() {
  return SFDC_BUNDLE;
}

function daysSinceActivity(o: Opportunity): number {
  const ref = o.LastActivityDate ?? o.CreatedDate;
  return daysBetween(TODAY, ref);
}

function computeRisks(o: Opportunity): string[] {
  const risks: string[] = [];
  const open = isOpenStage(o.StageName);
  if (open && o.CloseDate < TODAY) risks.push('CloseDate in past');
  const dsa = daysSinceActivity(o);
  if (open && dsa >= 30) risks.push('No activity 30d+');
  if ((o.Amount === 0 || o.Amount == null) && (o.StageName === 'Discovery' || o.StageName === 'Proposal' || o.StageName === 'Negotiation')) {
    risks.push('Missing Amount');
  }
  if (o.StageName === 'Negotiation' && dsa >= 60) risks.push('Stage mismatch');
  if (open && (o.NextStep == null || o.NextStep.trim() === '')) risks.push('Missing NextStep');
  return risks;
}

function ownerName(id: string): string {
  return USERS.find(u => u.Id === id)?.Name ?? id;
}

export const findAtRiskOpps = defineTool({
  name: 'find_at_risk_opps',
  label: 'Find at-risk opportunities',
  domain: 'org',
  description: 'Return opportunities with one or more risk signals (stale, missing fields, past close date, stage mismatch). Sorted by risk count then Amount.',
  schema: z.object({
    limit: z.number().int().min(1).max(100).optional(),
  }),
});

export const findStaleOpps = defineTool({
  name: 'find_stale_opps',
  label: 'Find stale opportunities',
  domain: 'org',
  description: 'List opportunities whose LastActivityDate is older than the given threshold (days). Optional stage filter.',
  schema: z.object({
    minDaysSinceActivity: z.number().int().min(0),
    stage: OppStageEnum.optional(),
  }),
});

export const findOppsMissingField = defineTool({
  name: 'find_opps_missing_field',
  label: 'Find opps missing field',
  domain: 'org',
  description: 'List open opportunities whose given field (NextStep, Amount, CloseDate) is empty.',
  schema: z.object({
    field: z.enum(['NextStep', 'Amount', 'CloseDate']),
  }),
});

export const getPipelineForecast = defineTool({
  name: 'get_pipeline_forecast',
  label: 'Pipeline forecast',
  domain: 'org',
  description: 'Quarter-roll forecast with stage and owner breakdowns, weighted by stage probability.',
  schema: z.object({
    quarter: z.enum(['Q2', 'Q3']),
  }),
});

export const listOpps = defineTool({
  name: 'list_opps',
  label: 'List opportunities',
  domain: 'org',
  description: 'List opportunities, optionally filtered by stage and/or owner.',
  schema: z.object({
    stage: OppStageEnum.optional(),
    ownerId: z.string().optional(),
  }),
});

export const getOpp = defineTool({
  name: 'get_opp',
  label: 'Get opportunity',
  domain: 'org',
  description: 'Fetch a single opportunity by Id.',
  schema: z.object({ id: z.string().min(1) }),
});

export const listUsers = defineTool({
  name: 'list_users',
  label: 'List users',
  domain: 'org',
  description: 'List all users (AEs, SDRs, managers, RevOps).',
  schema: z.object({}),
});

export const listAccounts = defineTool({
  name: 'list_accounts',
  label: 'List accounts',
  domain: 'org',
  description: 'List all accounts.',
  schema: z.object({}),
});

export const listLeads = defineTool({
  name: 'list_leads',
  label: 'List leads',
  domain: 'org',
  description: 'List all leads.',
  schema: z.object({}),
});

export const getAccount = defineTool({
  name: 'get_account',
  label: 'Get account',
  domain: 'org',
  description: 'Fetch a single account by Id.',
  schema: z.object({ id: z.string().min(1) }),
});

export const SFDC_READ_TOOLS: DefinedTool[] = [
  findAtRiskOpps, findStaleOpps, findOppsMissingField, getPipelineForecast,
  listOpps, getOpp, listUsers, listAccounts, listLeads, getAccount,
];

// ─── Handlers ────────────────────────────────────────────────────────

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

export async function handleFindAtRiskOpps(input: { limit?: number }): Promise<AtRiskOpp[]> {
  const limit = input.limit ?? 10;
  const { opportunities } = getSfdcBundle();
  const tagged = opportunities
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

export async function handleFindStaleOpps(input: {
  minDaysSinceActivity: number;
  stage?: OpportunityStage;
}): Promise<Opportunity[]> {
  const { opportunities } = getSfdcBundle();
  return opportunities.filter(o => {
    if (input.stage && o.StageName !== input.stage) return false;
    return daysSinceActivity(o) >= input.minDaysSinceActivity;
  });
}

export async function handleFindOppsMissingField(input: {
  field: 'NextStep' | 'Amount' | 'CloseDate';
}): Promise<Opportunity[]> {
  const { opportunities } = getSfdcBundle();
  return opportunities.filter(o => {
    if (!isOpenStage(o.StageName)) return false;
    if (input.field === 'NextStep') return !o.NextStep || o.NextStep.trim() === '';
    if (input.field === 'Amount') return !o.Amount || o.Amount === 0;
    if (input.field === 'CloseDate') return !o.CloseDate || o.CloseDate.trim() === '';
    return false;
  });
}

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

function weightedAmount(o: Opportunity): number {
  if (o.StageName === 'Closed Won') return o.Amount;
  if (o.StageName === 'Closed Lost') return 0;
  return o.Amount * (o.Probability / 100);
}

export async function handleGetPipelineForecast(input: {
  quarter: 'Q2' | 'Q3';
}): Promise<PipelineForecast> {
  const { opportunities } = getSfdcBundle();
  const { start, end } = Q_RANGES[input.quarter];
  const inRange = opportunities.filter(o => o.CloseDate >= start && o.CloseDate <= end);

  const totalUnweighted = inRange.reduce((s, o) => s + o.Amount, 0);
  const totalWeighted = inRange.reduce((s, o) => s + weightedAmount(o), 0);

  const stages: OpportunityStage[] = [
    'Prospecting', 'Qualification', 'Discovery', 'Proposal',
    'Negotiation', 'Closed Won', 'Closed Lost',
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

  const aes: User[] = USERS.filter(u => u.Role === 'AE');
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
    quarter: input.quarter,
    totalUnweighted,
    totalWeighted,
    byStage,
    byOwner,
    quotaTotal,
    attainmentPct,
  };
}

export async function handleListOpps(input: {
  stage?: OpportunityStage;
  ownerId?: string;
}): Promise<Opportunity[]> {
  const { opportunities } = getSfdcBundle();
  return opportunities.filter(o =>
    (!input.stage || o.StageName === input.stage) &&
    (!input.ownerId || o.OwnerId === input.ownerId),
  );
}

export async function handleGetOpp(input: { id: string }): Promise<Opportunity | null> {
  const { opportunities } = getSfdcBundle();
  return opportunities.find(o => o.Id === input.id) ?? null;
}

export async function handleListUsers(): Promise<User[]> {
  return USERS;
}

export async function handleListAccounts() {
  return ACCOUNTS;
}

export async function handleListLeads() {
  return LEADS;
}

export async function handleGetAccount(input: { id: string }) {
  return ACCOUNTS.find(a => a.Id === input.id) ?? null;
}

void STAGE_PROBABILITY;
