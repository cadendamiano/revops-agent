'use client';

import { useEffect, useState } from 'react';
import type { Artifact } from '@/lib/store';

type Props = { artifact: Artifact };

type Item = {
  ts: string;
  type: string;
  subject: string;
  who?: string;
  durationMin?: number;
};

type Shape = { relatedTo: string; items: Item[] };

const TYPE_ICON: Record<string, string> = {
  Call: '☎', Email: '✉', Meeting: '◫', Note: '✎', StageChange: '↪',
};

export function ActivityTimeline({ artifact }: Props) {
  const [data, setData] = useState<Shape | null>(null);

  useEffect(() => {
    if (!artifact.dataJson) return;
    try {
      const parsed = JSON.parse(artifact.dataJson);
      if (Array.isArray(parsed?.items)) setData(parsed as Shape);
    } catch { /* ignore */ }
  }, [artifact.dataJson]);

  if (!data) {
    return <div className="preview-empty" style={{ padding: 20, color: 'var(--ink-4)' }}>No timeline loaded.</div>;
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Activity timeline</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
          {data.items.length} item{data.items.length === 1 ? '' : 's'} · related to <span style={{ fontFamily: 'var(--mono)' }}>{data.relatedTo}</span>
        </div>
      </div>
      <div style={{ borderLeft: '2px solid var(--line)', paddingLeft: 14, marginLeft: 6, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {data.items.map((it, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: -22, top: 2, width: 18, height: 18,
              borderRadius: '50%', background: 'var(--surface, #fff)',
              border: '2px solid var(--teal)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: 'var(--teal)',
            }}>
              {TYPE_ICON[it.type] ?? '•'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{it.subject}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{it.ts}</div>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
              {it.type}{it.durationMin ? ` · ${it.durationMin}m` : ''}{it.who ? ` · ${it.who}` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
