import type { z } from 'zod';
import type { ToolContext, ToolDef } from '@/lib/tools';
import { zodToToolJsonSchema } from '@/lib/domain/jsonSchema';

export type DefinedTool = ToolDef & {
  /** When present, runAgentOnce calls schema.safeParse(input) before dispatch. */
  schema?: z.ZodType;
  /** Domain bucket for the per-area split. */
  domain: 'ap' | 'ar' | 'se' | 'org' | 'treasury' | 'render' | 'form';
};

type Args<T extends z.ZodType> = {
  name: string;
  label: string;
  description: string;
  domain: DefinedTool['domain'];
  schema: T;
};

/**
 * Define a tool with a Zod schema as the source of truth. The JSON Schema
 * sent to the model is derived from the Zod schema. The schema is also stored
 * on the returned object so the dispatcher can validate input before executing.
 */
export function defineTool<T extends z.ZodType>(args: Args<T>): DefinedTool {
  return {
    name: args.name,
    label: args.label,
    description: args.description,
    domain: args.domain,
    schema: args.schema,
    parameters: zodToToolJsonSchema(args.schema),
  };
}

/**
 * Wrap a legacy ToolDef (already-shaped JSON Schema) so it fits in the same registry.
 * Used while we migrate tools incrementally; no schema validation happens for these.
 */
export function legacyTool(def: ToolDef, domain: DefinedTool['domain']): DefinedTool {
  return { ...def, domain };
}

export type ToolValidationResult =
  | { ok: true; input: unknown }
  | { ok: false; code: 'E_SCHEMA'; summary: string; issues: { path: (string | number)[]; message: string }[] };

/** Validate a tool input against its Zod schema (if any). */
export function validateToolInput(tool: DefinedTool, input: unknown): ToolValidationResult {
  if (!tool.schema) return { ok: true, input };
  const r = tool.schema.safeParse(input);
  if (r.success) return { ok: true, input: r.data };
  const issues = r.error.issues.map(i => ({ path: i.path as (string | number)[], message: i.message }));
  const summary = `schema rejected input for ${tool.name}: ${issues.slice(0, 3).map(i => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ')}`;
  return { ok: false, code: 'E_SCHEMA', summary, issues };
}

export type { ToolContext };
