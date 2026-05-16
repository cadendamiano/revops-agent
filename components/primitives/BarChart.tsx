import { fmtMoneyShort } from '@/lib/format';

type Props = {
  data: Record<string, number | string>[];
  title: string;
  valueKey?: string;
  labelKey?: string;
  height?: number;
  accent?: string;
};

export function BarChart({
  data,
  title,
  valueKey = 'amount',
  labelKey = 'cat',
  height = 220,
  accent = 'var(--teal)',
}: Props) {
  const values = data.map(d => Number(d[valueKey]));
  const max = Math.max(...values);
  const pad = 24;
  const lblH = 38;
  const barW = 42;
  const gap = 28;
  const w = data.length * (barW + gap) + pad * 2;
  const h = height + lblH;

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>{title}</h3>
        <div className="legend">
          <span>
            <span className="swatch" style={{ background: accent }} />amount
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w, display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <line
            key={f}
            x1={pad}
            x2={w - pad}
            y1={pad + (height - pad * 2) * (1 - f)}
            y2={pad + (height - pad * 2) * (1 - f)}
            stroke="var(--line-2)"
            strokeWidth={1}
          />
        ))}
        {data.map((d, i) => {
          const v = Number(d[valueKey]);
          const x = pad + i * (barW + gap);
          const bh = (v / max) * (height - pad * 2);
          const y = height - pad - bh;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={bh} fill={accent} rx={3} />
              <text
                x={x + barW / 2}
                y={y - 6}
                fontSize="11"
                fontFamily="var(--mono)"
                textAnchor="middle"
                fill="var(--ink-2)"
              >
                {fmtMoneyShort(v)}
              </text>
              <text
                x={x + barW / 2}
                y={height + 14}
                fontSize="10.5"
                fontFamily="var(--mono)"
                textAnchor="middle"
                fill="var(--ink-3)"
              >
                {String(d[labelKey])}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
