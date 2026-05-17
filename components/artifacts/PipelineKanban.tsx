'use client';

import { useEffect, useState } from 'react';
import type { Artifact } from '@/lib/store';
import { OPPORTUNITIES, USERS } from '@/lib/salesforce/seed';
import { isOpenStage, type OpportunityStage } from '@/lib/salesforce/types';

type Props = { artifact: Artifact };

type OppCard = {
  Id: string;
  Name: string;
  Amount: number;
  ownerName?: string;
  risk?: string;
};

type Column = { name: string; opps: OppCard[] };

const OPEN_STAGES: OpportunityStage[] = ['Prospecting', 'Qualification', 'Discovery', 'Proposal', 'Negotiation'];

function fmtMoney(v: number): string {
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return '$' + Math.round(v / 1_000) + 'k';
  return '$' + v;
}

function buildDefault(): Column[] {
  return OPEN_STAGES.map(stage => ({
    name: stage,
    opps: OPPORTUNITIES
      .filter(o => o.StageName === stage && isOpenStage(o.StageName))
      .map(o => ({
        Id: o.Id, Name: o.Name, Amount: o.Amount,
        ownerName: USERS.find(u => u.Id === o.OwnerId)?.Name,
      })),
  }));
}

export function PipelineKanban({ artifact }: Props) {
  const [columns, setColumns] = useState<Column[]>([]);

  useEffect(() => {
    if (artifact.dataJson) {
      try {
        const parsed = JSON.parse(artifact.dataJson);
        if (Array.isArray(parsed?.stages)) {
          setColumns(parsed.stages as Column[]);
          return;
        }
      } catch { /* ignore */ }
    }
    setColumns(buildDefault());
  }, [artifact.dataJson]);

  if (columns.length === 0) {
    return <div className="preview-empty" style={{ padding: 20, color: 'var(--ink-4)' }}>No opps loaded.</div>;
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Open pipeline · kanban</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {columns.reduce((s, c) => s + c.opps.length, 0)} opps · {fmtMoney(columns.reduce((s, c) => s + c.opps.reduce((x, o) => x + o.Amount, 0), 0))} unweighted
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: 10 }}>
        {columns.map(col => {
          const colTotal = col.opps.reduce((s, o) => s + o.Amount, 0);
          return (
            <div key={col.name} style={{ background: 'var(--surface-2, #f5f5f7)', borderRadius: 8, padding: 8 }}>
              <div style={{
                fontFamily: 'var(--mono)', fontSize: 10.5, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: 'var(--ink-3)', marginBottom: 6,
              }}>
                {col.name} · {col.opps.length} · {fmtMoney(colTotal)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {col.opps.map(o => (
                  <div key={o.Id} style={{
                    background: 'var(--surface, #fff)',
                    border: '1px solid var(--line)',
                    borderRadius: 6, padding: '8px 10px', fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.Name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                      <span>{o.ownerName ?? '—'}</span>
                      <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{fmtMoney(o.Amount)}</span>
                    </div>
                    {o.risk && (
                      <div style={{ marginTop: 4, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--warn, #b45309)' }}>{o.risk}</div>
                    )}
                  </div>
                ))}
                {col.opps.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', padding: '8px 10px' }}>—</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
