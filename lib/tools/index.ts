import type { DefinedTool } from './defineTool';
import { SF_DATA_TOOLS, SF_DATA_INTERNAL_TOOLS } from './sfdc/data';
import { SF_SOBJECT_TOOLS } from './sfdc/sobject';
import { SF_ANALYTICS_TOOLS } from './sfdc/analytics';
import { SF_CASE_TOOLS } from './sfdc/case';
import { SF_ACTIVITY_TOOLS } from './sfdc/activity';
import { SF_APPROVAL_TOOLS } from './sfdc/approval';
import { SFDC_RENDER_TOOLS_V2 } from './sfdc/render';
import { SF_MEMORY_TOOLS } from './sfdc/memory';
import { SF_SESSION_TOOLS } from './sfdc/session';
import {
  askQuestion, offerArtifacts,
  renderArtifact, renderHtmlArtifact, renderSpreadsheetArtifact,
  renderDocumentArtifact, renderSlidesArtifact, renderAutomationArtifact,
} from './render';

export const READ_TOOLS_V2: DefinedTool[] = [
  ...SF_DATA_TOOLS.filter(t => t.name === 'sf_data_query' || t.name === 'sf_data_search' || t.name === 'sf_data_get_record'),
  ...SF_SOBJECT_TOOLS,
  ...SF_ANALYTICS_TOOLS,
  ...SF_CASE_TOOLS,
  ...SF_ACTIVITY_TOOLS.filter(t => t.name === 'sf_activity_list'),
  ...SF_APPROVAL_TOOLS.filter(t => t.name === 'sf_approval_queue'),
];

export const WRITE_TOOLS_V2: DefinedTool[] = [
  ...SF_DATA_TOOLS.filter(t =>
    t.name === 'sf_data_create' ||
    t.name === 'sf_data_update' ||
    t.name === 'sf_data_stage_change' ||
    t.name === 'sf_data_delete'),
  ...SF_ACTIVITY_TOOLS.filter(t => t.name === 'sf_activity_log'),
  ...SF_APPROVAL_TOOLS.filter(t => t.name === 'sf_approval_decide'),
];

export const FORM_TOOLS_V2: DefinedTool[] = [
  ...SFDC_RENDER_TOOLS_V2,
  renderArtifact, renderHtmlArtifact, renderSpreadsheetArtifact,
  renderDocumentArtifact, renderSlidesArtifact, renderAutomationArtifact,
  askQuestion,
  offerArtifacts,
  ...SF_MEMORY_TOOLS,
  ...SF_SESSION_TOOLS,
];

export const DEFINED_MODEL_TOOLS: DefinedTool[] = [
  ...READ_TOOLS_V2, ...FORM_TOOLS_V2, ...WRITE_TOOLS_V2,
];
export const DEFINED_INTERNAL_TOOLS: DefinedTool[] = [...SF_DATA_INTERNAL_TOOLS];

const BY_NAME = new Map<string, DefinedTool>();
for (const t of [...DEFINED_MODEL_TOOLS, ...DEFINED_INTERNAL_TOOLS]) {
  BY_NAME.set(t.name, t);
}

export function getDefinedTool(name: string): DefinedTool | undefined {
  return BY_NAME.get(name);
}

export { defineTool, legacyTool, validateToolInput } from './defineTool';
export type { DefinedTool, ToolValidationResult } from './defineTool';
