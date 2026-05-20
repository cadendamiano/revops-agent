import type { IconKey } from '@/components/primitives/Icon';
import type { ToolRowSpec } from '@/lib/flows';

export type ToolStepState = 'running' | 'ok' | 'err';

export type ToolStep = {
  icon: IconKey;
  label: string;
  result?: string;
  state: ToolStepState;
};

type Presentation = { icon: IconKey; label: string };

const TOOL_PRESENTATION: Record<string, Presentation> = {
  // Data — reads
  sf_data_query: { icon: 'Search', label: 'Queried records' },
  sf_data_search: { icon: 'Search', label: 'Searched records' },
  sf_data_get_record: { icon: 'Record', label: 'Looked up a record' },
  // Data — writes (staged)
  sf_data_create: { icon: 'Edit', label: 'Drafted a new record' },
  sf_data_update: { icon: 'Edit', label: 'Prepared an update' },
  sf_data_stage_change: { icon: 'Edit', label: 'Updated opportunity stage' },
  sf_data_delete: { icon: 'Trash', label: 'Prepared a deletion' },
  submit_approved_sfdc_batch: { icon: 'Shield', label: 'Applied approved changes' },
  // Schema
  sf_sobject_describe: { icon: 'Columns', label: 'Inspected the data model' },
  sf_sobject_list: { icon: 'Columns', label: 'Inspected the data model' },
  // Analytics
  sf_analytics_run_report: { icon: 'Chart', label: 'Ran a report' },
  sf_analytics_get_dashboard: { icon: 'Chart', label: 'Opened a dashboard' },
  sf_analytics_list_dashboards: { icon: 'Chart', label: 'Browsed dashboards' },
  sf_analytics_list_reports: { icon: 'Chart', label: 'Browsed reports' },
  // Cases
  sf_case_list: { icon: 'Ticket', label: 'Reviewed cases' },
  sf_case_sla_breach: { icon: 'Ticket', label: 'Checked SLA breaches' },
  // Activity
  sf_activity_list: { icon: 'Clock', label: 'Reviewed activity' },
  sf_activity_log: { icon: 'Clock', label: 'Logged an activity' },
  // Approvals
  sf_approval_queue: { icon: 'Shield', label: 'Checked approvals' },
  sf_approval_decide: { icon: 'Shield', label: 'Decided on approvals' },
  // SFDC render tools
  render_soql_results: { icon: 'Table', label: 'Opened the results table' },
  render_pipeline_kanban: { icon: 'Layout', label: 'Built the pipeline board' },
  render_account_360: { icon: 'Layout', label: 'Opened the account overview' },
  render_lead_scoring: { icon: 'Table', label: 'Scored the leads' },
  render_forecast: { icon: 'Chart', label: 'Opened the forecast' },
  render_dashboard_tiles: { icon: 'Chart', label: 'Built the dashboard' },
  render_case_sla: { icon: 'Layout', label: 'Mapped SLA risk' },
  render_activity_timeline: { icon: 'Clock', label: 'Built the activity timeline' },
  render_bulk_update_preview: { icon: 'Table', label: 'Previewed the bulk update' },
  render_action_draft: { icon: 'Edit', label: 'Drafted follow-up actions' },
  render_comparison: { icon: 'Columns', label: 'Built a comparison' },
  // Generic render
  render_artifact: { icon: 'Layout', label: 'Opened an artifact' },
  render_html_artifact: { icon: 'Layout', label: 'Built a custom view' },
  render_spreadsheet_artifact: { icon: 'Table', label: 'Opened a spreadsheet' },
  render_document_artifact: { icon: 'Doc', label: 'Drafted a document' },
  render_automation_artifact: { icon: 'Flow', label: 'Built an automation' },
  render_slides_artifact: { icon: 'Slides', label: 'Built a slide deck' },
  // Chat affordances + session
  ask_question: { icon: 'Question', label: 'Asked a clarifying question' },
  offer_artifacts: { icon: 'Layout', label: 'Offered artifact options' },
  flag_records: { icon: 'Flag', label: 'Flagged records' },
  plan: { icon: 'List', label: 'Planned the work' },
};

const VERB_FALLBACK: Record<ToolRowSpec['verb'], Presentation> = {
  GET: { icon: 'Search', label: 'Fetched data' },
  POST: { icon: 'Edit', label: 'Created records' },
  PATCH: { icon: 'Edit', label: 'Updated records' },
  DELETE: { icon: 'Trash', label: 'Deleted records' },
  EXEC: { icon: 'Code', label: 'Ran a tool' },
};

function resolveState(status?: string): ToolStepState {
  if (!status || status === '…' || status === 'running') return 'running';
  if (status === 'err' || status === 'error') return 'err';
  return 'ok';
}

export function describeToolRow(row: ToolRowSpec): ToolStep {
  // Priority: explicit tool name (live) → EXEC path as raw name (demo) → verb fallback (REST demo rows).
  const key = row.tool ?? (row.verb === 'EXEC' ? row.path : undefined);
  const base = (key && TOOL_PRESENTATION[key]) || VERB_FALLBACK[row.verb];
  const state = resolveState(row.status);
  const result = state === 'running' ? undefined : row.result;
  return { icon: base.icon, label: base.label, result, state };
}
