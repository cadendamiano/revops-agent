import { fmtMoneyShort } from '@/lib/format';

type Props = {
  data: Record<string, number | string>[];
  title: string;
  labelKey?: string;
  valueKey?: string;
  centerCaption?: string;
};

export function DonutChart({ data, title, labelKey = 'cat', valueKey = 'amount', centerCaption = 'Q1 SPEND' }: Props) {
  const values = data.map(d => Number(d[valueKey]));
  const total = values.reduce((s, v) => s + v, 0);
  const R = 70;
  const r = 46;
  const cx = 90;
  const cy = 90;
  let angle = -Math.PI / 2;
  const colors = [
    'oklch(0.62 0.10 195)',
    'oklch(0.55 0.09 195)',
    'oklch(0.72 0.08 195)',
    'oklch(0.48 0.08 205)',
    'oklch(0.78 0.05 195)',
    'oklch(0.40 0.06 205)',
  ];

  const arcs = data.map((d, i) => {
    const v = Number(d[valueKey]);
    const frac = v / total;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const large = frac > 0.5 ? 1 : 0;
    const [x0, y0] = [cx + R * Math.cos(a0), cy + R * Math.sin(a0)];
    const [x1, y1] = [cx + R * Math.cos(a1), cy + R * Math.sin(a1)];
    const [ix1, iy1] = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
    const [ix0, iy0] = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)];
    const path = `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix0} ${iy0} Z`;
    return {
      path,
      color: colors[i % colors.length],
      label: String(d[labelKey]),
      value: v,
      pct: Math.round(frac * 100),
    };
  });

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>{title}</h3>
        <div className="legend">
          <span style={{ color: 'var(--ink-3)' }}>total {fmtMoneyShort(total)}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 20, alignItems: 'center' }}>
        <svg viewBox="0 0 180 180" width={180} height={180}>
          {arcs.map((a, i) => <path key={i} d={a.path} fill={a.color} />)}
          <text x={90} y={88} textAnchor="middle" fontSize="20" fontFamily="var(--mono)" fontWeight={600} fill="var(--ink)">
            {fmtMoneyShort(total)}
          </text>
          <text x={90} y={104} textAnchor="middle" fontSize="10" fontFamily="var(--mono)" fill="var(--ink-4)">
            {centerCaption}
          </text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {arcs.map((a, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '12px 1fr auto auto',
                gap: 10,
                alignItems: 'center',
                fontFamily: 'var(--mono)',
                fontSize: 11.5,
              }}
            >
              <span style={{ width: 10, height: 10, background: a.color, borderRadius: 2 }} />
              <span style={{ color: 'var(--ink-2)' }}>{a.label}</span>
              <span style={{ color: 'var(--ink-4)' }}>{a.pct}%</span>
              <span style={{ color: 'var(--ink)', fontWeight: 600, width: 64, textAlign: 'right' }}>
                {fmtMoneyShort(a.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
