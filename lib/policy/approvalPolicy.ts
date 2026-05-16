// Salesforce approval policy: stake taxonomy + classifier + policy map.
export type Stake = 'read-only' | 'single-record-edit' | 'bulk-update' | 'mass-action';

export type ApprovalPolicyResult = 'auto-approvable' | 'single-approver' | 'requires-dual-control';

export type ClassifyInput = {
  recordCount: number;
  reversible: boolean;
  externallyVisible: boolean;
};

export function classifyStake(input: ClassifyInput): Stake {
  if (input.recordCount === 0) return 'read-only';
  if (!input.reversible || input.externallyVisible) return 'mass-action';
  if (input.recordCount > 25) return 'mass-action';
  if (input.recordCount > 1) return 'bulk-update';
  return 'single-record-edit';
}

export function approvalPolicyFor(stake: Stake): ApprovalPolicyResult {
  switch (stake) {
    case 'read-only':           return 'auto-approvable';
    case 'single-record-edit':  return 'single-approver';
    case 'bulk-update':         return 'single-approver';
    case 'mass-action':         return 'requires-dual-control';
  }
}

export type PolicyEvaluation = { policy: ApprovalPolicyResult; reasons: string[] };

export function evaluatePolicy(input: { stake: Stake }): PolicyEvaluation {
  const policy = approvalPolicyFor(input.stake);
  const reasons: string[] = [];
  if (input.stake === 'read-only') reasons.push('No records affected — read-only access.');
  if (input.stake === 'single-record-edit') reasons.push('Single record update — single-approver sign-off.');
  if (input.stake === 'bulk-update') reasons.push('Bulk update (2–25 records, reversible) — single-approver sign-off.');
  if (input.stake === 'mass-action') {
    reasons.push('Mass action: >25 records OR irreversible OR externally visible — dual control required.');
  }
  return { policy, reasons };
}
