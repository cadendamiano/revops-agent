'use client';

import { useEffect, useState } from 'react';
import type { Artifact } from '@/lib/store';
import { runLLM } from '@/lib/runtime';

type Props = { artifact: Artifact };

type Option = { id: string; label: string; summary?: string; tradeoffs: string[]; recommended?: boolean };
type Shape = { title?: string; options: Option[] };

export function ComparisonView({ artifact }: Props) {
  const [shape, setShape] = useState<Shape | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    if (!artifact.dataJson) return;
    try {
      const parsed = JSON.parse(artifact.dataJson) as Shape;
      if (Array.isArray(parsed?.options)) setShape(parsed);
    } catch { /* ignore */ }
  }, [artifact.dataJson]);

  if (!shape) {
    return <div className="preview-empty" style={{ padding: 20, color: 'var(--ink-4)' }}>No options to compare.</div>;
  }

  const choose = (o: Option) => {
    setChosen(o.id);
    runLLM(`I'll go with: ${o.label}.`);
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{shape.title ?? 'Compare options'}</div>
      <div className="cmp-grid">
        {shape.options.map(o => (
          <div key={o.id} className={'cmp-col' + (o.recommended ? ' is-recommended' : '') + (chosen === o.id ? ' is-chosen' : '')}>
            <div className="cmp-label">
              {o.label}
              {o.recommended && <span className="cmp-rec">Recommended</span>}
            </div>
            {o.summary && <div className="cmp-summary">{o.summary}</div>}
            <ul className="cmp-tradeoffs">
              {o.tradeoffs.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
            <button
              className={'btn ' + (o.recommended ? 'btn-primary' : 'btn-ghost')}
              disabled={chosen !== null}
              onClick={() => choose(o)}
            >
              {chosen === o.id ? 'Chosen' : 'Choose this'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
