'use client';

import { useRef, useEffect, useState } from 'react';
import { useStore, getActiveWorkspaceThread } from '@/lib/store';
import { runFlow, runLLM } from '@/lib/runtime';
import { ModelPicker } from './ModelPicker';
import { ModalityPicker } from './ModalityPicker';
import { matchSlashPrefixWithShortcuts, parseSlashWithShortcuts } from '@/lib/slashCommands';
import { isShortcut, type MenuItem } from '@/lib/shortcuts';
import { resolveComposerSubmit } from '@/lib/resolveComposerSubmit';
import { SlashMenu } from './SlashMenu';

const SLASH_PREFIX_RE = /^\/([a-z0-9-]*)$/i;

export function Composer() {
  const composer = useStore(s => s.composer);
  const setComposer = useStore(s => s.setComposer);
  const streaming = useStore(s => s.streaming);
  const mode = useStore(s => s.mode);
  const modelId = useStore(s => s.tweaks.modelId);
  const settingsStatus = useStore(s => s.settingsStatus);
  const setSettingsStatus = useStore(s => s.setSettingsStatus);
  const setTweak = useStore(s => s.setTweak);
  const activeWorkspaceThreadId = useStore(s => s.activeWorkspaceThreadId);
  const shortcuts = useStore(s => s.shortcuts);
  const ref = useRef<HTMLTextAreaElement>(null);

  const [forcedCmd, setForcedCmd] = useState<MenuItem | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState('');
  const [menuIndex, setMenuIndex] = useState(0);

  useEffect(() => {
    if (!streaming) ref.current?.focus();
  }, [streaming]);

  useEffect(() => {
    if (settingsStatus != null) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setSettingsStatus({
          anthropic: Boolean(data?.anthropic?.configured),
          gemini: Boolean(data?.gemini?.configured),
          llmgateway: Boolean(data?.llmgateway?.configured),
        });
      } catch {
        // ignore — picker stays optimistic until a subsequent load succeeds
      }
    })();
    return () => { cancelled = true; };
  }, [settingsStatus, setSettingsStatus]);

  // Clear forced command when mode changes.
  useEffect(() => {
    setForcedCmd(null);
    setMenuOpen(false);
  }, [mode]);

  // Clear forced command when active workspace thread changes.
  useEffect(() => {
    setForcedCmd(null);
    setMenuOpen(false);
  }, [activeWorkspaceThreadId]);

  const openMenuFor = (query: string) => {
    setMenuQuery(query);
    setMenuIndex(0);
    setMenuOpen(true);
  };

  const onChange = (value: string) => {
    setComposer(value);

    if (forcedCmd) {
      // Once a command is locked in, textarea value is the body only.
      return;
    }

    // No-space prefix while typing the command name → menu is a filter.
    const m = SLASH_PREFIX_RE.exec(value);
    if (m) {
      openMenuFor(m[1]);
      return;
    }

    // Space after a recognized slash → lock in the command.
    const parsed = parseSlashWithShortcuts(value, shortcuts);
    if (parsed && / /.test(value)) {
      setForcedCmd(parsed.cmd);
      setMenuOpen(false);
      setComposer(parsed.body);
      return;
    }

    setMenuOpen(false);
  };

  const selectCommand = (cmd: MenuItem) => {
    setForcedCmd(cmd);
    setMenuOpen(false);
    setComposer('');
    ref.current?.focus();
  };

  const clearForced = () => {
    setForcedCmd(null);
  };

  const onSubmit = () => {
    const action = resolveComposerSubmit({
      body: composer,
      streaming,
      forcedCmd,
      mode,
      desiredArtifactKind: getActiveWorkspaceThread()?.desiredArtifactKind,
    });

    if (action.kind === 'ignore') return;

    setComposer('');
    setForcedCmd(null);
    setMenuOpen(false);

    if (action.kind === 'flow') {
      runFlow(action.flowId);
      return;
    }
    runLLM(action.body, action.opts);
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (menuOpen) {
      const matches = matchSlashPrefixWithShortcuts(menuQuery, shortcuts);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (matches.length > 0) setMenuIndex(i => (i + 1) % matches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (matches.length > 0) setMenuIndex(i => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        if (matches.length > 0) {
          e.preventDefault();
          selectCommand(matches[menuIndex] ?? matches[0]);
          return;
        }
      }
    }

    if (e.key === 'Backspace' && forcedCmd && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
      e.preventDefault();
      clearForced();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  const placeholder =
    mode === 'testing'
      ? 'Ask something -- calls the real Bill sandbox (set default in Cmd+K)'
      : `Ask the coworker something — e.g. "show me all overdue AP" or "/" for commands`;

  return (
    <div className="composer">
      {mode === 'testing' && <ModalityPicker />}
      <div className="composer-shell">
        {menuOpen && (
          <SlashMenu
            query={menuQuery}
            activeIndex={menuIndex}
            onSelect={selectCommand}
            onHover={setMenuIndex}
          />
        )}
        {forcedCmd && (
          <div className="composer-forced">
            <span className="composer-forced-chip">
              /{forcedCmd.name}
              <button
                type="button"
                aria-label={`Clear /${forcedCmd.name}`}
                onClick={clearForced}
                className="composer-forced-x"
              >
                ×
              </button>
            </span>
            <span className="composer-forced-hint">
              {isShortcut(forcedCmd) ? forcedCmd.description : forcedCmd.hint}
            </span>
          </div>
        )}
        <textarea
          ref={ref}
          value={composer}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          placeholder={forcedCmd ? `describe the ${forcedCmd.name} — body only; empty is ok` : placeholder}
          rows={1}
          disabled={streaming}
          style={{ opacity: streaming ? 0.55 : 1 }}
        />
        <div className="composer-actions">
          <div className="composer-spacer" />
          <ModelPicker />
          <button className="send-btn" onClick={onSubmit} disabled={streaming}>
            Send <span className="kbd">↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}
