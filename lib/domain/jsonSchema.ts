import { z } from 'zod';

/**
 * Convert a Zod schema to the JSON Schema dialect that Anthropic's `tools[].input_schema`
 * and Gemini's `functionDeclarations[].parameters` consume. Strips `$schema` and
 * `additionalProperties: false` (Anthropic dislikes the latter on tool roots).
 *
 * Uses Zod v4's built-in `z.toJSONSchema`.
 */
export function zodToToolJsonSchema(schema: z.ZodType): {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
} {
  const raw = z.toJSONSchema(schema, { target: 'draft-7' }) as any;
  delete raw.$schema;
  if (raw.type !== 'object') {
    throw new Error('zodToToolJsonSchema: top-level schema must be an object');
  }
  // Recursively strip additionalProperties:false (Anthropic dislikes on tool roots,
  // and we want to be permissive about model-extra fields).
  const stripExtras = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if ('additionalProperties' in node && node.additionalProperties === false) {
      delete node.additionalProperties;
    }
    if (node.properties && typeof node.properties === 'object') {
      for (const k of Object.keys(node.properties)) stripExtras(node.properties[k]);
    }
    if (node.items) stripExtras(node.items);
    if (Array.isArray(node.anyOf)) node.anyOf.forEach(stripExtras);
    if (Array.isArray(node.oneOf)) node.oneOf.forEach(stripExtras);
  };
  stripExtras(raw);
  return {
    type: 'object',
    properties: raw.properties ?? {},
    ...(Array.isArray(raw.required) && raw.required.length > 0 ? { required: raw.required } : {}),
  };
}
