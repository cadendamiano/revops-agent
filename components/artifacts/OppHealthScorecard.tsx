'use client';

import { useEffect, useState } from 'react';
import type { Artifact } from '@/lib/store';
import { handleFindAtRiskOpps, type AtRiskOpp } from '@/lib/tools/sfdc-read';

type Props = { artifact: Artifact };

function fmtMoney(v: number): string {
  return '$' + Math.round(v).toLocaleString();
}

function RiskPill({ risk }: { risk: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        background: 'var(--warn-soft, rgba(245,158,11,0.16))',
        color: 'var(--warn, #b45309)',
        padding: '1px 6px',
        marginRight: 4,
        marginBottom: 2,
        borderRadius: 999,
        fontFamily: 'var(--mono)',
        fontSize: 10.5,
      }}
    >
      {risk}
    </span>
  );
}

export function OppHealthScorecard({ artifact }: Props) {
  const [rows, setRows] = useState<AtRiskOpp[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fromJson = artifact.dataJson;
    if (fromJson) {
      try {
        const parsed = JSON.parse(fromJson);
        if (Array.isArray(parsed?.opps)) {
          setRows(parsed.opps);
          return;
        }
      } catch {
        // fall through to seed lookup
      }
    }
    handleFindAtRiskOpps({ limit: 10 }).then(r => {
      if (!cancelled) setRows(r);
    });
    return () => { cancelled = true; };
  }, [artifact.dataJson]);

  if (rows.length === 0) {
    return <div className="preview-empty" style={{ padding: 20, color: 'var(--ink-4)' }}>No at-risk opportunities.</div>;
  }

  const total = rows.reduce((s, o) => s + o.Amount, 0);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>At-risk opportunities</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
          {rows.length} opps · {fmtMoney(total)} unweighted at risk
        </div>
      </div>
      <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 0.9fr 1fr 1.6fr',
            background: 'var(--surface-2, #f5f5f7)',
            padding: '8px 10px',
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--ink-3)',
          }}
        >
          <div>Name</div>
          <div>Stage</div>
          <div style={{ textAlign: 'right' }}>Amount</div>
          <div>Owner</div>
          <div>Risks</div>
        </div>
        {rows.map((o, i) => (
          <div
            key={o.Id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 0.9fr 1fr 1.6fr',
              padding: '8px 10px',
              borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
              fontSize: 12.5,
              alignItems: 'center',
            }}
          >
            <div style={{ color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.Name}</div>
            <div style={{ color: 'var(--ink-2)', fontFamily: 'var(--mono)', fontSize: 11.5 }}>{o.StageName}</div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{fmtMoney(o.Amount)}</div>
            <div style={{ color: 'var(--ink-2)' }}>{o.ownerName}</div>
            <div>
              {o.risks.map(r => <RiskPill key={r} risk={r} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
