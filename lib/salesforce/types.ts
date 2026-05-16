// Salesforce-flavored domain types. Field names mirror real SF objects.
export type Id = string;
export type IsoDate = string; // YYYY-MM-DD

export const TODAY: IsoDate = '2026-05-16';

export type UserRole = 'AE' | 'SDR' | 'Manager' | 'RevOps';

export type User = {
  Id: Id;
  Name: string;
  Email: string;
  Role: UserRole;
  Quota?: number; // ARR quota for AEs only
};

export type Industry = 'Software' | 'Manufacturing' | 'Healthcare' | 'FinServ' | 'Retail';

export type Account = {
  Id: Id;
  Name: string;
  Industry: Industry;
  AnnualRevenue: number;
  Employees: number;
  OwnerId: Id;
};

export type OpportunityStage =
  | 'Prospecting' | 'Qualification' | 'Discovery' | 'Proposal'
  | 'Negotiation' | 'Closed Won' | 'Closed Lost';

export type LeadSource = 'Inbound' | 'Outbound' | 'Partner' | 'Event';

export type Opportunity = {
  Id: Id;
  Name: string;
  AccountId: Id;
  OwnerId: Id;
  StageName: OpportunityStage;
  Amount: number;
  Probability: number; // 0-100
  CloseDate: IsoDate;
  CreatedDate: IsoDate;
  LastActivityDate?: IsoDate;
  NextStep?: string;
  LeadSource?: LeadSource;
};

export type LeadStatus = 'New' | 'Working' | 'Qualified' | 'Unqualified';

export type Lead = {
  Id: Id;
  Name: string;
  Company: string;
  Email: string;
  Status: LeadStatus;
  LeadSource: LeadSource;
  CreatedDate: IsoDate;
  OwnerId?: Id;
};

export type SfdcBundle = {
  users: User[];
  accounts: Account[];
  opportunities: Opportunity[];
  leads: Lead[];
};

// Utility: days between two ISO dates (a - b), positive when a is after b.
export function daysBetween(a: IsoDate, b: IsoDate): number {
  const dA = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const dB = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((dA - dB) / 86400000);
}

// Stage → default probability when none specified.
export const STAGE_PROBABILITY: Record<OpportunityStage, number> = {
  Prospecting: 10,
  Qualification: 20,
  Discovery: 40,
  Proposal: 60,
  Negotiation: 80,
  'Closed Won': 100,
  'Closed Lost': 0,
};

export function isOpenStage(s: OpportunityStage): boolean {
  return s !== 'Closed Won' && s !== 'Closed Lost';
}
