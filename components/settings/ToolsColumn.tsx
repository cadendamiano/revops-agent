'use client';

import { useEffect, useState } from 'react';
import { READ_TOOLS, WRITE_TOOLS, FORM_TOOLS, INTERNAL_TOOLS } from '@/lib/tools';
import { TESTING_SYSTEM_PROMPT } from '@/lib/tools';
import type { ToolDef } from '@/lib/tools';

type ToolGroup = { label: string; tools: ToolDef[]; accent: string };

function groupReadTools(): ToolGroup[] {
  const ap = READ_TOOLS.filter(t =>
    ['list_bills','get_bill','list_vendors','get_vendor','list_vendor_bank_accounts',
     'list_payments','get_payment','get_payment_options','get_exchange_rate',
     'list_approval_policies','get_aging_summary','get_category_spend',
     'find_duplicate_invoices','get_liquidity_projection'].includes(t.name)
  );
  const ar = READ_TOOLS.filter(t =>
    ['list_customers','get_customer','list_invoices','get_invoice','list_estimates'].includes(t.name)
  );
  const se = READ_TOOLS.filter(t =>
    ['list_expenses','get_employee','list_employees','list_cards','get_card',
     'list_budgets','get_budget','list_transactions','get_transaction','list_reimbursements'].includes(t.name)
  );
  const org = READ_TOOLS.filter(t =>
    ['list_funding_accounts','get_funding_account','list_users','get_user',
     'list_roles','list_chart_of_accounts','list_webhook_subscriptions','list_event_catalog'].includes(t.name)
  );
  const ui = READ_TOOLS.filter(t => ['render_artifact','render_html_artifact'].includes(t.name));
  return [
    { label: 'AP (Accounts Payable)', tools: ap, accent: 'var(--accent)' },
    { label: 'AR (Accounts Receivable)', tools: ar, accent: 'var(--pos)' },
    { label: 'Spend & Expense', tools: se, accent: 'var(--warn)' },
    { label: 'Org / Infra', tools: org, accent: 'var(--ink-3)' },
    { label: 'UI / Artifacts', tools: ui, accent: 'var(--accent-deep)' },
  ];
}

function ToolCard({
  tool,
  disabled,
  onToggle,
}: {
  tool: ToolDef;
  disabled: boolean;
  onToggle: (name: string, disabled: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={'tool-card' + (disabled ? ' tool-card--disabled' : '')}>
      <div className="tool-card-head" onClick={() => setExpanded(v => !v)}>
        <label className="tool-card-toggle" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={!disabled}
            onChange={e => onToggle(tool.name, !e.target.checked)}
          />
        </label>
        <span className="tool-card-name">{tool.name}</span>
        <span className="tool-card-label">{tool.label}</span>
        <span className="tool-card-expand">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="tool-card-body">
          <div className="tool-card-desc">{tool.description}</div>
          <pre className="tool-card-schema">{JSON.stringify(tool.parameters, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function ToolGroupSection({
  group,
  disabledTools,
  onToggle,
}: {
  group: ToolGroup;
  disabledTools: Set<string>;
  onToggle: (name: string, disabled: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const disabledCount = group.tools.filter(t => disabledTools.has(t.name)).length;

  return (
    <div className="tool-group">
      <button className="tool-group-head" onClick={() => setOpen(v => !v)} type="button">
        <span className="tool-group-dot" style={{ background: group.accent }} />
        <span className="tool-group-label">{group.label}</span>
        <span className="tool-group-count">
          {group.tools.length - disabledCount}/{group.tools.length}
        </span>
        <span className="tool-group-chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="tool-group-body">
          {group.tools.map(tool => (
            <ToolCard
              key={tool.name}
              tool={tool}
              disabled={disabledTools.has(tool.name)}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ToolsColumn() {
  const [disabledTools, setDisabledTools] = useState<Set<string>>(new Set());
  const [prompt, setPrompt] = useState('');
  const [overrideActive, setOverrideActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [toolsSavedAt, setToolsSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const disabled: string[] = data.disabledTools ?? [];
        setDisabledTools(new Set(disabled));
        const testingOverride: string | null = data.systemPromptOverrideTesting ?? null;
        setPrompt(testingOverride ?? TESTING_SYSTEM_PROMPT);
        setOverrideActive(Boolean(testingOverride));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  function toggleTool(name: string, makeDisabled: boolean) {
    setDisabledTools(prev => {
      const next = new Set(prev);
      if (makeDisabled) next.add(name);
      else next.delete(name);
      return next;
    });
  }

  async function saveTools() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ disabledTools: Array.from(disabledTools) }),
      });
      if (!res.ok) throw new Error('Save failed');
      setToolsSavedAt(Date.now());
    } catch (e: any) {
      setSaveError(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function savePrompts() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemPromptOverrideTesting: overrideActive ? prompt : null,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSavedAt(Date.now());
    } catch (e: any) {
      setSaveError(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function resetPrompt() {
    setPrompt(TESTING_SYSTEM_PROMPT);
    setOverrideActive(false);
  }

  const readGroups = groupReadTools();

  const writeGroup: ToolGroup = { label: 'Write tools', tools: WRITE_TOOLS, accent: 'var(--danger)' };
  const formGroup: ToolGroup = { label: 'Form / UX', tools: FORM_TOOLS, accent: 'var(--ink-4)' };
  const internalGroup: ToolGroup = { label: 'Internal (not sent to LLM)', tools: INTERNAL_TOOLS, accent: 'var(--ink-4)' };

  return (
    <div className="scol-body">
      {/* System Prompt */}
      <section className="settings-section">
        <div className="settings-section-head">
          <span>System prompt</span>
        </div>

        <div className="prompt-editor-bar">
          <label className="tweak-toggle" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
            <input
              type="checkbox"
              checked={overrideActive}
              onChange={e => setOverrideActive(e.target.checked)}
            />
            Use custom prompt
          </label>
          <button
            className="settings-link"
            onClick={() => resetPrompt()}
            disabled={prompt === TESTING_SYSTEM_PROMPT && !overrideActive}
          >
            Reset to default
          </button>
        </div>

        <textarea
          className={'prompt-editor' + (!overrideActive ? ' prompt-editor--readonly' : '')}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          readOnly={!overrideActive}
          spellCheck={false}
          rows={14}
        />
        <div className="prompt-editor-meta">
          {prompt.length.toLocaleString()} chars
          {overrideActive && prompt !== TESTING_SYSTEM_PROMPT && (
            <span className="prompt-modified"> · modified</span>
          )}
        </div>

        {saveError && <div className="settings-error" style={{ marginTop: 6 }}>{saveError}</div>}

        <div className="settings-footer">
          <button className="settings-save" onClick={savePrompts} disabled={saving}>
            {saving ? 'Saving…' : 'Save prompts'}
          </button>
          {savedAt && !saving && <span className="settings-saved">Saved</span>}
        </div>
      </section>

      {/* Tool management */}
      <section className="settings-section" style={{ marginTop: 20 }}>
        <div className="settings-section-head">
          <span>Tool management</span>
          <span className="settings-help" style={{ margin: 0 }}>
            {disabledTools.size > 0 ? `${disabledTools.size} disabled` : 'all enabled'}
          </span>
        </div>
        <div className="settings-help">
          Disabled tools are filtered out of every LLM request. Changes take effect on the next conversation turn.
        </div>

        {readGroups.map(group => (
          <ToolGroupSection
            key={group.label}
            group={group}
            disabledTools={disabledTools}
            onToggle={toggleTool}
          />
        ))}
        <ToolGroupSection group={writeGroup} disabledTools={disabledTools} onToggle={toggleTool} />
        <ToolGroupSection group={formGroup} disabledTools={disabledTools} onToggle={toggleTool} />
        <ToolGroupSection group={internalGroup} disabledTools={new Set()} onToggle={() => {}} />

        <div className="settings-footer" style={{ marginTop: 12 }}>
          <button className="settings-save" onClick={saveTools} disabled={saving}>
            {saving ? 'Saving…' : 'Save tool config'}
          </button>
          {toolsSavedAt && !saving && <span className="settings-saved">Saved</span>}
        </div>
      </section>
    </div>
  );
}
