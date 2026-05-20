'use client';

import { FLOWS, LOGISTICS_FLOWS, type ArtifactKind, type Flow, type FlowStep } from './flows';
import { newId, type Turn } from './turns';
import { useStore, getActiveWorkspaceThread, type ApprovalPayload } from './store';
import type { FlagInput } from './memory/types';
import { MODEL_TOOLS, INTERNAL_TOOLS } from './tools';

const ALL_TOOLS = [...MODEL_TOOLS, ...INTERNAL_TOOLS];
function toolLabel(name: string): string {
  return ALL_TOOLS.find(t => t.name === name)?.label ?? name;
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

function speedMult(s: 'fast' | 'normal' | 'slow') {
  if (s === 'fast') return 0.3;
  if (s === 'slow') return 2;
  return 1;
}

export function runFlow(flowId: string) {
  const state = useStore.getState();
  if (state.streaming) return;
  const registry: Record<string, Flow> = FLOWS;
  const flow: Flow | undefined = registry[flowId] ?? (LOGISTICS_FLOWS as Record<string, Flow>)[flowId];
  if (!flow) return;

  state.setStreaming(true);
  const mult = speedMult(state.tweaks.streamSpeed);

  let acc = 0;
  for (const step of flow.steps) {
    const d = (step.delay ?? 300) * mult;
    acc += d;
    setTimeout(() => executeStep(flow, step, mult), acc);
  }
  setTimeout(() => useStore.getState().setStreaming(false), acc + 400);
}

function getFlowActions(s: ReturnType<typeof useStore.getState>) {
  const wsThread = getActiveWorkspaceThread();
  return {
    addTurn: s.addTurnToActiveWorkspaceThread,
    updateTurn: s.updateTurnInActiveWorkspaceThread,
    removeTurnsByKind: s.removeTurnsByKindInActiveWorkspaceThread,
    setArtifacts: s.setArtifactsInActiveWorkspaceThread,
    setApprovalPayload: s.setApprovalPayloadInActiveWorkspaceThread,
    findTurn: (id: string) => wsThread?.turns.find(t => t.id === id),
  };
}

function executeStep(flow: Flow, step: FlowStep, mult: number) {
  const s = useStore.getState();
  const a = getFlowActions(s);
  if (step.kind === 'user') {
    a.addTurn({ id: newId('u'), kind: 'user', text: step.text });
    return;
  }
  if (step.kind === 'agent-stream') {
    const id = newId('a');
    const turn: Turn = { id, kind: 'agent', text: '', streaming: true };
    a.addTurn(turn);
    const words = step.text.split(/(\s+)/);
    let i = 0;
    const iv = setInterval(() => {
      i += 2 + Math.floor(Math.random() * 3);
      const actions = getFlowActions(useStore.getState());
      if (i >= words.length) {
        clearInterval(iv);
        actions.updateTurn(id, { text: step.text, streaming: false });
      } else {
        actions.updateTurn(id, { text: words.slice(0, i).join(''), streaming: true });
      }
    }, 35 * mult);
    return;
  }
  if (step.kind === 'tools') {
    const id = newId('tl');
    a.addTurn({ id, kind: 'tools', rows: [], pending: step.rows.length });
    step.rows.forEach((r, idx) => {
      setTimeout(() => {
        const actions = getFlowActions(useStore.getState());
        const cur = actions.findTurn(id);
        if (!cur || cur.kind !== 'tools') return;
        actions.updateTurn(id, {
          rows: [...cur.rows, r],
          pending: step.rows.length - idx - 1,
        } as Partial<Turn>);
      }, (idx + 1) * 220 * mult);
    });
    return;
  }
  if (step.kind === 'libs') {
    const id = newId('lb');
    a.addTurn({ id, kind: 'libs', items: [], total: step.items.length });
    step.items.forEach((lib, idx) => {
      setTimeout(() => {
        const actions = getFlowActions(useStore.getState());
        const cur = actions.findTurn(id);
        if (!cur || cur.kind !== 'libs') return;
        actions.updateTurn(id, { items: [...cur.items, lib] } as Partial<Turn>);
      }, (idx + 1) * 160 * mult);
    });
    return;
  }
  if (step.kind === 'building') {
    a.addTurn({ id: newId('bl'), kind: 'building', label: step.label, sub: step.sub });
    return;
  }
  if (step.kind === 'artifact-card') {
    a.removeTurnsByKind('building');
    if (flow.artifact) {
      const art = flow.artifact;
      a.setArtifacts(prev => (prev.find(p => p.id === art.id) ? prev : [...prev, {
        ...art,
        status: 'draft' as const,
        version: 1,
        createdBy: 'Coworker',
      }]));
    }
    a.addTurn({
      id: newId('ac'),
      kind: 'artifact-card',
      artifactId: step.artifactId,
      title: step.title,
      sub: step.sub,
      meta: step.meta,
      icon: step.icon,
    });
    return;
  }
  if (step.kind === 'artifact-enrich') {
    a.setArtifacts(prev => {
      const exists = prev.find(a => a.id === step.artifactId);
      if (exists) {
        return prev.map(a => a.id === step.artifactId
          ? { ...a, ...step.patch, version: a.version + 1, editedBy: 'Coworker', editedAt: Date.now() }
          : a);
      }
      return [...prev, {
        id: step.artifactId,
        kind: 'custom-dashboard' as ArtifactKind,
        label: step.patch.label ?? step.artifactId,
        filter: step.patch.filter,
        status: 'draft' as const,
        version: 1,
        createdBy: 'Coworker',
      }];
    });
    return;
  }
  if (step.kind === 'approval') {
    a.addTurn({ id: newId('ap'), kind: 'approval', payload: step.payload });
    a.setApprovalPayload(step.payload.batchId, step.payload);
    return;
  }
  if (step.kind === 'suggest') {
    a.addTurn({ id: newId('sg'), kind: 'suggest', items: step.items });
    return;
  }
}

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

  const agentId = newId('a');
  s.addTurnToActiveWorkspaceThread({ id: agentId, kind: 'agent', text: '', streaming: true });

  let acc = '';
  const toolTurnIds: Record<string, string> = {};

  // RAF-throttle for streaming text updates: caps store mutations at the display
  // refresh rate so a fast-streaming model doesn't overwhelm React reconciliation.
  let rafHandle: number | null = null;
  let pendingText = '';
  const flushText = () => {
    rafHandle = null;
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
        ...(s.mode === 'testing' ? { mode: 'testing' } : {}),
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
          acc += ev.text;
          pendingText = acc;
          scheduleText();
        } else if (ev.type === 'tool-call') {
          const tid = newId('tl');
          toolTurnIds[ev.id] = tid;
          useStore.getState().addTurnToActiveWorkspaceThread({
            id: tid,
            kind: 'tools',
            rows: [{ verb: 'EXEC', path: toolLabel(ev.name), filter: JSON.stringify(ev.input), status: '…', result: 'running' }],
            pending: 0,
          });
        } else if (ev.type === 'tool-result') {
          const tid = toolTurnIds[ev.id];
          if (tid) {
            useStore.getState().updateTurnInActiveWorkspaceThread(tid, {
              rows: [{
                verb: 'EXEC',
                path: toolLabel(ev.name),
                filter: JSON.stringify(ev.input),
                status: ev.ok ? 'ok' : 'err',
                result: ev.summary,
              }],
            } as Partial<Turn>);
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
          const tid = toolTurnIds[ev.id];
          if (tid) {
            useStore.getState().updateTurnInActiveWorkspaceThread(tid, {
              rows: [{
                verb: 'EXEC',
                path: toolLabel(ev.name),
                filter: JSON.stringify(ev.input),
                status: 'err',
                result: ev.summary,
              }],
            } as Partial<Turn>);
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
          useStore.getState().updateTurnInActiveWorkspaceThread(agentId, { text: acc, streaming: false });
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
          useStore.getState().updateTurnInActiveWorkspaceThread(agentId, { text: acc, streaming: false });
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
          useStore.getState().updateTurnInActiveWorkspaceThread(agentId, { text: acc || ev.text || '', streaming: false });
        } else if (ev.type === 'error') {
          cancelPendingText();
          useStore.getState().updateTurnInActiveWorkspaceThread(agentId, {
            text: (acc ? acc + '\n\n' : '') + formatErrorText(ev.message),
            streaming: false,
          });
        }
      }
    }
  } catch (e: any) {
    cancelPendingText();
    if (e?.name === 'AbortError') {
      // User terminated the session (PRD §7.13). Persist what we have.
      useStore.getState().updateTurnInActiveWorkspaceThread(agentId, {
        text: (acc ? acc + '\n\n' : '') + '_Session stopped by user._',
        streaming: false,
      });
    } else {
      useStore.getState().updateTurnInActiveWorkspaceThread(agentId, {
        text: `_Couldn't reach the model. ${e?.message ?? 'unknown error'}. Set ANTHROPIC_API_KEY / GEMINI_API_KEY in .env.local and restart._`,
        streaming: false,
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
