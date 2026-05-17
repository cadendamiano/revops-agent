'use client';

import { useEffect, useState } from 'react';
import type { Artifact } from '@/lib/store';
import { LEADS } from '@/lib/salesforce/seed';
import { daysBetween, TODAY } from '@/lib/salesforce/types';

type Props = { artifact: Artifact };

type ScoredLead = {
  Id: string; Name: string; Company: string; Status: string; LeadSource: string;
  score: number; scoreFactors: string[];
};

function scoreLead(l: typeof LEADS[number]): ScoredLead {
  let score = 30;
  const factors: string[] = [];
  if (l.LeadSource === 'Inbound')  { score += 25; factors.push('Inbound +25'); }
  if (l.LeadSource === 'Partner')  { score += 20; factors.push('Partner +20'); }
  if (l.LeadSource === 'Event')    { score += 15; factors.push('Event +15');   }
  if (l.LeadSource === 'Outbound') { score += 5;  factors.push('Outbound +5'); }
  const age = daysBetween(TODAY, l.CreatedDate);
  if (age <= 3)      { score += 25; factors.push(`Fresh ${age}d +25`); }
  else if (age <= 7) { score += 15; factors.push(`Fresh ${age}d +15`); }
  else if (age <= 14){ score += 5;  factors.push(`Recent ${age}d +5`); }
  if (l.Status === 'Working')    { score += 10; factors.push('Working +10'); }
  if (l.Status === 'Qualified')  { score += 20; factors.push('Qualified +20'); }
  if (l.Status === 'Unqualified'){ score -= 30; factors.push('Unqualified -30'); }
  return {
    Id: l.Id, Name: l.Name, Company: l.Company, Status: l.Status,
    LeadSource: l.LeadSource, score: Math.max(0, Math.min(100, score)),
    scoreFactors: factors,
  };
}

function buildDefault(): ScoredLead[] {
  return LEADS.map(scoreLead).sort((a, b) => b.score - a.score);
}

export function LeadScoringTable({ artifact }: Props) {
  const [leads, setLeads] = useState<ScoredLead[]>([]);

  useEffect(() => {
    if (artifact.dataJson) {
      try {
        const parsed = JSON.parse(artifact.dataJson);
        if (Array.isArray(parsed?.leads)) { setLeads(parsed.leads as ScoredLead[]); return; }
      } catch { /* fall through */ }
    }
    setLeads(buildDefault());
  }, [artifact.dataJson]);

  if (leads.length === 0) {
    return <div className="preview-empty" style={{ padding: 20, color: 'var(--ink-4)' }}>No leads loaded.</div>;
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Lead Scoring</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
          {leads.length} leads · {leads.filter(l => l.score >= 70).length} hot (≥70)
        </div>
      </div>
      <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 0.8fr 0.8fr 1.4fr 1.8fr',
          background: 'var(--surface-2, #f5f5f7)', padding: '8px 10px',
          fontFamily: 'var(--mono)', fontSize: 10.5,
          textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)',
        }}>
          <div>Name</div><div>Company</div><div>Status</div><div>Source</div><div>Score</div><div>Factors</div>
        </div>
        {leads.map((l, i) => (
          <div key={l.Id} style={{
            display: 'grid', gridTemplateColumns: '1.2fr 1.4fr 0.8fr 0.8fr 1.4fr 1.8fr',
            padding: '8px 10px', borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
            fontSize: 12.5, alignItems: 'center',
          }}>
            <div style={{ color: 'var(--ink)' }}>{l.Name}</div>
            <div style={{ color: 'var(--ink-2)' }}>{l.Company}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-2)' }}>{l.Status}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>{l.LeadSource}</div>
            <div>
              <div style={{ height: 8, background: 'var(--line-2)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${l.score}%`, height: '100%',
                  background: l.score >= 70 ? 'var(--pos)' : l.score >= 40 ? 'var(--warn)' : 'var(--neg)',
                }} />
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>{l.score}</div>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
              {l.scoreFactors.join(' · ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
