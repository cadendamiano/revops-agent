'use client';

// phase-a: neutral stub. Phase B reintroduces a domain-aware table renderer.
import { memo } from 'react';

type Props = {
  toolName: string;
  rows: any[];
  truncated?: boolean;
};

function DataTableInner({ toolName, rows, truncated }: Props) {
  if (rows.length === 0) {
    return (
      <div className="dt-empty">
        No results — try widening your filter.
      </div>
    );
  }

  const cols = Object.keys(rows[0] ?? {});
  const gridTemplate = cols.map(() => '1fr').join(' ');

  return (
    <div className="dt-card">
      <div className="dt-table" style={{ ['--dt-cols' as any]: gridTemplate }}>
        <div className="dt-head">
          {cols.map(c => <span key={c}>{c}</span>)}
        </div>
        {rows.map((row, i) => (
          <div className="dt-row" key={i}>
            {cols.map(c => (
              <span key={c} className="dt-cell">
                <span className="dt-cell-text">{renderCell(row[c])}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="dt-foot">
        <span className="dt-count">
          {rows.length.toLocaleString()} row{rows.length === 1 ? '' : 's'} · {toolName}
        </span>
        {truncated && (
          <span className="dt-kpi warn">
            <em>truncated</em> showing first {rows.length}
          </span>
        )}
      </div>
    </div>
  );
}

function renderCell(v: unknown): React.ReactNode {
  if (v == null) return '—';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 64);
  return String(v);
}

export const DataTable = memo(DataTableInner);
