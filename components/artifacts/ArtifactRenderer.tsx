'use client';

import type { Artifact } from '@/lib/store';
import { HtmlArtifact } from './HtmlArtifact';
import { DocumentArtifact } from './DocumentArtifact';
import { SpreadsheetArtifact } from './SpreadsheetArtifact';
import { SlidesArtifact } from './SlidesArtifact';
import { OppHealthScorecard } from './OppHealthScorecard';
import { PipelineForecast } from './PipelineForecast';
import { BulkUpdatePreview } from './BulkUpdatePreview';

export function ArtifactRenderer({ artifact }: { artifact: Artifact }) {
  switch (artifact.kind) {
    case 'spreadsheet':
      return <SpreadsheetArtifact artifact={artifact} />;
    case 'custom-dashboard':
      return <HtmlArtifact artifact={artifact} />;
    case 'document':
      return <DocumentArtifact artifact={artifact} />;
    case 'slides':
      return <SlidesArtifact artifact={artifact} />;
    case 'opp-health':
      return <OppHealthScorecard artifact={artifact} />;
    case 'pipeline-forecast':
      return <PipelineForecast artifact={artifact} />;
    case 'bulk-update-preview':
      return <BulkUpdatePreview artifact={artifact} />;
  }
}
