// sf_case — support cases.
import { z } from 'zod';
import { defineTool, type DefinedTool } from '../defineTool';
import { CASES } from '@/lib/salesforce/seed';
import { daysBetween, TODAY } from '@/lib/salesforce/types';

const PriorityEnum = z.enum(['P1', 'P2', 'P3']);
const StatusEnum = z.enum(['New', 'Working', 'Escalated', 'Closed']);

export const sfCaseList = defineTool({
  name: 'sf_case_list',
  label: 'sf case list',
  domain: 'org',
  description: 'List support cases, optionally filtered by status, priority, or accountId.',
  schema: z.object({
    status: StatusEnum.optional(),
    priority: PriorityEnum.optional(),
    accountId: z.string().optional(),
  }),
});

export const sfCaseSlaBreach = defineTool({
  name: 'sf_case_sla_breach',
  label: 'sf case sla-breach',
  domain: 'org',
  description: 'Return open cases past their SLA target (or within 24h). Each row includes age, slaPct, and breach severity.',
  schema: z.object({}),
});

export const SF_CASE_TOOLS: DefinedTool[] = [sfCaseList, sfCaseSlaBreach];

export async function handleSfCaseList(input: {
  status?: string; priority?: string; accountId?: string;
}) {
  return CASES.filter(c =>
    (!input.status   || c.Status   === input.status) &&
    (!input.priority || c.Priority === input.priority) &&
    (!input.accountId|| c.AccountId === input.accountId),
  );
}

export async function handleSfCaseSlaBreach() {
  return CASES
    .filter(c => c.Status !== 'Closed')
    .map(c => {
      const age = daysBetween(TODAY, c.CreatedDate);
      const slaWindow = daysBetween(c.SlaTargetDate, c.CreatedDate);
      const remaining = daysBetween(c.SlaTargetDate, TODAY);
      const slaPct = slaWindow > 0 ? Math.min(150, Math.round((age / slaWindow) * 100)) : 0;
      return {
        id: c.Id,
        caseNumber: c.CaseNumber,
        accountId: c.AccountId,
        subject: c.Subject,
        priority: c.Priority,
        status: c.Status,
        ownerId: c.OwnerId,
        age,
        slaPct,
        breached: remaining < 0,
        remaining,
      };
    })
    .filter(c => c.slaPct >= 75)
    .sort((a, b) => b.slaPct - a.slaPct);
}
