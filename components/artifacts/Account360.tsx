'use client';

import { useEffect, useState } from 'react';
import type { Artifact } from '@/lib/store';
import {
  ACCOUNTS, OPPORTUNITIES, ACTIVITIES, CONTACTS, USERS, CASES,
} from '@/lib/salesforce/seed';
import { computeRisks } from '@/lib/salesforce/queries';
import { isOpenStage } from '@/lib/salesforce/types';

type Props = { artifact: Artifact };

type Shape = {
  account: { Id: string; Name: string; Industry?: string; AnnualRevenue?: number; Employees?: number; OwnerName?: string };
  opps: { Id: string; Name: string; StageName: string; Amount: number; CloseDate: string }[];
  activities: { Id: string; Type: string; Subject: string; ActivityDate: string }[];
  contacts: { Id: string; Name: string; Title?: string; Email?: string }[];
  health: { score: number; label: string; signals: string[] };
};

function fmtMoney(v: number | undefined): string {
  if (v == null) return '—';
  if (v >= 1_000_000_000) return '$' + (v / 1_000_000_000).toFixed(1) + 'B';
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(0) + 'M';
  if (v >= 1_000) return '$' + Math.round(v / 1_000) + 'k';
  return '$' + v;
}

function buildForAccount(accountId: string): Shape | null {
  const a = ACCOUNTS.find(x => x.Id === accountId);
  if (!a) return null;
  const opps = OPPORTUNITIES.filter(o => o.AccountId === accountId);
  const acts = ACTIVITIES
    .filter(x => x.WhatId === accountId || opps.some(o => o.Id === x.WhatId))
    .sort((x, y) => y.ActivityDate.localeCompare(x.ActivityDate))
    .slice(0, 8);
  const contacts = CONTACTS.filter(c => c.AccountId === accountId);
  const owner = USERS.find(u => u.Id === a.OwnerId)?.Name;
  const openOpps = opps.filter(o => isOpenStage(o.StageName));
  const riskCount = openOpps.reduce((s, o) => s + computeRisks(o).length, 0);
  const recentActivityCount = acts.filter(x => x.ActivityDate >= '2026-05-01').length;
  const openCases = CASES.filter(c => c.AccountId === accountId && c.Status !== 'Closed');
  const p1Open = openCases.filter(c => c.Priority === 'P1').length;
  let score = 80;
  if (riskCount > 0) score -= riskCount * 5;
  if (recentActivityCount === 0) score -= 15;
  if (p1Open > 0) score -= 10;
  score = Math.max(20, Math.min(99, score));
  const label = score >= 80 ? 'Healthy' : score >= 60 ? 'Watch' : 'At risk';
  const signals: string[] = [];
  if (recentActivityCount > 0) signals.push(`${recentActivityCount} touches in last 14d`);
  if (riskCount > 0) signals.push(`${riskCount} risk signal${riskCount === 1 ? '' : 's'} on open opps`);
  if (p1Open > 0) signals.push(`${p1Open} open P1 case${p1Open === 1 ? '' : 's'}`);
  if (openOpps.length > 0) signals.push(`${openOpps.length} open opp${openOpps.length === 1 ? '' : 's'}`);
  return {
    account: {
      Id: a.Id, Name: a.Name, Industry: a.Industry,
      AnnualRevenue: a.AnnualRevenue, Employees: a.Employees, OwnerName: owner,
    },
    opps: opps.map(o => ({ Id: o.Id, Name: o.Name, StageName: o.StageName, Amount: o.Amount, CloseDate: o.CloseDate })),
    activities: acts.map(x => ({ Id: x.Id, Type: x.Type, Subject: x.Subject, ActivityDate: x.ActivityDate })),
    contacts: contacts.map(c => ({ Id: c.Id, Name: c.Name, Title: c.Title, Email: c.Email })),
    health: { score, label, signals },
  };
}

export function Account360({ artifact }: Props) {
  const [data, setData] = useState<Shape | null>(null);

  useEffect(() => {
    if (!artifact.dataJson) return;
    try {
      const parsed = JSON.parse(artifact.dataJson);
      if (parsed?.account && Array.isArray(parsed.opps)) {
        setData(parsed as Shape);
        return;
      }
      if (typeof parsed?.accountId === 'string') {
        const built = buildForAccount(parsed.accountId);
        if (built) setData(built);
      }
    } catch { /* ignore */ }
  }, [artifact.dataJson]);

  if (!data) {
    return <div className="preview-empty" style={{ padding: 20, color: 'var(--ink-4)' }}>No account loaded.</div>;
  }

  const openPipeline = data.opps
    .filter(o => o.StageName !== 'Closed Won' && o.StageName !== 'Closed Lost')
    .reduce((s, o) => s + o.Amount, 0);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>{data.account.Name}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
            {data.account.Industry ?? '—'} · {data.account.Employees?.toLocaleString() ?? '—'} employees · ARR {fmtMoney(data.account.AnnualRevenue)} · Owner: {data.account.OwnerName ?? '—'}
          </div>
        </div>
        <HealthBadge score={data.health.score} label={data.health.label} />
      </div>

      {data.health.signals.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {data.health.signals.map(s => (
            <span key={s} style={{
              padding: '2px 8px', borderRadius: 999,
              background: 'var(--surface-2, #f5f5f7)', color: 'var(--ink-2)',
              fontFamily: 'var(--mono)', fontSize: 10.5,
            }}>{s}</span>
          ))}
        </div>
      )}

      <SectionTitle>Open opportunities — {fmtMoney(openPipeline)}</SectionTitle>
      <Table
        cols={['Name', 'Stage', 'Amount', 'Close']}
        rows={data.opps.length === 0 ? null : data.opps.map(o => [o.Name, o.StageName, fmtMoney(o.Amount), o.CloseDate])}
        gridTemplate="1.8fr 0.9fr 0.7fr 0.7fr"
      />

      <SectionTitle>Recent activity</SectionTitle>
      {data.activities.length === 0 ? <Empty /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {data.activities.map(a => (
            <div key={a.Id} style={{ display: 'grid', gridTemplateColumns: '90px 70px 1fr', fontSize: 12.5, padding: '4px 0' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{a.ActivityDate}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)' }}>{a.Type}</span>
              <span>{a.Subject}</span>
            </div>
          ))}
        </div>
      )}

      <SectionTitle>Contacts ({data.contacts.length})</SectionTitle>
      <Table
        cols={['Name', 'Title', 'Email']}
        rows={data.contacts.length === 0 ? null : data.contacts.map(c => [c.Name, c.Title ?? '—', c.Email ?? '—'])}
        gridTemplate="1.1fr 1.1fr 1.6fr"
      />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)',
      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: -4,
    }}>{children}</div>
  );
}

function HealthBadge({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? 'var(--pos)' : score >= 60 ? 'var(--warn)' : 'var(--neg)';
  const bg = score >= 80 ? 'rgba(34,197,94,0.12)' : score >= 60 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 8, background: bg, color,
      minWidth: 110, textAlign: 'center',
    }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.8 }}>Health</div>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--mono)' }}>{score}</div>
      <div style={{ fontSize: 11.5 }}>{label}</div>
    </div>
  );
}

function Table({ cols, rows, gridTemplate }: { cols: string[]; rows: (string | number)[][] | null; gridTemplate: string }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: gridTemplate,
        background: 'var(--surface-2, #f5f5f7)', padding: '8px 10px',
        fontFamily: 'var(--mono)', fontSize: 10.5,
        textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)',
      }}>
        {cols.map(c => <div key={c}>{c}</div>)}
      </div>
      {rows === null ? (
        <div style={{ padding: 12, color: 'var(--ink-4)', fontSize: 12 }}>—</div>
      ) : rows.map((row, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: gridTemplate,
          padding: '8px 10px', borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
          fontSize: 12.5,
        }}>
          {row.map((cell, j) => (
            <div key={j} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: typeof cell === 'string' && cell.includes('@') ? 'var(--mono)' : 'inherit' }}>
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return <div style={{ padding: 12, color: 'var(--ink-4)', fontSize: 12 }}>—</div>;
}
