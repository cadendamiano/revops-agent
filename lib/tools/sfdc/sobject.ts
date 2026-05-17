// sf_sobject — schema introspection.
import { z } from 'zod';
import { defineTool, type DefinedTool } from '../defineTool';
import { SOBJECTS_SCHEMA, describeSObject, listSObjects } from '@/lib/salesforce/schema';
import {
  OPPORTUNITIES, ACCOUNTS, LEADS, CONTACTS, USERS, CASES, ACTIVITIES,
} from '@/lib/salesforce/seed';

const ROW_COUNTS: Record<string, number> = {
  Opportunity: OPPORTUNITIES.length,
  Account: ACCOUNTS.length,
  Lead: LEADS.length,
  Contact: CONTACTS.length,
  User: USERS.length,
  Case: CASES.length,
  Activity: ACTIVITIES.length,
};

export const sfSObjectDescribe = defineTool({
  name: 'sf_sobject_describe',
  label: 'sf sobject describe',
  domain: 'org',
  description: 'Describe an sObject: field metadata (name, label, type, nillable, referenceTo) and child relationships.',
  schema: z.object({
    sobject: z.string().min(1),
  }),
});

export const sfSObjectList = defineTool({
  name: 'sf_sobject_list',
  label: 'sf sobject list',
  domain: 'org',
  description: 'List sObjects available in the org with row counts.',
  schema: z.object({}),
});

export const SF_SOBJECT_TOOLS: DefinedTool[] = [sfSObjectDescribe, sfSObjectList];

export async function handleSfSObjectDescribe(input: { sobject: string }) {
  const d = describeSObject(input.sobject);
  if (!d) return { error: 'NOT_FOUND', hint: `unknown sObject "${input.sobject}". Known: ${Object.keys(SOBJECTS_SCHEMA).join(', ')}` };
  return d;
}

export async function handleSfSObjectList() {
  return listSObjects().map(s => ({ ...s, rowCount: ROW_COUNTS[s.name] ?? 0 }));
}
