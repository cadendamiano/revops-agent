// Salesforce dataset accessor — thin facade over the deterministic seed.
import type { Workspace } from './store';
import { USERS, ACCOUNTS, OPPORTUNITIES, LEADS } from '@/lib/salesforce/seed';

export type DatasetKey = 'default';

export const DEMO_PROMPTS: string[] = [
  "What's our Q2 forecast?",
  'Show my pipeline as a kanban',
  'Tell me about Cascade Property Group',
  'Qualify hot leads from the last 7 days',
  'Which service tickets are breaching SLA?',
  'Run a SOQL for the top open opps closing this quarter',
];

export const LOGISTICS_DEMO_PROMPTS: string[] = [];

// Task templates (PRD §7.1) — one per core task type, for live (testing) mode.
export type TaskTemplate = { label: string; prompt: string };
export const TASK_TEMPLATES: TaskTemplate[] = [
  { label: 'Pipeline review', prompt: 'Review my open pipeline and tell me what I should worry about — stale deals, stuck quotes, forecast concentration, and ownership gaps.' },
  { label: 'Lead re-engagement', prompt: 'Find cold leads worth reviving and draft personalized outreach for each.' },
  { label: 'Forecast modeling', prompt: 'Show me the Q2 forecast so I can adjust the stage probability assumptions.' },
  { label: 'Data hygiene', prompt: 'Find data quality issues — duplicate accounts, missing fields, unassigned or orphaned records — and propose fixes.' },
  { label: 'Stuck-deal intervention', prompt: 'Which deals are stuck, why aren’t they moving, and what should I do about each?' },
];

export const SESSION_FLOW_MAP: Record<string, string> = {};

export function getDataset(_key: DatasetKey = 'default') {
  return { users: USERS, accounts: ACCOUNTS, opportunities: OPPORTUNITIES, leads: LEADS };
}

const DAY = 86_400_000;

export const SEED_WORKSPACES: Workspace[] = [
  {
    id: 'ws_sessions',
    name: 'Sessions',
    icon: '◎',
    color: 'oklch(0.78 0.06 250)',
    createdAt: Date.now() - 40 * DAY,
    threads: [
      {
        id: 'thr_seed_today',
        title: 'Q2 pipeline check-in',
        createdAt: Date.now(),
        turns: [],
        artifacts: [],
        approvalStates: {},
        approvalPayloads: {},
        pinned: true,
      },
      {
        id: 'thr_seed_week',
        title: 'Cold lead re-engagement',
        createdAt: Date.now() - 3 * DAY,
        turns: [],
        artifacts: [],
        approvalStates: {},
        approvalPayloads: {},
      },
      {
        id: 'thr_seed_month',
        title: 'Forecast assumptions review',
        createdAt: Date.now() - 12 * DAY,
        turns: [],
        artifacts: [],
        approvalStates: {},
        approvalPayloads: {},
      },
      {
        id: 'thr_seed_older',
        title: 'Data hygiene sweep',
        createdAt: Date.now() - 45 * DAY,
        turns: [],
        artifacts: [],
        approvalStates: {},
        approvalPayloads: {},
      },
    ],
    files: [],
  },
];
