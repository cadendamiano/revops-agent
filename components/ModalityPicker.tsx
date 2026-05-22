'use client';

import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/lib/store';
import type { ArtifactKind } from '@/lib/flows';

type Option = { kind: ArtifactKind | null; label: string; hint: string };

const OPTIONS: Option[] = [
  { kind: null,           label: 'Auto',        hint: 'Let the model choose' },
  { kind: 'spreadsheet',  label: 'Spreadsheet', hint: 'Tabular data, formulas' },
  { kind: 'document',     label: 'Document',    hint: 'Long-form report' },
  { kind: 'slides',       label: 'Slides',      hint: 'Presentation deck' },
  { kind: 'custom-dashboard', label: 'Dashboard', hint: 'Custom interactive view' },
];

export function ModalityPicker() {
  const { desired, streaming } = useStore(
    useShallow((s) => {
      const ws = s.activeWorkspaceId ? s.workspaces.find(w => w.id === s.activeWorkspaceId) : undefined;
      const th = ws && s.activeWorkspaceThreadId ? ws.threads.find(t => t.id === s.activeWorkspaceThreadId) : undefined;
      return { desired: th?.desiredArtifactKind, streaming: s.streaming };
    })
  );
  const setDesired = useStore(s => s.setActiveWorkspaceThreadDesiredArtifactKind);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = OPTIONS.find(o => (o.kind ?? undefined) === desired) ?? OPTIONS[0];
  const isOverridden = desired !== undefined;

  return (
    <div className="modality-picker" ref={wrapRef}>
      <button
        type="button"
        className={'modality-trigger' + (isOverridden ? ' is-set' : '')}
        disabled={streaming}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Output: ${current.label} — ${current.hint}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="modality-trigger-plus" aria-hidden>+</span>
        {isOverridden && <span className="modality-trigger-label">{current.label}</span>}
      </button>
      {open && (
        <div className="modality-menu" role="menu">
          {OPTIONS.map(opt => {
            const selected = (opt.kind ?? undefined) === desired;
            return (
              <button
                key={opt.label}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={'modality-menu-item' + (selected ? ' selected' : '')}
                onClick={() => {
                  setDesired(opt.kind ?? undefined);
                  setOpen(false);
                }}
              >
                <span className="modality-menu-label">{opt.label}</span>
                <span className="modality-menu-hint">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
