'use client';

import { useState } from 'react';
import type { ToolRowSpec } from '@/lib/flows';

const COLLAPSE_THRESHOLD = 80;

const ChevronRight = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
    <path d="M3.5 2.5l3 2.5-3 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function tryPrettyJson(s: string): string | null {
  const trimmed = s.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return null;
  }
}

export function ToolRow({ row }: { row: ToolRowSpec }) {
  const [open, setOpen] = useState(false);
  const isOk = !row.status || row.status === '200' || row.status === 'ok';

  const filter = row.filter ?? '';
  const collapsible = filter.length > COLLAPSE_THRESHOLD;
  const detailText = collapsible ? (tryPrettyJson(filter) ?? filter) : filter;

  return (
    <div className={`tool-row-wrap${collapsible ? ' collapsible' : ''}${open ? ' open' : ''}`}>
      <div
        className={`tool-row${collapsible ? ' expand' : ''}`}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? open : undefined}
      >
        <span className="glyph">
          {collapsible ? <span className={`tool-row-chev${open ? ' open' : ''}`}><ChevronRight /></span> : '→'}
        </span>
        <span className="endpoint">
          <span className="verb">{row.verb}</span>
          <span className="path">{row.path}</span>
          {filter && <span className="filter"> {filter}</span>}
        </span>
        <span className="result">
          {row.status && <span className={isOk ? 'ok' : ''}>{row.status}</span>}
          {row.status && row.result ? ' · ' : ''}
          {row.result}
        </span>
      </div>
      {collapsible && open && (
        <pre className="tool-row-detail">{detailText}</pre>
      )}
    </div>
  );
}
