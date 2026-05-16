// Salesforce dataset accessor — thin facade over the deterministic seed.
import type { Workspace } from './store';
import { USERS, ACCOUNTS, OPPORTUNITIES, LEADS } from '@/lib/salesforce/seed';

export type DatasetKey = 'default';

export const DEMO_PROMPTS: string[] = [
  'Show me at-risk opportunities',
  "What's our Q2 forecast?",
  'Update the stale opps missing NextStep',
  'Close-Lost the silent Negotiation opps',
  '/forecast',
];

export const LOGISTICS_DEMO_PROMPTS: string[] = [];

export const SESSION_FLOW_MAP: Record<string, string> = {};

export function getDataset(_key: DatasetKey = 'default') {
  return { users: USERS, accounts: ACCOUNTS, opportunities: OPPORTUNITIES, leads: LEADS };
}

export const SEED_WORKSPACES: Workspace[] = [
  {
    id: 'ws_pipeops',
    name: 'Pipeline Ops',
    icon: '◎',
    color: 'oklch(0.78 0.06 250)',
    createdAt: Date.parse('2026-05-01T00:00:00Z'),
    threads: [
      {
        id: 'thr_pipeops_seed',
        title: 'Pipeline review',
        createdAt: Date.parse('2026-05-01T00:00:00Z'),
        turns: [],
        artifacts: [],
        approvalStates: {},
        approvalPayloads: {},
      },
    ],
    files: [],
  },
];
