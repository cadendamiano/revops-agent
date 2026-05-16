// Salesforce write tools — propose-only. Staging surfaces approval requirements.
import { z } from 'zod';
import { defineTool, type DefinedTool } from './defineTool';
import { ApprovalToken } from '@/lib/domain/approval';
import { verifyApprovalToken, redeemNonce } from '@/lib/approvals/token';
import { classifyStake, type Stake } from '@/lib/policy/approvalPolicy';
import {
  putStagedSfdcBatch, getStagedSfdcBatch, deleteStagedSfdcBatch,
  type StagedChange, type StagedSfdcBatch,
} from '@/lib/salesforce/stagedBatchStore';
import { OPPORTUNITIES } from '@/lib/salesforce/seed';
import type { OpportunityStage } from '@/lib/salesforce/types';

const OppStageEnum = z.enum([
  'Prospecting', 'Qualification', 'Discovery', 'Proposal',
  'Negotiation', 'Closed Won', 'Closed Lost',
]);

let batchSeq = 0;
function nextBatchId(): string {
  batchSeq += 1;
  return `btch_sfdc_${batchSeq.toString(36)}_${Date.now().toString(36)}`;
}

function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export const proposeOppFieldUpdate = defineTool({
  name: 'propose_opp_field_update',
  label: 'Propose opportunity field update',
  domain: 'org',
  description: 'Stage a batch that sets the same field value on a list of opportunities. Returns a batchId, stake, and a 5-row preview. Requires human approval before submission.',
  schema: z.object({
    oppIds: z.array(z.string().min(1)).min(1),
    field: z.enum(['NextStep', 'Amount', 'CloseDate']),
    value: z.string().min(1),
  }),
});

export const proposeStageChange = defineTool({
  name: 'propose_stage_change',
  label: 'Propose stage change',
  domain: 'org',
  description: 'Stage a batch that moves a list of opportunities to a new stage. Closed Lost is treated as externally visible (mass-action). Closed Won is irreversible.',
  schema: z.object({
    oppIds: z.array(z.string().min(1)).min(1),
    newStage: OppStageEnum,
    reason: z.string().min(1),
  }),
});

export const submitApprovedSfdcBatch = defineTool({
  name: 'submit_approved_sfdc_batch',
  label: 'Submit approved SFDC batch',
  domain: 'org',
  description: 'Internal — verifies the approval token and applies the staged batch. Not exposed to the model.',
  schema: z.object({
    batchId: z.string().min(1),
    approvalToken: ApprovalToken,
  }),
});

export const SFDC_WRITE_TOOLS: DefinedTool[] = [
  proposeOppFieldUpdate, proposeStageChange,
];

export const SFDC_INTERNAL_TOOLS: DefinedTool[] = [
  submitApprovedSfdcBatch,
];

// ─── Handlers ────────────────────────────────────────────────────────

export type ProposeResult = {
  batchId: string;
  stake: Stake;
  recordCount: number;
  preview: StagedChange[];
  requiresApproval: boolean;
  summary: string;
};

export async function handleProposeOppFieldUpdate(input: {
  oppIds: string[];
  field: 'NextStep' | 'Amount' | 'CloseDate';
  value: string;
}): Promise<ProposeResult> {
  const changes: StagedChange[] = [];
  for (const id of input.oppIds) {
    const opp = OPPORTUNITIES.find(o => o.Id === id);
    if (!opp) continue;
    const current = (opp as Record<string, unknown>)[input.field];
    changes.push({
      id: opp.Id,
      name: opp.Name,
      currentValue: String(current ?? ''),
      newValue: input.value,
    });
  }
  const recordCount = changes.length;
  const stake = classifyStake({ recordCount, reversible: true, externallyVisible: false });
  const batchId = nextBatchId();
  const idempotencyKey = newIdempotencyKey();
  const summary = `Set ${input.field} on ${recordCount} opportunit${recordCount === 1 ? 'y' : 'ies'}`;
  const batch: StagedSfdcBatch = {
    batchId, idempotencyKey, stake, recordCount, summary,
    meta: { field: input.field, value: input.value },
    changes,
  };
  putStagedSfdcBatch(batch);
  return {
    batchId, stake, recordCount,
    preview: changes.slice(0, 5),
    requiresApproval: stake !== 'read-only',
    summary,
  };
}

export async function handleProposeStageChange(input: {
  oppIds: string[];
  newStage: OpportunityStage;
  reason: string;
}): Promise<ProposeResult> {
  const reversible = !(input.newStage === 'Closed Won' || input.newStage === 'Closed Lost');
  const externallyVisible = input.newStage === 'Closed Lost';
  const changes: StagedChange[] = [];
  for (const id of input.oppIds) {
    const opp = OPPORTUNITIES.find(o => o.Id === id);
    if (!opp) continue;
    changes.push({
      id: opp.Id,
      name: opp.Name,
      currentValue: opp.StageName,
      newValue: input.newStage,
    });
  }
  const recordCount = changes.length;
  const stake = classifyStake({ recordCount, reversible, externallyVisible });
  const batchId = nextBatchId();
  const idempotencyKey = newIdempotencyKey();
  const summary = `Move ${recordCount} opportunit${recordCount === 1 ? 'y' : 'ies'} to ${input.newStage}`;
  putStagedSfdcBatch({
    batchId, idempotencyKey, stake, recordCount, summary,
    meta: { newStage: input.newStage, reason: input.reason },
    changes,
  });
  return {
    batchId, stake, recordCount,
    preview: changes.slice(0, 5),
    requiresApproval: stake !== 'read-only',
    summary,
  };
}

export type SubmitResult =
  | { ok: true; applied: number; batchId: string }
  | { ok: false; code: string; reason: string };

export async function handleSubmitApprovedSfdcBatch(input: {
  batchId: string;
  approvalToken: unknown;
}): Promise<SubmitResult> {
  const staged = getStagedSfdcBatch(input.batchId);
  if (!staged) {
    return { ok: false, code: 'E_NOT_FOUND', reason: 'no staged batch with that id' };
  }
  const v = await verifyApprovalToken({
    token: input.approvalToken,
    expectedBatchId: input.batchId,
    expectedIdempotencyKey: staged.idempotencyKey,
    requireDualControl: staged.stake === 'mass-action',
  });
  if (!v.ok) {
    return { ok: false, code: v.code, reason: v.reason };
  }
  const parsedToken = ApprovalToken.safeParse(input.approvalToken);
  if (parsedToken.success) {
    redeemNonce(v.nonce, parsedToken.data.claims.expiresAt);
  }
  deleteStagedSfdcBatch(input.batchId);
  return { ok: true, applied: staged.recordCount, batchId: input.batchId };
}
