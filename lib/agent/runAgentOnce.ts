import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { runTool, SYSTEM_PROMPT, TESTING_SYSTEM_PROMPT, type ToolContext, type ToolDef } from '@/lib/tools';
import type { DatasetKey } from '@/lib/data';
import type { ArtifactKind } from '@/lib/flows';
import { getAnthropicKey, getGeminiKey, getLLMGatewayKey, readSecrets } from '@/lib/secrets';
import { gatewayRemoteModelId, LLM_GATEWAY_BASE_URL, providerOf } from '@/lib/models';
import { buildModelTools, buildRequirementsBlock, coerceArtifactKind, filterToolsByAllowlist } from '@/lib/chatSchema';
import { jsonSchemaToGemini, type Event, type ChatHistoryTurn, type ApprovalPayload } from '@/lib/chatRouteHelpers';
import { ensureBraintrustLogger, traced, type Span } from '@/lib/braintrust';
import { getDefinedTool, validateToolInput } from '@/lib/tools/index';

export type RunAgentArgs = {
  model: string;
  userMessage: string;
  history?: ChatHistoryTurn[];
  mode?: 'demo' | 'testing';
  billEnvId?: string;
  billProduct?: 'ap' | 'se';
  demoDataset?: DatasetKey;
  forcedKind?: ArtifactKind;
  requirements?: string[];
  commandName?: string;
  shortcutAllowedTools?: string[];
  shortcutSystemPrompt?: string;
  /** Optional live-event callback. Used by the SSE route; evals can omit it. */
  onEvent?: (ev: Event) => void;
};

export type RunAgentResult = {
  events: Event[];
  finalText: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  errored: boolean;
};

// Cap inline-table payloads so a 10k-row response doesn't blow the SSE buffer.
const INLINE_DATA_MAX_ROWS = 200;
const INLINE_DATA_MAX_BYTES = 64 * 1024;

/** Build the optional `{ data, dataTruncated }` patch for a tool-result event.
 *  Only `list_*` tools whose result is an array of rows get a payload. */
function buildInlineTablePayload(
  toolName: string,
  data: unknown
): { data?: unknown[]; dataTruncated?: boolean } {
  if (!toolName.startsWith('list_') || !Array.isArray(data) || data.length === 0) {
    return {};
  }
  let rows = data as unknown[];
  let truncated = false;
  if (rows.length > INLINE_DATA_MAX_ROWS) {
    rows = rows.slice(0, INLINE_DATA_MAX_ROWS);
    truncated = true;
  }
  // Byte-cap is a coarse safety net — JSON.stringify is O(n) but already paid by SSE encode.
  if (JSON.stringify(rows).length > INLINE_DATA_MAX_BYTES) {
    let lo = 1;
    let hi = rows.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      if (JSON.stringify(rows.slice(0, mid)).length <= INLINE_DATA_MAX_BYTES) lo = mid;
      else hi = mid - 1;
    }
    rows = rows.slice(0, lo);
    truncated = true;
  }
  return { data: rows, dataTruncated: truncated || undefined };
}

export async function runAgentOnce(args: RunAgentArgs): Promise<RunAgentResult> {
  const events: Event[] = [];
  const send = (ev: Event) => {
    events.push(ev);
    args.onEvent?.(ev);
  };

  const history = Array.isArray(args.history) ? args.history.slice(-10) : [];
  const provider = providerOf(args.model);
  const ctx: ToolContext = {
    mode: args.mode ?? 'demo',
    billEnvId: args.billEnvId,
    billProduct: args.billProduct,
    demoDataset: args.demoDataset,
  };

  const secrets = await readSecrets();
  const demoOverride = secrets.systemPromptOverrideDemo;
  const testingOverride = secrets.systemPromptOverrideTesting;
  const disabledTools = new Set(secrets.disabledTools ?? []);

  const baseSystem =
    ctx.mode === 'testing'
      ? (testingOverride || TESTING_SYSTEM_PROMPT)
      : (demoOverride || SYSTEM_PROMPT);
  const withRequirements =
    args.forcedKind && args.commandName
      ? `${baseSystem}\n\n${buildRequirementsBlock(args.commandName, args.forcedKind, args.requirements ?? [])}`
      : baseSystem;
  const systemPrompt = args.shortcutSystemPrompt
    ? `${withRequirements}\n\n${args.shortcutSystemPrompt}`
    : withRequirements;
  const allTools = buildModelTools(args.forcedKind);
  const afterDisabled = disabledTools.size > 0
    ? allTools.filter(t => !disabledTools.has(t.name))
    : allTools;
  const tools = args.shortcutAllowedTools?.length
    ? filterToolsByAllowlist(afterDisabled, args.shortcutAllowedTools)
    : afterDisabled;

  await ensureBraintrustLogger();

  const startedAt = Date.now();
  let finalText = '';
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let errored = false;

  try {
    await traced(
      async (rootSpan) => {
        rootSpan.log({
          input: { userMessage: args.userMessage, history, mode: ctx.mode, demoDataset: ctx.demoDataset },
          metadata: { model: args.model, provider, billProduct: ctx.billProduct, forcedKind: args.forcedKind, commandName: args.commandName },
        });
        const onFinish = (t: string, it?: number, ot?: number) => {
          finalText = t;
          inputTokens = it;
          outputTokens = ot;
        };
        try {
          if (provider === 'gemini') {
            await runGemini(args.model, args.userMessage, send, ctx, systemPrompt, tools, args.forcedKind, history, onFinish);
          } else if (provider === 'llmgateway') {
            await runLLMGateway(args.model, args.userMessage, send, ctx, systemPrompt, tools, args.forcedKind, history, onFinish);
          } else {
            await runAnthropic(args.model, args.userMessage, send, ctx, systemPrompt, tools, args.forcedKind, history, onFinish);
          }
        } finally {
          rootSpan.log({
            output: finalText,
            metrics: {
              ...(inputTokens !== undefined ? { prompt_tokens: inputTokens } : {}),
              ...(outputTokens !== undefined ? { completion_tokens: outputTokens } : {}),
              ...(inputTokens !== undefined && outputTokens !== undefined
                ? { tokens: inputTokens + outputTokens }
                : {}),
            },
          });
        }
      },
      { name: 'chat.request', type: 'task' },
    );
  } catch (e: any) {
    errored = true;
    send({ type: 'error', message: e?.message ?? 'unknown error' });
  }

  const durationMs = Date.now() - startedAt;
  send({ type: 'usage', model: args.model, inputTokens, outputTokens, durationMs });
  send({ type: 'done' });

  return { events, finalText, inputTokens, outputTokens, durationMs, errored };
}

// ─── Tool span wrapper ────────────────────────────────────────────────

export type TracedToolResult =
  | { ok: true; summary: string; data: unknown }
  | { ok: false; summary: string; data: unknown; code?: 'E_SCHEMA' };

async function tracedTool(
  name: string,
  input: any,
  ctx: ToolContext,
): Promise<TracedToolResult> {
  return traced(
    async (toolSpan: Span) => {
      toolSpan.log({ input });
      // Validate against the registered Zod schema (if any) before dispatch.
      const def = getDefinedTool(name);
      if (def) {
        const v = validateToolInput(def, input);
        if (!v.ok) {
          toolSpan.log({
            output: { ok: false, summary: v.summary, code: v.code, issues: v.issues },
            metadata: { rejected: true, reason: 'schema' },
          });
          return { ok: false, summary: v.summary, data: { issues: v.issues }, code: v.code } as const;
        }
        // Use the parsed/coerced value (e.g. defaults applied) for downstream calls.
        input = v.input;
      }
      const res = await runTool(name, input, ctx);
      toolSpan.log({ output: { ok: res.ok, summary: res.summary, data: res.data } });
      return res;
    },
    { name: `tool:${name}`, type: 'tool' },
  );
}

// ── Anthropic ──────────────────────────────────────────────────────────
async function runAnthropic(
  model: string,
  userMessage: string,
  send: (ev: Event) => void,
  ctx: ToolContext,
  systemPrompt: string,
  modelTools: ToolDef[],
  forcedKind: ArtifactKind | undefined,
  history: ChatHistoryTurn[],
  onFinish: (text: string, inputTokens?: number, outputTokens?: number) => void
) {
  const apiKey = await getAnthropicKey();
  if (!apiKey) throw new Error('Anthropic API key not set. Configure it in Settings (or ANTHROPIC_API_KEY in .env.local).');

  const client = new Anthropic({ apiKey });
  const tools = modelTools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as any,
  }));

  const messages: Anthropic.Messages.MessageParam[] = [
    ...history.map(h => ({
      role: h.role,
      content: h.text,
    })) as Anthropic.Messages.MessageParam[],
    { role: 'user', content: userMessage },
  ];

  let fullResponseText = '';
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let turn = 0; turn < 4; turn++) {
    const turnResult = await traced(
      async (turnSpan: Span) => {
        turnSpan.log({ input: { messages, tools: tools.map(t => t.name) }, metadata: { model, turn } });
        const stream = await client.messages.stream({
          model,
          max_tokens: 2048,
          system: systemPrompt,
          tools,
          messages,
        });

        const toolUses: { id: string; name: string; input: any }[] = [];
        let textAccum = '';

        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            textAccum += event.delta.text;
            send({ type: 'text', text: event.delta.text });
          }
        }

        const final = await stream.finalMessage();
        const inTok = final.usage?.input_tokens ?? 0;
        const outTok = final.usage?.output_tokens ?? 0;

        for (const block of final.content) {
          if (block.type === 'tool_use') {
            toolUses.push({ id: block.id, name: block.name, input: block.input });
          }
        }

        turnSpan.log({
          output: { text: textAccum, toolUses: toolUses.map(t => ({ name: t.name })) },
          metrics: { prompt_tokens: inTok, completion_tokens: outTok, tokens: inTok + outTok },
        });

        return { textAccum, inTok, outTok, toolUses, final };
      },
      { name: 'llm.turn', type: 'llm' },
    );

    fullResponseText += turnResult.textAccum;
    totalInputTokens += turnResult.inTok;
    totalOutputTokens += turnResult.outTok;
    const toolUses = turnResult.toolUses;
    const final = turnResult.final;

    if (toolUses.length === 0) {
      onFinish(fullResponseText, totalInputTokens, totalOutputTokens);
      return;
    }

    const toolResults: any[] = [];
    for (const tu of toolUses) {
      send({ type: 'tool-call', id: tu.id, name: tu.name, input: tu.input });
      if (tu.name === 'ask_question') {
        const inp = tu.input as any;
        send({
          type: 'form-question',
          id: tu.id,
          question: inp.question ?? '',
          options: Array.isArray(inp.options) ? inp.options : [],
          multiSelect: inp.multi_select === true,
          freeText: inp.allow_free_text === true,
        });
        onFinish(fullResponseText, totalInputTokens, totalOutputTokens);
        return;
      }
      if (tu.name === 'offer_artifacts') {
        const inp = tu.input as any;
        send({
          type: 'artifact-offer',
          id: tu.id,
          summary: typeof inp.summary === 'string' ? inp.summary : undefined,
          question: typeof inp.question === 'string' ? inp.question : undefined,
          kinds: Array.isArray(inp.kinds) ? inp.kinds : [],
        });
        onFinish(fullResponseText, totalInputTokens, totalOutputTokens);
        return;
      }
      const res = await tracedTool(tu.name, tu.input, ctx);
      if (!res.ok && (res as any).code === 'E_SCHEMA') {
        send({ type: 'tool-error', id: tu.id, name: tu.name, input: tu.input, code: 'E_SCHEMA', summary: res.summary });
      } else {
        send({
          type: 'tool-result',
          id: tu.id,
          name: tu.name,
          input: tu.input,
          ok: res.ok,
          summary: res.summary,
          ...(res.ok ? buildInlineTablePayload(tu.name, res.data) : {}),
        });
      }
      if (tu.name === 'render_artifact') {
        const inp = tu.input as any;
        const kind = coerceArtifactKind(inp.kind, forcedKind);
        send({
          type: 'artifact',
          kind,
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
        });
      }
      if (tu.name === 'render_html_artifact') {
        const inp = tu.input as any;
        send({
          type: 'artifact',
          kind: 'custom-dashboard',
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
          html: inp.html,
          css: inp.css,
          script: inp.script,
          dataJson: inp.dataJson,
        });
      }
      if (tu.name === 'render_spreadsheet_artifact') {
        const inp = tu.input as any;
        send({
          type: 'artifact',
          kind: 'spreadsheet',
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
          dataJson: inp.dataJson,
        });
      }
      if (tu.name === 'render_document_artifact') {
        const inp = tu.input as any;
        send({
          type: 'artifact',
          kind: 'document',
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
          dataJson: inp.dataJson,
        });
      }
      if (tu.name === 'render_slides_artifact') {
        const inp = tu.input as any;
        send({
          type: 'artifact',
          kind: 'slides',
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
          dataJson: inp.dataJson,
        });
      }
      if (tu.name === 'render_automation_artifact') {
        const inp = tu.input as any;
        send({
          type: 'artifact',
          kind: 'automation',
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
          dataJson: JSON.stringify({
            name: inp.name,
            description: inp.description,
            trigger: inp.trigger,
            conditions: inp.conditions,
            actions: inp.actions,
            approvalPolicy: inp.approvalPolicy,
            expectedVolume: inp.expectedVolume,
            backfill: inp.backfill,
            rateLimit: inp.rateLimit,
            errorHandling: inp.errorHandling,
          }),
        });
      }
      if (tu.name === 'stage_payment_batch' && res.data && (res.data as any).approvalPayload) {
        const d = res.data as { approvalPayload: ApprovalPayload; simulated?: boolean };
        send({ type: 'approval', payload: d.approvalPayload, simulated: d.simulated === true });
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: JSON.stringify({ ok: res.ok, summary: res.summary, data: res.data }).slice(0, 8000),
      });
    }

    messages.push({ role: 'assistant', content: final.content });
    messages.push({ role: 'user', content: toolResults });
  }
  onFinish(fullResponseText, totalInputTokens, totalOutputTokens);
}

// ── Gemini ─────────────────────────────────────────────────────────────
async function runGemini(
  model: string,
  userMessage: string,
  send: (ev: Event) => void,
  ctx: ToolContext,
  systemPrompt: string,
  modelTools: ToolDef[],
  forcedKind: ArtifactKind | undefined,
  history: ChatHistoryTurn[],
  onFinish: (text: string, inputTokens?: number, outputTokens?: number) => void
) {
  const apiKey = await getGeminiKey();
  if (!apiKey) throw new Error('Gemini API key not set. Configure it in Settings (or GEMINI_API_KEY in .env.local).');

  const ai = new GoogleGenAI({ apiKey });

  const geminiTools = [
    {
      functionDeclarations: modelTools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: jsonSchemaToGemini(t.parameters),
      })),
    },
  ];

  const contents: any[] = [
    ...history.map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.text }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  let fullResponseText = '';

  for (let turn = 0; turn < 4; turn++) {
    const turnResult = await traced(
      async (turnSpan: Span) => {
        turnSpan.log({
          input: { contents, tools: modelTools.map(t => t.name) },
          metadata: { model, turn },
        });
        const stream = await ai.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction: systemPrompt,
            tools: geminiTools as any,
          },
        });

        const toolCalls: { id: string; name: string; input: any }[] = [];
        const modelParts: any[] = [];
        let textAccum = '';

        for await (const chunk of stream) {
          const cand = chunk.candidates?.[0];
          const parts = cand?.content?.parts ?? [];
          for (const part of parts) {
            if ((part as any).text) {
              textAccum += (part as any).text;
              send({ type: 'text', text: (part as any).text });
              modelParts.push({ text: (part as any).text });
            } else if ((part as any).functionCall) {
              const fc = (part as any).functionCall;
              const id = `fn_${toolCalls.length}_${Date.now()}`;
              toolCalls.push({ id, name: fc.name, input: fc.args ?? {} });
              modelParts.push({ functionCall: fc });
            }
          }
        }

        turnSpan.log({
          output: { text: textAccum, toolCalls: toolCalls.map(t => ({ name: t.name })) },
        });

        return { textAccum, toolCalls, modelParts };
      },
      { name: 'llm.turn', type: 'llm' },
    );

    fullResponseText += turnResult.textAccum;
    const toolCalls = turnResult.toolCalls;
    const modelParts = turnResult.modelParts;

    if (toolCalls.length === 0) {
      onFinish(fullResponseText);
      return;
    }

    contents.push({ role: 'model', parts: modelParts });

    const toolParts: any[] = [];
    for (const tc of toolCalls) {
      send({ type: 'tool-call', id: tc.id, name: tc.name, input: tc.input });
      if (tc.name === 'ask_question') {
        const inp = tc.input as any;
        send({
          type: 'form-question',
          id: tc.id,
          question: inp.question ?? '',
          options: Array.isArray(inp.options) ? inp.options : [],
          multiSelect: inp.multi_select === true,
          freeText: inp.allow_free_text === true,
        });
        onFinish(fullResponseText);
        return;
      }
      if (tc.name === 'offer_artifacts') {
        const inp = tc.input as any;
        send({
          type: 'artifact-offer',
          id: tc.id,
          summary: typeof inp.summary === 'string' ? inp.summary : undefined,
          question: typeof inp.question === 'string' ? inp.question : undefined,
          kinds: Array.isArray(inp.kinds) ? inp.kinds : [],
        });
        onFinish(fullResponseText);
        return;
      }
      const res = await tracedTool(tc.name, tc.input, ctx);
      if (!res.ok && (res as any).code === 'E_SCHEMA') {
        send({ type: 'tool-error', id: tc.id, name: tc.name, input: tc.input, code: 'E_SCHEMA', summary: res.summary });
      } else {
        send({
          type: 'tool-result',
          id: tc.id,
          name: tc.name,
          input: tc.input,
          ok: res.ok,
          summary: res.summary,
          ...(res.ok ? buildInlineTablePayload(tc.name, res.data) : {}),
        });
      }
      if (tc.name === 'render_artifact') {
        const inp = tc.input as any;
        const kind = coerceArtifactKind(inp.kind, forcedKind);
        send({
          type: 'artifact',
          kind,
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
        });
      }
      if (tc.name === 'render_html_artifact') {
        const inp = tc.input as any;
        send({
          type: 'artifact',
          kind: 'custom-dashboard',
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
          html: inp.html,
          css: inp.css,
          script: inp.script,
          dataJson: inp.dataJson,
        });
      }
      if (tc.name === 'render_spreadsheet_artifact') {
        const inp = tc.input as any;
        send({
          type: 'artifact',
          kind: 'spreadsheet',
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
          dataJson: inp.dataJson,
        });
      }
      if (tc.name === 'render_document_artifact') {
        const inp = tc.input as any;
        send({
          type: 'artifact',
          kind: 'document',
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
          dataJson: inp.dataJson,
        });
      }
      if (tc.name === 'render_slides_artifact') {
        const inp = tc.input as any;
        send({
          type: 'artifact',
          kind: 'slides',
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
          dataJson: inp.dataJson,
        });
      }
      if (tc.name === 'render_automation_artifact') {
        const inp = tc.input as any;
        send({
          type: 'artifact',
          kind: 'automation',
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
          dataJson: JSON.stringify({
            name: inp.name,
            description: inp.description,
            trigger: inp.trigger,
            conditions: inp.conditions,
            actions: inp.actions,
            approvalPolicy: inp.approvalPolicy,
            expectedVolume: inp.expectedVolume,
            backfill: inp.backfill,
            rateLimit: inp.rateLimit,
            errorHandling: inp.errorHandling,
          }),
        });
      }
      if (tc.name === 'stage_payment_batch' && res.data && (res.data as any).approvalPayload) {
        const d = res.data as { approvalPayload: ApprovalPayload; simulated?: boolean };
        send({ type: 'approval', payload: d.approvalPayload, simulated: d.simulated === true });
      }
      toolParts.push({
        functionResponse: {
          name: tc.name,
          response: { ok: res.ok, summary: res.summary, data: res.data },
        },
      });
    }
    contents.push({ role: 'user', parts: toolParts });
  }
  onFinish(fullResponseText);
}

// ── LLM Gateway (OpenAI-compatible) ────────────────────────────────────
async function runLLMGateway(
  model: string,
  userMessage: string,
  send: (ev: Event) => void,
  ctx: ToolContext,
  systemPrompt: string,
  modelTools: ToolDef[],
  forcedKind: ArtifactKind | undefined,
  history: ChatHistoryTurn[],
  onFinish: (text: string, inputTokens?: number, outputTokens?: number) => void
) {
  const apiKey = await getLLMGatewayKey();
  if (!apiKey) throw new Error('LLM Gateway API key not set. Configure it in Settings (or LLM_GATEWAY_API_KEY in .env.local).');

  const client = new OpenAI({ apiKey, baseURL: LLM_GATEWAY_BASE_URL });
  const remoteModel = gatewayRemoteModelId(model);

  const tools: OpenAI.Chat.Completions.ChatCompletionFunctionTool[] = modelTools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters as Record<string, unknown>,
    },
  }));

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({
      role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: h.text,
    })),
    { role: 'user', content: userMessage },
  ];

  let fullResponseText = '';
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let turn = 0; turn < 4; turn++) {
    const turnResult = await traced(
      async (turnSpan: Span) => {
        turnSpan.log({ input: { messages, tools: tools.map(t => t.function.name) }, metadata: { model: remoteModel, turn } });
        const stream = await client.chat.completions.create({
          model: remoteModel,
          messages,
          tools: tools.length > 0 ? tools : undefined,
          stream: true,
          stream_options: { include_usage: true },
        });

        // Tool calls arrive as deltas keyed by `index`; accumulate id/name/args
        // chunks until the stream finishes, then parse arguments as JSON.
        const toolAccum = new Map<number, { id: string; name: string; args: string }>();
        let textAccum = '';
        let inTok = 0;
        let outTok = 0;

        for await (const chunk of stream) {
          const choice = chunk.choices?.[0];
          const delta = choice?.delta;
          if (delta?.content) {
            textAccum += delta.content;
            send({ type: 'text', text: delta.content });
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const slot = toolAccum.get(tc.index) ?? { id: '', name: '', args: '' };
              if (tc.id) slot.id = tc.id;
              if (tc.function?.name) slot.name = tc.function.name;
              if (tc.function?.arguments) slot.args += tc.function.arguments;
              toolAccum.set(tc.index, slot);
            }
          }
          if (chunk.usage) {
            inTok = chunk.usage.prompt_tokens ?? inTok;
            outTok = chunk.usage.completion_tokens ?? outTok;
          }
        }

        const toolUses = [...toolAccum.entries()]
          .sort(([a], [b]) => a - b)
          .map(([, v]) => {
            let parsed: any = {};
            if (v.args) {
              try { parsed = JSON.parse(v.args); } catch { parsed = { _raw: v.args }; }
            }
            return { id: v.id || `fn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: v.name, input: parsed };
          });

        turnSpan.log({
          output: { text: textAccum, toolUses: toolUses.map(t => ({ name: t.name })) },
          metrics: { prompt_tokens: inTok, completion_tokens: outTok, tokens: inTok + outTok },
        });

        return { textAccum, inTok, outTok, toolUses };
      },
      { name: 'llm.turn', type: 'llm' },
    );

    fullResponseText += turnResult.textAccum;
    totalInputTokens += turnResult.inTok;
    totalOutputTokens += turnResult.outTok;
    const toolUses = turnResult.toolUses;

    if (toolUses.length === 0) {
      onFinish(fullResponseText, totalInputTokens, totalOutputTokens);
      return;
    }

    // Append the assistant turn (with tool_calls) before the tool messages —
    // OpenAI requires this exact sequencing so each `tool` message can refer to
    // a `tool_call_id` from the immediately-preceding assistant turn.
    messages.push({
      role: 'assistant',
      content: turnResult.textAccum || null,
      tool_calls: toolUses.map(tu => ({
        id: tu.id,
        type: 'function' as const,
        function: { name: tu.name, arguments: JSON.stringify(tu.input) },
      })),
    });

    for (const tu of toolUses) {
      send({ type: 'tool-call', id: tu.id, name: tu.name, input: tu.input });
      if (tu.name === 'ask_question') {
        const inp = tu.input as any;
        send({
          type: 'form-question',
          id: tu.id,
          question: inp.question ?? '',
          options: Array.isArray(inp.options) ? inp.options : [],
          multiSelect: inp.multi_select === true,
          freeText: inp.allow_free_text === true,
        });
        onFinish(fullResponseText, totalInputTokens, totalOutputTokens);
        return;
      }
      if (tu.name === 'offer_artifacts') {
        const inp = tu.input as any;
        send({
          type: 'artifact-offer',
          id: tu.id,
          summary: typeof inp.summary === 'string' ? inp.summary : undefined,
          question: typeof inp.question === 'string' ? inp.question : undefined,
          kinds: Array.isArray(inp.kinds) ? inp.kinds : [],
        });
        onFinish(fullResponseText, totalInputTokens, totalOutputTokens);
        return;
      }
      const res = await tracedTool(tu.name, tu.input, ctx);
      if (!res.ok && (res as any).code === 'E_SCHEMA') {
        send({ type: 'tool-error', id: tu.id, name: tu.name, input: tu.input, code: 'E_SCHEMA', summary: res.summary });
      } else {
        send({
          type: 'tool-result',
          id: tu.id,
          name: tu.name,
          input: tu.input,
          ok: res.ok,
          summary: res.summary,
          ...(res.ok ? buildInlineTablePayload(tu.name, res.data) : {}),
        });
      }
      if (tu.name === 'render_artifact') {
        const inp = tu.input as any;
        const kind = coerceArtifactKind(inp.kind, forcedKind);
        send({
          type: 'artifact',
          kind,
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
        });
      }
      if (tu.name === 'render_html_artifact') {
        const inp = tu.input as any;
        send({
          type: 'artifact',
          kind: 'custom-dashboard',
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
          html: inp.html,
          css: inp.css,
          script: inp.script,
          dataJson: inp.dataJson,
        });
      }
      if (tu.name === 'render_spreadsheet_artifact') {
        const inp = tu.input as any;
        send({
          type: 'artifact',
          kind: 'spreadsheet',
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
          dataJson: inp.dataJson,
        });
      }
      if (tu.name === 'render_document_artifact') {
        const inp = tu.input as any;
        send({
          type: 'artifact',
          kind: 'document',
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
          dataJson: inp.dataJson,
        });
      }
      if (tu.name === 'render_slides_artifact') {
        const inp = tu.input as any;
        send({
          type: 'artifact',
          kind: 'slides',
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
          dataJson: inp.dataJson,
        });
      }
      if (tu.name === 'render_automation_artifact') {
        const inp = tu.input as any;
        send({
          type: 'artifact',
          kind: 'automation',
          title: inp.title,
          sub: inp.sub,
          meta: inp.meta,
          label: inp.title,
          dataJson: JSON.stringify({
            name: inp.name,
            description: inp.description,
            trigger: inp.trigger,
            conditions: inp.conditions,
            actions: inp.actions,
            approvalPolicy: inp.approvalPolicy,
            expectedVolume: inp.expectedVolume,
            backfill: inp.backfill,
            rateLimit: inp.rateLimit,
            errorHandling: inp.errorHandling,
          }),
        });
      }
      if (tu.name === 'stage_payment_batch' && res.data && (res.data as any).approvalPayload) {
        const d = res.data as { approvalPayload: ApprovalPayload; simulated?: boolean };
        send({ type: 'approval', payload: d.approvalPayload, simulated: d.simulated === true });
      }
      messages.push({
        role: 'tool',
        tool_call_id: tu.id,
        content: JSON.stringify({ ok: res.ok, summary: res.summary, data: res.data }).slice(0, 8000),
      });
    }
  }
  onFinish(fullResponseText, totalInputTokens, totalOutputTokens);
}
