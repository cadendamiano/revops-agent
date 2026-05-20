// Salesforce demo flows. Scripted deterministic sequences for the demo mode.
import type { DatasetKey } from './data';

export type ArtifactKind =
  | 'spreadsheet'
  | 'document'
  | 'slides'
  | 'custom-dashboard'
  // SFDC-specific artifact kinds
  | 'soql-results'
  | 'pipeline-kanban'
  | 'account-360'
  | 'lead-scoring'
  | 'forecast'
  | 'dashboard-tiles'
  | 'case-sla'
  | 'activity-timeline'
  | 'bulk-update-preview'
  | 'action-draft'
  | 'comparison';

export type ToolRowSpec = {
  verb: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'EXEC';
  path: string;
  filter?: string;
  status?: string;
  result?: string;
  /** Raw tool name (e.g. sf_data_query) for presentation mapping; set for live calls. */
  tool?: string;
};

export type ApprovalStake =
  | 'read-only' | 'single-record-edit' | 'bulk-update' | 'mass-action';

export type ApprovalPreviewRow = {
  id: string;
  name: string;
  currentValue: string;
  newValue: string;
};

export type FlowStep =
  | { kind: 'user';          delay?: number; text: string }
  | { kind: 'agent-stream';  delay?: number; text: string }
  | { kind: 'tools';         delay?: number; rows: ToolRowSpec[] }
  | { kind: 'libs';          delay?: number; items: { pkg: string; ver: string }[] }
  | { kind: 'building';      delay?: number; label: string; sub: string }
  | {
      kind: 'artifact-card';
      delay?: number;
      artifactId: string;
      title: string;
      sub: string;
      meta: string;
      icon?: string;
    }
  | {
      kind: 'approval';
      delay?: number;
      payload: {
        batchId: string;
        stake: ApprovalStake;
        title: string;
        summary: string;
        recordCount: number;
        preview: ApprovalPreviewRow[];
        requiresSecondApprover?: boolean;
      };
    }
  | { kind: 'suggest'; delay?: number; items: string[] }
  | {
      kind: 'artifact-enrich';
      delay?: number;
      artifactId: string;
      patch: { filter?: string; label?: string };
    };

export type Flow = {
  id: string;
  title: string;
  steps: FlowStep[];
  artifact?: { id: string; kind: ArtifactKind; label: string; filter?: string; dataJson?: string };
};

// ─── soql_explore ────────────────────────────────────────────────────
const SOQL_DEMO = "SELECT Id, Name, StageName, Amount, OwnerId FROM Opportunity WHERE StageName != 'Closed Won' AND StageName != 'Closed Lost' AND CloseDate = THIS_QUARTER ORDER BY Amount DESC LIMIT 25";

const SOQL_EXPLORE_FLOW: Flow = {
  id: 'soql_explore',
  title: 'SOQL: top open Q2 opps',
  artifact: {
    id: 'art_soql_q2_top',
    kind: 'soql-results',
    label: 'SOQL · Q2 open opps · 25',
    dataJson: JSON.stringify({ soql: SOQL_DEMO }),
  },
  steps: [
    { kind: 'user', text: 'Run a SOQL for the top open opps closing this quarter' },
    { kind: 'agent-stream', delay: 200,
      text: `Running:\n\n\`\`\`soql\n${SOQL_DEMO}\n\`\`\`` },
    { kind: 'tools', delay: 220, rows: [
      { verb: 'GET', path: '/services/data/v60.0/query', filter: SOQL_DEMO, status: '200', result: '25 rows' },
      { verb: 'EXEC', path: 'sf_data_query', filter: 'limit=25', status: 'ok', result: '25 records · 5 fields' },
    ] },
    { kind: 'libs', delay: 160, items: [
      { pkg: '@salesforce/sf-api', ver: '4.12.0' },
      { pkg: '@tanstack/table-core', ver: '8.21.3' },
    ] },
    { kind: 'building', delay: 200, label: 'SOQL Results', sub: 'projecting 5 fields × 25 rows' },
    { kind: 'artifact-card', delay: 320,
      artifactId: 'art_soql_q2_top',
      title: 'Open Q2 jobs — top 25 by Amount',
      sub: 'SOQL-RESULTS · 25 ROWS',
      meta: '**top: Cascade Property Group - Boiler Replacement ($46k)**',
      icon: '◫' },
    { kind: 'suggest', delay: 150, items: [
      'Show my pipeline as a kanban',
      "What's our Q2 forecast?",
      'Tell me about Cascade Property Group',
    ] },
  ],
};

// ─── pipeline_kanban ─────────────────────────────────────────────────
const KANBAN_FLOW: Flow = {
  id: 'pipeline_kanban',
  title: 'Pipeline kanban (open opps)',
  artifact: {
    id: 'art_pipe_kanban',
    kind: 'pipeline-kanban',
    label: 'Pipeline · kanban',
  },
  steps: [
    { kind: 'user', text: 'Show my pipeline as a kanban' },
    { kind: 'agent-stream', delay: 200,
      text: 'Pulling all open jobs (Qualified → Invoiced) and bucketing by StageName.' },
    { kind: 'tools', delay: 220, rows: [
      { verb: 'GET', path: '/services/data/v60.0/query', filter: "SELECT Id, Name, Amount, StageName, OwnerId FROM Opportunity WHERE StageName NOT IN ('Closed Won', 'Closed Lost')", status: '200', result: 'rows' },
      { verb: 'EXEC', path: 'render_pipeline_kanban', filter: '5 stages', status: 'ok', result: 'rendered' },
    ] },
    { kind: 'libs', delay: 160, items: [
      { pkg: '@salesforce/sf-api', ver: '4.12.0' },
    ] },
    { kind: 'building', delay: 200, label: 'Pipeline Kanban', sub: 'rendering open jobs across 5 stages' },
    { kind: 'artifact-card', delay: 320,
      artifactId: 'art_pipe_kanban',
      title: 'Open pipeline · kanban view',
      sub: 'PIPELINE-KANBAN',
      meta: '**Quoted column carries the most stuck value** — watch the 60-day quotes',
      icon: '◫' },
    { kind: 'suggest', delay: 150, items: [
      'Which service tickets are breaching SLA?',
      'Qualify hot leads from the last 7 days',
      "What's our Q2 forecast?",
    ] },
  ],
};

// ─── account_360 ─────────────────────────────────────────────────────
const ACCOUNT_360_FLOW: Flow = {
  id: 'account_360',
  title: 'Account 360 — Cascade Property Group',
  artifact: {
    id: 'art_acct_pacific',
    kind: 'account-360',
    label: 'Account · Cascade Property Group',
    dataJson: JSON.stringify({ accountId: '001900900' }),
  },
  steps: [
    { kind: 'user', text: 'Tell me about Cascade Property Group' },
    { kind: 'agent-stream', delay: 200,
      text: 'Pulling the account record, open jobs, recent activity, and key contacts for Cascade Property Group.' },
    { kind: 'tools', delay: 240, rows: [
      { verb: 'GET', path: '/services/data/v60.0/sobjects/Account/001900900', status: '200', result: 'Cascade Property Group' },
      { verb: 'GET', path: '/services/data/v60.0/query', filter: "SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity WHERE AccountId = '001900900'", status: '200', result: '2 rows' },
      { verb: 'EXEC', path: 'sf_activity_list', filter: 'relatedTo=001900900', status: 'ok', result: '4 activities' },
      { verb: 'GET', path: '/services/data/v60.0/query', filter: "SELECT Id, Name, Title, Email FROM Contact WHERE AccountId = '001900900'", status: '200', result: '3 contacts' },
    ] },
    { kind: 'libs', delay: 160, items: [
      { pkg: '@salesforce/sf-api', ver: '4.12.0' },
      { pkg: 'recharts', ver: '2.13.3' },
    ] },
    { kind: 'building', delay: 220, label: 'Account 360', sub: 'assembling opps + activity + contacts' },
    { kind: 'artifact-card', delay: 350,
      artifactId: 'art_acct_pacific',
      title: 'Cascade Property Group — Account 360',
      sub: 'ACCOUNT-360 · PROPERTY MGMT',
      meta: '**$54k open pipeline** · 2 jobs · 3 contacts · recurring client',
      icon: '◎' },
    { kind: 'agent-stream', delay: 200,
      text: 'Diane Whitlock (Facilities Director) is the buyer on the Boiler Replacement quote ($46k), awaiting board approval. The Q2 maintenance job is scheduled with a crew dispatched. Recommend a check-in call before the board meets.' },
    { kind: 'suggest', delay: 150, items: [
      'Log a call with Diane Whitlock',
      'Which service tickets are breaching SLA?',
      'Draft a follow-up on the boiler quote',
    ] },
  ],
};

// ─── lead_qualification ──────────────────────────────────────────────
const LEAD_PREVIEW: ApprovalPreviewRow[] = [
  { id: '00Q0000001', name: 'Gabriela Ferreira — Referral',       currentValue: 'New',     newValue: 'Qualified' },
  { id: '00Q0000011', name: 'Trevor Nash — Google Ads',           currentValue: 'New',     newValue: 'Qualified' },
  { id: '00Q0000014', name: 'Patricia Owens — Website',           currentValue: 'New',     newValue: 'Qualified' },
  { id: '00Q0000017', name: 'Daniel Garcia — Repeat Customer',    currentValue: 'New',     newValue: 'Qualified' },
  { id: '00Q0000020', name: 'Linda Brown — Referral',             currentValue: 'New',     newValue: 'Qualified' },
];

const LEAD_FLOW: Flow = {
  id: 'lead_qualification',
  title: 'Qualify hot leads from the last 7 days',
  artifact: {
    id: 'art_lead_qual',
    kind: 'bulk-update-preview',
    label: 'Qualify · 5 leads',
    dataJson: JSON.stringify({
      batchId: 'btch_sfdc_leadqual_demo',
      stake: 'bulk-update',
      recordCount: 5,
      summary: "Set Status='Qualified' on 5 hot leads",
      changes: LEAD_PREVIEW,
    }),
  },
  steps: [
    { kind: 'user', text: 'Qualify hot leads from the last 7 days' },
    { kind: 'agent-stream', delay: 200,
      text: 'Pulling Status=New leads created in the last 7 days, then scoring on source × service type × engagement.' },
    { kind: 'tools', delay: 240, rows: [
      { verb: 'GET', path: '/services/data/v60.0/query', filter: "SELECT Id, Name, Company, Status, LeadSource, CreatedDate FROM Lead WHERE CreatedDate = LAST_N_DAYS:7 AND Status = 'New'", status: '200', result: '6 rows' },
      { verb: 'EXEC', path: 'render_lead_scoring', filter: '6 leads scored', status: 'ok', result: 'top 5 ≥ 70' },
      { verb: 'PATCH', path: 'sf_data_update', filter: "Status='Qualified' on 5 leads", status: 'ok', result: 'batchId=btch_sfdc_leadqual_demo · stake=bulk-update' },
    ] },
    { kind: 'libs', delay: 160, items: [
      { pkg: '@salesforce/sf-api', ver: '4.12.0' },
    ] },
    { kind: 'building', delay: 220, label: 'Lead Qualification Preview', sub: 'staging 5 Status=Qualified updates' },
    { kind: 'artifact-card', delay: 350,
      artifactId: 'art_lead_qual',
      title: 'Qualify top 5 leads (score ≥ 70)',
      sub: 'BULK-UPDATE · STAKE=BULK-UPDATE',
      meta: '**5 records** · reversible · single approver',
      icon: '✎' },
    { kind: 'approval', delay: 240, payload: {
      batchId: 'btch_sfdc_leadqual_demo',
      stake: 'bulk-update',
      title: 'Qualify 5 high-score leads',
      summary: 'Set Status=Qualified on 5 Inbound leads created in the last 7d with score ≥ 70. Reversible. Single approver required.',
      recordCount: 5,
      preview: LEAD_PREVIEW,
    } },
    { kind: 'agent-stream', delay: 200,
      text: 'Staged as `btch_sfdc_leadqual_demo`. Approve to flip Status to Qualified across all 5; reject to abandon.' },
  ],
};

// ─── forecast_review ─────────────────────────────────────────────────
const FORECAST_FLOW: Flow = {
  id: 'forecast_review',
  title: 'Q2 forecast review',
  artifact: {
    id: 'art_fc_q2',
    kind: 'forecast',
    label: 'Q2 forecast',
    dataJson: JSON.stringify({ reportId: 'ForecastQ2' }),
  },
  steps: [
    { kind: 'user', text: "What's our Q2 forecast?" },
    { kind: 'agent-stream', delay: 200,
      text: 'Running the **ForecastQ2** report — weighted pipeline rollup for CloseDate ∈ [2026-04-01, 2026-06-30] across the 3 inside-sales reps.' },
    { kind: 'tools', delay: 220, rows: [
      { verb: 'EXEC', path: 'sf_analytics_run_report', filter: 'reportId=ForecastQ2', status: 'ok', result: 'weighted pipeline computed' },
    ] },
    { kind: 'libs', delay: 160, items: [
      { pkg: '@salesforce/sf-api', ver: '4.12.0' },
      { pkg: 'recharts', ver: '2.13.3' },
    ] },
    { kind: 'building', delay: 200, label: 'Forecast Tile', sub: 'commit / bestCase / pipeline / quota' },
    { kind: 'artifact-card', delay: 320,
      artifactId: 'art_fc_q2',
      title: 'Q2 pipeline forecast (weighted)',
      sub: 'FORECAST · WEIGHTED',
      meta: '**A few large commercial installs drive most of the weighted total** — drag the sliders to test scenarios',
      icon: '$' },
    { kind: 'agent-stream', delay: 200,
      text: 'The forecast leans on three big commercial-install quotes; if any one slips, the quarter takes a real hit. Adjust the stage-probability sliders in the artifact to see the impact.' },
    { kind: 'suggest', delay: 150, items: [
      'Show my pipeline as a kanban',
      'Why are these deals stuck?',
      'Which service tickets are breaching SLA?',
    ] },
  ],
};

// ─── case_sla_review ─────────────────────────────────────────────────
const CASE_SLA_FLOW: Flow = {
  id: 'case_sla_review',
  title: 'Cases breaching SLA',
  artifact: {
    id: 'art_case_sla',
    kind: 'case-sla',
    label: 'Cases · SLA review',
  },
  steps: [
    { kind: 'user', text: 'Which service tickets are breaching SLA?' },
    { kind: 'agent-stream', delay: 200,
      text: 'Pulling open service tickets past their SLA target or within 24h. Sorting by slaPct desc.' },
    { kind: 'tools', delay: 220, rows: [
      { verb: 'EXEC', path: 'sf_case_sla_breach', filter: '', status: 'ok', result: 'breaching tickets found' },
      { verb: 'EXEC', path: 'render_case_sla', filter: 'cases', status: 'ok', result: 'rendered' },
    ] },
    { kind: 'libs', delay: 160, items: [
      { pkg: '@salesforce/sf-api', ver: '4.12.0' },
    ] },
    { kind: 'building', delay: 200, label: 'Case SLA Heatmap', sub: 'sorting tickets by SLA %' },
    { kind: 'artifact-card', delay: 320,
      artifactId: 'art_case_sla',
      title: 'Open service tickets — SLA pressure',
      sub: 'CASE-SLA',
      meta: '**P1 breach: commercial water main leak (no response)**',
      icon: '⚠' },
    { kind: 'agent-stream', delay: 200,
      text: 'A P1 ticket (C-9001 · commercial water main leak) is past its SLA target with no response. Want me to escalate it to the operations manager?' },
    { kind: 'suggest', delay: 150, items: [
      'Escalate the P1 ticket to the ops manager',
      'Tell me about Cascade Property Group',
      'Draft a follow-up on the boiler quote',
    ] },
  ],
};

export const FLOWS: Record<string, Flow> = {
  soql_explore: SOQL_EXPLORE_FLOW,
  pipeline_kanban: KANBAN_FLOW,
  account_360: ACCOUNT_360_FLOW,
  lead_qualification: LEAD_FLOW,
  forecast_review: FORECAST_FLOW,
  case_sla_review: CASE_SLA_FLOW,
};

export const LOGISTICS_FLOWS: Record<string, Flow> = {};

export type FlowId = string;

export function matchFlow(text: string, _dataset: DatasetKey = 'default'): string | null {
  const t = text.toLowerCase();
  // Order: specific before generic.
  if (t.includes('account 360') || t.includes('cascade') || t.includes('account360')) {
    return 'account_360';
  }
  if (t.includes('sla') || t.includes('p1 case') || t.includes('breach') ||
      (t.includes('case') && (t.includes('which') || t.includes('open')))) {
    return 'case_sla_review';
  }
  if (t.includes('lead') && (t.includes('qualif') || t.includes('score') || t.includes('hot'))) {
    return 'lead_qualification';
  }
  if (t.includes('forecast') || t.includes('/forecast') || t.includes('attainment') || t.includes('q2 ') || t.endsWith('q2') || t.includes('quota')) {
    return 'forecast_review';
  }
  if (t.includes('kanban') || (t.includes('pipeline') && !t.includes('forecast'))) {
    return 'pipeline_kanban';
  }
  if (t.includes('soql') || t.includes('select ') || t.includes('query')) {
    return 'soql_explore';
  }
  return null;
}
