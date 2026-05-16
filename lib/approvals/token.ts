/**
 * Approval-token mint/verify/redeem.
 *
 * The token is the contract that lets submit_payment_batch run. The LLM never
 * mints, holds, or forges one — it only learns that a token is required and
 * passes it through from the UI's workspace state when it calls submit.
 *
 * Crypto: HMAC-SHA256 over a canonical JSON encoding of the claims. The secret
 * lives in `secrets.local.json` as `approvalTokenSecret`; rotated separately
 * from API keys. For unit testing we accept an explicit secret override.
 *
 * Storage: nonces are kept in an in-process Map. Single-process is enough for
 * the prototype; the interface (consumeNonce / hasNonce) is replaceable with
 * a Redis or KV implementation when we move to multi-instance.
 */
import crypto from 'node:crypto';
import { ApprovalClaims, ApprovalToken } from '@/lib/domain/approval';

const DEFAULT_TTL_SECONDS = 15 * 60; // 15 minutes

/**
 * Canonical claim encoding: sort keys recursively so identical claims always
 * hash identically regardless of object construction order.
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

function hmac(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function getSecretFromEnv(): string | null {
  const fromEnv = process.env.APPROVAL_TOKEN_SECRET;
  return fromEnv && fromEnv.length >= 16 ? fromEnv : null;
}

async function getSecret(override?: string): Promise<string> {
  if (override) return override;
  const env = getSecretFromEnv();
  if (env) return env;
  // Fallback to the secrets.local.json file (Electron / dev).
  try {
    const { readSecrets } = await import('@/lib/secrets');
    const s = (await readSecrets()) as Record<string, unknown>;
    const fromFile = s.approvalTokenSecret;
    if (typeof fromFile === 'string' && fromFile.length >= 16) return fromFile;
  } catch {
    // ignore
  }
  throw new Error(
    'approvalTokenSecret missing. Set APPROVAL_TOKEN_SECRET env var or add ' +
    '"approvalTokenSecret" (>=16 chars) to .secrets.local.json.',
  );
}

export type MintArgs = {
  batchId: string;
  idempotencyKey: string;
  approverId: string;
  secondApproverId?: string;
  policyAtIssue: 'auto-approvable' | 'single-approver' | 'requires-dual-control';
  ttlSeconds?: number;
  /** Test override; if provided, bypasses env/file lookup. */
  secretOverride?: string;
};

export async function mintApprovalToken(args: MintArgs) {
  const now = Math.floor(Date.now() / 1000);
  const claims = ApprovalClaims.parse({
    batchId: args.batchId,
    idempotencyKey: args.idempotencyKey,
    approverId: args.approverId,
    secondApproverId: args.secondApproverId,
    issuedAt: now,
    expiresAt: now + (args.ttlSeconds ?? DEFAULT_TTL_SECONDS),
    nonce: crypto.randomBytes(12).toString('hex'),
    policyAtIssue: args.policyAtIssue,
  });
  const secret = await getSecret(args.secretOverride);
  const signature = hmac(secret, canonicalize(claims));
  return ApprovalToken.parse({ claims, signature });
}

export type VerifyArgs = {
  token: unknown;
  /** The batch the token is being used to authorize. */
  expectedBatchId: string;
  /** Idempotency key submitted alongside the token (must match claims.idempotencyKey). */
  expectedIdempotencyKey: string;
  /** Set true if the batch's policy resolved to requires-dual-control. */
  requireDualControl: boolean;
  /** Optional override to substitute time-of-check (testing). */
  now?: number;
  /** Test override; if provided, bypasses env/file lookup. */
  secretOverride?: string;
};

export type VerifyResult =
  | { ok: true; nonce: string }
  | { ok: false; code: 'E_NO_APPROVAL' | 'E_DUAL_CONTROL_REQUIRED' | 'E_NONCE_USED'; reason: string };

export async function verifyApprovalToken(args: VerifyArgs): Promise<VerifyResult> {
  const parsed = ApprovalToken.safeParse(args.token);
  if (!parsed.success) {
    return { ok: false, code: 'E_NO_APPROVAL', reason: 'token missing or malformed' };
  }
  const tok = parsed.data;
  const secret = await getSecret(args.secretOverride);
  const expectedSig = hmac(secret, canonicalize(tok.claims));
  if (!safeEqualHex(expectedSig, tok.signature)) {
    return { ok: false, code: 'E_NO_APPROVAL', reason: 'signature mismatch' };
  }
  const now = args.now ?? Math.floor(Date.now() / 1000);
  if (tok.claims.expiresAt < now) {
    return { ok: false, code: 'E_NO_APPROVAL', reason: 'token expired' };
  }
  if (tok.claims.batchId !== args.expectedBatchId) {
    return { ok: false, code: 'E_NO_APPROVAL', reason: 'batchId mismatch' };
  }
  if (tok.claims.idempotencyKey !== args.expectedIdempotencyKey) {
    return { ok: false, code: 'E_NO_APPROVAL', reason: 'idempotencyKey mismatch' };
  }
  if (args.requireDualControl && !tok.claims.secondApproverId) {
    return { ok: false, code: 'E_DUAL_CONTROL_REQUIRED', reason: 'second approver required for this amount' };
  }
  if (hasNonceBeenRedeemed(tok.claims.nonce)) {
    return { ok: false, code: 'E_NONCE_USED', reason: 'token already redeemed' };
  }
  return { ok: true, nonce: tok.claims.nonce };
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

// ─── Nonce store ─────────────────────────────────────────────────────

const REDEEMED_NONCES = new Map<string, number /* expiresAt sec */>();

export function hasNonceBeenRedeemed(nonce: string): boolean {
  pruneExpiredNonces();
  return REDEEMED_NONCES.has(nonce);
}

export function redeemNonce(nonce: string, expiresAt: number): void {
  REDEEMED_NONCES.set(nonce, expiresAt);
}

function pruneExpiredNonces(): void {
  const now = Math.floor(Date.now() / 1000);
  for (const [n, exp] of REDEEMED_NONCES) {
    if (exp < now) REDEEMED_NONCES.delete(n);
  }
}

/** Test-only: clear the nonce store. */
export function __clearNonceStoreForTests(): void {
  REDEEMED_NONCES.clear();
}
