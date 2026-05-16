// In-process store for staged SFDC change batches.
// Mirrors Phase A's payment staged-batch store, but for Salesforce objects.
import type { Stake } from '@/lib/policy/approvalPolicy';
import type { Id } from './types';

export type StagedChange = {
  id: Id;
  name: string;
  currentValue: string;
  newValue: string;
};

export type StagedSfdcBatch = {
  batchId: string;
  idempotencyKey: string;
  stake: Stake;
  recordCount: number;
  /** Short human-readable rollup, e.g. "Update NextStep on 14 stale opportunities". */
  summary: string;
  /** Free-form per-batch metadata (field name, target stage, reason, etc.). */
  meta?: Record<string, unknown>;
  changes: StagedChange[];
};

const STORE = new Map<string, StagedSfdcBatch>();

export function putStagedSfdcBatch(b: StagedSfdcBatch): void {
  STORE.set(b.batchId, b);
}

export function getStagedSfdcBatch(batchId: string): StagedSfdcBatch | undefined {
  return STORE.get(batchId);
}

export function deleteStagedSfdcBatch(batchId: string): boolean {
  return STORE.delete(batchId);
}

export function listStagedSfdcBatches(): StagedSfdcBatch[] {
  return Array.from(STORE.values());
}

/** Test-only: clear the store between cases. */
export function __clearStagedSfdcBatchStoreForTests(): void {
  STORE.clear();
}
