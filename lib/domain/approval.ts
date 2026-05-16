// phase-a: neutral stub. Phase B replaces with SF content.
import { z } from 'zod';

export const ApproverId = z.string().min(1);
export type ApproverId = z.infer<typeof ApproverId>;

export const ApprovalClaims = z.object({
  batchId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  approverId: ApproverId,
  secondApproverId: ApproverId.optional(),
  issuedAt: z.number().int().describe('Unix epoch seconds'),
  expiresAt: z.number().int(),
  nonce: z.string().min(8),
  policyAtIssue: z.enum(['auto-approvable', 'single-approver', 'requires-dual-control']),
});
export type ApprovalClaims = z.infer<typeof ApprovalClaims>;

export const ApprovalToken = z.object({
  claims: ApprovalClaims,
  signature: z.string().regex(/^[a-f0-9]{64}$/, 'expected 64-char lowercase hex'),
});
export type ApprovalToken = z.infer<typeof ApprovalToken>;
