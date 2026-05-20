// sf_data — record CRUD + SOQL over the mocked SFDC bundle.
import { z } from 'zod';
import { defineTool, type DefinedTool } from '../defineTool';
import {
  OPPORTUNITIES, ACCOUNTS, LEADS, CONTACTS, USERS, CASES, ACTIVITIES,
} from '@/lib/salesforce/seed';
import { runSoql } from '@/lib/salesforce/soql';
import { classifyStake, type Stake } from '@/lib/policy/approvalPolicy';
import {
  putStagedSfdcBatch, getStagedSfdcBatch, deleteStagedSfdcBatch,
  type StagedChange, type StagedSfdcBatch,
} from '@/lib/salesforce/stagedBatchStore';
import { ApprovalToken } from '@/lib/domain/approval';
import { verifyApprovalToken, redeemNonce } from '@/lib/approvals/token';
import type { OpportunityStage } from '@/lib/salesforce/types';

const SObjectEnum = z.enum([
  'Opportunity', 'Account', 'Lead', 'Contact', 'User', 'Case', 'Activity',
]);

const SOURCE: Record<string, Record<string, unknown>[]> = {
  Opportunity: OPPORTUNITIES as unknown as Record<string, unknown>[],
  Account:     ACCOUNTS as unknown as Record<string, unknown>[],
  Lead:        LEADS as unknown as Record<string, unknown>[],
  Contact:     CONTACTS as unknown as Record<string, unknown>[],
  User:        USERS as unknown as Record<string, unknown>[],
  Case:        CASES as unknown as Record<string, unknown>[],
  Activity:    ACTIVITIES as unknown as Record<string, unknown>[],
};

let batchSeq = 0;
function nextBatchId(): string {
  batchSeq += 1;
  return `btch_sfdc_${batchSeq.toString(36)}_${Date.now().toString(36)}`;
}
function newIdempotencyKey(): string { return crypto.randomUUID(); }

// ─── Tool definitions ────────────────────────────────────────────────

export const sfDataQuery = defineTool({
  name: 'sf_data_query',
  label: 'sf data query',
  domain: 'org',
  description: 'Execute a SOQL query against the org. SELECT … FROM Opportunity|Account|Lead|Contact|User|Case|Activity [WHERE …] [ORDER BY …] [LIMIT n]. Returns { totalSize, done, records, fields }.',
  schema: z.object({
    soql: z.string().min(1),
    limit: z.number().int().min(1).max(2000).optional(),
  }),
});

export const sfDataSearch = defineTool({
  name: 'sf_data_search',
  label: 'sf data search',
  domain: 'org',
  description: 'Mock SOSL: case-insensitive substring search across Name/Email/Subject fields. Returns matching records grouped by sObject.',
  schema: z.object({
    term: z.string().min(1),
    sobjects: z.array(SObjectEnum).optional(),
  }),
});

export const sfDataGetRecord = defineTool({
  name: 'sf_data_get_record',
  label: 'sf data get-record',
  domain: 'org',
  description: 'Fetch a single record by sObject + Id.',
  schema: z.object({
    sobject: SObjectEnum,
    id: z.string().min(1),
  }),
});

export const sfDataCreate = defineTool({
  name: 'sf_data_create',
  label: 'sf data create',
  domain: 'org',
  description: 'Stage a single-record create. Returns batchId for approval before insert.',
  schema: z.object({
    sobject: SObjectEnum,
    fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  }),
});

export const sfDataUpdate = defineTool({
  name: 'sf_data_update',
  label: 'sf data update',
  domain: 'org',
  description: 'Stage a same-value bulk update on the given Ids. Stake classifier escalates >25 rows to mass-action.',
  schema: z.object({
    sobject: SObjectEnum,
    ids: z.array(z.string().min(1)).min(1),
    field: z.string().min(1),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  }),
});

const OppStageEnum = z.enum([
  'Qualified', 'Quoted', 'Scheduled', 'Job Complete',
  'Invoiced', 'Closed Won', 'Closed Lost',
]);

export const sfDataStageChange = defineTool({
  name: 'sf_data_stage_change',
  label: 'sf data stage-change',
  domain: 'org',
  description: 'Stage an Opportunity stage change for a list of Ids. Closed Lost is externally visible → mass-action. Closed Won is irreversible.',
  schema: z.object({
    ids: z.array(z.string().min(1)).min(1),
    newStage: OppStageEnum,
    reason: z.string().min(1),
  }),
});

export const sfDataDelete = defineTool({
  name: 'sf_data_delete',
  label: 'sf data delete',
  domain: 'org',
  description: 'Stage a delete for a list of Ids. Always irreversible → mass-action / dual control.',
  schema: z.object({
    sobject: SObjectEnum,
    ids: z.array(z.string().min(1)).min(1),
    reason: z.string().min(1),
  }),
});

// Internal — server-side redeem.
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

export const SF_DATA_TOOLS: DefinedTool[] = [
  sfDataQuery, sfDataSearch, sfDataGetRecord,
  sfDataCreate, sfDataUpdate, sfDataStageChange, sfDataDelete,
];

export const SF_DATA_INTERNAL_TOOLS: DefinedTool[] = [submitApprovedSfdcBatch];

// ─── Handlers ───────────────────────────────────────────────────────

export async function handleSfDataQuery(input: { soql: string; limit?: number }) {
  const limit = input.limit ?? 200;
  return runSoql(input.soql, limit);
}

export async function handleSfDataSearch(input: { term: string; sobjects?: string[] }) {
  const targets = input.sobjects && input.sobjects.length > 0
    ? input.sobjects
    : Object.keys(SOURCE);
  const needle = input.term.toLowerCase();
  const results: Record<string, Record<string, unknown>[]> = {};
  for (const t of targets) {
    const src = SOURCE[t];
    if (!src) continue;
    results[t] = src.filter(r => {
      for (const k of ['Name', 'Email', 'Subject', 'CaseNumber', 'Company']) {
        const v = r[k];
        if (typeof v === 'string' && v.toLowerCase().includes(needle)) return true;
      }
      return false;
    });
  }
  const total = Object.values(results).reduce((s, arr) => s + arr.length, 0);
  return { term: input.term, total, results };
}

export async function handleSfDataGetRecord(input: { sobject: string; id: string }) {
  const src = SOURCE[input.sobject];
  if (!src) return null;
  return src.find(r => r.Id === input.id) ?? null;
}

export type ProposeResult = {
  batchId: string;
  stake: Stake;
  recordCount: number;
  preview: StagedChange[];
  requiresApproval: boolean;
  summary: string;
  blocked?: { id: string; reason: string }[];
};

// Guardrail (PRD §7.15): closed-won / closed-lost opportunities are immutable.
function partitionClosedOpps(ids: string[]): { editable: string[]; blocked: { id: string; reason: string }[] } {
  const editable: string[] = [];
  const blocked: { id: string; reason: string }[] = [];
  for (const id of ids) {
    const opp = OPPORTUNITIES.find(o => o.Id === id);
    if (opp && (opp.StageName === 'Closed Won' || opp.StageName === 'Closed Lost')) {
      blocked.push({ id, reason: `Opportunity is ${opp.StageName} and cannot be modified` });
    } else {
      editable.push(id);
    }
  }
  return { editable, blocked };
}

export async function handleSfDataCreate(input: {
  sobject: string; fields: Record<string, unknown>;
}): Promise<ProposeResult> {
  const newId = `new_${input.sobject.slice(0, 3).toLowerCase()}_${Date.now().toString(36)}`;
  const summary = `Create 1 ${input.sobject}`;
  const changes: StagedChange[] = [{
    id: newId,
    name: String(input.fields.Name ?? input.fields.Subject ?? newId),
    currentValue: '(new)',
    newValue: JSON.stringify(input.fields).slice(0, 160),
  }];
  const stake = classifyStake({ recordCount: 1, reversible: true, externallyVisible: false });
  const batch: StagedSfdcBatch = {
    batchId: nextBatchId(),
    idempotencyKey: newIdempotencyKey(),
    stake, recordCount: 1, summary,
    meta: { op: 'create', sobject: input.sobject, fields: input.fields },
    changes,
  };
  putStagedSfdcBatch(batch);
  return {
    batchId: batch.batchId, stake, recordCount: 1,
    preview: changes, requiresApproval: stake !== 'read-only', summary,
  };
}

export async function handleSfDataUpdate(input: {
  sobject: string; ids: string[]; field: string; value: unknown;
}): Promise<ProposeResult> {
  const src = SOURCE[input.sobject] ?? [];
  const { editable, blocked } = input.sobject === 'Opportunity'
    ? partitionClosedOpps(input.ids)
    : { editable: input.ids, blocked: [] as { id: string; reason: string }[] };
  const changes: StagedChange[] = [];
  for (const id of editable) {
    const rec = src.find(r => r.Id === id);
    if (!rec) continue;
    changes.push({
      id,
      name: String((rec as any).Name ?? (rec as any).Subject ?? id),
      currentValue: String((rec as any)[input.field] ?? ''),
      newValue: String(input.value),
    });
  }
  const recordCount = changes.length;
  const stake = classifyStake({ recordCount, reversible: true, externallyVisible: false });
  const summary = `Set ${input.field} on ${recordCount} ${input.sobject}${recordCount === 1 ? '' : 's'}`;
  const batch: StagedSfdcBatch = {
    batchId: nextBatchId(),
    idempotencyKey: newIdempotencyKey(),
    stake, recordCount, summary,
    meta: { op: 'update', sobject: input.sobject, field: input.field, value: input.value },
    changes,
  };
  putStagedSfdcBatch(batch);
  return {
    batchId: batch.batchId, stake, recordCount,
    preview: changes.slice(0, 5),
    requiresApproval: stake !== 'read-only',
    summary,
    blocked: blocked.length ? blocked : undefined,
  };
}

export async function handleSfDataStageChange(input: {
  ids: string[]; newStage: OpportunityStage; reason: string;
}): Promise<ProposeResult> {
  const reversible = !(input.newStage === 'Closed Won' || input.newStage === 'Closed Lost');
  const externallyVisible = input.newStage === 'Closed Lost';
  const { editable, blocked } = partitionClosedOpps(input.ids);
  const changes: StagedChange[] = [];
  for (const id of editable) {
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
  const summary = `Move ${recordCount} opportunit${recordCount === 1 ? 'y' : 'ies'} to ${input.newStage}`;
  const batch: StagedSfdcBatch = {
    batchId: nextBatchId(),
    idempotencyKey: newIdempotencyKey(),
    stake, recordCount, summary,
    meta: { op: 'stage-change', newStage: input.newStage, reason: input.reason },
    changes,
  };
  putStagedSfdcBatch(batch);
  return {
    batchId: batch.batchId, stake, recordCount,
    preview: changes.slice(0, 5),
    requiresApproval: stake !== 'read-only',
    summary,
    blocked: blocked.length ? blocked : undefined,
  };
}

export async function handleSfDataDelete(input: {
  sobject: string; ids: string[]; reason: string;
}): Promise<ProposeResult> {
  const src = SOURCE[input.sobject] ?? [];
  const changes: StagedChange[] = [];
  for (const id of input.ids) {
    const rec = src.find(r => r.Id === id);
    if (!rec) continue;
    changes.push({
      id,
      name: String((rec as any).Name ?? (rec as any).Subject ?? id),
      currentValue: '(exists)',
      newValue: '(deleted)',
    });
  }
  const recordCount = changes.length;
  // Delete is never reversible.
  const stake = classifyStake({ recordCount, reversible: false, externallyVisible: false });
  const summary = `Delete ${recordCount} ${input.sobject}${recordCount === 1 ? '' : 's'}`;
  const batch: StagedSfdcBatch = {
    batchId: nextBatchId(),
    idempotencyKey: newIdempotencyKey(),
    stake, recordCount, summary,
    meta: { op: 'delete', sobject: input.sobject, reason: input.reason },
    changes,
  };
  putStagedSfdcBatch(batch);
  return {
    batchId: batch.batchId, stake, recordCount,
    preview: changes.slice(0, 5),
    requiresApproval: true,
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
