'use client';

import { useState } from 'react';
import type { FlowStep } from '@/lib/flows';
import type { ApprovalState } from '@/lib/store';

type ApprovalPayload = Extract<FlowStep, { kind: 'approval' }>['payload'];
type Stake = ApprovalPayload['stake'];

type Props = {
  payload: ApprovalPayload;
  state?: ApprovalState | null;
  simulated?: boolean;
  onApprove: (batchId: string) => void;
  onReject: (batchId: string) => void;
};

const STAKE_LABEL: Record<Stake, string> = {
  'read-only': 'Read-only',
  'single-record-edit': 'Single record',
  'bulk-update': 'Bulk update',
  'mass-action': 'Mass action',
};

const STAKE_COLOR: Record<Stake, string> = {
  'read-only': 'var(--pos)',
  'single-record-edit': 'var(--accent)',
  'bulk-update': 'var(--warn)',
  'mass-action': 'var(--danger)',
};

function StakeBadge({ stake }: { stake: Stake }) {
  return (
    <span
      style={{
        background: STAKE_COLOR[stake],
        color: '#fff',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 10.5,
        fontFamily: 'var(--mono)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontWeight: 600,
      }}
    >
      {STAKE_LABEL[stake]}
    </span>
  );
}

function PreviewTable({ rows }: { rows: ApprovalPayload['preview'] }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div style={{ padding: '0 16px 12px' }}>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10.5,
          color: 'var(--ink-4)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 6,
        }}
      >
        Preview · {rows.length} of many
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', padding: '4px 6px', borderBottom: '1px solid var(--line-2)' }}>Name</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', padding: '4px 6px', borderBottom: '1px solid var(--line-2)' }}>Current</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', padding: '4px 6px', borderBottom: '1px solid var(--line-2)' }}>New</div>
        {rows.map((r, i) => (
          <Row key={r.id + i} cells={[
            r.name,
            r.currentValue || <em style={{ color: 'var(--ink-4)' }}>(empty)</em>,
            r.newValue,
          ]} />
        ))}
      </div>
    </div>
  );
}

function Row({ cells }: { cells: React.ReactNode[] }) {
  return (
    <>
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            padding: '6px',
            fontSize: 12.5,
            color: 'var(--ink)',
            borderBottom: '1px dashed var(--line-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {c}
        </div>
      ))}
    </>
  );
}

function headLabel(
  stake: Stake,
  state: ApprovalState | null | undefined,
  batchId: string
) {
  if (state === 'approved') return <><span style={{ color: 'var(--pos)' }}>✓</span>Approved · {batchId}</>;
  if (state === 'rejected') return <><span style={{ color: 'var(--danger)' }}>×</span>Cancelled · {batchId}</>;
  if (state === 'submitting') return <><span className="pulse" />Submitting · {batchId}</>;
  if (stake === 'mass-action') {
    return <><span className="pulse" style={{ background: 'var(--danger)' }} />Awaiting approval · mass action</>;
  }
  if (stake === 'bulk-update') {
    return <><span className="pulse" style={{ background: 'var(--warn)' }} />Awaiting approval · bulk update</>;
  }
  return <><span className="pulse" />Awaiting approval</>;
}

export function ApprovalCard({ payload, state, simulated = false, onApprove, onReject }: Props) {
  const approved = state === 'approved';
  const rejected = state === 'rejected';
  const submitting = state === 'submitting';
  const stake = payload.stake;
  const needsSecond = stake === 'mass-action' && payload.requiresSecondApprover === true;

  const [secondId, setSecondId] = useState('');
  const canApprove = !needsSecond || secondId.trim().length > 0;

  const approveLabel = submitting ? 'Submitting…' : 'Approve & apply';

  return (
    <div className="approval">
      <div className="approval-head" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {headLabel(stake, state ?? null, payload.batchId)}
        <div style={{ flex: 1 }} />
        <StakeBadge stake={stake} />
        {simulated && !approved && !rejected && (
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              color: 'var(--ink-4)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            simulated
          </span>
        )}
      </div>

      <div style={{ padding: '10px 16px 6px' }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{payload.title}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>{payload.summary}</div>
        <div style={{ marginTop: 6, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-4)' }}>
          {payload.recordCount} record{payload.recordCount === 1 ? '' : 's'}
        </div>
      </div>

      <PreviewTable rows={payload.preview} />

      {!approved && !rejected && (
        <>
          {needsSecond && (
            <div style={{ padding: '0 16px 10px' }}>
              <div
                style={{
                  background: 'var(--warn-soft, rgba(245,158,11,0.12))',
                  border: '1px solid color-mix(in oklab, var(--warn) 30%, transparent)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 12,
                  color: 'var(--ink-2)',
                }}
              >
                Mass action — a second approver is required. Enter their user Id (e.g. <code>005MG001</code>) to proceed.
              </div>
              <input
                style={{
                  marginTop: 6,
                  width: '100%',
                  height: 32,
                  padding: '0 10px',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  background: 'var(--surface)',
                  fontFamily: 'var(--mono)',
                  fontSize: 12.5,
                }}
                placeholder="Second approver Id"
                value={secondId}
                onChange={(e) => setSecondId(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                disabled={submitting}
              />
            </div>
          )}

          <div className="approval-actions">
            <button
              className="btn btn-primary"
              disabled={!canApprove || submitting}
              onClick={() => { if (canApprove && !submitting) onApprove(payload.batchId); }}
            >
              {approveLabel} <span className="kbd">⌘↵</span>
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => onReject(payload.batchId)}
              disabled={submitting}
            >
              Cancel batch
            </button>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-4)' }}>
              audit: req_{payload.batchId}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
