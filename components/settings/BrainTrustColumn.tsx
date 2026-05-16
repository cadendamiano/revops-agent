'use client';

import { useEffect, useState } from 'react';

type BrainTrustView = {
  configured: boolean;
  masked: string;
  orgName: string;
  projectName: string;
  enabled: boolean;
};

type Project = { id: string; name: string };

function tracesUrl(orgName: string, projectName: string): string {
  if (!orgName || !projectName) return 'https://www.braintrust.dev/app';
  const org = encodeURIComponent(orgName);
  const proj = encodeURIComponent(projectName);
  return `https://www.braintrust.dev/app/${org}/p/${proj}/logs`;
}

export function BrainTrustColumn() {
  const [btView, setBtView] = useState<BrainTrustView | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [orgInput, setOrgInput] = useState('');
  const [projectInput, setProjectInput] = useState('');
  const [enabledInput, setEnabledInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const bt = data.braintrust as BrainTrustView;
        setBtView(bt);
        setOrgInput(bt?.orgName ?? '');
        setProjectInput(bt?.projectName ?? '');
        setEnabledInput(bt?.enabled ?? false);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  async function saveBrainTrust() {
    setSaving(true);
    setSaveError(null);
    try {
      const patch: Record<string, unknown> = {
        braintrustOrgName: orgInput,
        braintrustProjectName: projectInput,
        braintrustEnabled: enabledInput,
      };
      if (apiKeyInput.length > 0) patch.braintrustApiKey = apiKeyInput;
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      setBtView(data.braintrust);
      setApiKeyInput('');
      setSavedAt(Date.now());
    } catch (e: any) {
      setSaveError(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTestStatus('testing');
    setTestError('');
    setProjects([]);
    try {
      const res = await fetch('/api/braintrust?action=test', { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
        setTestStatus('ok');
        setProjects(data.projects ?? []);
      } else {
        setTestStatus('error');
        setTestError(data.error ?? 'Unknown error');
      }
    } catch (e: any) {
      setTestStatus('error');
      setTestError(e?.message ?? 'Network error');
    }
  }

  const liveTracingOn = Boolean(btView?.configured) && enabledInput && Boolean(projectInput);

  return (
    <>
      {/* Configuration */}
      <section className="settings-section">
        <div className="settings-section-head">
          <span>API key</span>
          {btView && (
            <span className={'status-pill' + (btView.configured ? ' ok' : '')}>
              {btView.configured ? btView.masked : 'missing'}
            </span>
          )}
        </div>
        <input
          type="password"
          className="settings-input"
          placeholder={btView?.configured ? '•••• configured' : 'bt_…'}
          value={apiKeyInput}
          onChange={e => setApiKeyInput(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </section>

      <section className="settings-section">
        <div className="settings-section-head"><span>Organization</span></div>
        <input
          className="settings-input"
          placeholder="my-org"
          value={orgInput}
          onChange={e => setOrgInput(e.target.value)}
          autoComplete="off"
        />
      </section>

      <section className="settings-section">
        <div className="settings-section-head"><span>Project name</span></div>
        <input
          className="settings-input"
          placeholder="coworker-traces"
          value={projectInput}
          onChange={e => setProjectInput(e.target.value)}
          autoComplete="off"
        />
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <span>Live tracing</span>
          <span className={'status-pill' + (liveTracingOn ? ' ok' : '')}>{liveTracingOn ? 'on' : 'off'}</span>
        </div>
        <label className="tweak-toggle" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
          <input type="checkbox" checked={enabledInput} onChange={e => setEnabledInput(e.target.checked)} />
          Stream LLM + tool spans to BrainTrust on every request
        </label>
        <div className="settings-help" style={{ marginTop: 6 }}>
          Each request opens a root span with child spans for every model turn and tool call. Token counts, latency, and errors are captured automatically.
        </div>
      </section>

      {saveError && <div className="settings-error">{saveError}</div>}

      <div className="settings-footer">
        <button className="settings-save" onClick={saveBrainTrust} disabled={saving}>
          {saving ? 'Saving…' : 'Save BrainTrust'}
        </button>
        <button
          className="settings-save"
          onClick={testConnection}
          disabled={testStatus === 'testing'}
          style={{ marginLeft: 8, background: 'var(--surface-2)', color: 'var(--ink-2)' }}
        >
          {testStatus === 'testing' ? 'Testing…' : 'Test connection'}
        </button>
        {savedAt && !saving && <span className="settings-saved">Saved</span>}
      </div>

      {testStatus === 'ok' && (
        <div className="bt-test-result ok">
          Connected. {projects.length} project{projects.length === 1 ? '' : 's'} found.
          {projects.length > 0 && (
            <ul className="bt-project-list">
              {projects.slice(0, 8).map(p => <li key={p.id}>{p.name}</li>)}
              {projects.length > 8 && <li>+{projects.length - 8} more</li>}
            </ul>
          )}
        </div>
      )}
      {testStatus === 'error' && (
        <div className="bt-test-result error">{testError}</div>
      )}

      {liveTracingOn && (
        <div className="settings-footer" style={{ marginTop: 12 }}>
          <a
            className="settings-save"
            href={tracesUrl(orgInput, projectInput)}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            Open traces in BrainTrust →
          </a>
        </div>
      )}
    </>
  );
}
