'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore, getActiveWorkspaceThread } from '@/lib/store';
import { handleApprove, handleReject, handleFormAnswer, runLLM } from '@/lib/runtime';
import { resolveComposerSubmit } from '@/lib/resolveComposerSubmit';
import { TASK_TEMPLATES, makeSeedWorkspaces } from '@/lib/data';
import { TopBar } from '@/components/TopBar';
import { Rail } from '@/components/Rail';
import { Composer } from '@/components/Composer';
import { Turn } from '@/components/Turn';
import { ArtifactPane } from '@/components/ArtifactPane';
import { ResizeHandle } from '@/components/ResizeHandle';
import { DevConfigPanel } from '@/components/DevConfigPanel';

export default function Page() {
  const workspaces = useStore(s => s.workspaces);
  const activeWorkspaceId = useStore(s => s.activeWorkspaceId);
  const activeWorkspaceThreadId = useStore(s => s.activeWorkspaceThreadId);
  const activeArtifact = useStore(s => s.activeArtifact);
  const setActiveArtifact = useStore(s => s.setActiveArtifact);
  const setComposer = useStore(s => s.setComposer);
  const accentHue = useStore(s => s.tweaks.accentHue);
  const darkMode = useStore(s => s.tweaks.darkMode);
  const newSession = useStore(s => s.newSession);
  const streaming = useStore(s => s.streaming);

  const handleChipSubmit = useCallback((body: string) => {
    const action = resolveComposerSubmit({
      body,
      streaming,
      forcedCmd: null,
      desiredArtifactKind: getActiveWorkspaceThread()?.desiredArtifactKind,
    });
    if (action.kind === 'llm') {
      runLLM(action.body, action.opts);
    }
  }, [streaming]);

  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [railW, setRailW] = useState(240);
  const [convoW, setConvoW] = useState(480);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeWsThread = useMemo(() => {
    if (!activeWorkspaceId || !activeWorkspaceThreadId) return undefined;
    const ws = workspaces.find(w => w.id === activeWorkspaceId);
    return ws?.threads.find(t => t.id === activeWorkspaceThreadId);
  }, [workspaces, activeWorkspaceId, activeWorkspaceThreadId]);

  const turns = activeWsThread?.turns ?? [];
  const approvalStates = activeWsThread?.approvalStates ?? {};

  useEffect(() => {
    if (workspaces.length === 0) {
      useStore.setState({ workspaces: makeSeedWorkspaces(Date.now()) });
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--hue', String(accentHue));
  }, [accentHue]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setTweaksOpen(v => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        newSession();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [newSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length]);

  return (
    <div className="app" style={{ '--rail-w': railW + 'px', '--convo-w': convoW + 'px' } as React.CSSProperties}>
      <TopBar />

      <Rail />

      <ResizeHandle onDelta={d => setRailW(w => Math.max(160, w + d))} />

      <main className="convo">
        <div className="convo-stream">
          {!activeWsThread && (
            <div className="testing-empty">
              <div>
                <div className="glyph" style={{ fontSize: 42, color: 'var(--ink-4)' }}>◦</div>
                <div style={{ marginTop: 10 }}>
                  Pick a workspace task to start, or create a new one.
                </div>
              </div>
            </div>
          )}
          {activeWsThread && turns.length === 0 && (
            <div className="testing-empty">
              <div>
                <div className="glyph" style={{ fontSize: 42, color: 'var(--ink-4)' }}>◦</div>
                <div style={{ marginTop: 10 }}>Start a task session — pick a template or type a prompt.</div>
                <div className="task-templates">
                  {TASK_TEMPLATES.map(t => (
                    <button key={t.label} className="composer-chip" onClick={() => runLLM(t.prompt)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {turns.map(turn => (
            <Turn
              key={turn.id}
              turn={turn}
              approvalState={
                turn.kind === 'approval'
                  ? (approvalStates[turn.payload?.batchId] ?? null)
                  : null
              }
              onApprove={handleApprove}
              onReject={handleReject}
              activeArtifact={activeArtifact}
              onOpenArtifact={setActiveArtifact}
              onSuggestion={setComposer}
              onChipSubmit={handleChipSubmit}
              onFormAnswer={handleFormAnswer}
            />
          ))}
          <div ref={bottomRef} />
        </div>
        <Composer />
      </main>

      <ResizeHandle onDelta={d => setConvoW(w => Math.max(280, w + d))} />

      <ArtifactPane />

      {tweaksOpen && <DevConfigPanel onClose={() => setTweaksOpen(false)} />}
    </div>
  );
}
