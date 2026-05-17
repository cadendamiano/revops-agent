// sf_activity — tasks/events/comms timeline.
import { z } from 'zod';
import { defineTool, type DefinedTool } from '../defineTool';
import { ACTIVITIES } from '@/lib/salesforce/seed';
import { classifyStake, type Stake } from '@/lib/policy/approvalPolicy';
import {
  putStagedSfdcBatch, type StagedChange,
} from '@/lib/salesforce/stagedBatchStore';

const ActivityTypeEnum = z.enum(['Call', 'Email', 'Meeting', 'Note', 'StageChange']);

export const sfActivityList = defineTool({
  name: 'sf_activity_list',
  label: 'sf activity list',
  domain: 'org',
  description: 'List activities for a related record (Opportunity, Account, Case). Optional type filter. Sorted newest first.',
  schema: z.object({
    relatedTo: z.string().min(1),
    types: z.array(ActivityTypeEnum).optional(),
  }),
});

export const sfActivityLog = defineTool({
  name: 'sf_activity_log',
  label: 'sf activity log',
  domain: 'org',
  description: 'Stage a single activity (Call/Email/Meeting/Note) for approval before logging.',
  schema: z.object({
    relatedTo: z.string().min(1),
    type: ActivityTypeEnum,
    subject: z.string().min(1),
    durationMin: z.number().int().min(0).optional(),
  }),
});

export const SF_ACTIVITY_TOOLS: DefinedTool[] = [sfActivityList, sfActivityLog];

let activitySeq = 0;
function nextBatchId(): string {
  activitySeq += 1;
  return `btch_act_${activitySeq.toString(36)}_${Date.now().toString(36)}`;
}

export async function handleSfActivityList(input: { relatedTo: string; types?: string[] }) {
  const types = input.types ? new Set(input.types) : null;
  return ACTIVITIES
    .filter(a => a.WhatId === input.relatedTo)
    .filter(a => !types || types.has(a.Type))
    .sort((a, b) => b.ActivityDate.localeCompare(a.ActivityDate));
}

export type ProposeActivityResult = {
  batchId: string;
  stake: Stake;
  recordCount: 1;
  preview: StagedChange[];
  requiresApproval: boolean;
  summary: string;
};

export async function handleSfActivityLog(input: {
  relatedTo: string; type: string; subject: string; durationMin?: number;
}): Promise<ProposeActivityResult> {
  const newId = `00T_new_${Date.now().toString(36)}`;
  const change: StagedChange = {
    id: newId,
    name: input.subject,
    currentValue: '(none)',
    newValue: `${input.type}${input.durationMin ? ` (${input.durationMin}m)` : ''}: ${input.subject}`,
  };
  const stake = classifyStake({ recordCount: 1, reversible: true, externallyVisible: false });
  const summary = `Log ${input.type} on ${input.relatedTo}: ${input.subject}`;
  const batchId = nextBatchId();
  putStagedSfdcBatch({
    batchId,
    idempotencyKey: crypto.randomUUID(),
    stake,
    recordCount: 1,
    summary,
    meta: { op: 'activity-log', relatedTo: input.relatedTo, type: input.type, durationMin: input.durationMin },
    changes: [change],
  });
  return {
    batchId, stake, recordCount: 1,
    preview: [change],
    requiresApproval: true,
    summary,
  };
}
