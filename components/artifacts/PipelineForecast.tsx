'use client';

import { useEffect, useState } from 'react';
import { BarChart } from '../primitives/BarChart';
import type { Artifact } from '@/lib/store';
import { handleGetPipelineForecast, type PipelineForecast as Forecast } from '@/lib/tools/sfdc-read';

type Props = { artifact: Artifact };

function fmtMoney(v: number): string {
  return '$' + Math.round(v).toLocaleString();
}

export function PipelineForecast({ artifact }: Props) {
  const [forecast, setForecast] = useState<Forecast | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fromJson = artifact.dataJson;
    if (fromJson) {
      try {
        const parsed = JSON.parse(fromJson);
        if (parsed?.forecast) {
          setForecast(parsed.forecast);
          return;
        }
      } catch {
        // fall through
      }
    }
    handleGetPipelineForecast({ quarter: 'Q2' }).then(f => {
      if (!cancelled) setForecast(f);
    });
    return () => { cancelled = true; };
  }, [artifact.dataJson]);

  if (!forecast) {
    return <div className="preview-empty" style={{ padding: 20, color: 'var(--ink-4)' }}>Loading forecast…</div>;
  }

  const chartData = forecast.byStage.map(s => ({
    cat: s.stage.replace(' ', '\n'),
    amount: Math.round(s.weighted),
  }));

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
          {forecast.quarter} pipeline forecast · weighted
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
          {fmtMoney(forecast.totalWeighted)} weighted · {fmtMoney(forecast.totalUnweighted)} unweighted · {forecast.attainmentPct}% of {fmtMoney(forecast.quotaTotal)} quota
        </div>
      </div>

      <BarChart
        data={chartData}
        title={`${forecast.quarter} weighted by stage`}
        valueKey="amount"
        labelKey="cat"
      />

      <div>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 6,
          }}
        >
          AE attainment
        </div>
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr 1fr 0.8fr',
              background: 'var(--surface-2, #f5f5f7)',
              padding: '8px 10px',
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--ink-3)',
            }}
          >
            <div>Owner</div>
            <div style={{ textAlign: 'right' }}>Quota</div>
            <div style={{ textAlign: 'right' }}>Weighted</div>
            <div style={{ textAlign: 'right' }}>Attain</div>
          </div>
          {forecast.byOwner.map((row, i) => {
            const overQuota = row.attainmentPct >= 100;
            return (
              <div
                key={row.ownerId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1fr 1fr 0.8fr',
                  padding: '8px 10px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
                  fontSize: 12.5,
                }}
              >
                <div style={{ color: 'var(--ink)', fontWeight: 500 }}>{row.ownerName}</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>{fmtMoney(row.quota)}</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmtMoney(row.weighted)}</div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: overQuota ? 'var(--pos)' : 'var(--ink-2)', fontWeight: 600 }}>
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
