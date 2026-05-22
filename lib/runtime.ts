'use client';

import { type ArtifactKind, type ToolRowSpec } from './flows';
import { newId, type Turn } from './turns';
import { useStore, getActiveWorkspaceThread, type ApprovalPayload } from './store';
import type { FlagInput } from './memory/types';
import { toolLabel } from './toolLabels';

// SFDC render tools → artifact kind. Lets live (testing-mode) tool calls open
// the rich artifacts, matching what scripted demo flows produce.
const SFDC_RENDER_KIND: Record<string, ArtifactKind> = {
  render_soql_results: 'soql-results',
  render_pipeline_kanban: 'pipeline-kanban',
  render_account_360: 'account-360',
  render_lead_scoring: 'lead-scoring',
  render_forecast: 'forecast',
  render_dashboard_tiles: 'dashboard-tiles',
  render_case_sla: 'case-sla',
  render_activity_timeline: 'activity-timeline',
  render_bulk_update_preview: 'bulk-update-preview',
  render_action_draft: 'action-draft',
  render_comparison: 'comparison',
};

function createSfdcRenderArtifact(kind: ArtifactKind, input: Record<string, unknown>) {
  const { artifactId: _omit, title, ...rest } = input;
  const artId = `art_${kind.replace(/-/g, '_')}`;
  const heading = typeof title === 'string' ? title : kind.replace(/-/g, ' ');
  const artifact = {
    id: artId,
    kind,
    label: heading,
    status: 'draft' as const,
    version: 1,
    createdBy: 'RevOps Agent',
    title: heading,
    dataJson: JSON.stringify(rest),
  };
  const cardTurn: Turn = {
    id: newId('ac'),
    kind: 'artifact-card',
    artifactId: artId,
    title: heading,
    sub: 'GENERATED',
    meta: '',
    icon: '◫',
  };
  useStore.getState().createArtifactFromEvent(artId, artifact, cardTurn);
}

type HistoryTurn = { role: 'user' | 'assistant'; text: string };

function formatErrorText(message: string): string {
  const low = message.toLowerCase();
  if (low.includes('api key not set') || low.includes('api key') && low.includes('not')) {
    return `⚠ **${message}**\n\nOpen **Settings** (gear icon in the left rail) and paste a key — or switch models via the picker next to the Send button.`;
  }
  return `⚠ **Error:** ${message}`;
}

function buildHistory(turns: Turn[], maxTurns = 10): HistoryTurn[] {
  const out: HistoryTurn[] = [];
  for (const t of turns) {
    if (t.kind === 'user') out.push({ role: 'user', text: t.text });
    else if (t.kind === 'agent') {
      // Skip the welcome turn and empty-streaming placeholders.
      if ((t as any).welcome) continue;
      const text = t.text?.trim();
      if (text) out.push({ role: 'assistant', text });
    }
  }
  return out.slice(-maxTurns);
}

export type ForcedArtifact = {
  forcedKind?: ArtifactKind;
  requirements?: string[];
  /** Slash-command name for transcript display ("/ap show overdue") and the
   *  requirements-block system prompt. Omitted when forcedKind comes from the
   *  composer modality picker (no slash). */
  commandName?: string;
  shortcutAllowedTools?: string[];
  shortcutSystemPrompt?: string;
};

// ─── Approval submission helpers ──────────────────────────────────────

type SubmitContext = {
  mode: 'demo' | 'testing';
  payload: ApprovalPayload | undefined;
};

function getSubmitContext(batchId: string): SubmitContext {
  const s = useStore.getState();
  const wsThread = getActiveWorkspaceThread();
  return {
    mode: s.mode,
    payload: wsThread?.approvalPayloads?.[batchId],
  };
}

function getApprovalActions(s: ReturnType<typeof useStore.getState>) {
  return {
    addTurn: s.addTurnToActiveWorkspaceThread,
    setApproval: s.setApprovalInActiveWorkspaceThread,
  };
}

export async function handleApprove(batchId: string) {
  const ctx = getSubmitContext(batchId);
  const s = useStore.getState();
  const { addTurn, setApproval } = getApprovalActions(s);

  if (!ctx.payload) {
    addTurn({
      id: newId('a'),
      kind: 'agent',
      text: 'Approved — but the staged payload was lost. Please re-stage the batch.',
    });
    return;
  }

  setApproval(batchId, 'submitting');

  try {
    // Step 1: mint a server-signed approval token.
    const requiresDual = ctx.payload?.requiresSecondApprover === true;
    const stake = ctx.payload?.stake ?? 'bulk-update';
    const mintRes = await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        batchId,
        idempotencyKey: `idem_${batchId}`,
        approverId: 'usr_current_session',
        stake,
        ...(requiresDual ? { secondApproverId: 'usr_second_approver' } : {}),
      }),
    });
    if (!mintRes.ok) {
      const errBody = await mintRes.json().catch(() => ({} as any));
      throw new Error(`approval mint failed: ${errBody.error ?? mintRes.statusText}`);
    }
    const mintBody = (await mintRes.json()) as {
      ok: boolean;
      token?: unknown;
      error?: string;
    };
    if (!mintBody.ok || !mintBody.token) {
      throw new Error(`approval mint failed: ${mintBody.error ?? 'unknown'}`);
    }

    // Step 2: submit the batch with the token. The dispatcher's gate verifies
    // the signature, expiry, batchId match, and dual-control claim, then
    // redeems the nonce.
    const res = await fetch('/api/dryrun', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tool: 'submit_approved_sfdc_batch',
        input: { batchId, approvalToken: mintBody.token },
        mode: ctx.mode,
        allowInternal: true,
      }),
    });
    if (!res.ok) {
      throw new Error(`submit request failed (${res.status})`);
    }
    const body = (await res.json()) as {
      ok: boolean;
      summary: string;
      data: { applied?: number; batchId?: string } | null;
    };
    if (!body.ok) {
      throw new Error(body.summary || 'submission rejected');
    }

    const applied = body.data?.applied ?? ctx.payload.recordCount;

    setApproval(batchId, 'approved');
    addTurn({
      id: newId('a'),
      kind: 'agent',
      text: 'Approved. Applying the staged batch to Salesforce.',
    });
    addTurn({
      id: newId('tl'),
      kind: 'tools',
      rows: [
        {
          verb: 'POST',
          path: '/services/data/v60.0/composite/sobjects/Opportunity',
          filter: `batchId=${batchId}`,
          status: '200',
          result: `applied ${applied} records`,
        },
      ],
    });
    addTurn({
      id: newId('a'),
      kind: 'agent',
      text: `**Batch ${batchId} applied.** ${applied} record${applied === 1 ? '' : 's'} updated in Salesforce.`,
    });
  } catch (err: any) {
    setApproval(batchId, 'pending');
    addTurn({
      id: newId('a'),
      kind: 'agent',
      text: `Submission failed: ${err?.message ?? 'unknown error'} — you can retry approve or cancel.`,
    });
  }
}

export function handleReject(batchId: string) {
  const s = useStore.getState();
  const { addTurn, setApproval } = getApprovalActions(s);

  setApproval(batchId, 'rejected');
  addTurn({
    id: newId('a'),
    kind: 'agent',
    text: 'Batch cancelled — nothing was submitted to Salesforce.',
  });
}

// ─── Form question answer ────────────────────────────────────────────────
export function handleFormAnswer(
  turnId: string,
  selected: string[],
  labels: string[],
  freeText: string
) {
  const s = useStore.getState();

  const patch = { answered: true, selected, freeTextValue: freeText };
  s.updateTurnInActiveWorkspaceThread(turnId, patch as any);

  const parts = labels.filter(Boolean);
  let submission: string;
  if (freeText.trim() && parts.length) {
    submission = `${parts.join(', ')} — also: ${freeText.trim()}`;
  } else if (freeText.trim()) {
    submission = freeText.trim();
  } else {
    submission = parts.join(', ');
  }

  void runLLM(submission);
}

// ─── Free-text LLM path ─────────────────────────────────────────────────
//
// Always writes turns/artifacts/approvals into the active workspace thread.
// In `testing` mode, the active thread's `billEnvId`/`billProduct` are sent
// to /api/chat so the backend hits a real Bill sandbox; if no env is picked,
// we short-circuit with an inline prompt to choose one in the rail.
export async function runLLM(userText: string, opts?: ForcedArtifact) {
  const s = useStore.getState();
  if (s.streaming) return;

  const wsThread = getActiveWorkspaceThread();
  if (!wsThread) return;

  const displayText = opts?.commandName
    ? `/${opts.commandName}${userText ? ' ' + userText : ''}`
    : userText;

  const history = buildHistory(wsThread.turns);
  s.addTurnToActiveWorkspaceThread({ id: newId('u'), kind: 'user', text: displayText });
  s.setStreaming(true);

  // Phase-aware turn ids: text and tool-call runs alternate, so we close the
  // current text turn when a tool call interrupts it (and vice versa). This keeps
  // the conversation in true chronological order instead of merging every text
  // chunk into a single turn at the top.
  let agentId: string | null = null;
  let acc = '';
  let toolsTurnId: string | null = null;
  let toolRows: ToolRowSpec[] = [];
  const toolRowIndex: Record<string, number> = {};

  // RAF-throttle for streaming text updates: caps store mutations at the display
  // refresh rate so a fast-streaming model doesn't overwhelm React reconciliation.
  let rafHandle: number | null = null;
  let pendingText = '';
  const flushText = () => {
    rafHandle = null;
    if (!agentId) return;
    useStore.getState().updateTurnInActiveWorkspaceThread(agentId, {
      text: pendingText,
      streaming: true,
    });
  };
  const scheduleText = () => {
    if (rafHandle !== null) return;
    if (typeof requestAnimationFrame !== 'undefined') {
      rafHandle = requestAnimationFrame(flushText);
    } else {
      // SSR/no-DOM fallback (should never hit in browser)
      rafHandle = setTimeout(flushText, 16) as unknown as number;
    }
  };
  // Called before any terminal text write (done/error/form-question) so a deferred
  // RAF can't clobber the final state with streaming: true.
  const cancelPendingText = () => {
    if (rafHandle === null) return;
    if (typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafHandle);
    } else {
      clearTimeout(rafHandle);
    }
    rafHandle = null;
  };

  currentAbort = new AbortController();
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: currentAbort.signal,
      body: JSON.stringify({
        model: s.tweaks.modelId,
        userMessage: userText,
        history,
        memory: s.flaggedMemory,
        mode: 'testing',
        ...(opts ? {
          forcedKind: opts.forcedKind,
          requirements: opts.requirements,
          commandName: opts.commandName,
          shortcutAllowedTools: opts.shortcutAllowedTools,
          shortcutSystemPrompt: opts.shortcutSystemPrompt,
        } : {}),
      }),
    });
    if (!res.ok || !res.body) throw new Error('chat request failed');
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (!json) continue;
        let ev: any;
        try { ev = JSON.parse(json); } catch { continue; }
        if (ev.type === 'text') {
          if (!agentId) {
            agentId = newId('a');
            useStore.getState().addTurnToActiveWorkspaceThread({
              id: agentId, kind: 'agent', text: '', streaming: true,
            });
            acc = '';
            toolsTurnId = null;
          }
          acc += ev.text;
          pendingText = acc;
          scheduleText();
        } else if (ev.type === 'tool-call') {
          if (agentId) {
            cancelPendingText();
            useStore.getState().updateTurnInActiveWorkspaceThread(agentId, {
              text: acc, streaming: false,
            });
            agentId = null;
            acc = '';
          }
          const row: ToolRowSpec = {
            verb: 'EXEC',
            path: toolLabel(ev.name),
            filter: JSON.stringify(ev.input),
            status: '…',
            result: 'running',
            tool: ev.name,
          };
          if (toolsTurnId == null) {
            toolsTurnId = newId('tl');
            toolRows = [row];
            toolRowIndex[ev.id] = 0;
            useStore.getState().addTurnToActiveWorkspaceThread({
              id: toolsTurnId,
              kind: 'tools',
              rows: toolRows,
              pending: 0,
            });
          } else {
            toolRowIndex[ev.id] = toolRows.length;
            toolRows = [...toolRows, row];
            useStore.getState().updateTurnInActiveWorkspaceThread(toolsTurnId, { rows: toolRows } as Partial<Turn>);
          }
        } else if (ev.type === 'tool-result') {
          const idx = toolRowIndex[ev.id];
          if (toolsTurnId && idx != null) {
            toolRows = toolRows.map((r, i) =>
              i === idx ? { ...r, status: ev.ok ? 'ok' : 'err', result: ev.summary } : r,
            );
            useStore.getState().updateTurnInActiveWorkspaceThread(toolsTurnId, { rows: toolRows } as Partial<Turn>);
          }
          // Inline data-table: append a separate turn so the user sees the rows
          // directly under the tool row, without the model needing to re-list them.
          if (ev.ok && Array.isArray(ev.data) && ev.data.length > 0) {
            useStore.getState().addTurnToActiveWorkspaceThread({
              id: newId('dt'),
              kind: 'data-table',
              toolName: ev.name,
              rows: ev.data,
              truncated: ev.dataTruncated === true,
            });
          }
          // Flagged-record memory: persist the records the agent flagged.
          if (ev.ok && ev.name === 'flag_records') {
            const recs = (ev as { input?: { records?: FlagInput[] } }).input?.records;
            if (Array.isArray(recs) && recs.length > 0) {
              useStore.getState().flagRecords(recs);
            }
          }
          // SFDC render tools (testing mode): open the rich artifact inline.
          if (ev.ok && SFDC_RENDER_KIND[ev.name]) {
            const inp = (ev as { input?: Record<string, unknown> }).input;
            if (inp) createSfdcRenderArtifact(SFDC_RENDER_KIND[ev.name], inp);
          }
          // Structured plan: render a checkpoint turn at the top of the work.
          if (ev.ok && ev.name === 'plan') {
            const inp = (ev as { input?: { goal?: string; steps?: { title: string; detail?: string }[] } }).input;
            if (inp && Array.isArray(inp.steps) && inp.steps.length > 0) {
              useStore.getState().addTurnToActiveWorkspaceThread({
                id: newId('pl'), kind: 'plan', goal: inp.goal, steps: inp.steps,
              });
            }
          }
        } else if (ev.type === 'tool-error') {
          const idx = toolRowIndex[ev.id];
          if (toolsTurnId && idx != null) {
            toolRows = toolRows.map((r, i) =>
              i === idx ? { ...r, status: 'err', result: ev.summary } : r,
            );
            useStore.getState().updateTurnInActiveWorkspaceThread(toolsTurnId, { rows: toolRows } as Partial<Turn>);
          }
        } else if (ev.type === 'artifact') {
          const artId = ev.kind === 'custom-dashboard'
            ? `art_cdash_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
            : `art_${ev.kind.replace('-', '_')}`;
          const artifact = {
            id: artId,
            kind: ev.kind,
            label: ev.label ?? ev.kind,
            status: 'draft' as const,
            version: 1,
            createdBy: 'Coworker',
            ...(ev.title ? { title: ev.title } : {}),
            ...(ev.html ? { html: ev.html } : {}),
            ...(ev.css ? { css: ev.css } : {}),
            ...(ev.script ? { script: ev.script } : {}),
            ...(ev.dataJson ? { dataJson: ev.dataJson } : {}),
          };
          const cardTurn: Turn = {
            id: newId('ac'),
            kind: 'artifact-card',
            artifactId: artId,
            title: ev.title ?? ev.label ?? 'Artifact',
            sub: (ev.sub ?? 'GENERATED').toUpperCase(),
            meta: ev.meta ?? '',
            icon: ev.icon ?? '◫',
          };
          // Single batched mutation: artifact + activeArtifact + card turn.
          useStore.getState().createArtifactFromEvent(artId, artifact, cardTurn);
        } else if (ev.type === 'approval') {
          const payload = ev.payload as ApprovalPayload;
          useStore.getState().setApprovalPayloadInActiveWorkspaceThread(payload.batchId, payload);
          useStore.getState().addTurnToActiveWorkspaceThread({
            id: newId('ap'),
            kind: 'approval',
            payload,
            simulated: ev.simulated === true,
          });
          // Auto mode (PRD §7.2): pre-authorize non-mass-action batches without a
          // per-item click. Dual-control (mass-action) always still prompts.
          const st = useStore.getState();
          const gated = (payload as { stake?: string }).stake === 'mass-action'
            || (payload as { requiresSecondApprover?: boolean }).requiresSecondApprover === true;
          if (st.execMode === 'auto' && !gated) {
            void handleApprove(payload.batchId);
          }
        } else if (ev.type === 'form-question') {
          cancelPendingText();
          if (agentId) {
            useStore.getState().updateTurnInActiveWorkspaceThread(agentId, { text: acc, streaming: false });
            agentId = null;
            acc = '';
          }
          useStore.getState().addTurnToActiveWorkspaceThread({
            id: newId('fq'),
            kind: 'form-question',
            question: ev.question,
            options: ev.options,
            multiSelect: ev.multiSelect,
            freeText: ev.freeText,
          });
        } else if (ev.type === 'artifact-offer') {
          cancelPendingText();
          if (agentId) {
            useStore.getState().updateTurnInActiveWorkspaceThread(agentId, { text: acc, streaming: false });
            agentId = null;
            acc = '';
          }
          useStore.getState().addTurnToActiveWorkspaceThread({
            id: newId('ao'),
            kind: 'artifact-offer',
            summary: ev.summary,
            question: ev.question,
            kinds: ev.kinds as ArtifactKind[],
          });
        } else if (ev.type === 'usage') {
          useStore.getState().recordUsage({
            ts: Date.now(),
            model: ev.model,
            inputTokens: ev.inputTokens ?? 0,
            outputTokens: ev.outputTokens ?? 0,
            durationMs: ev.durationMs ?? 0,
          });
        } else if (ev.type === 'done') {
          cancelPendingText();
          const finalText = acc || ev.text || '';
          if (agentId) {
            useStore.getState().updateTurnInActiveWorkspaceThread(agentId, { text: finalText, streaming: false });
          } else if (finalText) {
            useStore.getState().addTurnToActiveWorkspaceThread({
              id: newId('a'), kind: 'agent', text: finalText, streaming: false,
            });
          }
        } else if (ev.type === 'error') {
          cancelPendingText();
          const errText = formatErrorText(ev.message);
          if (agentId) {
            useStore.getState().updateTurnInActiveWorkspaceThread(agentId, {
              text: (acc ? acc + '\n\n' : '') + errText,
              streaming: false,
            });
          } else {
            useStore.getState().addTurnToActiveWorkspaceThread({
              id: newId('a'), kind: 'agent', text: errText, streaming: false,
            });
          }
        }
      }
    }
  } catch (e: any) {
    cancelPendingText();
    const msg = e?.name === 'AbortError'
      // User terminated the session (PRD §7.13). Persist what we have.
      ? '_Session stopped by user._'
      : `_Couldn't reach the model. ${e?.message ?? 'unknown error'}. Set ANTHROPIC_API_KEY / GEMINI_API_KEY in .env.local and restart._`;
    if (agentId) {
      useStore.getState().updateTurnInActiveWorkspaceThread(agentId, {
        text: (acc ? acc + '\n\n' : '') + msg,
        streaming: false,
      });
    } else {
      useStore.getState().addTurnToActiveWorkspaceThread({
        id: newId('a'), kind: 'agent', text: msg, streaming: false,
      });
    }
  } finally {
    cancelPendingText();
    currentAbort = null;
    useStore.getState().setStreaming(false);
  }
}

// Active request controller so the user can terminate a running session.
let currentAbort: AbortController | null = null;

/** Terminate the in-flight session (PRD §7.13). */
export function stopLLM() {
  currentAbort?.abort();
}
