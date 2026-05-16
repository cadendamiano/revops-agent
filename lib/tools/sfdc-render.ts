// Salesforce render tools — emit artifact cards. The handlers simply echo the input.
import { z } from 'zod';
import { defineTool, type DefinedTool } from './defineTool';
import { askQuestion, offerArtifacts } from './render';

const OppRow = z.object({
  Id: z.string(),
  Name: z.string(),
  StageName: z.string(),
  Amount: z.number(),
  ownerName: z.string(),
  risks: z.array(z.string()),
});

const ForecastByStage = z.object({
  stage: z.string(),
  count: z.number(),
  unweighted: z.number(),
  weighted: z.number(),
});

const ForecastByOwner = z.object({
  ownerId: z.string(),
  ownerName: z.string(),
  quota: z.number(),
  weighted: z.number(),
  attainmentPct: z.number(),
});

const ForecastShape = z.object({
  quarter: z.enum(['Q2', 'Q3']),
  totalUnweighted: z.number(),
  totalWeighted: z.number(),
  byStage: z.array(ForecastByStage),
  byOwner: z.array(ForecastByOwner),
  quotaTotal: z.number(),
  attainmentPct: z.number(),
});

export const renderOppHealthScorecard = defineTool({
  name: 'render_opp_health_scorecard',
  label: 'Open opp-health scorecard',
  domain: 'render',
  description: 'Open the at-risk opportunity scorecard artifact with the given rows.',
  schema: z.object({
    artifactId: z.string().min(1),
    opps: z.array(OppRow),
  }),
});

export const renderPipelineForecast = defineTool({
  name: 'render_pipeline_forecast',
  label: 'Open pipeline forecast',
  domain: 'render',
  description: 'Open the pipeline-forecast artifact with the supplied quarterly rollup.',
  schema: z.object({
    artifactId: z.string().min(1),
    forecast: ForecastShape,
  }),
});

export const renderBulkUpdatePreview = defineTool({
  name: 'render_bulk_update_preview',
  label: 'Open bulk-update preview',
  domain: 'render',
  description: 'Open the bulk-update preview artifact for a staged batch. The artifact pulls preview rows from the staging store by batchId.',
  schema: z.object({
    artifactId: z.string().min(1),
    batchId: z.string().min(1),
  }),
});

export const SFDC_RENDER_TOOLS: DefinedTool[] = [
  renderOppHealthScorecard, renderPipelineForecast, renderBulkUpdatePreview,
  askQuestion, offerArtifacts,
];

// ─── Handlers ────────────────────────────────────────────────────────

export async function handleRenderOppHealthScorecard(input: {
  artifactId: string;
  opps: unknown[];
}) {
  return { kind: 'opp-health', artifactId: input.artifactId, opps: input.opps };
}

export async function handleRenderPipelineForecast(input: {
  artifactId: string;
  forecast: unknown;
}) {
  return { kind: 'pipeline-forecast', artifactId: input.artifactId, forecast: input.forecast };
}

export async function handleRenderBulkUpdatePreview(input: {
  artifactId: string;
  batchId: string;
}) {
  return { kind: 'bulk-update-preview', artifactId: input.artifactId, batchId: input.batchId };
}
