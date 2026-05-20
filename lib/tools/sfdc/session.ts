// plan — the agent's structured plan for a task session (PRD §7.1, §9.1).
// Not a CRM write, so it is NOT approval-gated. The frontend renders the plan
// as a checkpoint turn at the top of the work and persists it in the trace.
import { z } from 'zod';
import { defineTool, type DefinedTool } from '../defineTool';

export const planTool = defineTool({
  name: 'plan',
  label: 'Propose a plan',
  domain: 'form',
  description: 'Before executing a multi-step task, lay out your plan as an ordered list of steps so the user can see what you intend to do. Call this once at the start of a task session. Each step is a short title plus an optional detail.',
  schema: z.object({
    goal: z.string().optional(),
    steps: z.array(z.object({
      title: z.string().min(1),
      detail: z.string().optional(),
    })).min(1),
  }),
});

export const SF_SESSION_TOOLS: DefinedTool[] = [planTool];

export async function handlePlan(input: { goal?: string; steps: unknown[] }) {
  return { steps: input.steps.length };
}
