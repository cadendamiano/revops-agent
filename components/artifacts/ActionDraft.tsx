'use client';

import { useEffect, useState } from 'react';
import type { Artifact } from '@/lib/store';
import { runLLM } from '@/lib/runtime';

type Props = { artifact: Artifact };

type Channel = 'email' | 'sms' | 'call' | 'note';
type Draft = { id: string; channel: Channel; recordId?: string; to?: string; subject?: string; body: string };
type Shape = { title?: string; drafts: Draft[] };
type Status = 'pending' | 'approved' | 'skipped';

const CHANNEL_LABEL: Record<Channel, string> = { email: 'Email', sms: 'SMS', call: 'Call script', note: 'Activity note' };

export function ActionDraft({ artifact }: Props) {
  const [shape, setShape] = useState<Shape | null>(null);
  const [edited, setEdited] = useState<Record<string, { subject?: string; body: string }>>({});
  const [status, setStatus] = useState<Record<string, Status>>({});

  useEffect(() => {
    if (!artifact.dataJson) return;
    try {
      const parsed = JSON.parse(artifact.dataJson) as Shape;
      if (Array.isArray(parsed?.drafts)) {
        setShape(parsed);
        const init: Record<string, { subject?: string; body: string }> = {};
        for (const d of parsed.drafts) init[d.id] = { subject: d.subject, body: d.body };
        setEdited(init);
      }
    } catch { /* ignore */ }
  }, [artifact.dataJson]);

  if (!shape) {
    return <div className="preview-empty" style={{ padding: 20, color: 'var(--ink-4)' }}>No drafts to show.</div>;
  }

  const approve = (d: Draft) => {
    const cur = edited[d.id];
    setStatus(s => ({ ...s, [d.id]: 'approved' }));
    const target = d.to ?? d.recordId ?? 'the recipient';
    runLLM(`Approved the ${CHANNEL_LABEL[d.channel].toLowerCase()} to ${target}. Final version:\n` +
      (cur?.subject ? `Subject: ${cur.subject}\n` : '') + cur?.body);
  };
  const skip = (d: Draft) => {
    setStatus(s => ({ ...s, [d.id]: 'skipped' }));
    runLLM(`Skip the ${CHANNEL_LABEL[d.channel].toLowerCase()} draft for ${d.to ?? d.recordId ?? 'that record'}.`);
  };

  const pending = shape.drafts.filter(d => (status[d.id] ?? 'pending') === 'pending');

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{shape.title ?? 'Action drafts'}</div>
      {shape.drafts.map(d => {
        const st = status[d.id] ?? 'pending';
        const e = edited[d.id] ?? { body: d.body };
        return (
          <div key={d.id} className="draft-card" data-status={st}>
            <div className="draft-head">
              <span className="draft-chan">{CHANNEL_LABEL[d.channel]}</span>
              <span className="draft-to">{d.to ?? d.recordId ?? ''}</span>
              {st !== 'pending' && <span className={'draft-status ' + st}>{st}</span>}
            </div>
            {d.channel === 'email' && (
              <input
                className="input draft-subject"
                value={e.subject ?? ''}
                placeholder="Subject"
                disabled={st !== 'pending'}
                onChange={ev => setEdited(s => ({ ...s, [d.id]: { ...e, subject: ev.target.value } }))}
              />
            )}
            <textarea
              className="textarea draft-body"
              value={e.body}
              rows={5}
              disabled={st !== 'pending'}
              onChange={ev => setEdited(s => ({ ...s, [d.id]: { ...e, body: ev.target.value } }))}
            />
            {st === 'pending' && (
              <div className="draft-actions">
                <button className="btn btn-primary" onClick={() => approve(d)}>Approve &amp; send</button>
                <button className="btn btn-ghost" onClick={() => skip(d)}>Skip</button>
              </div>
            )}
          </div>
        );
      })}
      {pending.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>All drafts handled.</div>
      )}
    </div>
  );
}
