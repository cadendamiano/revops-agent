// Salesforce demo flows. Scripted deterministic sequences for the demo mode.
import type { DatasetKey } from './data';

export type ArtifactKind =
  | 'spreadsheet'
  | 'document'
  | 'slides'
  | 'custom-dashboard'
  | 'opp-health'
  | 'pipeline-forecast'
  | 'bulk-update-preview';

export type ToolRowSpec = {
  verb: 'GET' | 'POST' | 'EXEC';
  path: string;
  filter?: string;
  status?: string;
  result?: string;
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

// ─── at_risk_opps ────────────────────────────────────────────────────
const AT_RISK_FLOW: Flow = {
  id: 'at_risk_opps',
  title: 'At-risk opportunity scorecard',
  artifact: {
    id: 'art_oh_atrisk',
    kind: 'opp-health',
    label: 'At-risk opportunities · 10',
  },
  steps: [
    { kind: 'user', text: 'Show me at-risk opportunities' },
    { kind: 'agent-stream', delay: 200,
      text: 'Scanning Atlas Tech pipeline. Filtering on past CloseDate, stale activity, missing NextStep, and Negotiation-stage opps with 60+ days of silence.' },
    { kind: 'tools', delay: 220, rows: [
      { verb: 'GET', path: '/services/data/v60.0/queryAll', filter: "SELECT Id,Name,StageName,Amount,LastActivityDate,NextStep FROM Opportunity WHERE IsClosed=false", status: '200', result: '38 rows' },
      { verb: 'EXEC', path: 'find_at_risk_opps', filter: 'limit=10', status: 'ok', result: '10 opps with 2+ risks' },
    ] },
    { kind: 'libs', delay: 180, items: [
      { pkg: '@salesforce/sf-api', ver: '4.12.0' },
      { pkg: '@tanstack/table-core', ver: '8.21.3' },
      { pkg: 'date-fns', ver: '3.6.0' },
    ] },
    { kind: 'building', delay: 220, label: 'Opportunity Health Scorecard', sub: 'aggregating risk signals' },
    { kind: 'artifact-card', delay: 350,
      artifactId: 'art_oh_atrisk',
      title: 'At-risk opportunity scorecard',
      sub: 'OPP-HEALTH · 10 ROWS',
      meta: '**$2.27M** total at-risk pipeline · top: Mosaic Insurance - Claims Automation ($295k)',
      icon: '⚠' },
    { kind: 'agent-stream', delay: 200,
      text: 'Top patterns: 28 Negotiation deals with no activity in 60+ days (~$4.9M) and 14 of them are also missing NextStep. The 10 worst offenders are in the scorecard. Want me to draft a hygiene update or queue a Close-Lost batch for the silent Negotiation pool?' },
    { kind: 'suggest', delay: 150, items: [
      'Update the stale opps missing NextStep',
      'Close-Lost the silent Negotiation opps',
      "What's our Q2 forecast?",
    ] },
  ],
};

// ─── hygiene_bulk_update — stake bulk-update, 14 records, reversible ──
const HYGIENE_PREVIEW: ApprovalPreviewRow[] = [
  { id: '006N0001', name: 'Northwind Robotics - Platform Renewal',     currentValue: '', newValue: 'Confirm renewal terms with procurement' },
  { id: '006N0002', name: 'Pacific Health Systems - EHR Expansion',    currentValue: '', newValue: 'Confirm renewal terms with procurement' },
  { id: '006N0003', name: 'Crestline Capital - Risk Module',           currentValue: '', newValue: 'Confirm renewal terms with procurement' },
  { id: '006N0004', name: 'Lumen Software - Enterprise License',       currentValue: '', newValue: 'Confirm renewal terms with procurement' },
  { id: '006N0005', name: 'Cobalt Retail Group - POS Refresh',         currentValue: '', newValue: 'Confirm renewal terms with procurement' },
];

const HYGIENE_FLOW: Flow = {
  id: 'hygiene_bulk_update',
  title: 'Bulk update — NextStep on stale opps',
  artifact: {
    id: 'art_bup_hygiene',
    kind: 'bulk-update-preview',
    label: 'Hygiene · 14 opps',
    dataJson: JSON.stringify({ batchId: 'btch_sfdc_hygiene_demo' }),
  },
  steps: [
    { kind: 'user', text: 'Update the stale opps missing NextStep' },
    { kind: 'agent-stream', delay: 200,
      text: 'Pulling Negotiation-stage opportunities with no NextStep and last activity 60+ days ago. Found **14** matching opps across 4 AEs, totaling **$2.85M** in unweighted pipeline.' },
    { kind: 'tools', delay: 220, rows: [
      { verb: 'EXEC', path: 'find_opps_missing_field', filter: 'field=NextStep', status: 'ok', result: '14 rows' },
      { verb: 'EXEC', path: 'propose_opp_field_update', filter: 'NextStep="Confirm renewal terms with procurement"', status: 'ok', result: 'batchId=btch_sfdc_hygiene_demo · stake=bulk-update' },
    ] },
    { kind: 'libs', delay: 160, items: [
      { pkg: '@salesforce/sf-api', ver: '4.12.0' },
      { pkg: '@tanstack/table-core', ver: '8.21.3' },
    ] },
    { kind: 'building', delay: 200, label: 'Bulk Update Preview', sub: 'rendering 14 staged changes' },
    { kind: 'artifact-card', delay: 320,
      artifactId: 'art_bup_hygiene',
      title: 'NextStep hygiene · 14 opps',
      sub: 'BULK-UPDATE · STAKE=BULK-UPDATE',
      meta: '**14 records** · reversible · single approver',
      icon: '✎' },
    { kind: 'approval', delay: 220, payload: {
      batchId: 'btch_sfdc_hygiene_demo',
      stake: 'bulk-update',
      title: 'Set NextStep on 14 stale opportunities',
      summary: 'Apply NextStep="Confirm renewal terms with procurement" to 14 Negotiation opps with no recent activity. Reversible. Single approver required.',
      recordCount: 14,
      preview: HYGIENE_PREVIEW,
    } },
    { kind: 'agent-stream', delay: 200,
      text: 'Staged as `btch_sfdc_hygiene_demo`. Approve below to apply across all 14 records; reject to abandon the batch.' },
  ],
};

// ─── mass_stage_correction — stake mass-action, 28 records, dual ─────
const MASS_PREVIEW: ApprovalPreviewRow[] = [
  { id: '006N0001', name: 'Northwind Robotics - Platform Renewal',     currentValue: 'Negotiation', newValue: 'Closed Lost' },
  { id: '006N0002', name: 'Pacific Health Systems - EHR Expansion',    currentValue: 'Negotiation', newValue: 'Closed Lost' },
  { id: '006N0003', name: 'Crestline Capital - Risk Module',           currentValue: 'Negotiation', newValue: 'Closed Lost' },
  { id: '006N0005', name: 'Cobalt Retail Group - POS Refresh',         currentValue: 'Negotiation', newValue: 'Closed Lost' },
  { id: '006N0012', name: 'Granite Industrials - Field Service',       currentValue: 'Negotiation', newValue: 'Closed Lost' },
];

const MASS_FLOW: Flow = {
  id: 'mass_stage_correction',
  title: 'Close-Lost silent Negotiation opps',
  artifact: {
    id: 'art_bup_mass',
    kind: 'bulk-update-preview',
    label: 'Close-Lost · 28 opps',
    dataJson: JSON.stringify({ batchId: 'btch_sfdc_mass_demo' }),
  },
  steps: [
    { kind: 'user', text: 'Close-Lost the silent Negotiation opps' },
    { kind: 'agent-stream', delay: 200,
      text: 'Pulling Negotiation-stage opps with **60+ days** of zero activity. Found **28 deals** ($4.93M unweighted) across all 4 AEs. Closing these as Lost is **externally visible** (customer-facing) and irreversible — that escalates the stake to **mass-action**, which needs dual control.' },
    { kind: 'tools', delay: 240, rows: [
      { verb: 'EXEC', path: 'find_stale_opps', filter: 'minDaysSinceActivity=60&stage=Negotiation', status: 'ok', result: '28 rows' },
      { verb: 'EXEC', path: 'propose_stage_change', filter: 'newStage=Closed Lost', status: 'ok', result: 'batchId=btch_sfdc_mass_demo · stake=mass-action' },
    ] },
    { kind: 'libs', delay: 160, items: [
      { pkg: '@salesforce/sf-api', ver: '4.12.0' },
      { pkg: '@tanstack/table-core', ver: '8.21.3' },
    ] },
    { kind: 'building', delay: 220, label: 'Close-Lost Batch Preview', sub: 'rendering 28 staged stage changes' },
    { kind: 'artifact-card', delay: 320,
      artifactId: 'art_bup_mass',
      title: 'Close-Lost · 28 silent Negotiation opps',
      sub: 'MASS-ACTION · DUAL CONTROL',
      meta: '**28 records** · $4.93M unweighted · irreversible · second approver required',
      icon: '⚠' },
    { kind: 'approval', delay: 240, payload: {
      batchId: 'btch_sfdc_mass_demo',
      stake: 'mass-action',
      title: 'Move 28 opportunities to Closed Lost',
      summary: 'Set StageName=Closed Lost on 28 Negotiation opps with 60+ days inactivity. Externally visible to customers in the org\'s shared dashboards. Requires dual approval (you + Manager).',
      recordCount: 28,
      preview: MASS_PREVIEW,
      requiresSecondApprover: true,
    } },
    { kind: 'agent-stream', delay: 200,
      text: 'Staged as `btch_sfdc_mass_demo`. Renée Okafor (Manager) is the second approver. Click Approve to send the request; once Renée signs off the move applies to all 28 records.' },
  ],
};

// ─── pipeline_forecast — read-only ────────────────────────────────────
const FORECAST_FLOW: Flow = {
  id: 'pipeline_forecast',
  title: 'Q2 pipeline forecast',
  artifact: {
    id: 'art_pf_q2',
    kind: 'pipeline-forecast',
    label: 'Q2 forecast · weighted',
  },
  steps: [
    { kind: 'user', text: "What's our Q2 forecast?" },
    { kind: 'agent-stream', delay: 200,
      text: 'Pulling CloseDate ∈ [2026-04-01, 2026-06-30] and rolling up weighted by stage probability. Quota total across 4 AEs is **$3.1M**.' },
    { kind: 'tools', delay: 220, rows: [
      { verb: 'GET', path: '/services/data/v60.0/queryAll', filter: 'SELECT Id,OwnerId,StageName,Amount,Probability,CloseDate FROM Opportunity', status: '200', result: '45 rows' },
      { verb: 'EXEC', path: 'get_pipeline_forecast', filter: 'quarter=Q2', status: 'ok', result: 'totalWeighted ≈ $2.41M · attainment 77.9%' },
    ] },
    { kind: 'libs', delay: 160, items: [
      { pkg: '@salesforce/sf-api', ver: '4.12.0' },
      { pkg: '@tanstack/table-core', ver: '8.21.3' },
      { pkg: 'recharts', ver: '2.13.3' },
    ] },
    { kind: 'building', delay: 200, label: 'Pipeline Forecast', sub: 'weighting by stage probability' },
    { kind: 'artifact-card', delay: 320,
      artifactId: 'art_pf_q2',
      title: 'Q2 pipeline forecast',
      sub: 'PIPELINE-FORECAST · WEIGHTED',
      meta: '**$2.41M weighted** · 77.9% of $3.1M quota · Negotiation drives 60% of weighted total',
      icon: '$' },
    { kind: 'agent-stream', delay: 200,
      text: 'Priya is the only AE pacing above 100%. Marcus and Devon are sub-80%. The 28 stale Negotiation deals make up most of Marcus and Hana\'s gap — closing or cleaning them would unblock a real forecast read.' },
    { kind: 'suggest', delay: 150, items: [
      'Show me at-risk opportunities',
      'Close-Lost the silent Negotiation opps',
      'Update the stale opps missing NextStep',
    ] },
  ],
};

export const FLOWS: Record<string, Flow> = {
  at_risk_opps: AT_RISK_FLOW,
  hygiene_bulk_update: HYGIENE_FLOW,
  mass_stage_correction: MASS_FLOW,
  pipeline_forecast: FORECAST_FLOW,
};

export const LOGISTICS_FLOWS: Record<string, Flow> = {};

export type FlowId = string;

export function matchFlow(text: string, _dataset: DatasetKey = 'default'): string | null {
  const t = text.toLowerCase();
  // Order matters: more specific (mass / hygiene) before less specific.
  if (
    t.includes('close lost') ||
    t.includes('close-lost') ||
    t.includes('stalled negotiation') ||
    (t.includes('negotiation') && t.includes('60'))
  ) {
    return 'mass_stage_correction';
  }
  if (t.includes('next step') || t.includes('nextstep') || t.includes('missing') || t.includes('hygiene') || t.includes('stale opps')) {
    return 'hygiene_bulk_update';
  }
  if (t.includes('forecast') || t.includes('q2') || t.includes('rollup') || t.includes('attainment') || t.includes('quota')) {
    return 'pipeline_forecast';
  }
  if (t.includes('at risk') || t.includes('at-risk') || t.includes('risk') || t.includes('scorecard') || t.includes('stalled')) {
    return 'at_risk_opps';
  }
  return null;
}
