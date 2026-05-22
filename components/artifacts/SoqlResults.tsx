'use client';

import { useEffect, useState } from 'react';
import type { Artifact } from '@/lib/store';

type Props = { artifact: Artifact };

type Shape = {
  soql: string;
  fields: string[];
  records: Record<string, unknown>[];
};

function renderCell(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 60);
  return String(v);
}

export function SoqlResults({ artifact }: Props) {
  const [data, setData] = useState<Shape | null>(null);

  useEffect(() => {
    if (!artifact.dataJson) return;
    try {
      const parsed = JSON.parse(artifact.dataJson);
      // Inline shape from the tool call.
      if (Array.isArray(parsed?.records) && Array.isArray(parsed?.fields)) {
        setData({ soql: parsed.soql ?? '', fields: parsed.fields, records: parsed.records });
        return;
      }
      // Demo shape: a soql string to execute against the mock (server-side).
      if (typeof parsed?.soql === 'string') {
        fetch('/api/soql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ soql: parsed.soql }),
        })
          .then(res => res.json())
          .then(r => {
            if (!('error' in r)) {
              setData({ soql: parsed.soql, fields: r.fields, records: r.records });
            }
          })
          .catch(() => {});
        return;
      }
    } catch {
      // ignore
    }
  }, [artifact.dataJson]);

  if (!data) {
    return <div className="preview-empty" style={{ padding: 20, color: 'var(--ink-4)' }}>No SOQL results loaded.</div>;
  }

  const cols = data.fields;
  const gridTemplate = cols.map(() => '1fr').join(' ');

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>SOQL Results</div>
        <pre style={{
          fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-2)',
          background: 'var(--surface-2, #f5f5f7)', padding: '8px 10px',
          borderRadius: 6, margin: '6px 0', overflow: 'auto',
        }}>{data.soql}</pre>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{data.records.length} record{data.records.length === 1 ? '' : 's'} · {cols.length} field{cols.length === 1 ? '' : 's'}</div>
      </div>
      <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: gridTemplate,
          background: 'var(--surface-2, #f5f5f7)', padding: '8px 10px',
          fontFamily: 'var(--mono)', fontSize: 10.5, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'var(--ink-3)',
        }}>
          {cols.map(c => <div key={c}>{c}</div>)}
        </div>
        {data.records.map((r, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: gridTemplate,
            padding: '8px 10px', borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
            fontSize: 12, fontFamily: 'var(--mono)',
          }}>
            {cols.map(c => (
              <div key={c} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {renderCell(r[c])}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
