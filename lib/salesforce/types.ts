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

// ─── Contact ────────────────────────────────────────────────────────
export type Contact = {
  Id: Id;
  AccountId: Id;
  Name: string;
  Title?: string;
  Email: string;
  Phone?: string;
  OwnerId?: Id;
};

// ─── Activity (tasks/events/comms) ──────────────────────────────────
export type ActivityType = 'Call' | 'Email' | 'Meeting' | 'Note' | 'StageChange';
export type Activity = {
  Id: Id;
  WhatId: Id;     // Opportunity, Account, Case Id
  WhoId?: Id;     // Contact or Lead Id
  Type: ActivityType;
  Subject: string;
  ActivityDate: IsoDate;
  DurationMin?: number;
  OwnerId: Id;
};

// ─── Case ───────────────────────────────────────────────────────────
export type CasePriority = 'P1' | 'P2' | 'P3';
export type CaseStatus = 'New' | 'Working' | 'Escalated' | 'Closed';
export type Case = {
  Id: Id;
  CaseNumber: string;
  AccountId: Id;
  Subject: string;
  Priority: CasePriority;
  Status: CaseStatus;
  CreatedDate: IsoDate;
  SlaTargetDate: IsoDate;
  OwnerId: Id;
};

// ─── Report / Dashboard (analytics) ─────────────────────────────────
export type ReportFormat = 'Tabular' | 'Summary' | 'Matrix';
export type ReportRow = Record<string, string | number>;
export type Report = {
  Id: Id;
  Name: string;
  Folder: string;
  Format: ReportFormat;
  columns: string[];
  rows: ReportRow[] | (() => ReportRow[]);
  grandTotal?: number;
};

export type DashboardTileType = 'metric' | 'bar' | 'donut' | 'line';
export type DashboardTile = {
  type: DashboardTileType;
  label: string;
  value?: string | number;
  series?: { label: string; value: number }[];
  reportId?: Id;
};
export type Dashboard = {
  Id: Id;
  Name: string;
  tiles: DashboardTile[];
};

// ─── Approval Request ──────────────────────────────────────────────
export type ApprovalRequestStatus = 'Pending' | 'Approved' | 'Rejected';
export type ApprovalRequest = {
  Id: Id;
  SubmittedFor: Id;        // Opportunity Id
  SubmittedById: Id;       // User Id
  Reason: string;
  DiscountPct: number;
  Amount: number;
  Status: ApprovalRequestStatus;
  CreatedDate: IsoDate;
};

// ─── sObject describe (schema) ─────────────────────────────────────
export type FieldType = 'id' | 'string' | 'picklist' | 'reference' | 'number' | 'currency' | 'date' | 'datetime' | 'boolean' | 'email' | 'phone' | 'textarea';
export type FieldDescribe = {
  name: string;
  label: string;
  type: FieldType;
  nillable: boolean;
  referenceTo?: string;
  picklistValues?: string[];
};
export type ChildRelationship = {
  childSObject: string;
  field: string;
  relationshipName: string;
};
export type SObjectDescribe = {
  name: string;
  label: string;
  fields: FieldDescribe[];
  childRelationships: ChildRelationship[];
};

export type SfdcBundle = {
  users: User[];
  accounts: Account[];
  opportunities: Opportunity[];
  leads: Lead[];
  contacts: Contact[];
  activities: Activity[];
  cases: Case[];
  approvalRequests: ApprovalRequest[];
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
