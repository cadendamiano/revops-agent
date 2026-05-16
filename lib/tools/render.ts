import { z } from 'zod';
import { defineTool } from './defineTool';

// phase-a: render_artifact's kind enum is empty until Phase B reintroduces SF kinds.
const RenderArtifactKind = z.enum(['custom-dashboard']);

export const renderArtifact = defineTool({
  name: 'render_artifact',
  label: 'Open artifact',
  domain: 'render',
  description:
    'Open an interactive artifact card in the UI. Use when the user asks to visualize, list, or configure something that has a matching artifact kind.',
  schema: z.object({
    kind: RenderArtifactKind,
    title: z.string().min(1),
    sub: z.string().optional(),
    meta: z.string().optional(),
  }),
});

export const renderHtmlArtifact = defineTool({
  name: 'render_html_artifact',
  label: 'Build custom artifact',
  domain: 'render',
  description:
    'Open a custom HTML/CSS/JS artifact in the UI. Use this whenever the user asks for a visualization or layout — for example a line graph, treemap, heatmap, sankey, sunburst, scatter, KPI dashboard, or any freeform layout. The artifact renders inside a sandboxed iframe with ECharts v5, D3 v7, and Chart.js v4 available globally.',
  schema: z.object({
    title: z.string().min(1),
    sub: z.string().optional(),
    meta: z.string().optional(),
    html: z.string().min(1),
    css: z.string().optional(),
    script: z.string().optional(),
    dataJson: z.string().optional(),
  }),
});

export const renderSpreadsheetArtifact = defineTool({
  name: 'render_spreadsheet_artifact',
  label: 'Open spreadsheet',
  domain: 'render',
  description:
    'Open an editable multi-sheet spreadsheet in the artifact panel. Use when the user asks to see data (bills, vendors, expenses, aging, spend), create a spreadsheet, or requests tabular data with formula editing. This is the primary way to surface tabular data — prefer it over any other table format.',
  schema: z.object({
    title: z.string().min(1),
    sub: z.string().optional(),
    meta: z.string().optional(),
    dataJson: z.string().min(1),
  }),
});

export const renderDocumentArtifact = defineTool({
  name: 'render_document_artifact',
  label: 'Open document',
  domain: 'render',
  description:
    'Open an editable rich-text document in the artifact panel. Use when the user asks for a report, one-pager, memo, narrative summary, or any prose-and-structured-content document. The user can edit the document inline; their edits are persisted automatically.',
  schema: z.object({
    title: z.string().min(1),
    sub: z.string().optional(),
    meta: z.string().optional(),
    dataJson: z.string().min(1),
  }),
});

const AutomationCondition = z.object({
  field: z.string().min(1),
  operator: z.string().min(1),
  value: z.string().min(1),
});

const AutomationAction = z.object({
  target: z.string().min(1),
  operation: z.string().min(1),
  detail: z.string().min(1),
});

export const renderAutomationArtifact = defineTool({
  name: 'render_automation_artifact',
  label: 'Open automation',
  domain: 'render',
  description:
    'Open an automation rule artifact in the UI. Use ONLY after the user has invoked /automation and you have gathered the structured automation logic from them. Pass the user\'s actual rule via the typed fields below — do NOT invent fields they did not specify. If a required field (trigger, at least one action) is missing, ask via ask_question first and DO NOT call this tool yet.',
  schema: z.object({
    title: z.string().min(1),
    sub: z.string().optional(),
    meta: z.string().optional(),
    name: z.string().min(1),
    description: z.string().min(1),
    trigger: z.string().min(1),
    conditions: z.array(AutomationCondition),
    actions: z.array(AutomationAction).min(1),
    approvalPolicy: z.enum(['auto', 'human-gate']).optional(),
    expectedVolume: z.string().optional(),
    backfill: z.object({
      enabled: z.boolean(),
      window: z.string().optional(),
    }).optional(),
    rateLimit: z.string().optional(),
    errorHandling: z.string().optional(),
  }),
});

export const renderSlidesArtifact = defineTool({
  name: 'render_slides_artifact',
  label: 'Open slide deck',
  domain: 'render',
  description:
    'Open an editable slide-deck presentation in the artifact panel. Use ONLY when the user has invoked /slides AND has explicitly confirmed they are ready to generate the deck after the questionnaire. Do not call this tool to fulfil any other request.',
  schema: z.object({
    title: z.string().min(1),
    sub: z.string().optional(),
    meta: z.string().optional(),
    dataJson: z.string().min(1),
  }),
});

export const askQuestion = defineTool({
  name: 'ask_question',
  label: 'Ask clarifying question',
  domain: 'form',
  description:
    'Ask the user a structured question to collect context before proceeding. Use this when intent is ambiguous — especially for automation setup. Prefer multi_select when several options might apply simultaneously. Set allow_free_text when the option list may not be exhaustive.',
  schema: z.object({
    question: z.string().min(1),
    options: z.array(z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      description: z.string().optional(),
    })),
    multi_select: z.boolean().optional(),
    allow_free_text: z.boolean().optional(),
  }),
});

const OfferArtifactKind = z.enum([
  'spreadsheet', 'document', 'slides', 'custom-dashboard',
]);

export const offerArtifacts = defineTool({
  name: 'offer_artifacts',
  label: 'Offer artifact options',
  domain: 'form',
  description:
    'Testing-mode opt-in flow. After a read tool returns data, call this *instead of* render_*_artifact. Pass 2–4 of the most contextually relevant `kinds` for the data you just read — e.g. tabular data → spreadsheet + custom-dashboard (chart); narrative → document + slides; rule/automation → automation. The UI shows clickable chips; the user opts in explicitly. Do NOT call this when the user has already explicitly named an artifact, or when a Requirements block is present in the system message.',
  schema: z.object({
    summary: z.string().optional(),
    question: z.string().optional(),
    kinds: z.array(OfferArtifactKind).min(1).max(5),
  }),
});

export const RENDER_TOOLS = [
  renderArtifact, renderHtmlArtifact, renderSpreadsheetArtifact,
  renderDocumentArtifact, renderSlidesArtifact, renderAutomationArtifact,
  askQuestion, offerArtifacts,
];
