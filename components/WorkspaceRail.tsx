'use client';

import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { Icon } from './primitives/Icon';

const Pin = ({ filled }: { filled?: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill={filled ? 'currentColor' : 'none'}>
    <path
      d="M4.2 1.5h3.6l-.5 3 1.7 1.5v1H3v-1l1.7-1.5-.5-3z"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinejoin="round"
    />
    <path d="M6 7v3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
  </svg>
);

type SessionEntry = {
  workspaceId: string;
  threadId: string;
  title: string;
  createdAt: number;
  pinned: boolean;
};

const DAY = 86_400_000;

function bucketLabel(createdAt: number, now: number): string {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  if (createdAt >= startOfToday.getTime()) return 'Today';
  const age = now - createdAt;
  if (age < 7 * DAY) return 'Previous 7 days';
  if (age < 30 * DAY) return 'Previous 30 days';
  return 'Older';
}

const TIME_ORDER = ['Today', 'Previous 7 days', 'Previous 30 days', 'Older'];

export function WorkspaceRailBody() {
  return <SessionList />;
}

function SessionList() {
  const workspaces = useStore(s => s.workspaces);
  const newSession = useStore(s => s.newSession);

  const entries: SessionEntry[] = workspaces.flatMap(w =>
    w.threads.map(t => ({
      workspaceId: w.id,
      threadId: t.id,
      title: t.title,
      createdAt: t.createdAt,
      pinned: !!t.pinned,
    }))
  );

  const now = Date.now();
  const pinned = entries.filter(e => e.pinned).sort((a, b) => b.createdAt - a.createdAt);

  const timeBuckets = new Map<string, SessionEntry[]>();
  for (const e of entries) {
    if (e.pinned) continue;
    const label = bucketLabel(e.createdAt, now);
    const list = timeBuckets.get(label);
    if (list) list.push(e);
    else timeBuckets.set(label, [e]);
  }

  const sections: { label: string; items: SessionEntry[] }[] = [];
  if (pinned.length) sections.push({ label: 'Pinned', items: pinned });
  for (const label of TIME_ORDER) {
    const items = timeBuckets.get(label);
    if (items && items.length) {
      sections.push({ label, items: items.sort((a, b) => b.createdAt - a.createdAt) });
    }
  }

  return (
    <>
      <button className="ws-new-session" onClick={() => newSession()}>
        <Icon.Plus />
        <span>New session</span>
      </button>

      {sections.length === 0 && <div className="rail-empty">No sessions yet.</div>}

      {sections.map(section => (
        <div key={section.label} className="ws-section">
          <div className="ws-session-label">{section.label}</div>
          {section.items.map(e => (
            <SessionRow key={e.threadId} entry={e} />
          ))}
        </div>
      ))}
    </>
  );
}

function SessionRow({ entry }: { entry: SessionEntry }) {
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const activeThreadId = useStore(s => s.activeWorkspaceThreadId);
  const setActiveWorkspaceThread = useStore(s => s.setActiveWorkspaceThread);
  const renameWorkspaceThread = useStore(s => s.renameWorkspaceThread);
  const deleteWorkspaceThread = useStore(s => s.deleteWorkspaceThread);
  const toggleThreadPinned = useStore(s => s.toggleThreadPinned);

  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(entry.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isActive = activeWorkspaceId === entry.workspaceId && activeThreadId === entry.threadId;

  const commitRename = () => {
    if (renameValue.trim()) renameWorkspaceThread(entry.workspaceId, entry.threadId, renameValue.trim());
    setRenaming(false);
  };

  return (
    <div
      className={'ws-session-row' + (isActive ? ' active' : '')}
      onClick={() => { if (!renaming) setActiveWorkspaceThread(entry.workspaceId, entry.threadId); }}
    >
      {renaming ? (
        <input
          className="rail-rename-input"
          value={renameValue}
          autoFocus
          onClick={e => e.stopPropagation()}
          onChange={e => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') commitRename();
            else if (e.key === 'Escape') setRenaming(false);
          }}
        />
      ) : (
        <span
          className="ws-session-title"
          onDoubleClick={e => { e.stopPropagation(); setRenameValue(entry.title); setRenaming(true); }}
        >{entry.title}</span>
      )}

      {!renaming && (confirmingDelete ? (
        <span className="ws-inline-confirm">
          <button className="ws-confirm-yes" onClick={e => { e.stopPropagation(); deleteWorkspaceThread(entry.workspaceId, entry.threadId); }}>Delete</button>
          <button className="ws-confirm-cancel" onClick={e => { e.stopPropagation(); setConfirmingDelete(false); }}>Cancel</button>
        </span>
      ) : (
        <span className="ws-session-actions">
          <button
            className={'ws-pin-btn' + (entry.pinned ? ' pinned' : '')}
            aria-label={entry.pinned ? 'Unpin session' : 'Pin session'}
            title={entry.pinned ? 'Unpin' : 'Pin'}
            onClick={e => { e.stopPropagation(); toggleThreadPinned(entry.workspaceId, entry.threadId); }}
          >
            <Pin filled={entry.pinned} />
          </button>
          <button
            className="icon-btn ws-session-del"
            aria-label="Delete session"
            onClick={e => { e.stopPropagation(); setConfirmingDelete(true); }}
          >
            <Icon.Trash />
          </button>
        </span>
      ))}
    </div>
  );
}
