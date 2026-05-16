'use client';

import type { Artifact } from '@/lib/store';
import { OppHealthScorecard } from './artifacts/OppHealthScorecard';
import { PipelineForecast } from './artifacts/PipelineForecast';
import { BulkUpdatePreview } from './artifacts/BulkUpdatePreview';

type Props = {
  artifact: Artifact;
};

export function ArtifactPreview({ artifact }: Props) {
  switch (artifact.kind) {
    case 'opp-health':
      return <OppHealthScorecard artifact={artifact} />;
    case 'pipeline-forecast':
      return <PipelineForecast artifact={artifact} />;
    case 'bulk-update-preview':
      return <BulkUpdatePreview artifact={artifact} />;
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
