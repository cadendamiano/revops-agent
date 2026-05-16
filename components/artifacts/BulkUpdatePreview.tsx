'use client';

import { useEffect, useState } from 'react';
import type { Artifact } from '@/lib/store';
import { getStagedSfdcBatch, type StagedSfdcBatch } from '@/lib/salesforce/stagedBatchStore';
import type { Stake } from '@/lib/policy/approvalPolicy';

type Props = { artifact: Artifact };

const STAKE_LABEL: Record<Stake, string> = {
  'read-only': 'Read-only',
  'single-record-edit': 'Single record',
  'bulk-update': 'Bulk update',
  'mass-action': 'Mass action',
};

const STAKE_COLOR: Record<Stake, string> = {
  'read-only': 'var(--pos)',
  'single-record-edit': 'var(--teal)',
  'bulk-update': 'var(--warn)',
  'mass-action': 'var(--neg)',
};

export function BulkUpdatePreview({ artifact }: Props) {
  const [batch, setBatch] = useState<StagedSfdcBatch | null>(null);

  useEffect(() => {
    let batchId: string | undefined;
    let inlinePreview: StagedSfdcBatch | undefined;
    if (artifact.dataJson) {
      try {
        const parsed = JSON.parse(artifact.dataJson);
        if (typeof parsed?.batchId === 'string') batchId = parsed.batchId;
        // Demo-mode fallback: the flow can ship a fully-formed batch shape.
        if (parsed && Array.isArray(parsed.changes)) {
          inlinePreview = parsed as StagedSfdcBatch;
        }
      } catch {
        // ignore
      }
    }
    if (batchId) {
      const b = getStagedSfdcBatch(batchId);
      if (b) { setBatch(b); return; }
    }
    if (inlinePreview) setBatch(inlinePreview);
  }, [artifact.dataJson]);

  if (!batch) {
    return (
      <div className="preview-empty" style={{ padding: 20, color: 'var(--ink-4)' }}>
        No staged batch found. The batch may have been applied or expired.
      </div>
    );
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            background: STAKE_COLOR[batch.stake],
            color: '#fff',
            padding: '3px 10px',
            borderRadius: 999,
            fontFamily: 'var(--mono)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
          }}
        >
          {STAKE_LABEL[batch.stake]}
        </span>
        <div style={{ fontSize: 12.5, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
          {batch.batchId}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{batch.summary}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
          {batch.recordCount} record{batch.recordCount === 1 ? '' : 's'} staged · awaiting approval
        </div>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr',
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
          <div>Current</div>
          <div>New</div>
        </div>
        {batch.changes.map((c, i) => (
          <div
            key={c.id + i}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              padding: '8px 10px',
              borderTop: i === 0 ? 'none' : '1px solid var(--line-2)',
              fontSize: 12.5,
              alignItems: 'center',
            }}
          >
            <div style={{ color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
            <div style={{ color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 11.5 }}>
              {c.currentValue || <em style={{ color: 'var(--ink-4)' }}>(empty)</em>}
            </div>
            <div style={{ color: 'var(--ink)', fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 600 }}>{c.newValue}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
