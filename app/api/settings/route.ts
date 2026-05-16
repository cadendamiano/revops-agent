import { NextRequest } from 'next/server';
import {
  readSecrets,
  writeSecrets,
  toMaskedView,
  newEnvironmentId,
  type BillEnvironment,
  type Secrets,
} from '@/lib/secrets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type IncomingBillEnv = {
  id?: string;
  name?: string;
  devKey?: string;
  username?: string;
  password?: string;
  orgId?: string;
  product?: 'ap' | 'se' | 'both';
  seClientId?: string;
  seClientSecret?: string;
};

type IncomingPatch = {
  anthropicApiKey?: string | null;
  geminiApiKey?: string | null;
  llmgatewayApiKey?: string | null;
  billEnvironments?: IncomingBillEnv[];
  braintrustApiKey?: string | null;
  braintrustOrgName?: string | null;
  braintrustProjectName?: string | null;
  braintrustEnabled?: boolean;
  disabledTools?: string[];
  systemPromptOverrideDemo?: string | null;
  systemPromptOverrideTesting?: string | null;
};

export async function GET() {
  const current = await readSecrets();
  return Response.json(toMaskedView(current));
}

export async function POST(req: NextRequest) {
  let patch: IncomingPatch;
  try {
    patch = (await req.json()) as IncomingPatch;
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  const current = await readSecrets();
  const next: Secrets = {
    anthropicApiKey: current.anthropicApiKey,
    geminiApiKey: current.geminiApiKey,
    llmgatewayApiKey: current.llmgatewayApiKey,
    billEnvironments: [...current.billEnvironments],
    braintrustApiKey: current.braintrustApiKey,
    braintrustOrgName: current.braintrustOrgName,
    braintrustProjectName: current.braintrustProjectName,
    braintrustEnabled: current.braintrustEnabled,
    disabledTools: current.disabledTools ?? [],
    systemPromptOverrideDemo: current.systemPromptOverrideDemo ?? null,
    systemPromptOverrideTesting: current.systemPromptOverrideTesting ?? null,
  };

  if (patch.anthropicApiKey !== undefined) {
    next.anthropicApiKey = patch.anthropicApiKey ? String(patch.anthropicApiKey) : undefined;
  }
  if (patch.geminiApiKey !== undefined) {
    next.geminiApiKey = patch.geminiApiKey ? String(patch.geminiApiKey) : undefined;
  }
  if (patch.llmgatewayApiKey !== undefined) {
    next.llmgatewayApiKey = patch.llmgatewayApiKey ? String(patch.llmgatewayApiKey) : undefined;
  }
  if (patch.braintrustApiKey !== undefined) {
    next.braintrustApiKey = patch.braintrustApiKey ? String(patch.braintrustApiKey) : undefined;
  }
  if (patch.braintrustOrgName !== undefined) {
    next.braintrustOrgName = patch.braintrustOrgName ? String(patch.braintrustOrgName) : undefined;
  }
  if (patch.braintrustProjectName !== undefined) {
    next.braintrustProjectName = patch.braintrustProjectName ? String(patch.braintrustProjectName) : undefined;
  }
  if (patch.braintrustEnabled !== undefined) {
    next.braintrustEnabled = Boolean(patch.braintrustEnabled);
  }
  if (Array.isArray(patch.disabledTools)) {
    next.disabledTools = patch.disabledTools.filter(t => typeof t === 'string');
  }
  if ('systemPromptOverrideDemo' in patch) {
    next.systemPromptOverrideDemo = patch.systemPromptOverrideDemo
      ? String(patch.systemPromptOverrideDemo)
      : null;
  }
  if ('systemPromptOverrideTesting' in patch) {
    next.systemPromptOverrideTesting = patch.systemPromptOverrideTesting
      ? String(patch.systemPromptOverrideTesting)
      : null;
  }

  if (Array.isArray(patch.billEnvironments)) {
    const byId = new Map(current.billEnvironments.map(e => [e.id, e]));
    const merged: BillEnvironment[] = [];
    for (const incoming of patch.billEnvironments) {
      const prev = incoming.id ? byId.get(incoming.id) : undefined;
      const id = prev?.id ?? newEnvironmentId();
      const incomingProduct = incoming.product;
      const product: 'ap' | 'se' | 'both' =
        incomingProduct === 'se' || incomingProduct === 'both' || incomingProduct === 'ap'
          ? incomingProduct
          : (prev?.product ?? 'ap');
      const seClientId =
        incoming.seClientId !== undefined
          ? (String(incoming.seClientId) || undefined)
          : prev?.seClientId;
      const seClientSecret =
        incoming.seClientSecret !== undefined
          ? (String(incoming.seClientSecret) || undefined)
          : prev?.seClientSecret;
      merged.push({
        id,
        name: String(incoming.name ?? prev?.name ?? '').trim() || 'Sandbox',
        devKey: incoming.devKey !== undefined ? String(incoming.devKey) : (prev?.devKey ?? ''),
        username: incoming.username !== undefined ? String(incoming.username) : (prev?.username ?? ''),
        password: incoming.password !== undefined ? String(incoming.password) : (prev?.password ?? ''),
        orgId: incoming.orgId !== undefined ? String(incoming.orgId) : (prev?.orgId ?? ''),
        product,
        seClientId,
        seClientSecret,
      });
    }
    next.billEnvironments = merged;
  }

  await writeSecrets(next);
  return Response.json(toMaskedView(next));
}
