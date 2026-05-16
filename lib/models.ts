export type ModelId = string;
export type Provider = 'anthropic' | 'gemini' | 'llmgateway';
export type ModelEntry = { id: ModelId; provider: Provider; label: string; sub: string };

// Gateway-routed models carry an `llmgateway/` prefix on the internal id so
// providerOf() can distinguish them from direct Anthropic/Gemini calls even
// when the underlying model name overlaps (e.g. claude-sonnet-4-5). The prefix
// is stripped by gatewayRemoteModelId() before the request is sent.
export const LLM_GATEWAY_PREFIX = 'llmgateway/';
export const LLM_GATEWAY_BASE_URL = 'https://api.llmgateway.io/v1';

export const MODELS: ModelEntry[] = [
  { id: 'claude-opus-4-5', provider: 'anthropic', label: 'opus 4.5', sub: 'Anthropic · highest reasoning' },
  { id: 'claude-sonnet-4-5', provider: 'anthropic', label: 'sonnet 4.5', sub: 'Anthropic · balanced (default)' },
  { id: 'claude-haiku-4-5', provider: 'anthropic', label: 'haiku 4.5', sub: 'Anthropic · fastest' },
  { id: 'gemini-2.5-pro', provider: 'gemini', label: 'gemini 2.5 pro', sub: 'Google · highest reasoning' },
  { id: 'gemini-2.5-flash', provider: 'gemini', label: 'gemini 2.5 flash', sub: 'Google · fastest' },
  { id: 'llmgateway/auto', provider: 'llmgateway', label: 'auto', sub: 'Gateway · smart routing' },
  { id: 'llmgateway/openai/gpt-5', provider: 'llmgateway', label: 'gpt-5', sub: 'OpenAI · highest reasoning' },
  { id: 'llmgateway/openai/gpt-5-mini', provider: 'llmgateway', label: 'gpt-5 mini', sub: 'OpenAI · balanced' },
  { id: 'llmgateway/openai/gpt-5-nano', provider: 'llmgateway', label: 'gpt-5 nano', sub: 'OpenAI · fastest' },
  { id: 'llmgateway/openai/gpt-4o', provider: 'llmgateway', label: 'gpt-4o', sub: 'OpenAI · multimodal' },
  { id: 'llmgateway/anthropic/claude-opus-4-5', provider: 'llmgateway', label: 'opus 4.5 (gw)', sub: 'Anthropic · via gateway' },
  { id: 'llmgateway/anthropic/claude-sonnet-4-5', provider: 'llmgateway', label: 'sonnet 4.5 (gw)', sub: 'Anthropic · via gateway' },
  { id: 'llmgateway/google/gemini-2.5-pro', provider: 'llmgateway', label: 'gemini 2.5 pro (gw)', sub: 'Google · via gateway' },
  { id: 'llmgateway/google/gemini-2.5-flash', provider: 'llmgateway', label: 'gemini 2.5 flash (gw)', sub: 'Google · via gateway' },
  { id: 'llmgateway/moonshotai/kimi-k2', provider: 'llmgateway', label: 'kimi k2', sub: 'Moonshot · open · tools' },
  { id: 'llmgateway/qwen/qwen3-coder', provider: 'llmgateway', label: 'qwen 3 coder', sub: 'Alibaba · open · coding' },
];

export const DEFAULT_MODEL_ID: ModelId = 'claude-sonnet-4-5';

export function getModel(id: ModelId): ModelEntry | undefined {
  return MODELS.find(m => m.id === id);
}

export function providerOf(id: ModelId): Provider {
  return getModel(id)?.provider ?? 'anthropic';
}

export function firstModelForProvider(provider: Provider): ModelId | undefined {
  return MODELS.find(m => m.provider === provider)?.id;
}

/** Strip the `llmgateway/` prefix to get the model id the gateway expects on the wire. */
export function gatewayRemoteModelId(id: ModelId): string {
  return id.startsWith(LLM_GATEWAY_PREFIX) ? id.slice(LLM_GATEWAY_PREFIX.length) : id;
}

// Approximate USD cost per 1M tokens. Provider list prices change — these are
// for the in-app speedometer only, not billing. Gateway entries reflect the
// upstream provider's list price; LLM Gateway adds a small routing markup
// that we don't model here.
export const MODEL_COST_PER_1M: Record<ModelId, { input: number; output: number }> = {
  'claude-opus-4-5':   { input: 15,   output: 75 },
  'claude-sonnet-4-5': { input: 3,    output: 15 },
  'claude-haiku-4-5':  { input: 0.80, output: 4 },
  'gemini-2.5-pro':    { input: 1.25, output: 10 },
  'gemini-2.5-flash':  { input: 0.15, output: 0.60 },
  'llmgateway/auto':                           { input: 1,    output: 5 },
  'llmgateway/openai/gpt-5':                   { input: 5,    output: 15 },
  'llmgateway/openai/gpt-5-mini':              { input: 0.50, output: 2 },
  'llmgateway/openai/gpt-5-nano':              { input: 0.10, output: 0.40 },
  'llmgateway/openai/gpt-4o':                  { input: 2.50, output: 10 },
  'llmgateway/anthropic/claude-opus-4-5':      { input: 15,   output: 75 },
  'llmgateway/anthropic/claude-sonnet-4-5':    { input: 3,    output: 15 },
  'llmgateway/google/gemini-2.5-pro':          { input: 1.25, output: 10 },
  'llmgateway/google/gemini-2.5-flash':        { input: 0.15, output: 0.60 },
  'llmgateway/moonshotai/kimi-k2':             { input: 0.60, output: 2.50 },
  'llmgateway/qwen/qwen3-coder':               { input: 0.40, output: 1.60 },
};

export function estimateCostUsd(modelId: ModelId, inputTokens: number, outputTokens: number): number {
  const rates = MODEL_COST_PER_1M[modelId];
  if (!rates) return 0;
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}
