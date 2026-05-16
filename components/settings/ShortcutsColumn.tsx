'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { READ_TOOLS, WRITE_TOOLS, FORM_TOOLS } from '@/lib/tools';
import type { ToolDef } from '@/lib/tools';
import {
  slugify,
  syncVariables,
  validateShortcutName,
  type Shortcut,
  type ShortcutVariable,
} from '@/lib/shortcuts';

type ToolGroup = { label: string; tools: ToolDef[] };

function buildToolGroups(): ToolGroup[] {
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
    { label: 'AP — Accounts Payable', tools: ap },
    { label: 'AR — Accounts Receivable', tools: ar },
    { label: 'Spend & Expense', tools: se },
    { label: 'Org / Infra', tools: org },
    { label: 'UI / Artifacts', tools: ui },
    { label: 'Write tools', tools: WRITE_TOOLS },
    { label: 'Form / UX', tools: FORM_TOOLS },
  ];
}

type DraftState = {
  name: string;
  label: string;
  description: string;
  prompt: string;
  variables: ShortcutVariable[];
  allowedTools: string[];
};

const EMPTY_DRAFT: DraftState = {
  name: '',
  label: '',
  description: '',
  prompt: '',
  variables: [],
  allowedTools: [],
};

function shortcutToDraft(sc: Shortcut): DraftState {
  return {
    name: sc.name,
    label: sc.label,
    description: sc.description,
    prompt: sc.prompt,
    variables: sc.variables,
    allowedTools: sc.allowedTools,
  };
}

function newId(): string {
  return `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ShortcutsColumn() {
  const shortcuts = useStore(s => s.shortcuts);
  const addShortcut = useStore(s => s.addShortcut);
  const updateShortcut = useStore(s => s.updateShortcut);
  const deleteShortcut = useStore(s => s.deleteShortcut);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [nameError, setNameError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const groups = useMemo(buildToolGroups, []);

  // Sync the draft to the selected shortcut whenever the underlying store entry changes.
  useEffect(() => {
    if (creating) return;
    if (!selectedId) {
      setDraft(EMPTY_DRAFT);
      return;
    }
    const sc = shortcuts.find(s => s.id === selectedId);
    if (sc) setDraft(shortcutToDraft(sc));
  }, [selectedId, creating, shortcuts]);

  const isEditing = creating || selectedId != null;
  const editingId = creating ? undefined : selectedId ?? undefined;

  function startCreate() {
    setCreating(true);
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    setNameError(null);
    setSavedAt(null);
  }

  function selectShortcut(id: string) {
    setCreating(false);
    setSelectedId(id);
    setNameError(null);
    setSavedAt(null);
  }

  function cancelEditing() {
    setCreating(false);
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    setNameError(null);
  }

  function onNameChange(value: string) {
    setDraft(d => ({ ...d, name: slugify(value) }));
  }

  function onNameBlur() {
    const err = validateShortcutName(draft.name, shortcuts, editingId);
    setNameError(err);
  }

  function onPromptChange(value: string) {
    setDraft(d => ({
      ...d,
      prompt: value,
      variables: syncVariables(value, d.variables),
    }));
  }

  function onVariableLabelChange(name: string, label: string) {
    setDraft(d => ({
      ...d,
      variables: d.variables.map(v => (v.name === name ? { ...v, label } : v)),
    }));
  }

  function toggleTool(name: string) {
    setDraft(d => {
      const has = d.allowedTools.includes(name);
      return {
        ...d,
        allowedTools: has
          ? d.allowedTools.filter(t => t !== name)
          : [...d.allowedTools, name],
      };
    });
  }

  function onSave() {
    const err = validateShortcutName(draft.name, shortcuts, editingId);
    if (err) {
      setNameError(err);
      return;
    }
    if (!draft.prompt.trim()) {
      setNameError('Prompt cannot be empty');
      return;
    }
    setNameError(null);

    const now = Date.now();
    if (creating) {
      const id = newId();
      addShortcut({
        id,
        name: draft.name,
        label: draft.label.trim() || draft.name,
        description: draft.description.trim(),
        prompt: draft.prompt,
        variables: draft.variables,
        allowedTools: draft.allowedTools,
        createdAt: now,
        updatedAt: now,
      });
      setCreating(false);
      setSelectedId(id);
    } else if (selectedId) {
      updateShortcut(selectedId, {
        name: draft.name,
        label: draft.label.trim() || draft.name,
        description: draft.description.trim(),
        prompt: draft.prompt,
        variables: draft.variables,
        allowedTools: draft.allowedTools,
      });
    }
    setSavedAt(now);
  }

  function onDelete() {
    if (!selectedId) return;
    if (!confirm('Delete this shortcut?')) return;
    deleteShortcut(selectedId);
    setSelectedId(null);
    setCreating(false);
    setDraft(EMPTY_DRAFT);
  }

  return (
    <div className="shortcut-pane">
      <div className="shortcut-list-col">
        <div className="shortcut-list-head">
          <span className="settings-col-subtitle">Shortcuts</span>
          <button className="shortcut-new-btn" onClick={startCreate}>
            + New
          </button>
        </div>
        <div className="shortcut-list">
          {shortcuts.length === 0 && !creating && (
            <div className="shortcut-empty-mini">No shortcuts yet</div>
          )}
          {shortcuts.map(sc => (
            <div
              key={sc.id}
              className={
                'shortcut-list-item' +
                (selectedId === sc.id && !creating ? ' active' : '')
              }
              onClick={() => selectShortcut(sc.id)}
            >
              <div className="shortcut-list-name">/{sc.name}</div>
              {sc.description && (
                <div className="shortcut-list-hint">{sc.description}</div>
              )}
            </div>
          ))}
          {creating && (
            <div className="shortcut-list-item active">
              <div className="shortcut-list-name">
                /{draft.name || 'new-shortcut'}
              </div>
              <div className="shortcut-list-hint">Drafting…</div>
            </div>
          )}
        </div>
      </div>

      <div className="shortcut-editor-col">
        {!isEditing ? (
          <div className="shortcut-empty-state">
            <div className="shortcut-empty-title">No shortcut selected</div>
            <div className="shortcut-empty-text">
              Create a shortcut to capture a repeatable prompt with variables and a
              tool allowlist. Invoke it from the chat composer with{' '}
              <code>/your-name</code>.
            </div>
            <button className="settings-save" onClick={startCreate}>
              Create your first shortcut
            </button>
          </div>
        ) : (
          <div className="shortcut-editor">
            <section className="settings-section">
              <div className="settings-section-head">
                <span>Identity</span>
              </div>
              <label className="shortcut-field">
                <span className="shortcut-field-label">
                  Name <span className="shortcut-field-hint">(used as /name)</span>
                </span>
                <input
                  className="settings-input"
                  value={draft.name}
                  onChange={e => onNameChange(e.target.value)}
                  onBlur={onNameBlur}
                  placeholder="weekly-report"
                  spellCheck={false}
                />
                {nameError && <div className="settings-error">{nameError}</div>}
              </label>
              <label className="shortcut-field">
                <span className="shortcut-field-label">Label</span>
                <input
                  className="settings-input"
                  value={draft.label}
                  onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
                  placeholder="Weekly AP report"
                />
              </label>
              <label className="shortcut-field">
                <span className="shortcut-field-label">Description</span>
                <input
                  className="settings-input"
                  value={draft.description}
                  onChange={e =>
                    setDraft(d => ({ ...d, description: e.target.value }))
                  }
                  placeholder="One-liner shown in the slash menu"
                />
              </label>
            </section>

            <section className="settings-section">
              <div className="settings-section-head">
                <span>Prompt template</span>
                <span className="settings-help" style={{ margin: 0 }}>
                  use <code>{'{{variable}}'}</code> placeholders
                </span>
              </div>
              <textarea
                className="prompt-editor"
                value={draft.prompt}
                onChange={e => onPromptChange(e.target.value)}
                rows={8}
                spellCheck={false}
                placeholder="Pull a weekly summary for {{vendor}} covering {{period}}…"
              />
            </section>

            {draft.variables.length > 0 && (
              <section className="settings-section">
                <div className="settings-section-head">
                  <span>Variables</span>
                  <span className="settings-help" style={{ margin: 0 }}>
                    auto-detected from the prompt
                  </span>
                </div>
                <div className="shortcut-vars">
                  {draft.variables.map(v => (
                    <div key={v.name} className="shortcut-var-row">
                      <span className="shortcut-var-name">{`{{${v.name}}}`}</span>
                      <input
                        className="settings-input"
                        value={v.label}
                        onChange={e => onVariableLabelChange(v.name, e.target.value)}
                        placeholder="Display label"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="settings-section">
              <div className="settings-section-head">
                <span>Tool allowlist</span>
                <span className="settings-help" style={{ margin: 0 }}>
                  {draft.allowedTools.length === 0
                    ? 'all tools allowed'
                    : `${draft.allowedTools.length} selected`}
                </span>
              </div>
              <div className="settings-help">
                Pick the tools the model is permitted to call when this shortcut runs.
                Leave empty to allow every enabled tool.
              </div>
              <div className="shortcut-tools-grid">
                {groups.map(group => (
                  <div key={group.label} className="shortcut-tools-group">
                    <div className="shortcut-tools-group-label">{group.label}</div>
                    {group.tools.map(t => (
                      <label key={t.name} className="shortcut-tool-row">
                        <input
                          type="checkbox"
                          checked={draft.allowedTools.includes(t.name)}
                          onChange={() => toggleTool(t.name)}
                        />
                        <span className="shortcut-tool-name">{t.name}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <div className="settings-footer">
              <button className="settings-save" onClick={onSave}>
                Save
              </button>
              {!creating && selectedId && (
                <button
                  className="shortcut-delete-btn"
                  onClick={onDelete}
                  type="button"
                >
                  Delete
                </button>
              )}
              <button
                className="settings-link"
                onClick={cancelEditing}
                type="button"
              >
                Cancel
              </button>
              {savedAt && <span className="settings-saved">Saved</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
