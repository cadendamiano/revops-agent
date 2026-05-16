'use client';

import { useStore } from '@/lib/store';
import { estimateCostUsd } from '@/lib/models';

const MAX_BARS = 60;
const CHART_HEIGHT = 64;
const BAR_GAP = 2;

function fmtTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

function fmtCost(usd: number): string {
  if (usd === 0) return '$0.00';
  if (usd < 0.01) return '<$0.01';
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function UsageSparkline() {
  const samples = useStore(s => s.tokenHistory);
  const clear = useStore(s => s.clearTokenHistory);

  const recent = samples.slice(-MAX_BARS);
  const totalIn = recent.reduce((a, s) => a + s.inputTokens, 0);
  const totalOut = recent.reduce((a, s) => a + s.outputTokens, 0);
  const totalCost = recent.reduce(
    (a, s) => a + estimateCostUsd(s.model, s.inputTokens, s.outputTokens),
    0,
  );
  const maxTotal = Math.max(1, ...recent.map(s => s.inputTokens + s.outputTokens));

  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <span>Token burn — this session</span>
        {recent.length > 0 && (
          <button
            type="button"
            className="settings-link"
            onClick={clear}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Clear
          </button>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="settings-help">
          No requests yet — start a chat to see token burn here.
        </div>
      ) : (
        <>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11.5,
              color: 'var(--ink-2)',
              marginBottom: 8,
            }}
          >
            <strong style={{ color: 'var(--ink-1)' }}>{recent.length}</strong> request
            {recent.length === 1 ? '' : 's'} ·{' '}
            <span style={{ color: 'oklch(0.62 0.10 215)' }}>{fmtTokens(totalIn)} in</span> /{' '}
            <span style={{ color: 'oklch(0.62 0.10 25)' }}>{fmtTokens(totalOut)} out</span> ·{' '}
            <strong style={{ color: 'var(--ink-1)' }}>~{fmtCost(totalCost)}</strong>{' '}
            <span style={{ color: 'var(--ink-4)' }}>est.</span>
          </div>

          <svg
            viewBox={`0 0 ${MAX_BARS * (BAR_GAP + 4)} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
            style={{
              width: '100%',
              height: CHART_HEIGHT,
              background: 'var(--surface-2)',
              borderRadius: 4,
              padding: '4px 6px',
              boxSizing: 'border-box',
            }}
            aria-label="Token usage sparkline"
          >
            {recent.map((s, i) => {
              const total = s.inputTokens + s.outputTokens;
              const h = (total / maxTotal) * (CHART_HEIGHT - 8);
              const inH = total > 0 ? (s.inputTokens / total) * h : 0;
              const outH = h - inH;
              const x = i * (BAR_GAP + 4);
              const yOut = CHART_HEIGHT - 4 - h;
              const yIn = yOut + outH;
              return (
                <g key={s.ts + ':' + i}>
                  <title>
                    {s.model} · {fmtTokens(s.inputTokens)} in / {fmtTokens(s.outputTokens)} out ·{' '}
                    {(s.durationMs / 1000).toFixed(1)}s
                  </title>
                  <rect x={x} y={yOut} width={4} height={Math.max(0, outH)} fill="oklch(0.62 0.10 25)" />
                  <rect x={x} y={yIn} width={4} height={Math.max(0, inH)} fill="oklch(0.62 0.10 215)" />
                </g>
              );
            })}
          </svg>

          <div className="settings-help" style={{ marginTop: 6 }}>
            Each bar = one chat request. Blue = prompt tokens, red = completion tokens. Hover for details. Cost is an estimate based on list prices.
          </div>
        </>
      )}
    </section>
  );
}
