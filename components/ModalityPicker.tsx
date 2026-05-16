'use client';

import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/lib/store';
import type { ArtifactKind } from '@/lib/flows';

type Option = { kind: ArtifactKind | null; label: string; hint: string };

/** Visible options. liquidity-burndown, sweep-rule, spend-chart, crm-flow, ap-table
 *  are intentionally excluded until their renderers are refactored to be
 *  dataJson-driven (Steps 3–6 of the test-mode generic-artifacts plan).
 *  Picking them today would render demo data even in test mode. */
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

  return (
    <div className="modality-picker" role="radiogroup" aria-label="Desired artifact format">
      {OPTIONS.map(opt => {
        const selected = (opt.kind ?? undefined) === desired;
        return (
          <button
            key={opt.label}
            type="button"
            role="radio"
            aria-checked={selected}
            title={opt.hint}
            disabled={streaming}
            className={'modality-chip' + (selected ? ' selected' : '')}
            onClick={() => setDesired(selected ? undefined : (opt.kind ?? undefined))}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
