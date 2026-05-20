// flag_records — the agent's write path into flagged-record memory (PRD §7.11).
// Not a CRM write, so it is NOT approval-gated; it records that the agent
// surfaced an issue. The frontend persists the flags from the tool-result.
import { z } from 'zod';
import { defineTool, type DefinedTool } from '../defineTool';

export const flagRecords = defineTool({
  name: 'flag_records',
  label: 'Flag records to memory',
  domain: 'form',
  description: 'Record that you have flagged one or more records (as a risk, opportunity, stale, duplicate, or hygiene issue) so they persist across sessions and are not re-surfaced once the user dismisses them. Call this after you identify records worth tracking.',
  schema: z.object({
    records: z.array(z.object({
      recordId: z.string().min(1),
      sobject: z.string().optional(),
      name: z.string().optional(),
      flag: z.enum(['risk', 'opportunity', 'stale', 'duplicate', 'hygiene', 'other']).optional(),
      reason: z.string().optional(),
    })).min(1),
  }),
});

export const SF_MEMORY_TOOLS: DefinedTool[] = [flagRecords];

export async function handleFlagRecords(input: { records: unknown[] }) {
  return { flagged: input.records.length };
}
