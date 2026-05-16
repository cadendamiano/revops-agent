import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export type BillProductTag = 'ap' | 'se' | 'both';

export type BillEnvironment = {
  id: string;
  name: string;
  devKey: string;
  username: string;
  password: string;
  orgId: string;
  product: BillProductTag;
  seClientId?: string;
  seClientSecret?: string;
};

export type Secrets = {
  anthropicApiKey?: string;
  geminiApiKey?: string;
  llmgatewayApiKey?: string;
  billEnvironments: BillEnvironment[];
  braintrustApiKey?: string;
  braintrustOrgName?: string;
  braintrustProjectName?: string;
  braintrustEnabled?: boolean;
  disabledTools?: string[];
  systemPromptOverrideDemo?: string | null;
  systemPromptOverrideTesting?: string | null;
};

export type BillEnvironmentMasked = {
  id: string;
  name: string;
  devKey: string;
  username: string;
  orgId: string;
  passwordConfigured: boolean;
  product: BillProductTag;
  seClientId: string;
  seClientSecretConfigured: boolean;
};

export type SecretsMasked = {
  anthropic: { configured: boolean; masked: string };
  gemini: { configured: boolean; masked: string };
  llmgateway: { configured: boolean; masked: string };
  billEnvironments: BillEnvironmentMasked[];
  braintrust: { configured: boolean; masked: string; orgName: string; projectName: string; enabled: boolean };
  disabledTools: string[];
  systemPromptOverrideDemo: string | null;
  systemPromptOverrideTesting: string | null;
};

const SECRETS_PATH = process.env.COWORKER_SECRETS_PATH
  ?? path.join(process.cwd(), '.secrets.local.json');

const EMPTY: Secrets = { billEnvironments: [] };

function normalizeProduct(p: unknown): BillProductTag {
  if (p === 'se' || p === 'both') return p;
  return 'ap';
}

export async function readSecrets(): Promise<Secrets> {
  try {
    const raw = await fs.readFile(SECRETS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<Secrets>;
    const envs = Array.isArray(parsed.billEnvironments) ? parsed.billEnvironments : [];
    return {
      anthropicApiKey: parsed.anthropicApiKey,
      geminiApiKey: parsed.geminiApiKey,
      llmgatewayApiKey: parsed.llmgatewayApiKey,
      braintrustApiKey: parsed.braintrustApiKey,
      braintrustOrgName: parsed.braintrustOrgName,
      braintrustProjectName: parsed.braintrustProjectName,
      braintrustEnabled: parsed.braintrustEnabled ?? false,
      disabledTools: Array.isArray(parsed.disabledTools) ? parsed.disabledTools : [],
      systemPromptOverrideDemo: parsed.systemPromptOverrideDemo ?? null,
      systemPromptOverrideTesting: parsed.systemPromptOverrideTesting ?? null,
      billEnvironments: envs.map(e => ({
        id: String(e.id ?? ''),
        name: String(e.name ?? ''),
        devKey: String(e.devKey ?? ''),
        username: String(e.username ?? ''),
        password: String(e.password ?? ''),
        orgId: String(e.orgId ?? ''),
        product: normalizeProduct((e as any).product),
        seClientId: (e as any).seClientId ? String((e as any).seClientId) : undefined,
        seClientSecret: (e as any).seClientSecret ? String((e as any).seClientSecret) : undefined,
      })),
    };
  } catch (err: any) {
    if (err?.code === 'ENOENT') return { ...EMPTY };
    throw err;
  }
}

export async function writeSecrets(next: Secrets): Promise<void> {
  const serialized = JSON.stringify(next, null, 2);
  await fs.writeFile(SECRETS_PATH, serialized, { encoding: 'utf8', mode: 0o600 });
  try {
    await fs.chmod(SECRETS_PATH, 0o600);
  } catch {
    // best-effort on platforms that reject chmod
  }
}

export async function getAnthropicKey(): Promise<string | undefined> {
  const s = await readSecrets();
  return s.anthropicApiKey || process.env.ANTHROPIC_API_KEY || undefined;
}

export async function getGeminiKey(): Promise<string | undefined> {
  const s = await readSecrets();
  return s.geminiApiKey || process.env.GEMINI_API_KEY || undefined;
}

export async function getLLMGatewayKey(): Promise<string | undefined> {
  const s = await readSecrets();
  return s.llmgatewayApiKey || process.env.LLM_GATEWAY_API_KEY || undefined;
}

export async function getBillEnvironment(id: string): Promise<BillEnvironment | undefined> {
  const s = await readSecrets();
  return s.billEnvironments.find(e => e.id === id);
}

export function maskSecret(value: string | undefined): string {
  if (!value) return '';
  const tail = value.slice(-4);
  return `••••${tail}`;
}

export function toMaskedView(s: Secrets): SecretsMasked {
  return {
    anthropic: {
      configured: Boolean(s.anthropicApiKey),
      masked: maskSecret(s.anthropicApiKey),
    },
    gemini: {
      configured: Boolean(s.geminiApiKey),
      masked: maskSecret(s.geminiApiKey),
    },
    llmgateway: {
      configured: Boolean(s.llmgatewayApiKey),
      masked: maskSecret(s.llmgatewayApiKey),
    },
    braintrust: {
      configured: Boolean(s.braintrustApiKey),
      masked: maskSecret(s.braintrustApiKey),
      orgName: s.braintrustOrgName ?? '',
      projectName: s.braintrustProjectName ?? '',
      enabled: s.braintrustEnabled ?? false,
    },
    disabledTools: s.disabledTools ?? [],
    systemPromptOverrideDemo: s.systemPromptOverrideDemo ?? null,
    systemPromptOverrideTesting: s.systemPromptOverrideTesting ?? null,
    billEnvironments: s.billEnvironments.map(e => ({
      id: e.id,
      name: e.name,
      devKey: maskSecret(e.devKey),
      username: e.username,
      orgId: e.orgId,
      passwordConfigured: Boolean(e.password),
      product: e.product,
      seClientId: e.seClientId ?? '',
      seClientSecretConfigured: Boolean(e.seClientSecret),
    })),
  };
}

export function newEnvironmentId(): string {
  return `env_${randomBytes(6).toString('hex')}`;
}
