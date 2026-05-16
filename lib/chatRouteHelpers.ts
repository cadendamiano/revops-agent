import { Type } from '@google/genai';
import type { FlowStep } from './flows';

export type ApprovalPayload = Extract<FlowStep, { kind: 'approval' }>['payload'];

export type Event =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; id: string; name: string; input: any }
  | {
      type: 'tool-result';
      id: string;
      name: string;
      input: any;
      ok: boolean;
      summary: string;
      /** Optional row payload for inline data-table rendering. Only attached
       *  for `list_*` tools whose result is an array of records. */
      data?: unknown[];
      /** True when the row payload was clipped to fit the SSE budget. */
      dataTruncated?: boolean;
    }
  | {
      type: 'tool-error';
      id: string;
      name: string;
      input: any;
      code: 'E_SCHEMA' | 'E_NO_APPROVAL' | 'E_DUAL_CONTROL_REQUIRED' | 'E_NONCE_USED' | 'E_IDEMPOTENCY';
      summary: string;
    }
  | {
      type: 'artifact';
      kind: string;
      title?: string;
      sub?: string;
      meta?: string;
      label?: string;
      icon?: string;
      html?: string;
      css?: string;
      script?: string;
      dataJson?: string;
    }
  | { type: 'approval'; payload: ApprovalPayload; simulated: boolean }
  | {
      type: 'form-question';
      id: string;
      question: string;
      options: { id: string; label: string; description?: string }[];
      multiSelect: boolean;
      freeText: boolean;
    }
  | {
      type: 'artifact-offer';
      id: string;
      summary?: string;
      question?: string;
      kinds: string[];
    }
  | {
      type: 'usage';
      model: string;
      inputTokens?: number;
      outputTokens?: number;
      durationMs: number;
    }
  | { type: 'done' }
  | { type: 'error'; message: string };

export type ChatHistoryTurn = { role: 'user' | 'assistant'; text: string };

export function sseEncode(ev: Event): string {
  return `data: ${JSON.stringify(ev)}\n\n`;
}

export function jsonSchemaToGemini(s: any): any {
  if (!s || typeof s !== 'object') return s;
  const out: any = {};
  if (s.type === 'object') {
    out.type = Type.OBJECT;
    out.properties = {};
    for (const [k, v] of Object.entries(s.properties ?? {})) {
      out.properties[k] = jsonSchemaToGemini(v);
    }
    if (s.required) out.required = s.required;
  } else if (s.type === 'string') {
    out.type = Type.STRING;
    if (s.enum) out.enum = s.enum;
    if (s.description) out.description = s.description;
  } else if (s.type === 'integer') {
    out.type = Type.INTEGER;
    if (s.description) out.description = s.description;
  } else if (s.type === 'number') {
    out.type = Type.NUMBER;
  } else if (s.type === 'boolean') {
    out.type = Type.BOOLEAN;
  } else if (s.type === 'array') {
    out.type = Type.ARRAY;
    if (s.items) out.items = jsonSchemaToGemini(s.items);
  }
  if (s.description && !out.description) out.description = s.description;
  return out;
}
