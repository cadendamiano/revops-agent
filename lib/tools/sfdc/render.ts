// Render tools for the SFDC artifact library. Handlers just echo input.
import { z } from 'zod';
import { defineTool, type DefinedTool } from '../defineTool';

const ArtifactId = z.string().min(1);

export const renderSoqlResults = defineTool({
  name: 'render_soql_results',
  label: 'Open SOQL results',
  domain: 'render',
  description: 'Open a SOQL result table artifact. Pass the SOQL query and the records array returned by sf_data_query.',
  schema: z.object({
    artifactId: ArtifactId,
    soql: z.string().min(1),
    fields: z.array(z.string()),
    records: z.array(z.record(z.string(), z.unknown())),
  }),
});

export const renderPipelineKanban = defineTool({
  name: 'render_pipeline_kanban',
  label: 'Open pipeline kanban',
  domain: 'render',
  description: 'Open the pipeline kanban artifact. Pass stages with their opp lists.',
  schema: z.object({
    artifactId: ArtifactId,
    stages: z.array(z.object({
      name: z.string(),
      opps: z.array(z.object({
        Id: z.string(),
        Name: z.string(),
        Amount: z.number(),
        ownerName: z.string().optional(),
        risk: z.string().optional(),
      })),
    })),
  }),
});

export const renderAccount360 = defineTool({
  name: 'render_account_360',
  label: 'Open account 360',
  domain: 'render',
  description: 'Open the account 360 artifact: account header, opps, recent activity, contacts, health score.',
  schema: z.object({
    artifactId: ArtifactId,
    account: z.object({
      Id: z.string(), Name: z.string(),
      Industry: z.string().optional(), AnnualRevenue: z.number().optional(),
      Employees: z.number().optional(), OwnerName: z.string().optional(),
    }),
    opps: z.array(z.object({
      Id: z.string(), Name: z.string(), StageName: z.string(), Amount: z.number(), CloseDate: z.string(),
    })),
    activities: z.array(z.object({
      Id: z.string(), Type: z.string(), Subject: z.string(), ActivityDate: z.string(),
    })),
    contacts: z.array(z.object({
      Id: z.string(), Name: z.string(), Title: z.string().optional(), Email: z.string().optional(),
    })),
    health: z.object({
      score: z.number(), label: z.string(),
      signals: z.array(z.string()),
    }),
  }),
});

export const renderLeadScoring = defineTool({
  name: 'render_lead_scoring',
  label: 'Open lead scoring',
  domain: 'render',
  description: 'Open the lead scoring table with computed scores + factors.',
  schema: z.object({
    artifactId: ArtifactId,
    leads: z.array(z.object({
      Id: z.string(), Name: z.string(), Company: z.string(),
      Status: z.string(), LeadSource: z.string(),
      score: z.number(), scoreFactors: z.array(z.string()),
    })),
  }),
});

export const renderForecast = defineTool({
  name: 'render_forecast',
  label: 'Open forecast',
  domain: 'render',
  description: 'Open the forecast tile artifact. commit / bestCase / pipeline / quota + byStage and byOwner breakdowns.',
  schema: z.object({
    artifactId: ArtifactId,
    commit: z.number(),
    bestCase: z.number(),
    pipeline: z.number(),
    quota: z.number(),
    byStage: z.array(z.object({ stage: z.string(), count: z.number(), weighted: z.number() })),
    byOwner: z.array(z.object({ ownerName: z.string(), quota: z.number(), weighted: z.number(), attainmentPct: z.number() })),
  }),
});

export const renderDashboardTiles = defineTool({
  name: 'render_dashboard_tiles',
  label: 'Open dashboard',
  domain: 'render',
  description: 'Open a dashboard artifact with mixed tiles (metric/bar/donut/line).',
  schema: z.object({
    artifactId: ArtifactId,
    name: z.string(),
    tiles: z.array(z.object({
      type: z.enum(['metric', 'bar', 'donut', 'line']),
      label: z.string(),
      value: z.union([z.string(), z.number()]).optional(),
      series: z.array(z.object({ label: z.string(), value: z.number() })).optional(),
    })),
  }),
});

export const renderCaseSla = defineTool({
  name: 'render_case_sla',
  label: 'Open case SLA heatmap',
  domain: 'render',
  description: 'Open the case-SLA heatmap artifact.',
  schema: z.object({
    artifactId: ArtifactId,
    cases: z.array(z.object({
      id: z.string(), caseNumber: z.string(),
      priority: z.string(), age: z.number(), slaPct: z.number(),
      subject: z.string().optional(), ownerId: z.string().optional(),
    })),
  }),
});

export const renderActivityTimeline = defineTool({
  name: 'render_activity_timeline',
  label: 'Open activity timeline',
  domain: 'render',
  description: 'Open the activity timeline artifact for a related record.',
  schema: z.object({
    artifactId: ArtifactId,
    relatedTo: z.string(),
    items: z.array(z.object({
      ts: z.string(), type: z.string(), subject: z.string(),
      who: z.string().optional(), durationMin: z.number().optional(),
    })),
  }),
});

export const renderBulkUpdatePreview = defineTool({
  name: 'render_bulk_update_preview',
  label: 'Open bulk-update preview',
  domain: 'render',
  description: 'Open the bulk-update preview artifact for a staged batch (any sf_data_* propose tool).',
  schema: z.object({
    artifactId: ArtifactId,
    batchId: z.string().min(1),
  }),
});

export const renderActionDraft = defineTool({
  name: 'render_action_draft',
  label: 'Open action drafts',
  domain: 'render',
  description: 'Open an editable Action Draft artifact — one or more drafts (email/SMS/call script/activity note) the user can edit in place before approving. Use for lead re-engagement batches and stuck-deal follow-ups. Each draft body should be fully written; the user edits then approves.',
  schema: z.object({
    artifactId: ArtifactId,
    title: z.string().optional(),
    drafts: z.array(z.object({
      id: z.string(),
      channel: z.enum(['email', 'sms', 'call', 'note']),
      recordId: z.string().optional(),
      to: z.string().optional(),
      subject: z.string().optional(),
      body: z.string(),
    })).min(1),
  }),
});

export const renderComparison = defineTool({
  name: 'render_comparison',
  label: 'Open comparison',
  domain: 'render',
  description: 'Open a side-by-side Comparison artifact for evaluating options (e.g. "follow up now vs. wait", "close lost vs. reassign"). Each option lists its tradeoffs; mark one recommended if you have a recommendation.',
  schema: z.object({
    artifactId: ArtifactId,
    title: z.string().optional(),
    options: z.array(z.object({
      id: z.string(),
      label: z.string(),
      summary: z.string().optional(),
      tradeoffs: z.array(z.string()).default([]),
      recommended: z.boolean().optional(),
    })).min(2),
  }),
});

export const SFDC_RENDER_TOOLS_V2: DefinedTool[] = [
  renderSoqlResults, renderPipelineKanban, renderAccount360, renderLeadScoring,
  renderForecast, renderDashboardTiles, renderCaseSla, renderActivityTimeline,
  renderBulkUpdatePreview, renderActionDraft, renderComparison,
];

// ─── Handlers (just echo) ───────────────────────────────────────────

export async function handleRenderSoqlResults(input: unknown) {
  return { kind: 'soql-results', ...(input as object) };
}
export async function handleRenderPipelineKanban(input: unknown) {
  return { kind: 'pipeline-kanban', ...(input as object) };
}
export async function handleRenderAccount360(input: unknown) {
  return { kind: 'account-360', ...(input as object) };
}
export async function handleRenderLeadScoring(input: unknown) {
  return { kind: 'lead-scoring', ...(input as object) };
}
export async function handleRenderForecast(input: unknown) {
  return { kind: 'forecast', ...(input as object) };
}
export async function handleRenderDashboardTiles(input: unknown) {
  return { kind: 'dashboard-tiles', ...(input as object) };
}
export async function handleRenderCaseSla(input: unknown) {
  return { kind: 'case-sla', ...(input as object) };
}
export async function handleRenderActivityTimeline(input: unknown) {
  return { kind: 'activity-timeline', ...(input as object) };
}
export async function handleRenderBulkUpdatePreview(input: { artifactId: string; batchId: string }) {
  return { kind: 'bulk-update-preview', artifactId: input.artifactId, batchId: input.batchId };
}
export async function handleRenderActionDraft(input: unknown) {
  return { kind: 'action-draft', ...(input as object) };
}
export async function handleRenderComparison(input: unknown) {
  return { kind: 'comparison', ...(input as object) };
}
