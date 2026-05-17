'use client';

import { useState } from 'react';
import { useStore, type Workspace, type Artifact } from '@/lib/store';
import { Icon } from './primitives/Icon';

const Clock = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="5.4" stroke="currentColor" strokeWidth="1.2" />
    <path d="M7 4v3l2 1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const Filter = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M2 3h8M3.5 6h5M5 9h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const FolderPlus = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M1.5 3.5h3l1 1h6v6.5h-10V3.5z" stroke="var(--accent)" strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M6.5 7v2.5M5.25 8.25h2.5" stroke="var(--accent)" strokeWidth="1.1" strokeLinecap="round" />
  </svg>
);

const ChevronRight = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M3.5 2.5l3 2.5-3 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Folder = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M1.6 4.2c0-.55.45-1 1-1H5.4l1.1 1.1H11.4c.55 0 1 .45 1 1v5.5c0 .55-.45 1-1 1H2.6c-.55 0-1-.45-1-1V4.2z"
      stroke="var(--accent)"
      strokeWidth="1.2"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export function WorkspaceRailBody() {
  const view = useStore(s => s.workspaceView);
  const setView = useStore(s => s.setWorkspaceView);

  return (
    <>
      {view === 'history' ? <WorkspaceHistory onBack={() => setView('workspaces')} /> : <WorkspaceList />}
    </>
  );
}

function WorkspaceList() {
  const workspaces = useStore(s => s.workspaces);
  const setView = useStore(s => s.setWorkspaceView);
  const newWorkspace = useStore(s => s.newWorkspace);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');

  const commitNew = () => {
    const name = draftName.trim();
    if (name) newWorkspace(name);
    setCreating(false);
    setDraftName('');
  };

  return (
    <>
      <button className="ws-history-btn" onClick={() => setView('history')}>
        <span className="ws-history-icon"><Clock /></span>
        <span>History</span>
      </button>

      <div className="ws-section">
        <div className="ws-section-header">
          <span className="ws-section-label">Workbooks</span>
          <div className="ws-section-actions">
            <button className="ws-icon-btn" aria-label="Filter workspaces" title="Filter">
              <Filter />
            </button>
            <button
              className="ws-icon-btn"
              aria-label="New workbook"
              title="New workbook"
              onClick={() => setCreating(true)}
            >
              <FolderPlus />
            </button>
          </div>
        </div>

        {workspaces.map(w => (
          <WorkspaceItem key={w.id} workspace={w} />
        ))}

        {creating && (
          <div className="ws-workspace-item ws-creating">
            <span className="ws-workspace-chip" style={{ background: 'oklch(0.92 0.04 195)' }}>
              <Folder />
            </span>
            <input
              className="rail-rename-input"
              autoFocus
              value={draftName}
              placeholder="Workspace name"
              onChange={e => setDraftName(e.target.value)}
              onBlur={commitNew}
              onKeyDown={e => {
                if (e.key === 'Enter') commitNew();
                else if (e.key === 'Escape') {
                  setCreating(false);
                  setDraftName('');
                }
              }}
            />
          </div>
        )}

        {!creating && (
          <button className="ws-add-ghost" onClick={() => setCreating(true)}>
            <Icon.Plus />
            <span>New workbook</span>
          </button>
        )}
      </div>
    </>
  );
}

const KIND_LABELS: Record<string, string> = {
  'ap-table': 'Tables',
  'spend-chart': 'Charts',
  'custom-dashboard': 'Dashboards',
  'document': 'Documents',
  'liquidity-burndown': 'Burndowns',
  'rule-net15': 'Rules',
  'automation': 'Automations',
  'sweep-rule': 'Rules',
  'crm-flow': 'Flows',
};

function kindIcon(kind: string): string {
  if (kind === 'spend-chart' || kind === 'liquidity-burndown') return '\u{1F4CA}';
  if (kind === 'custom-dashboard') return '\u{1F5A5}';
  if (kind === 'document') return '\u{1F4C4}';
  if (kind === 'ap-table') return '\u{1F4CB}';
  return '⚙';
}

function ArtifactList({
  artifacts,
  workspaceId,
  threadId,
  onOpen,
}: {
  artifacts: Artifact[];
  workspaceId: string;
  threadId: string;
  onOpen: (workspaceId: string, threadId: string, artifactId: string) => void;
}) {
  const activeArtifact = useStore(s => s.activeArtifact);
  const grouped = new Map<string, Artifact[]>();
  for (const a of artifacts) {
    const label = KIND_LABELS[a.kind] ?? 'Other';
    const list = grouped.get(label);
    if (list) list.push(a);
    else grouped.set(label, [a]);
  }

  return (
    <div className="ws-artifact-list">
      {[...grouped.entries()].map(([groupLabel, items]) => (
        <div key={groupLabel}>
          <div className="ws-artifact-group-label">{groupLabel}</div>
          {items.map(a => (
            <div
              key={a.id}
              className={'ws-artifact-item' + (activeArtifact === a.id ? ' active' : '')}
              onClick={e => {
                e.stopPropagation();
                onOpen(workspaceId, threadId, a.id);
              }}
            >
              <span>{kindIcon(a.kind)}</span>
              <span>{a.label}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function WorkspaceItem({ workspace }: { workspace: Workspace }) {
  const expanded = useStore(s => s.expandedWorkspaceIds.includes(workspace.id));
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const activeThreadId = useStore(s => s.activeWorkspaceThreadId);
  const toggleExpanded = useStore(s => s.toggleWorkspaceExpanded);
  const renameWorkspace = useStore(s => s.renameWorkspace);
  const deleteWorkspace = useStore(s => s.deleteWorkspace);
  const newWorkspaceThread = useStore(s => s.newWorkspaceThread);
  const setActiveWorkspaceThread = useStore(s => s.setActiveWorkspaceThread);
  const deleteWorkspaceThread = useStore(s => s.deleteWorkspaceThread);
  const renameWorkspaceThread = useStore(s => s.renameWorkspaceThread);
  const openWorkspaceArtifact = useStore(s => s.openWorkspaceArtifact);

  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(workspace.name);
  const [renamingThreadId, setRenamingThreadId] = useState<string | null>(null);
  const [threadRenameValue, setThreadRenameValue] = useState('');
  const [expandedThreadIds, setExpandedThreadIds] = useState<Set<string>>(new Set());

  const toggleThreadExpanded = (id: string) =>
    setExpandedThreadIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const isActiveWs = activeWorkspaceId === workspace.id;

  return (
    <div className={'ws-workspace-group' + (isActiveWs ? ' active' : '')}>
      <div
        className="ws-workspace-item"
        onClick={() => !renaming && toggleExpanded(workspace.id)}
        onDoubleClick={e => {
          e.stopPropagation();
          setRenaming(true);
          setRenameValue(workspace.name);
        }}
      >
        <span className="ws-workspace-chip" style={{ background: workspace.color }}>
          <Folder />
        </span>
        {renaming ? (
          <input
            className="rail-rename-input"
            value={renameValue}
            autoFocus
            onClick={e => e.stopPropagation()}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={() => {
              renameWorkspace(workspace.id, renameValue);
              setRenaming(false);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                renameWorkspace(workspace.id, renameValue);
                setRenaming(false);
              } else if (e.key === 'Escape') {
                setRenaming(false);
              }
            }}
          />
        ) : (
          <span className="ws-workspace-name">{workspace.name}</span>
        )}
        <span className={'ws-chevron' + (expanded ? ' open' : '')}>
          <ChevronRight />
        </span>
        <button
          className="icon-btn ws-workspace-del"
          aria-label="Delete workspace"
          onClick={e => {
            e.stopPropagation();
            if (confirm(`Delete workspace "${workspace.name}"?`)) {
              deleteWorkspace(workspace.id);
            }
          }}
        >
          <Icon.Trash />
        </button>
      </div>

      {expanded && (
        <div className="ws-workspace-children">
          {workspace.threads.map(t => {
            const isActive = isActiveWs && activeThreadId === t.id;
            const hasArtifacts = t.artifacts.length > 0;
            const isThreadExpanded = expandedThreadIds.has(t.id);

            return (
              <div key={t.id} className="ws-thread-group">
                <div
                  className={'ws-thread-item' + (isActive ? ' active' : '')}
                  onClick={() => {
                    if (renamingThreadId === t.id) return;
                    setActiveWorkspaceThread(workspace.id, t.id);
                    if (hasArtifacts) toggleThreadExpanded(t.id);
                  }}
                >
                  {hasArtifacts && (
                    <span className={'ws-thread-chevron' + (isThreadExpanded ? ' open' : '')}>
                      <ChevronRight />
                    </span>
                  )}
                  <span className="ws-thread-glyph">{'◦'}</span>
                  {renamingThreadId === t.id ? (
                    <input
                      className="rail-rename-input"
                      value={threadRenameValue}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                      onChange={e => setThreadRenameValue(e.target.value)}
                      onBlur={() => {
                        if (threadRenameValue.trim()) {
                          renameWorkspaceThread(workspace.id, t.id, threadRenameValue.trim());
                        }
                        setRenamingThreadId(null);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          if (threadRenameValue.trim()) {
                            renameWorkspaceThread(workspace.id, t.id, threadRenameValue.trim());
                          }
                          setRenamingThreadId(null);
                        } else if (e.key === 'Escape') {
                          setRenamingThreadId(null);
                        }
                      }}
                    />
                  ) : (
                    <span
                      className="ws-thread-title"
                      onDoubleClick={e => {
                        e.stopPropagation();
                        setRenamingThreadId(t.id);
                        setThreadRenameValue(t.title);
                      }}
                    >{t.title}</span>
                  )}
                  {hasArtifacts && (
                    <span className="ws-thread-meta">{t.artifacts.length}</span>
                  )}
                  <button
                    className="icon-btn ws-thread-del"
                    aria-label="Delete task"
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm(`Delete task "${t.title}"?`)) {
                        deleteWorkspaceThread(workspace.id, t.id);
                      }
                    }}
                  >
                    <Icon.Trash />
                  </button>
                </div>

                {hasArtifacts && isThreadExpanded && (
                  <ArtifactList
                    artifacts={t.artifacts}
                    workspaceId={workspace.id}
                    threadId={t.id}
                    onOpen={openWorkspaceArtifact}
                  />
                )}
              </div>
            );
          })}

          <button
            className="ws-thread-item ws-add-thread"
            onClick={() => newWorkspaceThread(workspace.id)}
          >
            <span className="ws-thread-glyph">{'＋'}</span>
            <span className="ws-thread-title">New task</span>
          </button>

          {workspace.files.map(f => (
            <div key={f.id} className="ws-file-item">
              <span className="ws-file-glyph"><Icon.Doc /></span>
              <span className="ws-file-name">{f.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkspaceHistory({ onBack }: { onBack: () => void }) {
  const workspaces = useStore(s => s.workspaces);
  const setActiveWorkspaceThread = useStore(s => s.setActiveWorkspaceThread);

  const items = workspaces
    .flatMap(w =>
      w.threads.map(t => ({
        workspaceId: w.id,
        workspaceName: w.name,
        workspaceIcon: w.icon,
        workspaceColor: w.color,
        threadId: t.id,
        title: t.title,
        createdAt: t.createdAt,
        turnCount: t.turns.length,
      }))
    )
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <>
      <button className="ws-history-btn ws-history-active" onClick={onBack}>
        <span className="ws-history-icon"><Clock /></span>
        <span>History</span>
        <span className="ws-history-back">← Workspaces</span>
      </button>

      <div className="ws-section">
        <div className="ws-section-header">
          <span className="ws-section-label">Recent tasks</span>
        </div>

        {items.length === 0 && (
          <div className="rail-empty">No tasks yet.</div>
        )}

        {items.map(item => (
          <div
            key={item.threadId}
            className="ws-history-item"
            onClick={() => setActiveWorkspaceThread(item.workspaceId, item.threadId)}
          >
            <span className="ws-history-chip" style={{ background: item.workspaceColor }}>
              <Folder />
            </span>
            <div className="ws-history-body">
              <div className="ws-history-title">{item.title}</div>
              <div className="ws-history-meta">
                {item.workspaceName} · {item.turnCount} turn{item.turnCount === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
