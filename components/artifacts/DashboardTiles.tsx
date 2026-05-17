'use client';

import { useEffect, useState } from 'react';
import type { Artifact } from '@/lib/store';
import { BarChart } from '../primitives/BarChart';

type Props = { artifact: Artifact };

type Tile = {
  type: 'metric' | 'bar' | 'donut' | 'line';
  label: string;
  value?: string | number;
  series?: { label: string; value: number }[];
};

type Shape = { name: string; tiles: Tile[] };

export function DashboardTiles({ artifact }: Props) {
  const [data, setData] = useState<Shape | null>(null);

  useEffect(() => {
    if (!artifact.dataJson) return;
    try {
      const parsed = JSON.parse(artifact.dataJson);
      if (Array.isArray(parsed?.tiles)) setData(parsed as Shape);
    } catch { /* ignore */ }
  }, [artifact.dataJson]);

  if (!data) return <div className="preview-empty" style={{ padding: 20, color: 'var(--ink-4)' }}>No dashboard loaded.</div>;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{data.name}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{data.tiles.length} tile{data.tiles.length === 1 ? '' : 's'}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {data.tiles.map((t, i) => <TileCard key={i} tile={t} />)}
      </div>
    </div>
  );
}

function TileCard({ tile }: { tile: Tile }) {
  if (tile.type === 'metric') {
    return (
      <div style={{ padding: 14, borderRadius: 8, border: '1px solid var(--line)' }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
        }}>{tile.label}</div>
        <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--ink)' }}>
          {String(tile.value ?? '—')}
        </div>
      </div>
    );
  }
  if (tile.type === 'bar' && tile.series) {
    return (
      <div style={{ padding: 12, borderRadius: 8, border: '1px solid var(--line)' }}>
        <BarChart
          data={tile.series.map(s => ({ cat: s.label, amount: s.value }))}
          title={tile.label}
          valueKey="amount"
          labelKey="cat"
          height={180}
        />
      </div>
    );
  }
  if (tile.type === 'donut' && tile.series) {
    const total = tile.series.reduce((s, x) => s + x.value, 0) || 1;
    return (
      <div style={{ padding: 14, borderRadius: 8, border: '1px solid var(--line)' }}>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
        }}>{tile.label}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tile.series.map(s => {
            const pct = Math.round((s.value / total) * 100);
            return (
              <div key={s.label} style={{ fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ color: 'var(--ink)' }}>{s.label}</span>
                  <span style={{ fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>{s.value} · {pct}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--line-2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--teal)' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  // line — fall back to a simple series listing.
  return (
    <div style={{ padding: 14, borderRadius: 8, border: '1px solid var(--line)' }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
      }}>{tile.label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-2)' }}>
        {tile.series?.map(s => `${s.label}: ${s.value}`).join(' · ') ?? '—'}
      </div>
    </div>
  );
}
