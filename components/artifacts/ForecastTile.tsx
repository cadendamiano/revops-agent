'use client';

import { useEffect, useState } from 'react';
import { BarChart } from '../primitives/BarChart';
import type { Artifact } from '@/lib/store';
import { getPipelineForecast } from '@/lib/salesforce/queries';

type Props = { artifact: Artifact };

type Shape = {
  commit: number;
  bestCase: number;
  pipeline: number;
  quota: number;
  byStage: { stage: string; count: number; weighted: number }[];
  byOwner: { ownerName: string; quota: number; weighted: number; attainmentPct: number }[];
};

function fmtMoney(v: number): string {
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2) + 'M';
  if (v >= 1_000) return '$' + Math.round(v / 1_000) + 'k';
  return '$' + Math.round(v);
}

function buildFromForecast(reportId?: string): Shape {
  const f = getPipelineForecast('Q2');
  // commit = weighted from Closed Won + Scheduled/Invoiced, bestCase adds Quoted
  const commit = f.byStage
    .filter(s => s.stage === 'Closed Won' || s.stage === 'Scheduled' || s.stage === 'Invoiced' || s.stage === 'Job Complete')
    .reduce((sum, s) => sum + s.weighted, 0);
  const bestCase = commit + f.byStage.filter(s => s.stage === 'Quoted').reduce((sum, s) => sum + s.weighted, 0);
  return {
    commit, bestCase,
    pipeline: f.totalWeighted, quota: f.quotaTotal,
    byStage: f.byStage.map(s => ({ stage: s.stage, count: s.count, weighted: Math.round(s.weighted) })),
    byOwner: f.byOwner,
  };
  void reportId;
}

export function ForecastTile({ artifact }: Props) {
  const [data, setData] = useState<Shape | null>(null);

  useEffect(() => {
    if (artifact.dataJson) {
      try {
        const parsed = JSON.parse(artifact.dataJson);
        if (Array.isArray(parsed?.byStage) && typeof parsed?.commit === 'number') {
          setData(parsed as Shape);
          return;
        }
        if (parsed?.reportId) {
          setData(buildFromForecast(parsed.reportId));
          return;
        }
      } catch { /* ignore */ }
    }
    setData(buildFromForecast('ForecastQ2'));
  }, [artifact.dataJson]);

  if (!data) return <div className="preview-empty" style={{ padding: 20, color: 'var(--ink-4)' }}>Loading forecast…</div>;

  const attainPct = data.quota > 0 ? Math.round((data.pipeline / data.quota) * 100) : 0;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Q2 Forecast · weighted</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
          {fmtMoney(data.pipeline)} weighted pipeline · {attainPct}% of {fmtMoney(data.quota)} quota
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <Tile label="Commit"    value={fmtMoney(data.commit)}   />
        <Tile label="Best Case" value={fmtMoney(data.bestCase)} />
        <Tile label="Pipeline"  value={fmtMoney(data.pipeline)} highlight />
        <Tile label="Quota"     value={fmtMoney(data.quota)}    />
      </div>

      <BarChart
        data={data.byStage.map(s => ({ cat: s.stage.replace(' ', '\n'), amount: s.weighted }))}
        title="Weighted by stage"
        valueKey="amount"
        labelKey="cat"
      />

      <div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
        }}>AE attainment</div>
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.8fr',
            background: 'var(--surface-2, #f5f5f7)', padding: '8px 10px',
            fontFamily: 'var(--mono)', fontSize: 10.5,
            textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)',
          }}>
            <div>Owner</div>
            <div style={{ textAlign: 'right' }}>Quota</div>
            <div style={{ textAlign: 'right' }}>Weighted</div>
            <div style={{ textAlign: 'right' }}>Attain</div>
          </div>
          {data.byOwner.map((row, i) => {
            const over = row.attainmentPct >= 100;
            return (
              <div key={row.ownerName} style={{
                display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.8fr',
                padding: '8px 10px', borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
                fontSize: 12.5,
              }}>
                <div style={{ color: 'var(--ink)', fontWeight: 500 }}>{row.ownerName}</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtMoney(row.quota)}</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmtMoney(row.weighted)}</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: over ? 'var(--pos)' : 'var(--ink-2)', fontWeight: 600 }}>
                  {row.attainmentPct}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: 12, borderRadius: 8,
      background: highlight ? 'rgba(20, 184, 166, 0.12)' : 'var(--surface-2, #f5f5f7)',
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
      }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: highlight ? 'var(--teal)' : 'var(--ink)' }}>
        {value}
      </div>
    </div>
  );
}
