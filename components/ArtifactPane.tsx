'use client';

import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/lib/store';
import { Icon } from './primitives/Icon';
import { HtmlArtifact } from './artifacts/HtmlArtifact';
import { DocumentArtifact } from './artifacts/DocumentArtifact';
import { SpreadsheetArtifact } from './artifacts/SpreadsheetArtifact';
import { SlidesArtifact } from './artifacts/SlidesArtifact';
import { OppHealthScorecard } from './artifacts/OppHealthScorecard';
import { PipelineForecast } from './artifacts/PipelineForecast';
import { BulkUpdatePreview } from './artifacts/BulkUpdatePreview';
import { ArtifactPreview } from './ArtifactPreview';
import { ArtifactCode } from './ArtifactCode';
import type { ArtifactKind } from '@/lib/flows';
import type { Artifact, ArtifactStatus } from '@/lib/store';

const EMPTY_ARTIFACTS: Artifact[] = [];

function glyphFor(kind: ArtifactKind) {
  if (kind === 'spreadsheet') return <Icon.Table />;
  if (kind === 'custom-dashboard') return <Icon.Chart />;
  if (kind === 'slides') return <Icon.Doc />;
  if (kind === 'opp-health') return <Icon.Table />;
  if (kind === 'pipeline-forecast') return <Icon.Chart />;
  if (kind === 'bulk-update-preview') return <Icon.Table />;
  return <Icon.Doc />;
}

type ViewTab = 'logic' | 'preview' | 'code';

function statusBadgeClass(status: ArtifactStatus | undefined): string {
  if (status === 'active') return 'artifact-status-badge active';
  if (status === 'paused') return 'artifact-status-badge paused';
  return 'artifact-status-badge draft';
}

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

export function ArtifactPane() {
  const showCodeView = useStore(s => s.tweaks.showCodeView);
  const setWsThreadArtifacts = useStore(s => s.setArtifactsInActiveWorkspaceThread);
  const mode = useStore(s => s.mode);

  const active = useStore(s => s.activeArtifact);
  const setActive = useStore(s => s.setActiveArtifact);

  const [view, setView] = useState<ViewTab>('logic');

  const artifacts = useStore(
    useShallow((s) => {
      if (!s.activeWorkspaceId || !s.activeWorkspaceThreadId) return EMPTY_ARTIFACTS;
      const ws = s.workspaces.find(w => w.id === s.activeWorkspaceId);
      const th = ws?.threads.find(t => t.id === s.activeWorkspaceThreadId);
      return th?.artifacts ?? EMPTY_ARTIFACTS;
    })
  );

  const cur = artifacts.find(a => a.id === active);
  const isOpen = !!active;

  useEffect(() => {
    setView('logic');
  }, [active]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setActive(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, setActive]);

  const closeOne = (id: string) => {
    setWsThreadArtifacts(prev => prev.filter(x => x.id !== id));
    if (active === id) setActive(null);
  };

  return (
    <>
      <div
        className={'artifact-scrim' + (isOpen ? ' open' : '')}
        onClick={() => setActive(null)}
      />
      <section className={'artifact-pane' + (isOpen ? ' open' : '')}>
        <div className="artifact-tabs">
          {artifacts.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 14px',
                color: 'var(--ink-4)',
                fontFamily: 'var(--mono)',
                fontSize: 11.5,
              }}
            >
              Artifacts · nothing open
            </div>
          ) : (
            artifacts.map(a => (
              <div
                key={a.id}
                className={'artifact-tab' + (active === a.id ? ' active' : '')}
                onClick={() => setActive(a.id)}
              >
                <span className="icn">{glyphFor(a.kind)}</span>
                <span>{a.label}</span>
                <span
                  className="close"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeOne(a.id);
                  }}
                >
                  <Icon.Close />
                </span>
              </div>
            ))
          )}
          <div className="artifact-tabs-spacer" />
          <div className="artifact-tools">
            <button className="icon-btn" title="Copy as link">↗</button>
            <button className="icon-btn" title="Download">⤓</button>
            <button
              className="icon-btn artifact-drawer-close"
              title="Close panel (Esc)"
              aria-label="Close artifact panel"
              onClick={() => setActive(null)}
            >
              <Icon.Close />
            </button>
          </div>
        </div>

        <div className="artifact-content">
          {cur ? (
            <>
              <div className="artifact-view-bar">
                <div className="artifact-view-tabs">
                  {(['logic', 'preview', ...(showCodeView ? ['code'] : [])] as ViewTab[]).map(v => (
                    <button
                      key={v}
                      className={'artifact-view-tab' + (view === v ? ' active' : '')}
                      onClick={() => setView(v)}
                    >
                      {v === 'logic'
                        ? 'Logic'
                        : v === 'preview'
                          ? mode === 'testing' ? 'Preview' : 'Ledger'
                          : 'Code'}
                    </button>
                  ))}
                </div>
                <div className="artifact-provenance">
                  <span className={statusBadgeClass(cur.status)}>
                    {cur.status ?? 'draft'}
                  </span>
                  <span className="artifact-prov-version">
                    {cur.editedBy && <span className="artifact-prov-dot" title="Hand-edited — logic and code may differ" />}
                    v{cur.version ?? 1}
                  </span>
                  <span className="artifact-prov-sep">·</span>
                  <span className="artifact-prov-author">
                    {cur.createdBy ?? 'Coworker'}
                    {cur.editedBy ? ` · ${cur.editedBy} edited ${timeAgo(cur.editedAt)}` : ''}
                  </span>
                </div>
              </div>

              <div className="artifact-body">
                {view === 'preview' && <ArtifactPreview artifact={cur} />}
                {view === 'code' && <ArtifactCode artifact={cur} />}
                {view === 'logic' && cur.kind === 'spreadsheet' && (
                  <SpreadsheetArtifact artifact={cur} />
                )}
                {view === 'logic' && cur.kind === 'custom-dashboard' && <HtmlArtifact artifact={cur} />}
                {view === 'logic' && cur.kind === 'document' && <DocumentArtifact artifact={cur} />}
                {view === 'logic' && cur.kind === 'slides' && <SlidesArtifact artifact={cur} />}
                {view === 'logic' && cur.kind === 'opp-health' && <OppHealthScorecard artifact={cur} />}
                {view === 'logic' && cur.kind === 'pipeline-forecast' && <PipelineForecast artifact={cur} />}
                {view === 'logic' && cur.kind === 'bulk-update-preview' && <BulkUpdatePreview artifact={cur} />}
              </div>
            </>
          ) : (
            <EmptyArtifact />
          )}
        </div>
      </section>
    </>
  );
}

function EmptyArtifact() {
  return (
    <div className="artifact-empty">
      <div>
        <div className="glyph">◫</div>
        <div>
          Artifacts the coworker creates
          <br />
          open here side-by-side.
        </div>
        <div style={{ marginTop: 12, color: 'var(--ink-3)' }}>
          Spreadsheets · Documents · Slides · Dashboards
        </div>
      </div>
    </div>
  );
}
