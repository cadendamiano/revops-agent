/**
 * Idempotency cache for stage_payment_batch and submit_payment_batch.
 *
 * Single-process Map for the prototype. Interface (get / put / clear) is
 * intentionally narrow so the implementation can swap to Redis or a KV store
 * without consumer changes.
 */

type Entry<V> = { value: V; expiresAt: number };

const STAGE_TTL_SECONDS = 30 * 60; // 30 min: matches the typical approval window
const SUBMIT_TTL_SECONDS = 24 * 60 * 60; // 24h: dedupe retries within a day

export type Operation = 'stage' | 'submit';

const STORE = new Map<string, Entry<unknown>>();

function makeKey(op: Operation, idempotencyKey: string): string {
  return `${op}:${idempotencyKey}`;
}

export function getIdempotent<V>(op: Operation, idempotencyKey: string): V | undefined {
  pruneExpired();
  const k = makeKey(op, idempotencyKey);
  const entry = STORE.get(k);
  return entry ? (entry.value as V) : undefined;
}

export function putIdempotent<V>(op: Operation, idempotencyKey: string, value: V): void {
  pruneExpired();
  const ttl = op === 'stage' ? STAGE_TTL_SECONDS : SUBMIT_TTL_SECONDS;
  STORE.set(makeKey(op, idempotencyKey), {
    value,
    expiresAt: Math.floor(Date.now() / 1000) + ttl,
  });
}

function pruneExpired(): void {
  const now = Math.floor(Date.now() / 1000);
  for (const [k, e] of STORE) {
    if (e.expiresAt < now) STORE.delete(k);
  }
}

export function __clearIdempotencyForTests(): void {
  STORE.clear();
}
