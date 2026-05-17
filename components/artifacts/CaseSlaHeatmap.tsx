'use client';

import { useEffect, useState } from 'react';
import type { Artifact } from '@/lib/store';
import { CASES } from '@/lib/salesforce/seed';
import { daysBetween, TODAY } from '@/lib/salesforce/types';

type Props = { artifact: Artifact };

type Row = {
  id: string;
  caseNumber: string;
  priority: string;
  age: number;
  slaPct: number;
  subject?: string;
  ownerId?: string;
};

function buildDefault(): Row[] {
  return CASES
    .filter(c => c.Status !== 'Closed')
    .map(c => {
      const age = daysBetween(TODAY, c.CreatedDate);
      const slaWindow = daysBetween(c.SlaTargetDate, c.CreatedDate);
      const slaPct = slaWindow > 0 ? Math.min(150, Math.round((age / slaWindow) * 100)) : 0;
      return {
        id: c.Id, caseNumber: c.CaseNumber,
        priority: c.Priority, age, slaPct,
        subject: c.Subject, ownerId: c.OwnerId,
      };
    })
    .sort((a, b) => b.slaPct - a.slaPct);
}

function slaColor(pct: number): string {
  if (pct >= 100) return 'var(--neg)';
  if (pct >= 75) return 'var(--warn)';
  if (pct >= 50) return '#eab308';
  return 'var(--pos)';
}

export function CaseSlaHeatmap({ artifact }: Props) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (artifact.dataJson) {
      try {
        const parsed = JSON.parse(artifact.dataJson);
        if (Array.isArray(parsed?.cases)) {
          setRows(parsed.cases as Row[]);
          return;
        }
      } catch { /* ignore */ }
    }
    setRows(buildDefault());
  }, [artifact.dataJson]);

  if (rows.length === 0) {
    return <div className="preview-empty" style={{ padding: 20, color: 'var(--ink-4)' }}>No open cases.</div>;
  }

  const breached = rows.filter(r => r.slaPct >= 100).length;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Open Cases · SLA</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
          {rows.length} open · {breached} breached
        </div>
      </div>
      <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '0.8fr 0.5fr 2fr 0.6fr 1.4fr',
          background: 'var(--surface-2, #f5f5f7)', padding: '8px 10px',
          fontFamily: 'var(--mono)', fontSize: 10.5,
          textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)',
        }}>
          <div>Case #</div><div>Pri</div><div>Subject</div><div>Age</div><div>SLA</div>
        </div>
        {rows.map((r, i) => (
          <div key={r.id} style={{
            display: 'grid', gridTemplateColumns: '0.8fr 0.5fr 2fr 0.6fr 1.4fr',
            padding: '8px 10px', borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
            fontSize: 12.5, alignItems: 'center',
          }}>
            <div style={{ fontFamily: 'var(--mono)', color: 'var(--ink)' }}>{r.caseNumber}</div>
            <div style={{
              fontFamily: 'var(--mono)', fontWeight: 700,
              color: r.priority === 'P1' ? 'var(--neg)' : r.priority === 'P2' ? 'var(--warn)' : 'var(--ink-2)',
            }}>{r.priority}</div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{r.subject ?? '—'}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>{r.age}d</div>
            <div>
              <div style={{ height: 10, background: 'var(--line-2)', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                <div style={{ width: `${Math.min(100, r.slaPct)}%`, height: '100%', background: slaColor(r.slaPct) }} />
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
                {r.slaPct}%{r.slaPct >= 100 ? ' breached' : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
