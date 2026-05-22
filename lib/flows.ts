// Type-only module. Flow data and scripted sequences have been removed
// (demo mode deprecated). Types remain because they are imported widely.

export type ArtifactKind =
  | 'spreadsheet'
  | 'document'
  | 'slides'
  | 'custom-dashboard'
  // SFDC-specific artifact kinds
  | 'soql-results'
  | 'pipeline-kanban'
  | 'account-360'
  | 'lead-scoring'
  | 'forecast'
  | 'dashboard-tiles'
  | 'case-sla'
  | 'activity-timeline'
  | 'bulk-update-preview'
  | 'action-draft'
  | 'comparison';

export type ToolRowSpec = {
  verb: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'EXEC';
  path: string;
  filter?: string;
  status?: string;
  result?: string;
  /** Raw tool name (e.g. sf_data_query) for presentation mapping; set for live calls. */
  tool?: string;
};

export type ApprovalStake =
  | 'read-only' | 'single-record-edit' | 'bulk-update' | 'mass-action';

export type ApprovalPreviewRow = {
  id: string;
  name: string;
  currentValue: string;
  newValue: string;
};

export type FlowStep =
  | { kind: 'user';          delay?: number; text: string }
  | { kind: 'agent-stream';  delay?: number; text: string }
  | { kind: 'tools';         delay?: number; rows: ToolRowSpec[] }
  | { kind: 'libs';          delay?: number; items: { pkg: string; ver: string }[] }
  | { kind: 'building';      delay?: number; label: string; sub: string }
  | {
      kind: 'artifact-card';
      delay?: number;
      artifactId: string;
      title: string;
      sub: string;
      meta: string;
      icon?: string;
    }
  | {
      kind: 'approval';
      delay?: number;
      payload: {
        batchId: string;
        stake: ApprovalStake;
        title: string;
        summary: string;
        recordCount: number;
        preview: ApprovalPreviewRow[];
        requiresSecondApprover?: boolean;
      };
    }
  | { kind: 'suggest'; delay?: number; items: string[] }
  | {
      kind: 'artifact-enrich';
      delay?: number;
      artifactId: string;
      patch: { filter?: string; label?: string };
    };
