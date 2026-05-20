// Map-based dispatcher over the v2 SFDC tool registry.
import type { DatasetKey } from './data';
import {
  DEFINED_MODEL_TOOLS, DEFINED_INTERNAL_TOOLS,
  READ_TOOLS_V2 as _READ, FORM_TOOLS_V2 as _FORM, WRITE_TOOLS_V2 as _WRITE,
  getDefinedTool, validateToolInput,
} from './tools/index';
import {
  handleSfDataQuery, handleSfDataSearch, handleSfDataGetRecord,
  handleSfDataCreate, handleSfDataUpdate, handleSfDataStageChange, handleSfDataDelete,
  handleSubmitApprovedSfdcBatch,
} from './tools/sfdc/data';
import {
  handleSfSObjectDescribe, handleSfSObjectList,
} from './tools/sfdc/sobject';
import {
  handleSfAnalyticsListDashboards, handleSfAnalyticsGetDashboard,
  handleSfAnalyticsListReports, handleSfAnalyticsRunReport,
} from './tools/sfdc/analytics';
import {
  handleSfCaseList, handleSfCaseSlaBreach,
} from './tools/sfdc/case';
import {
  handleSfActivityList, handleSfActivityLog,
} from './tools/sfdc/activity';
import {
  handleSfApprovalQueue, handleSfApprovalDecide,
} from './tools/sfdc/approval';
import {
  handleRenderSoqlResults, handleRenderPipelineKanban, handleRenderAccount360,
  handleRenderLeadScoring, handleRenderForecast, handleRenderDashboardTiles,
  handleRenderCaseSla, handleRenderActivityTimeline, handleRenderBulkUpdatePreview,
  handleRenderActionDraft, handleRenderComparison,
} from './tools/sfdc/render';
import { handleFlagRecords } from './tools/sfdc/memory';
import { handlePlan } from './tools/sfdc/session';

export type ToolDef = {
  name: string;
  label: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
};

export type ToolContext = {
  mode?: 'demo' | 'testing';
  today?: string;
  /** Legacy fields kept so existing harness code compiles; ignored by SFDC tools. */
  billEnvId?: string;
  billProduct?: 'ap' | 'se';
  demoDataset?: DatasetKey;
};

export const DEMO_SANDBOX_ENV_ID = '__demo_sandbox__';

export const MODEL_TOOLS: ToolDef[] = DEFINED_MODEL_TOOLS;
export const INTERNAL_TOOLS: ToolDef[] = DEFINED_INTERNAL_TOOLS;
export const TOOLS: ToolDef[] = [...MODEL_TOOLS, ...INTERNAL_TOOLS];

export const READ_TOOLS = _READ;
export const FORM_TOOLS = _FORM;
export const WRITE_TOOLS = _WRITE;

type RunResult = { ok: boolean; summary: string; data: unknown };

function ok(summary: string, data: unknown): RunResult {
  return { ok: true, summary, data };
}
function fail(summary: string, data: unknown = null): RunResult {
  return { ok: false, summary, data };
}

type Handler = (input: any) => Promise<RunResult>;

const HANDLERS = new Map<string, Handler>();

// sf_data
HANDLERS.set('sf_data_query', async (input) => {
  const r = await handleSfDataQuery(input);
  if ('error' in r) return fail(r.hint || r.error, r);
  return ok(`${r.totalSize} record${r.totalSize === 1 ? '' : 's'}`, r);
});
HANDLERS.set('sf_data_search', async (input) => {
  const r = await handleSfDataSearch(input);
  return ok(`${r.total} match${r.total === 1 ? '' : 'es'} for "${r.term}"`, r);
});
HANDLERS.set('sf_data_get_record', async (input) => {
  const r = await handleSfDataGetRecord(input);
  return r ? ok((r as any).Name ?? (r as any).Subject ?? input.id, r) : fail(`${input.sobject} ${input.id} not found`);
});
HANDLERS.set('sf_data_create', async (input) => {
  const r = await handleSfDataCreate(input);
  return ok(r.summary, r);
});
HANDLERS.set('sf_data_update', async (input) => {
  const r = await handleSfDataUpdate(input);
  return ok(r.summary, r);
});
HANDLERS.set('sf_data_stage_change', async (input) => {
  const r = await handleSfDataStageChange(input);
  return ok(r.summary, r);
});
HANDLERS.set('sf_data_delete', async (input) => {
  const r = await handleSfDataDelete(input);
  return ok(r.summary, r);
});
HANDLERS.set('submit_approved_sfdc_batch', async (input) => {
  const r = await handleSubmitApprovedSfdcBatch(input);
  return r.ok ? ok(`Applied ${r.applied} changes`, r) : fail(r.reason, r);
});

// sf_sobject
HANDLERS.set('sf_sobject_describe', async (input) => {
  const r = await handleSfSObjectDescribe(input);
  if ('error' in (r as any)) return fail((r as any).hint, r);
  return ok(`${input.sobject}: ${(r as any).fields.length} fields`, r);
});
HANDLERS.set('sf_sobject_list', async () => {
  const r = await handleSfSObjectList();
  return ok(`${r.length} sObjects`, r);
});

// sf_analytics
HANDLERS.set('sf_analytics_list_dashboards', async () => {
  const r = await handleSfAnalyticsListDashboards();
  return ok(`${r.length} dashboards`, r);
});
HANDLERS.set('sf_analytics_get_dashboard', async (input) => {
  const r = await handleSfAnalyticsGetDashboard(input);
  if ('error' in (r as any)) return fail((r as any).hint, r);
  return ok((r as any).Name, r);
});
HANDLERS.set('sf_analytics_list_reports', async () => {
  const r = await handleSfAnalyticsListReports();
  return ok(`${r.length} reports`, r);
});
HANDLERS.set('sf_analytics_run_report', async (input) => {
  const r = await handleSfAnalyticsRunReport(input);
  if ('error' in (r as any)) return fail((r as any).hint, r);
  return ok((r as any).Name, r);
});

// sf_case
HANDLERS.set('sf_case_list', async (input) => {
  const r = await handleSfCaseList(input);
  return ok(`${r.length} case${r.length === 1 ? '' : 's'}`, r);
});
HANDLERS.set('sf_case_sla_breach', async () => {
  const r = await handleSfCaseSlaBreach();
  return ok(`${r.length} case${r.length === 1 ? '' : 's'} at/over SLA`, r);
});

// sf_activity
HANDLERS.set('sf_activity_list', async (input) => {
  const r = await handleSfActivityList(input);
  return ok(`${r.length} activit${r.length === 1 ? 'y' : 'ies'}`, r);
});
HANDLERS.set('sf_activity_log', async (input) => {
  const r = await handleSfActivityLog(input);
  return ok(r.summary, r);
});

// sf_approval
HANDLERS.set('sf_approval_queue', async () => {
  const r = await handleSfApprovalQueue();
  return ok(`${r.length} pending approval${r.length === 1 ? '' : 's'}`, r);
});
HANDLERS.set('sf_approval_decide', async (input) => {
  const r = await handleSfApprovalDecide(input);
  return ok(r.summary, r);
});

// SFDC render tools
HANDLERS.set('render_soql_results',      async (input) => ok('SOQL results rendered',     await handleRenderSoqlResults(input)));
HANDLERS.set('render_pipeline_kanban',   async (input) => ok('Pipeline kanban rendered',  await handleRenderPipelineKanban(input)));
HANDLERS.set('render_account_360',       async (input) => ok('Account 360 rendered',     await handleRenderAccount360(input)));
HANDLERS.set('render_lead_scoring',      async (input) => ok('Lead scoring rendered',    await handleRenderLeadScoring(input)));
HANDLERS.set('render_forecast',          async (input) => ok('Forecast rendered',        await handleRenderForecast(input)));
HANDLERS.set('render_dashboard_tiles',   async (input) => ok('Dashboard rendered',       await handleRenderDashboardTiles(input)));
HANDLERS.set('render_case_sla',          async (input) => ok('Case SLA rendered',        await handleRenderCaseSla(input)));
HANDLERS.set('render_activity_timeline', async (input) => ok('Timeline rendered',         await handleRenderActivityTimeline(input)));
HANDLERS.set('render_bulk_update_preview', async (input) => ok('Preview rendered',       await handleRenderBulkUpdatePreview(input)));
HANDLERS.set('render_action_draft',        async (input) => ok('Drafts rendered',        await handleRenderActionDraft(input)));
HANDLERS.set('render_comparison',          async (input) => ok('Comparison rendered',    await handleRenderComparison(input)));

// Generic render tools (handled by the runtime as artifact events; we just echo).
const echoRender = (kind: string): Handler => async (input) => ok(`${kind} rendered`, { kind, ...input });
HANDLERS.set('render_artifact',             echoRender('artifact'));
HANDLERS.set('render_html_artifact',        echoRender('custom-dashboard'));
HANDLERS.set('render_spreadsheet_artifact', echoRender('spreadsheet'));
HANDLERS.set('render_document_artifact',    echoRender('document'));
HANDLERS.set('render_slides_artifact',      echoRender('slides'));
HANDLERS.set('render_automation_artifact',  echoRender('automation'));

// Chat-loop affordances
HANDLERS.set('ask_question',    async (input) => ok('acknowledged', { name: 'ask_question', ...input }));
HANDLERS.set('offer_artifacts', async (input) => ok('acknowledged', { name: 'offer_artifacts', ...input }));

// Flagged-record memory (persisted client-side from the tool-result input).
HANDLERS.set('flag_records', async (input) => {
  const r = await handleFlagRecords(input);
  return ok(`Flagged ${r.flagged} record${r.flagged === 1 ? '' : 's'}`, r);
});

// Structured session plan (rendered as a checkpoint turn from the tool input).
HANDLERS.set('plan', async (input) => {
  const r = await handlePlan(input);
  return ok(`Planned ${r.steps} step${r.steps === 1 ? '' : 's'}`, r);
});

async function dispatch(name: string, input: any): Promise<RunResult> {
  const h = HANDLERS.get(name);
  if (!h) return { ok: false, summary: `unknown tool: ${name}`, data: { name } };
  return h(input);
}

export async function runTool(
  name: string,
  input: any,
  _ctx?: ToolContext,
  _opts?: { allowInternal?: boolean },
): Promise<RunResult> {
  const def = getDefinedTool(name);
  if (def) {
    const v = validateToolInput(def, input);
    if (!v.ok) return { ok: false, summary: v.summary, data: { issues: v.issues } };
    input = v.input;
  }
  return dispatch(name, input);
}

export const runMockTool = runTool;
export const runRealTool = runTool;

export const SYSTEM_PROMPT = `You are RevOps Agent, a CRM-savvy AI assistant running revenue operations for Beacon Plumbing Co., a mid-sized plumbing services company in the Seattle metro. Today's date is 2026-05-16. You drive a mocked Salesforce org via tool calls that mirror the real \`sf\` CLI / REST API.

Domain primer:
- The funnel: leads (Status: New → Contacted → Qualified → Unqualified/Converted) become Opportunities (jobs) with StageName: Qualified → Quoted → Scheduled → Job Complete → Invoiced → Closed Won/Closed Lost.
- Opportunity custom fields: \`Service_Type__c\` (Residential Repair, Residential Install, Commercial Service, Commercial Install, Emergency), \`Urgency__c\` (Routine, Urgent, Emergency), \`Property_Type__c\` (Residential, Commercial).
- The team: 3 inside-sales reps (Role 'InsideSales', carry quota), 8 field plumbers (Role 'Plumber', with a Specialty), 1 operations manager (Role 'OpsManager'). Lead sources: Google Ads, Website, Referral, Repeat Customer, Yelp, Unknown.
- Lead flow is the load-bearing input; anything that protects, accelerates, or revives leads and stuck quotes has high stakes.

Tool groups (each group's tools share a common prefix):

- **sf_data** — record CRUD + SOQL. Prefer \`sf_data_query\` (SOQL) for any read. Use \`sf_data_get_record\` for single-record fetches, \`sf_data_search\` for keyword lookups across sObjects. Writes (\`sf_data_create\`, \`sf_data_update\`, \`sf_data_stage_change\`, \`sf_data_delete\`) STAGE a batch; they do not apply. The response includes \`batchId\` and \`stake\`.
- **sf_sobject** — schema introspection. \`sf_sobject_list\` shows sObjects + row counts; \`sf_sobject_describe\` returns fields + relationships. Use when the user asks "what fields…" or you need to validate a field name before SOQL.
- **sf_analytics** — reports and dashboards. \`sf_analytics_list_reports\` / \`sf_analytics_run_report\` (reportId="ForecastQ2" for the weighted Q2 forecast), and \`sf_analytics_list_dashboards\` / \`sf_analytics_get_dashboard\`.
- **sf_case** — \`sf_case_list\` (filter by status/priority/account) and \`sf_case_sla_breach\` (cases past or near SLA).
- **sf_activity** — \`sf_activity_list\` (timeline for an Opp/Account/Case) and \`sf_activity_log\` (stage a new Call/Email/Meeting/Note).
- **sf_approval** — \`sf_approval_queue\` (pending discount approvals) and \`sf_approval_decide\` (stage approve/reject).
- **Render** — open an artifact card for the user: \`render_soql_results\`, \`render_pipeline_kanban\`, \`render_account_360\`, \`render_lead_scoring\`, \`render_forecast\`, \`render_dashboard_tiles\`, \`render_case_sla\`, \`render_activity_timeline\`, \`render_bulk_update_preview\`, \`render_action_draft\` (editable email/SMS/call/note drafts — use for lead re-engagement and stuck-deal follow-ups; write the full body, the user edits then approves), \`render_comparison\` (side-by-side options the user picks from). Generic artifacts (\`render_spreadsheet_artifact\`, \`render_document_artifact\`, \`render_slides_artifact\`, \`render_html_artifact\`) are available for ad-hoc visualizations.
- **Chat affordances** — \`ask_question\` for clarification, \`offer_artifacts\` for suggesting renders.
- **Memory** — \`flag_records\` records the records you've flagged (risk/opportunity/stale/duplicate/hygiene) so they persist across sessions. Call it once per finding-set. If FLAGGED-RECORD MEMORY appears below, do NOT re-surface records the user dismissed/ignored unless their state has clearly changed.

Workflow (SOQL-first read, then propose→render→approve for writes):
0. **Plan first.** For any multi-step task, call \`plan\` once with an ordered list of steps before you start executing, so the user can see your intended path.
1. **Read first.** Open with \`sf_data_query\` or a named convenience read (\`sf_case_sla_breach\`, \`sf_analytics_run_report\`, etc.). Summarize what you found in 1–3 sentences citing counts, names, and amounts.
2. **Render** the appropriate artifact for the result so the user can see it.
3. **Propose** changes by calling a stage tool (\`sf_data_update\`, \`sf_data_stage_change\`, \`sf_data_delete\`, \`sf_activity_log\`, \`sf_approval_decide\`). Each returns \`batchId\`, \`stake\`, \`recordCount\`.
4. Call \`render_bulk_update_preview\` with the \`batchId\` so the user can review.
5. Wait for the human to click Approve. \`submit_approved_sfdc_batch\` is internal — the harness invokes it once a token is minted.

Approval stakes (set by the policy classifier — do not invent):
- \`read-only\` — no changes proposed.
- \`single-record-edit\` — 1 record, reversible.
- \`bulk-update\` — 2–25 records, reversible, single approver.
- \`mass-action\` — >25 records, irreversible (Closed Won/Lost, deletes), or externally visible (Closed Lost). Requires dual control. Examples that ALWAYS trip mass-action: \`sf_data_delete\` (always), \`sf_data_stage_change\` to Closed Lost (externally visible), batches over 25 rows.

SOQL guidance:
- Supported: \`SELECT … FROM Opportunity|Account|Lead|Contact|User|Case|Activity [WHERE …] [ORDER BY …] [LIMIT n]\`.
- WHERE supports AND/OR, =, !=, <, <=, >, >=, LIKE, IN, NOT IN, plus date literals (TODAY, YESTERDAY, LAST_N_DAYS:N, THIS_QUARTER, NEXT_QUARTER, LAST_QUARTER).
- If the parser returns \`UNSUPPORTED_SOQL\`, simplify the query or use a named convenience tool instead.

Be concise. Cite specific record names, Ids, and amounts. Never invent Ids.`;

export const TESTING_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

TESTING MODE: when the user supplies an artifact kind hint, prefer that kind for rendering.`;

// Re-export the registry helper for callers that imported it from here.
export { getDefinedTool };
