'use client';

import { memo, useCallback, useState } from 'react';
import { ToolRow } from './primitives/ToolRow';
import { ApprovalCard } from './primitives/ApprovalCard';
import { DataTable } from './primitives/DataTable';
import { Icon } from './primitives/Icon';
import { Markdown } from './primitives/Markdown';
import { ArtifactThumb } from './ArtifactThumb';
import type { Turn as TurnType } from '@/lib/turns';
import type { ApprovalState } from '@/lib/store';
import { useStore } from '@/lib/store';
import type { ArtifactKind } from '@/lib/flows';

const ARTIFACT_KIND_LABEL: Record<ArtifactKind, string> = {
  'spreadsheet': 'Spreadsheet',
  'document': 'Document',
  'slides': 'Slides',
  'custom-dashboard': 'Custom chart',
  'soql-results': 'SOQL results',
  'pipeline-kanban': 'Pipeline kanban',
  'account-360': 'Account 360',
  'lead-scoring': 'Lead scoring',
  'forecast': 'Forecast',
  'dashboard-tiles': 'Dashboard',
  'case-sla': 'Case SLA',
  'activity-timeline': 'Activity timeline',
  'bulk-update-preview': 'Bulk update preview',
};

type Props = {
  turn: TurnType;
  approvalState: ApprovalState | null;
  onApprove: (batchId: string) => void;
  onReject: (batchId: string) => void;
  activeArtifact: string | null;
  onOpenArtifact: (id: string) => void;
  onSuggestion: (text: string) => void;
  onChipSubmit: (text: string) => void;
  onFormAnswer: (turnId: string, selected: string[], labels: string[], freeText: string) => void;
};

function TurnInner({
  turn,
  approvalState,
  onApprove,
  onReject,
  activeArtifact,
  onOpenArtifact,
  onSuggestion,
  onChipSubmit,
  onFormAnswer,
}: Props) {
  if (turn.kind === 'user') {
    return (
      <div className="msg user fade-in">
        <div className="msg-body">{turn.text}</div>
      </div>
    );
  }

  if (turn.kind === 'agent') {
    return (
      <div className="msg agent fade-in">
        <div className="msg-body">
          <Markdown text={turn.text} />
          {turn.streaming && <span className="caret" />}
        </div>
      </div>
    );
  }

  if (turn.kind === 'tools') {
    return (
      <div className="msg agent fade-in">
        <div className="msg-body">
          <div className="tool-call">
            {turn.rows.map((r, i) => <ToolRow key={`${r.verb}:${r.path}:${i}`} row={r} />)}
            {turn.pending != null && turn.pending > 0 && (
              <div className="tool-row" style={{ color: 'var(--ink-4)' }}>
                <span className="glyph"><Icon.Spinner /></span>
                <span className="endpoint"><span className="path">resolving…</span></span>
                <span className="result">{turn.pending} pending</span>
              </div>
            )}
          </div>
          <div className="tool-summary">
            {turn.rows.length} tool call{turn.rows.length === 1 ? '' : 's'} · all succeeded
          </div>
        </div>
      </div>
    );
  }

  if (turn.kind === 'data-table') {
    return (
      <div className="msg agent fade-in">
        <div className="msg-body">
          <DataTable toolName={turn.toolName} rows={turn.rows} truncated={turn.truncated} />
        </div>
      </div>
    );
  }

  if (turn.kind === 'approval') {
    return (
      <div className="msg agent fade-in">
        <div className="msg-body" style={{ minWidth: 0 }}>
          <ApprovalCard
            payload={turn.payload}
            state={approvalState}
            simulated={turn.simulated ?? false}
            onApprove={onApprove}
            onReject={onReject}
          />
        </div>
      </div>
    );
  }

  if (turn.kind === 'libs') {
    return (
      <div className="msg agent fade-in">
        <div className="msg-body">
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              color: 'var(--ink-4)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 4,
            }}
          >
            loaded libraries
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {turn.items.map((lib, i) => (
              <span key={`${lib.pkg}@${lib.ver}:${i}`} className="library-pull">
                <span className="pkg">{lib.pkg}</span>
                <span className="ver">@{lib.ver}</span>
                <span className="status">✓</span>
              </span>
            ))}
            {turn.items.length < turn.total && (
              <span className="library-pull" style={{ color: 'var(--ink-4)' }}>
                <Icon.Spinner /> <span>resolving…</span>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (turn.kind === 'building') {
    return (
      <div className="msg agent fade-in">
        <div className="msg-body">
          <div className="artifact-building">
            <div className="skel" />
            <div>
              <div className="title">
                Building artifact ·{' '}
                <em style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>{turn.label}</em>
              </div>
              <div style={{ color: 'var(--ink-4)', marginTop: 2 }}>
                {turn.sub}<span className="caret" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (turn.kind === 'artifact-card') {
    const isActive = activeArtifact === turn.artifactId;
    return (
      <div className="msg agent fade-in">
        <div className="msg-body">
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 4 }}>
            Artifact ready.
          </div>
          <div
            className={'artifact-card' + (isActive ? ' active' : '')}
            onClick={() => onOpenArtifact(turn.artifactId)}
            role="button"
          >
            <div className="artifact-card-hero">
              <div className="artifact-card-kind">
                <span className="dot" />{turn.sub}
              </div>
              <div className="artifact-card-right-pill">{turn.icon ?? '◫'}</div>
              <ArtifactThumb kind={turn.artifactId} />
            </div>
            <div className="artifact-card-body">
              <div className="artifact-card-title">{turn.title}</div>
              <div className="artifact-card-meta"><Markdown text={turn.meta} /></div>
            </div>
            <div className="artifact-card-foot">
              <span className="source">
                <span className="src-dot" />source: Salesforce
              </span>
              <span className="spacer" />
              <span className="cta">View <Icon.Arrow /></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (turn.kind === 'suggest') {
    return (
      <div className="msg agent fade-in">
        <div className="msg-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {turn.items.map(s => {
            const isRecommend = s.startsWith('Recommend ');
            return (
              <button
                key={s}
                className={`composer-chip${isRecommend ? ' chip-recommend' : ''}`}
                onClick={() => onSuggestion(s)}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (turn.kind === 'plan') {
    return (
      <div className="msg agent fade-in">
        <div className="plan-card">
          <div className="plan-head">PLAN{turn.goal ? <span className="plan-goal"> — {turn.goal}</span> : null}</div>
          <ol className="plan-steps">
            {turn.steps.map((s, i) => (
              <li key={i} className="plan-step">
                <span className="plan-step-title">{s.title}</span>
                {s.detail ? <span className="plan-step-detail">{s.detail}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  if (turn.kind === 'form-question') {
    return <FormQuestion turn={turn} onFormAnswer={onFormAnswer} />;
  }

  if (turn.kind === 'artifact-offer') {
    return <ArtifactOffer turn={turn} onChipSubmit={onChipSubmit} />;
  }

  return null;
}

export const Turn = memo(TurnInner);

type ArtifactOfferProps = {
  turn: Extract<TurnType, { kind: 'artifact-offer' }>;
  onChipSubmit: (text: string) => void;
};

function ArtifactOffer({ turn, onChipSubmit }: ArtifactOfferProps) {
  const updateTurn = useStore(s => s.updateTurnInActiveWorkspaceThread);
  const answered = turn.answered === true;

  const handleClick = useCallback((kind: ArtifactKind, label: string) => {
    if (answered) return;
    updateTurn(turn.id, { answered: true } as any);
    onChipSubmit(`Render as ${label.toLowerCase()}`);
  }, [answered, turn.id, updateTurn, onChipSubmit]);

  const question = turn.question ?? 'Want me to turn this into an artifact?';

  return (
    <div className="msg agent fade-in">
      {turn.summary && (
        <div className="msg-body" style={{ marginBottom: 6 }}>
          <Markdown text={turn.summary} />
        </div>
      )}
      <div className="msg-body" style={{ marginBottom: 6, color: 'var(--ink-3)' }}>
        {question}
      </div>
      <div className="msg-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {turn.kinds.map(kind => {
          const label = ARTIFACT_KIND_LABEL[kind] ?? kind;
          return (
            <button
              key={kind}
              className="composer-chip"
              disabled={answered}
              onClick={() => handleClick(kind, label)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type FormQuestionProps = {
  turn: Extract<TurnType, { kind: 'form-question' }>;
  onFormAnswer: (turnId: string, selected: string[], labels: string[], freeText: string) => void;
};

function FormQuestion({ turn, onFormAnswer }: FormQuestionProps) {
  const [localSelected, setLocalSelected] = useState<string[]>(turn.selected ?? []);
  const [freeTextValue, setFreeTextValue] = useState(turn.freeTextValue ?? '');
  const answered = turn.answered ?? false;

  const toggleOption = useCallback((id: string) => {
    if (answered) return;
    if (!turn.multiSelect) {
      setLocalSelected([id]);
      return;
    }
    setLocalSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, [answered, turn.multiSelect]);

  const handleSubmit = useCallback(() => {
    if (answered) return;
    const labels = localSelected.map(
      sid => turn.options.find(o => o.id === sid)?.label ?? sid
    );
    onFormAnswer(turn.id, localSelected, labels, freeTextValue);
  }, [answered, localSelected, freeTextValue, turn.id, turn.options, onFormAnswer]);

  const handleSingleSelect = useCallback((id: string, label: string) => {
    if (answered) return;
    onFormAnswer(turn.id, [id], [label], '');
  }, [answered, turn.id, onFormAnswer]);

  const canSubmit = localSelected.length > 0 || freeTextValue.trim().length > 0;
  const showSubmitButton = turn.multiSelect || turn.freeText;

  return (
    <div className="msg agent fade-in">
      <div className="msg-body">
        <div className="fq-question">{turn.question}</div>
        <div className="fq-options">
          {turn.options.map(opt => {
            const isSelected = localSelected.includes(opt.id);
            const isAnsweredOther = answered && !isSelected;
            return (
              <button
                key={opt.id}
                className={`fq-option${isSelected ? ' fq-option-selected' : ''}${isAnsweredOther ? ' fq-option-dim' : ''}`}
                onClick={() =>
                  turn.multiSelect
                    ? toggleOption(opt.id)
                    : handleSingleSelect(opt.id, opt.label)
                }
                disabled={answered}
              >
                {turn.multiSelect && (
                  <span className={`fq-checkbox${isSelected ? ' fq-checkbox-checked' : ''}`}>
                    {isSelected && '✓'}
                  </span>
                )}
                <span className="fq-option-body">
                  <span className="fq-option-label">{opt.label}</span>
                  {opt.description && (
                    <span className="fq-option-desc">{opt.description}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {turn.freeText && (
          <div className="fq-free-text">
            <textarea
              className="fq-textarea"
              placeholder="Or describe what you need…"
              value={freeTextValue}
              onChange={e => !answered && setFreeTextValue(e.target.value)}
              disabled={answered}
              rows={2}
            />
          </div>
        )}
        {showSubmitButton && !answered && (
          <button
            className="fq-submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            Continue →
          </button>
        )}
        {answered && (
          <div className="fq-answered-badge">Submitted</div>
        )}
      </div>
    </div>
  );
}
