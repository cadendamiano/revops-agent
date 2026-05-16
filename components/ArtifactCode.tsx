'use client';

// phase-a: neutral stub. Phase B replaces with SF code templates.
import type { Artifact } from '@/lib/store';

type Props = {
  artifact: Artifact;
};

function timeAgo(ts: number | undefined): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ArtifactCode({ artifact }: Props) {
  const editInfo = artifact.editedBy
    ? ` · ${artifact.editedBy} edited ${timeAgo(artifact.editedAt)}`
    : '';
  const hasHumanEdit = Boolean(artifact.editedBy);

  return (
    <div className="code-view">
      <div className="code-view-meta">
        <span className="code-view-version">
          {hasHumanEdit && <span className="code-view-edit-dot" title="Code edited — logic view may differ" />}
          v{artifact.version || 1}
        </span>
        <span className="code-view-author">
          by {artifact.createdBy || 'Coworker'}{editInfo}
        </span>
        <span className="code-view-badge">read-only</span>
      </div>
      <div className="code-block">
        <div className="code-line">
          <span className="code-ln">1</span>
          <span className="code-ln-text" style={{ color: 'var(--ink-4)' }}>
            # No code template for this artifact kind
          </span>
        </div>
      </div>
    </div>
  );
}
