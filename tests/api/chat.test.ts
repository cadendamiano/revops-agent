import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sseEncode, jsonSchemaToGemini } from '@/lib/chatRouteHelpers';
import { Type } from '@google/genai';

// ─── sseEncode ────────────────────────────────────────────────────────────────

describe('sseEncode', () => {
  it('wraps the event as a data: line ending with double newline', () => {
    const result = sseEncode({ type: 'done' });
    expect(result).toBe('data: {"type":"done"}\n\n');
  });

  it('serialises a text event', () => {
    const result = sseEncode({ type: 'text', text: 'hello' });
    expect(result).toMatch(/^data: /);
    const parsed = JSON.parse(result.slice(6).trim());
    expect(parsed).toEqual({ type: 'text', text: 'hello' });
  });

  it('serialises an error event', () => {
    const result = sseEncode({ type: 'error', message: 'something went wrong' });
    const parsed = JSON.parse(result.slice(6).trim());
    expect(parsed.type).toBe('error');
    expect(parsed.message).toBe('something went wrong');
  });

  it('serialises a tool-call event with nested objects', () => {
    const event = {
      type: 'tool-call' as const,
      id: 'tc_1',
      name: 'list_bills',
      input: { status: 'overdue' },
    };
    const result = sseEncode(event);
    const parsed = JSON.parse(result.slice(6).trim());
    expect(parsed.input).toEqual({ status: 'overdue' });
  });

  it('always ends with \\n\\n', () => {
    const result = sseEncode({ type: 'done' });
    expect(result.endsWith('\n\n')).toBe(true);
  });

  it('serialises a custom-dashboard artifact event preserving html/script/dataJson', () => {
    const result = sseEncode({
      type: 'artifact' as const,
      kind: 'custom-dashboard',
      title: 'Q1 treemap',
      sub: 'CHART · TREEMAP',
      meta: '6 buckets · $112k',
      label: 'Q1 treemap',
      html: '<div id="viz"></div>',
      css: '#viz { height: 320px; }',
      script: 'echarts.init(document.getElementById("viz")).setOption({});',
      dataJson: '[{"cat":"Professional","amount":40500}]',
    });
    const parsed = JSON.parse(result.slice(6).trim());
    expect(parsed.type).toBe('artifact');
    expect(parsed.kind).toBe('custom-dashboard');
    expect(parsed.html).toBe('<div id="viz"></div>');
    expect(parsed.css).toBe('#viz { height: 320px; }');
    expect(parsed.script).toContain('echarts.init');
    expect(parsed.dataJson).toBe('[{"cat":"Professional","amount":40500}]');
  });

  it('serialises an approval event with payload and simulated flag', () => {
    const result = sseEncode({
      type: 'approval' as const,
      payload: {
        batchId: 'btch_1',
        stake: 'bulk-update',
        title: 'Update NextStep on 3 opps',
        summary: 'Hygiene update for stale opportunities.',
        recordCount: 3,
        preview: [
          { id: '006N0001', name: 'Northwind - Renewal', currentValue: '', newValue: 'Confirm renewal' },
        ],
        requiresSecondApprover: false,
      },
      simulated: true,
    });
    const parsed = JSON.parse(result.slice(6).trim());
    expect(parsed.type).toBe('approval');
    expect(parsed.payload.batchId).toBe('btch_1');
    expect(parsed.simulated).toBe(true);
  });
});

// ─── jsonSchemaToGemini ───────────────────────────────────────────────────────

describe('jsonSchemaToGemini', () => {
  it('converts a string type', () => {
    const result = jsonSchemaToGemini({ type: 'string' });
    expect(result.type).toBe(Type.STRING);
  });

  it('preserves enum on string type', () => {
    const result = jsonSchemaToGemini({ type: 'string', enum: ['a', 'b'] });
    expect(result.enum).toEqual(['a', 'b']);
  });

  it('preserves description on string type', () => {
    const result = jsonSchemaToGemini({ type: 'string', description: 'A field' });
    expect(result.description).toBe('A field');
  });

  it('converts an integer type', () => {
    const result = jsonSchemaToGemini({ type: 'integer' });
    expect(result.type).toBe(Type.INTEGER);
  });

  it('converts a boolean type', () => {
    const result = jsonSchemaToGemini({ type: 'boolean' });
    expect(result.type).toBe(Type.BOOLEAN);
  });

  it('converts a number type', () => {
    const result = jsonSchemaToGemini({ type: 'number' });
    expect(result.type).toBe(Type.NUMBER);
  });

  it('converts an array type and recurses into items', () => {
    const result = jsonSchemaToGemini({ type: 'array', items: { type: 'string' } });
    expect(result.type).toBe(Type.ARRAY);
    expect(result.items.type).toBe(Type.STRING);
  });

  it('converts an object type and recurses into properties', () => {
    const schema = {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'closed'] },
        count: { type: 'integer' },
      },
      required: ['status'],
    };
    const result = jsonSchemaToGemini(schema);
    expect(result.type).toBe(Type.OBJECT);
    expect(result.properties.status.type).toBe(Type.STRING);
    expect(result.properties.status.enum).toEqual(['open', 'closed']);
    expect(result.properties.count.type).toBe(Type.INTEGER);
    expect(result.required).toEqual(['status']);
  });

  it('falls back gracefully for null or non-object input', () => {
    expect(jsonSchemaToGemini(null)).toBeNull();
    expect(jsonSchemaToGemini('string')).toBe('string');
  });

  it('propagates top-level description when not set by type handling', () => {
    const result = jsonSchemaToGemini({ type: 'integer', description: 'count of days' });
    expect(result.description).toBe('count of days');
  });
});

// ─── POST handler ─────────────────────────────────────────────────────────────

// Hermetic: ignore any on-disk .secrets.local.json so tests don't depend on the
// developer's local keys.
vi.mock('@/lib/secrets', async () => {
  const actual = await vi.importActual<typeof import('@/lib/secrets')>('@/lib/secrets');
  return {
    ...actual,
    readSecrets: vi.fn(async () => ({
      anthropicApiKey: undefined,
      geminiApiKey: undefined,
      billEnvironments: [],
    })),
    getAnthropicKey: vi.fn(async () => process.env.ANTHROPIC_API_KEY),
    getGeminiKey: vi.fn(async () => process.env.GEMINI_API_KEY),
  };
});

describe('POST handler', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  it('streams an error event when ANTHROPIC_API_KEY is missing', async () => {
    const { POST } = await import('@/app/api/chat/route');
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-sonnet-4-5', userMessage: 'hello' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(req as any);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const text = await response.text();
    const events = text
      .split('\n\n')
      .filter(Boolean)
      .map(line => JSON.parse(line.replace(/^data: /, '')));

    const errorEvent = events.find((e: any) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent.message).toContain('ANTHROPIC_API_KEY');
  });

  it('streams an error event when GEMINI_API_KEY is missing', async () => {
    const { POST } = await import('@/app/api/chat/route');
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ model: 'gemini-2.5-pro', userMessage: 'hello' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(req as any);
    const text = await response.text();
    const events = text
      .split('\n\n')
      .filter(Boolean)
      .map(line => JSON.parse(line.replace(/^data: /, '')));

    const errorEvent = events.find((e: any) => e.type === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent.message).toContain('GEMINI_API_KEY');
  });

  it('always includes a done event at the end of the stream', async () => {
    const { POST } = await import('@/app/api/chat/route');
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-sonnet-4-5', userMessage: 'hello' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(req as any);
    const text = await response.text();
    const events = text
      .split('\n\n')
      .filter(Boolean)
      .map(line => JSON.parse(line.replace(/^data: /, '')));

    const lastEvent = events[events.length - 1];
    expect(lastEvent.type).toBe('done');
  });

  it('returns correct SSE response headers', async () => {
    const { POST } = await import('@/app/api/chat/route');
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ model: 'claude-sonnet-4-5', userMessage: 'hi' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(req as any);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('cache-control')).toContain('no-cache');
  });
});
