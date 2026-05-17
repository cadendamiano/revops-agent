import { fmtMoneyShort } from '@/lib/format';

type ProjectionPoint = { day: string; balance: number };

export type LineChartMarker = {
  day: string;
  label?: string;
  color?: string;
};

type Props = {
  data: ProjectionPoint[];
  threshold?: number;
  height?: number;
  accent?: string;
  title?: string;
  markers?: LineChartMarker[];
};

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function LineChart({
  data,
  threshold,
  height = 220,
  accent = 'var(--accent)',
  title,
  markers,
}: Props) {
  if (data.length === 0) return null;

  const pad = 28;
  const rightPad = 76;
  const topPad = 28;
  const bottomPad = 36;
  const viewW = 640;
  const viewH = height + topPad + bottomPad;

  const plotW = viewW - pad - rightPad;
  const plotH = height;
  const plotLeft = pad;
  const plotTop = topPad;
  const plotBottom = topPad + plotH;

  const maxVal = Math.max(...data.map(p => p.balance)) * 1.1;
  const minVal = 0;

  const xOf = (i: number) =>
    plotLeft + (plotW * i) / Math.max(1, data.length - 1);
  const yOf = (v: number) =>
    plotBottom - ((v - minVal) / Math.max(1, maxVal - minVal)) * plotH;

  // Find min balance point
  let minIdx = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i].balance < data[minIdx].balance) minIdx = i;
  }
  const minPoint = data[minIdx];

  const linePts = data.map((p, i) => `${xOf(i)},${yOf(p.balance)}`).join(' ');

  // X axis labels: sample ~7
  const step = Math.max(1, Math.ceil(data.length / 7));
  const xTicks: number[] = [];
  for (let i = 0; i < data.length; i += step) xTicks.push(i);
  if (xTicks[xTicks.length - 1] !== data.length - 1) xTicks.push(data.length - 1);

  // Gridlines: 4 horizontal dashed
  const gridFractions = [0.2, 0.4, 0.6, 0.8];

  const thresholdY = threshold !== undefined ? yOf(threshold) : null;

  return (
    <div className="chart-card">
      {title && (
        <div className="chart-head">
          <h3>{title}</h3>
          <div className="legend">
            <span>
              <span className="swatch" style={{ background: accent }} />balance
            </span>
            {threshold !== undefined && (
              <span>
                <span className="swatch" style={{ background: 'rgba(220,38,38,0.6)' }} />
                floor {fmtMoneyShort(threshold)}
              </span>
            )}
          </div>
        </div>
      )}
      <svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" style={{ display: 'block' }}>
        {/* Gridlines */}
        {gridFractions.map((f, i) => {
          const y = plotTop + plotH * f;
          return (
            <line
              key={`g${i}`}
              x1={plotLeft}
              x2={plotLeft + plotW}
              y1={y}
              y2={y}
              stroke="var(--line-2)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          );
        })}

        {/* Threshold band and line */}
        {thresholdY !== null && (
          <>
            <rect
              x={plotLeft}
              y={thresholdY}
              width={plotW}
              height={plotBottom - thresholdY}
              className="linechart-threshold-band"
            />
            <line
              x1={plotLeft}
              x2={plotLeft + plotW}
              y1={thresholdY}
              y2={thresholdY}
              className="linechart-threshold-line"
              strokeWidth={1.2}
            />
            <text
              x={plotLeft + plotW + 6}
              y={thresholdY + 4}
              fontSize="11"
              fontFamily="var(--mono)"
              fill="rgba(220,38,38,0.85)"
            >
              Floor: {fmtMoneyShort(threshold!)}
            </text>
          </>
        )}

        {/* Y label: top of range */}
        <text
          x={plotLeft + plotW + 6}
          y={plotTop + 4}
          fontSize="11"
          fontFamily="var(--mono)"
          fill="var(--ink-3)"
        >
          {fmtMoneyShort(maxVal)}
        </text>

        {/* Curve */}
        <polyline
          points={linePts}
          fill="none"
          stroke={accent}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Min marker: vertical dashed line + bubble label (suppressed when sweep markers are provided) */}
        {(!markers || markers.length === 0) && (
          <>
            <line
              x1={xOf(minIdx)}
              x2={xOf(minIdx)}
              y1={plotTop}
              y2={plotBottom}
              className="linechart-min-marker"
              strokeWidth={1}
            />
            <circle
              cx={xOf(minIdx)}
              cy={yOf(minPoint.balance)}
              r={3.5}
              fill={accent}
              stroke="var(--surface)"
              strokeWidth={1.5}
            />
            <text
              x={xOf(minIdx)}
              y={yOf(minPoint.balance) - 10}
              fontSize="11"
              fontFamily="var(--mono)"
              textAnchor={minIdx > data.length / 2 ? 'end' : 'start'}
              className="linechart-min-label"
            >
              {formatShortDate(minPoint.day)} · {fmtMoneyShort(minPoint.balance)}
            </text>
          </>
        )}

        {/* Sweep event markers: vertical dashed line + dot + label */}
        {markers && markers.map((m, mi) => {
          const idx = data.findIndex(p => p.day === m.day);
          if (idx < 0) return null;
          const mx = xOf(idx);
          const my = yOf(data[idx].balance);
          const color = m.color ?? 'var(--pos)';
          const anchor = idx > data.length / 2 ? 'end' : 'start';
          const labelDx = anchor === 'end' ? -6 : 6;
          return (
            <g key={`mk${mi}`}>
              <line
                x1={mx}
                x2={mx}
                y1={plotTop}
                y2={plotBottom}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="2 3"
                opacity={0.6}
              />
              <circle
                cx={mx}
                cy={my}
                r={3.5}
                fill={color}
                stroke="var(--surface)"
                strokeWidth={1.5}
              />
              {m.label && (
                <text
                  x={mx + labelDx}
                  y={my - 8}
                  fontSize="11"
                  fontFamily="var(--mono)"
                  textAnchor={anchor}
                  fill={color}
                  fontWeight={600}
                >
                  {m.label}
                </text>
              )}
            </g>
          );
        })}

        {/* X axis labels */}
        {xTicks.map((i) => (
          <text
            key={`x${i}`}
            x={xOf(i)}
            y={plotBottom + 18}
            fontSize="10.5"
            fontFamily="var(--mono)"
            textAnchor="middle"
            fill="var(--ink-3)"
          >
            {formatShortDate(data[i].day)}
          </text>
        ))}
      </svg>
    </div>
  );
}
