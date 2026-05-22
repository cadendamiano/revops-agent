'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { Icon } from '@/components/primitives/Icon';

type ProviderView = { configured: boolean; masked: string };
type BillProductTag = 'ap' | 'se' | 'both';

type BillEnvView = {
  id: string;
  name: string;
  devKey: string;
  username: string;
  orgId: string;
  passwordConfigured: boolean;
  product: BillProductTag;
  seClientId: string;
  seClientSecretConfigured: boolean;
};

type SettingsView = {
  anthropic: ProviderView;
  gemini: ProviderView;
  llmgateway: ProviderView;
  billEnvironments: BillEnvView[];
};

type BillDraft = {
  id: string;
  name: string;
  username: string;
  orgId: string;
  devKeyInput: string;
  passwordInput: string;
  devKeyMasked: string;
  devKeyConfigured: boolean;
  passwordConfigured: boolean;
  product: BillProductTag;
  seClientIdInput: string;
  seClientSecretInput: string;
  seClientIdCurrent: string;
  seClientSecretConfigured: boolean;
  isNew: boolean;
};

const EMPTY_DRAFT = (id: string): BillDraft => ({
  id,
  name: '',
  username: '',
  orgId: '',
  devKeyInput: '',
  passwordInput: '',
  devKeyMasked: '',
  devKeyConfigured: false,
  passwordConfigured: false,
  product: 'ap',
  seClientIdInput: '',
  seClientSecretInput: '',
  seClientIdCurrent: '',
  seClientSecretConfigured: false,
  isNew: true,
});

function toDraft(env: BillEnvView): BillDraft {
  return {
    id: env.id,
    name: env.name,
    username: env.username,
    orgId: env.orgId,
    devKeyInput: '',
    passwordInput: '',
    devKeyMasked: env.devKey,
    devKeyConfigured: Boolean(env.devKey),
    passwordConfigured: env.passwordConfigured,
    product: env.product ?? 'ap',
    seClientIdInput: '',
    seClientSecretInput: '',
    seClientIdCurrent: env.seClientId ?? '',
    seClientSecretConfigured: Boolean(env.seClientSecretConfigured),
    isNew: false,
  };
}

function StatusPill({ configured }: { configured: boolean }) {
  return (
    <span className={'status-pill' + (configured ? ' ok' : '')}>
      {configured ? 'configured' : 'missing'}
    </span>
  );
}

export function CredentialsColumn() {
  const setSettingsStatus = useStore(s => s.setSettingsStatus);

  function publishStatus(next: SettingsView) {
    setSettingsStatus({
      anthropic: next.anthropic.configured,
      gemini: next.gemini.configured,
      llmgateway: next.llmgateway.configured,
    });
  }

  const [view, setView] = useState<SettingsView | null>(null);
  const [anthropicInput, setAnthropicInput] = useState('');
  const [geminiInput, setGeminiInput] = useState('');
  const [llmgatewayInput, setLlmgatewayInput] = useState('');
  const [drafts, setDrafts] = useState<BillDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load settings');
        const data = (await res.json()) as SettingsView;
        if (cancelled) return;
        setView(data);
        setDrafts(data.billEnvironments.map(toDraft));
        publishStatus(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load settings');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function saveAll() {
    setSaving(true);
    setError(null);
    try {
      const patch: Record<string, unknown> = {};
      if (anthropicInput.length > 0) patch.anthropicApiKey = anthropicInput;
      if (geminiInput.length > 0) patch.geminiApiKey = geminiInput;
      if (llmgatewayInput.length > 0) patch.llmgatewayApiKey = llmgatewayInput;
      patch.billEnvironments = drafts.map(d => {
        const entry: Record<string, unknown> = {
          name: d.name || 'Sandbox',
          username: d.username,
          orgId: d.orgId,
          product: d.product,
        };
        if (!d.isNew) entry.id = d.id;
        if (d.devKeyInput.length > 0) entry.devKey = d.devKeyInput;
        if (d.passwordInput.length > 0) entry.password = d.passwordInput;
        if (d.product === 'se' || d.product === 'both') {
          if (d.seClientIdInput.length > 0) entry.seClientId = d.seClientIdInput;
          if (d.seClientSecretInput.length > 0) entry.seClientSecret = d.seClientSecretInput;
        }
        return entry;
      });
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Save failed');
      const next = (await res.json()) as SettingsView;
      setView(next);
      setDrafts(next.billEnvironments.map(toDraft));
      publishStatus(next);
      setAnthropicInput('');
      setGeminiInput('');
      setLlmgatewayInput('');
      setSavedAt(Date.now());
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function clearProvider(which: 'anthropic' | 'gemini' | 'llmgateway') {
    setSaving(true);
    setError(null);
    try {
      const keyByProvider = {
        anthropic: 'anthropicApiKey',
        gemini: 'geminiApiKey',
        llmgateway: 'llmgatewayApiKey',
      } as const;
      const key = keyByProvider[which];
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ [key]: '' }),
      });
      if (!res.ok) throw new Error('Clear failed');
      const next = (await res.json()) as SettingsView;
      setView(next);
      publishStatus(next);
      if (which === 'anthropic') setAnthropicInput('');
      else if (which === 'gemini') setGeminiInput('');
      else setLlmgatewayInput('');
    } catch (e: any) {
      setError(e?.message ?? 'Clear failed');
    } finally {
      setSaving(false);
    }
  }

  function addEnvironment() {
    setDrafts(prev => [...prev, EMPTY_DRAFT(`draft_${prev.length}_${Date.now()}`)]);
  }

  function updateDraft(id: string, patch: Partial<BillDraft>) {
    setDrafts(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d)));
  }

  function removeDraft(id: string) {
    setDrafts(prev => prev.filter(d => d.id !== id));
  }

  return (
    <>
      {!view && !error && <div className="settings-loading">Loading…</div>}

      {view && (
        <>
          <section className="settings-section">
            <div className="settings-section-head">
              <span>Anthropic API key</span>
              <StatusPill configured={view.anthropic.configured} />
            </div>
            <input
              type="password"
              className="settings-input"
              placeholder={view.anthropic.configured ? view.anthropic.masked : 'sk-ant-…'}
              value={anthropicInput}
              onChange={e => setAnthropicInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            {view.anthropic.configured && (
              <button className="settings-link" onClick={() => clearProvider('anthropic')} disabled={saving}>Clear</button>
            )}
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <span>Gemini API key</span>
              <StatusPill configured={view.gemini.configured} />
            </div>
            <input
              type="password"
              className="settings-input"
              placeholder={view.gemini.configured ? view.gemini.masked : 'AIza…'}
              value={geminiInput}
              onChange={e => setGeminiInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            {view.gemini.configured && (
              <button className="settings-link" onClick={() => clearProvider('gemini')} disabled={saving}>Clear</button>
            )}
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <span>LLM Gateway API key</span>
              <StatusPill configured={view.llmgateway.configured} />
            </div>
            <input
              type="password"
              className="settings-input"
              placeholder={view.llmgateway.configured ? view.llmgateway.masked : 'llmgw_…'}
              value={llmgatewayInput}
              onChange={e => setLlmgatewayInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            {view.llmgateway.configured && (
              <button className="settings-link" onClick={() => clearProvider('llmgateway')} disabled={saving}>Clear</button>
            )}
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <span>Bill sandbox environments</span>
              <button className="settings-link" onClick={addEnvironment}>+ Add</button>
            </div>
            {drafts.length === 0 && <div className="settings-empty">No sandbox environments yet.</div>}
            {drafts.map(d => (
              <div key={d.id} className="env-card">
                <div className="env-card-head">
                  <input
                    className="settings-input env-name"
                    placeholder="Name (e.g. sbx-primary)"
                    value={d.name}
                    onChange={e => updateDraft(d.id, { name: e.target.value })}
                  />
                  <button className="icon-btn" onClick={() => removeDraft(d.id)} aria-label="Remove environment">
                    <Icon.Trash />
                  </button>
                </div>
                <div className="env-field">
                  <span>Product</span>
                  <div className="env-product-toggle">
                    {(['ap', 'se', 'both'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        className={'env-product-btn' + (d.product === p ? ' active' : '')}
                        onClick={() => updateDraft(d.id, { product: p })}
                      >
                        {p === 'ap' ? 'AP' : p === 'se' ? 'S&E' : 'Both'}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="env-field">
                  <span>Dev key</span>
                  <input
                    type="password"
                    className="settings-input"
                    placeholder={d.devKeyConfigured ? d.devKeyMasked : 'devKey'}
                    value={d.devKeyInput}
                    onChange={e => updateDraft(d.id, { devKeyInput: e.target.value })}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <label className="env-field">
                  <span>Username</span>
                  <input
                    className="settings-input"
                    placeholder="api-user@company.com"
                    value={d.username}
                    onChange={e => updateDraft(d.id, { username: e.target.value })}
                    autoComplete="off"
                  />
                </label>
                <label className="env-field">
                  <span>Password</span>
                  <input
                    type="password"
                    className="settings-input"
                    placeholder={d.passwordConfigured ? '•••• configured' : 'password'}
                    value={d.passwordInput}
                    onChange={e => updateDraft(d.id, { passwordInput: e.target.value })}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <label className="env-field">
                  <span>Org ID</span>
                  <input
                    className="settings-input"
                    placeholder="00901…"
                    value={d.orgId}
                    onChange={e => updateDraft(d.id, { orgId: e.target.value })}
                    autoComplete="off"
                  />
                </label>
                {(d.product === 'se' || d.product === 'both') && (
                  <>
                    <label className="env-field">
                      <span>S&amp;E client id</span>
                      <input
                        className="settings-input"
                        placeholder={d.seClientIdCurrent || 'client id'}
                        value={d.seClientIdInput}
                        onChange={e => updateDraft(d.id, { seClientIdInput: e.target.value })}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>
                    <label className="env-field">
                      <span>S&amp;E client secret</span>
                      <input
                        type="password"
                        className="settings-input"
                        placeholder={d.seClientSecretConfigured ? '•••• configured' : 'client secret'}
                        value={d.seClientSecretInput}
                        onChange={e => updateDraft(d.id, { seClientSecretInput: e.target.value })}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </label>
                  </>
                )}
              </div>
            ))}
          </section>

          {error && <div className="settings-error">{error}</div>}

          <div className="settings-footer">
            <button className="settings-save" onClick={saveAll} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {savedAt && !saving && !error && <span className="settings-saved">Saved</span>}
          </div>
        </>
      )}

      {error && !view && <div className="settings-error">{error}</div>}
    </>
  );
}
