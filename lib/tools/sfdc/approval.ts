// sf_approval — approval queue (discount approvals on Opportunities).
import { z } from 'zod';
import { defineTool, type DefinedTool } from '../defineTool';
import { APPROVAL_REQUESTS, OPPORTUNITIES, USERS } from '@/lib/salesforce/seed';
import { classifyStake, type Stake } from '@/lib/policy/approvalPolicy';
import {
  putStagedSfdcBatch, type StagedChange,
} from '@/lib/salesforce/stagedBatchStore';

const DecisionEnum = z.enum(['Approved', 'Rejected']);

export const sfApprovalQueue = defineTool({
  name: 'sf_approval_queue',
  label: 'sf approval queue',
  domain: 'org',
  description: 'List pending approval requests (discount approvals on Opportunities), enriched with opp name and submitter.',
  schema: z.object({}),
});

export const sfApprovalDecide = defineTool({
  name: 'sf_approval_decide',
  label: 'sf approval decide',
  domain: 'org',
  description: 'Stage approve/reject for one or more approval requests. Bulk count drives stake.',
  schema: z.object({
    approvalIds: z.array(z.string().min(1)).min(1),
    decision: DecisionEnum,
    comment: z.string().optional(),
  }),
});

export const SF_APPROVAL_TOOLS: DefinedTool[] = [sfApprovalQueue, sfApprovalDecide];

let approvalSeq = 0;
function nextBatchId(): string {
  approvalSeq += 1;
  return `btch_appr_${approvalSeq.toString(36)}_${Date.now().toString(36)}`;
}

export async function handleSfApprovalQueue() {
  return APPROVAL_REQUESTS
    .filter(r => r.Status === 'Pending')
    .map(r => {
      const opp = OPPORTUNITIES.find(o => o.Id === r.SubmittedFor);
      const submitter = USERS.find(u => u.Id === r.SubmittedById);
      return {
        Id: r.Id,
        SubmittedFor: r.SubmittedFor,
        OppName: opp?.Name ?? r.SubmittedFor,
        SubmittedById: r.SubmittedById,
        SubmitterName: submitter?.Name ?? r.SubmittedById,
        Reason: r.Reason,
        DiscountPct: r.DiscountPct,
        Amount: r.Amount,
        CreatedDate: r.CreatedDate,
      };
    });
}

export type ApprovalDecideResult = {
  batchId: string;
  stake: Stake;
  recordCount: number;
  preview: StagedChange[];
  requiresApproval: boolean;
  summary: string;
};

export async function handleSfApprovalDecide(input: {
  approvalIds: string[]; decision: 'Approved' | 'Rejected'; comment?: string;
}): Promise<ApprovalDecideResult> {
  const changes: StagedChange[] = [];
  for (const id of input.approvalIds) {
    const r = APPROVAL_REQUESTS.find(x => x.Id === id);
    if (!r) continue;
    const opp = OPPORTUNITIES.find(o => o.Id === r.SubmittedFor);
    changes.push({
      id: r.Id,
      name: opp?.Name ?? r.SubmittedFor,
      currentValue: 'Pending',
      newValue: input.decision,
    });
  }
  const recordCount = changes.length;
  const stake = classifyStake({ recordCount, reversible: true, externallyVisible: false });
  const summary = `${input.decision} ${recordCount} approval${recordCount === 1 ? '' : 's'}`;
  const batchId = nextBatchId();
  putStagedSfdcBatch({
    batchId,
    idempotencyKey: crypto.randomUUID(),
    stake,
    recordCount,
    summary,
    meta: { op: 'approval-decide', decision: input.decision, comment: input.comment },
    changes,
  });
  return {
    batchId, stake, recordCount,
    preview: changes.slice(0, 5),
    requiresApproval: stake !== 'read-only',
    summary,
  };
}
