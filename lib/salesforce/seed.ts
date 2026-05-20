// Beacon Plumbing Co. dataset. Generated deterministically from a seeded RNG
// (lib/salesforce/generate.ts) so the data is identical on every boot, then
// loaded into SQLite (lib/db/sqlite.ts) for the SOQL layer. These named arrays
// remain the in-memory source for analytics helpers and artifact components.
import type {
  Account, Activity, ApprovalRequest, Case, Contact, Lead, Opportunity, SfdcBundle, User,
} from './types';
import { generateBundle, TODAY as GEN_TODAY } from './generate';

export const TODAY = GEN_TODAY;

const BUNDLE: SfdcBundle = generateBundle();

export const USERS: User[] = BUNDLE.users;
export const ACCOUNTS: Account[] = BUNDLE.accounts;
export const OPPORTUNITIES: Opportunity[] = BUNDLE.opportunities;
export const LEADS: Lead[] = BUNDLE.leads;
export const CONTACTS: Contact[] = BUNDLE.contacts;
export const ACTIVITIES: Activity[] = BUNDLE.activities;
export const CASES: Case[] = BUNDLE.cases;
export const APPROVAL_REQUESTS: ApprovalRequest[] = BUNDLE.approvalRequests;

export const SFDC_BUNDLE: SfdcBundle = BUNDLE;
