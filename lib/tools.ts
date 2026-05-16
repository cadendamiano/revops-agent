// Legacy dispatcher. Wraps the v2 SFDC tool registry behind a uniform runTool().
import type { DatasetKey } from './data';
import type { DefinedTool } from './tools/defineTool';
import {
  DEFINED_MODEL_TOOLS, DEFINED_INTERNAL_TOOLS,
  READ_TOOLS_V2 as _READ, FORM_TOOLS_V2 as _FORM, WRITE_TOOLS_V2 as _WRITE,
  getDefinedTool, validateToolInput,
} from './tools/index';
import {
  handleFindAtRiskOpps, handleFindStaleOpps, handleFindOppsMissingField,
  handleGetPipelineForecast, handleListOpps, handleGetOpp,
  handleListUsers, handleListAccounts, handleListLeads, handleGetAccount,
} from './tools/sfdc-read';
import {
  handleProposeOppFieldUpdate, handleProposeStageChange,
  handleSubmitApprovedSfdcBatch,
} from './tools/sfdc-write';
import {
  handleRenderOppHealthScorecard, handleRenderPipelineForecast,
  handleRenderBulkUpdatePreview,
} from './tools/sfdc-render';

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

async function dispatch(name: string, input: any): Promise<RunResult> {
  switch (name) {
    case 'find_at_risk_opps': {
      const rows = await handleFindAtRiskOpps(input);
      return ok(`${rows.length} at-risk opportunities`, rows);
    }
    case 'find_stale_opps': {
      const rows = await handleFindStaleOpps(input);
      return ok(`${rows.length} stale opportunities`, rows);
    }
    case 'find_opps_missing_field': {
      const rows = await handleFindOppsMissingField(input);
      return ok(`${rows.length} opps missing ${input.field}`, rows);
    }
    case 'get_pipeline_forecast': {
      const f = await handleGetPipelineForecast(input);
      return ok(`${input.quarter} weighted $${Math.round(f.totalWeighted).toLocaleString()}`, f);
    }
    case 'list_opps': {
      const rows = await handleListOpps(input);
      return ok(`${rows.length} opportunities`, rows);
    }
    case 'get_opp': {
      const o = await handleGetOpp(input);
      return o ? ok(o.Name, o) : fail('opportunity not found');
    }
    case 'list_users': {
      const rows = await handleListUsers();
      return ok(`${rows.length} users`, rows);
    }
    case 'list_accounts': {
      const rows = await handleListAccounts();
      return ok(`${rows.length} accounts`, rows);
    }
    case 'list_leads': {
      const rows = await handleListLeads();
      return ok(`${rows.length} leads`, rows);
    }
    case 'get_account': {
      const a = await handleGetAccount(input);
      return a ? ok(a.Name, a) : fail('account not found');
    }
    case 'propose_opp_field_update': {
      const r = await handleProposeOppFieldUpdate(input);
      return ok(r.summary, r);
    }
    case 'propose_stage_change': {
      const r = await handleProposeStageChange(input);
      return ok(r.summary, r);
    }
    case 'submit_approved_sfdc_batch': {
      const r = await handleSubmitApprovedSfdcBatch(input);
      return r.ok
        ? ok(`Applied ${r.applied} changes`, r)
        : fail(r.reason, r);
    }
    case 'render_opp_health_scorecard': {
      const r = await handleRenderOppHealthScorecard(input);
      return ok('Scorecard rendered', r);
    }
    case 'render_pipeline_forecast': {
      const r = await handleRenderPipelineForecast(input);
      return ok('Forecast rendered', r);
    }
    case 'render_bulk_update_preview': {
      const r = await handleRenderBulkUpdatePreview(input);
      return ok('Preview rendered', r);
    }
    case 'ask_question':
    case 'offer_artifacts':
      // Handled by the agent loop, not here. Acknowledge so it doesn't fall through.
      return ok('acknowledged', { name });
    default:
      return { ok: false, summary: `unknown tool: ${name}`, data: { name } };
  }
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

export const SYSTEM_PROMPT = `You are Salesforce Coworker, an AI assistant for revenue operations at Atlas Tech. Today's date is 2026-05-16.

Your job: read CRM data and propose changes; you never write to Salesforce without explicit human approval.

Available tools (call by name):
- Read: find_at_risk_opps, find_stale_opps, find_opps_missing_field, get_pipeline_forecast, list_opps, get_opp, list_users, list_accounts, list_leads, get_account.
- Propose (stages a change batch — requires approval to apply): propose_opp_field_update, propose_stage_change.
- Render (emits an artifact card the user reviews): render_opp_health_scorecard, render_pipeline_forecast, render_bulk_update_preview.

Workflow:
1. Use read tools to understand the situation. Show the user counts and a clear breakdown.
2. Propose changes by calling propose_*. Surface the returned stake ("bulk-update", "mass-action") and recordCount in your message.
3. Render a preview artifact via render_bulk_update_preview so the human can review before approving.
4. Wait for approval. submit_approved_sfdc_batch is internal — it runs automatically once the human clicks Approve and the server mints a token.

Approval stakes:
- read-only: no changes proposed — auto.
- single-record-edit / bulk-update: single approver.
- mass-action (>25 records, irreversible, or externally visible): dual control required.

Be concise. Cite specific opp names and amounts. Never invent IDs.`;

export const TESTING_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

TESTING MODE: when the user supplies an artifact kind hint, prefer that kind for rendering.`;

// Re-export the registry helper for callers that imported it from here.
export { getDefinedTool };
