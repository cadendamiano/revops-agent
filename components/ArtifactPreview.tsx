'use client';

import type { Artifact } from '@/lib/store';
import { SoqlResults } from './artifacts/SoqlResults';
import { PipelineKanban } from './artifacts/PipelineKanban';
import { Account360 } from './artifacts/Account360';
import { LeadScoringTable } from './artifacts/LeadScoringTable';
import { ForecastTile } from './artifacts/ForecastTile';
import { DashboardTiles } from './artifacts/DashboardTiles';
import { CaseSlaHeatmap } from './artifacts/CaseSlaHeatmap';
import { ActivityTimeline } from './artifacts/ActivityTimeline';
import { BulkUpdatePreview } from './artifacts/BulkUpdatePreview';
import { ActionDraft } from './artifacts/ActionDraft';
import { ComparisonView } from './artifacts/ComparisonView';

type Props = {
  artifact: Artifact;
};

export function ArtifactPreview({ artifact }: Props) {
  switch (artifact.kind) {
    case 'soql-results':       return <SoqlResults artifact={artifact} />;
    case 'pipeline-kanban':    return <PipelineKanban artifact={artifact} />;
    case 'account-360':        return <Account360 artifact={artifact} />;
    case 'lead-scoring':       return <LeadScoringTable artifact={artifact} />;
    case 'forecast':           return <ForecastTile artifact={artifact} />;
    case 'dashboard-tiles':    return <DashboardTiles artifact={artifact} />;
    case 'case-sla':           return <CaseSlaHeatmap artifact={artifact} />;
    case 'activity-timeline':  return <ActivityTimeline artifact={artifact} />;
    case 'bulk-update-preview':return <BulkUpdatePreview artifact={artifact} />;
    case 'action-draft':       return <ActionDraft artifact={artifact} />;
    case 'comparison':         return <ComparisonView artifact={artifact} />;
    default:
      return (
        <div className="preview-empty">
          <div style={{ color: 'var(--ink-4)', fontFamily: 'var(--mono)', fontSize: 11.5 }}>
            No preview data available.
          </div>
        </div>
      );
  }
}
