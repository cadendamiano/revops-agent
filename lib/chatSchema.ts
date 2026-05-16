import { MODEL_TOOLS, type ToolDef } from './tools';
import type { ArtifactKind } from './flows';

export function buildModelTools(forcedKind?: ArtifactKind): ToolDef[] {
  if (!forcedKind) return MODEL_TOOLS;
  return MODEL_TOOLS.map(t => {
    if (t.name !== 'render_artifact') return t;
    const kindProp = (t.parameters.properties as any)?.kind;
    if (!kindProp) return t;
    // 'document', 'slides', and 'spreadsheet' aren't in the generic enum —
    // they have their own typed tools (render_document_artifact, etc.). Don't
    // touch the enum; the requirements prompt steers the model to the right
    // typed tool instead.
    const enumList: string[] = Array.isArray(kindProp.enum) ? kindProp.enum : [];
    if (!enumList.includes(forcedKind)) return t;
    return {
      ...t,
      parameters: {
        ...t.parameters,
        properties: {
          ...t.parameters.properties,
          kind: { ...kindProp, enum: [forcedKind] },
        },
      },
    };
  });
}

export function buildRequirementsBlock(
  commandName: string,
  forcedKind: ArtifactKind,
  requirements: string[]
): string {
  const lines = requirements.map(r => `- ${r}`).join('\n');

  // /slides is questionnaire-driven: we explicitly tell the model NOT to
  // generate the artifact this turn. It must run a conversation, then wait
  // for a yes from the user before calling render_slides_artifact.
  if (forcedKind === 'slides') {
    return `The user invoked /${commandName}. DO NOT call render_slides_artifact yet.

Instead, hold a short questionnaire conversation to gather what's needed for the deck. Ask 2–4 focused questions per turn (use \`ask_question\` for the most decision-rich items, plain prose for the rest). Cover every item below before generating.

Requirements to collect:
${lines}

Once you believe you have enough to build a strong deck, summarize back what you've gathered in 4–6 lines and ask explicitly: "Do you have everything you'd like? Ready for me to generate the deck?" Only AFTER the user says yes (or equivalent) should you call \`render_slides_artifact\` with the structured \`dataJson\`. If they want changes, keep iterating; never generate the deck without a confirmation.`;
  }

  // /doc is one-shot: generate the document artifact this turn using the
  // typed tool (not render_artifact).
  if (forcedKind === 'document') {
    return `The user invoked /${commandName}. You MUST call render_document_artifact exactly once this turn. Before (or alongside) that call, produce a structured plan that covers EVERY requirement below. Use the read tools (list_bills, get_category_spend, list_vendors, get_aging_summary, find_duplicate_invoices) to ground concrete values.

Requirements:
${lines}`;
  }

  const dvExtra = commandName === 'dataviz'
    ? `

Dataviz routing:
- If the user asked for a standard spend donut+bar (Q1 spend by category), call render_artifact with kind="spend-chart".
- If the user asked for a non-standard visualization (line, treemap, heatmap, sunburst, sankey, scatter, radar, custom dashboard, or anything else), call \`render_html_artifact\` instead. Pipe the read-tool output as \`dataJson\`; write a short script that uses ECharts/D3/Chart.js to render into #root. Do not try to squeeze it into spend-chart.`
    : '';
  return `The user invoked /${commandName}. You MUST open exactly one artifact this turn — either via render_artifact (kind="${forcedKind}") or via render_html_artifact for requests that don't fit the curated kind. Before (or alongside) that call, produce a structured plan that covers EVERY requirement below. Use the read tools (list_bills, get_category_spend, list_vendors, get_aging_summary, find_duplicate_invoices) to ground concrete values.

Requirements:
${lines}${dvExtra}`;
}

export function filterToolsByAllowlist(tools: ToolDef[], allowlist: string[]): ToolDef[] {
  if (!allowlist.length) return tools;
  const allowed = new Set(allowlist);
  return tools.filter(t => allowed.has(t.name));
}

export function coerceArtifactKind(
  modelKind: unknown,
  forcedKind: ArtifactKind | undefined
): string {
  if (!forcedKind) return String(modelKind);
  // 'html' and 'spreadsheet' are legitimate escape hatches — never coerce them away.
  if (modelKind === 'html') return 'html';
  if (modelKind === 'spreadsheet') return 'spreadsheet';
  if (modelKind !== forcedKind) {
    console.warn(
      `[chat] model emitted artifact kind=${String(modelKind)} but forced kind=${forcedKind}; coercing`
    );
    return forcedKind;
  }
  return forcedKind;
}
