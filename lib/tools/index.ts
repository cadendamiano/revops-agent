import type { DefinedTool } from './defineTool';
import { SFDC_READ_TOOLS } from './sfdc-read';
import { SFDC_WRITE_TOOLS, SFDC_INTERNAL_TOOLS } from './sfdc-write';
import { SFDC_RENDER_TOOLS } from './sfdc-render';

export const READ_TOOLS_V2: DefinedTool[] = [...SFDC_READ_TOOLS];
export const FORM_TOOLS_V2: DefinedTool[] = [...SFDC_RENDER_TOOLS];
export const WRITE_TOOLS_V2: DefinedTool[] = [...SFDC_WRITE_TOOLS];

export const DEFINED_MODEL_TOOLS: DefinedTool[] = [
  ...READ_TOOLS_V2, ...FORM_TOOLS_V2, ...WRITE_TOOLS_V2,
];
export const DEFINED_INTERNAL_TOOLS: DefinedTool[] = [...SFDC_INTERNAL_TOOLS];

const BY_NAME = new Map<string, DefinedTool>();
for (const t of [...DEFINED_MODEL_TOOLS, ...DEFINED_INTERNAL_TOOLS]) {
  BY_NAME.set(t.name, t);
}

export function getDefinedTool(name: string): DefinedTool | undefined {
  return BY_NAME.get(name);
}

export { defineTool, legacyTool, validateToolInput } from './defineTool';
export type { DefinedTool, ToolValidationResult } from './defineTool';
