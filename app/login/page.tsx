'use client';

import { FormEvent, useEffect, useState } from 'react';

type ElectronAPI = {
  login(credentials: { password: string; email?: string }): Promise<{ ok: boolean; error?: string }>;
};

function getApi(): ElectronAPI | null {
  if (typeof window === 'undefined') return null;
  return (window as any).electronAPI ?? null;
}

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasElectron, setHasElectron] = useState(true);

  useEffect(() => {
    setHasElectron(getApi() !== null);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const api = getApi();
    if (!api) {
      setError('Auth is only available in the desktop app.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.login({ password });
      if (result.ok) {
        window.location.replace('/');
      } else {
        setError(result.error ?? 'Login failed');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">RevOps Agent</div>
        <div className="login-sub">Internal development build</div>

        {!hasElectron && (
          <div className="login-notice">
            Running in browser dev mode — no auth gate. <a href="/">Continue to app →</a>
          </div>
        )}

        <label className="login-label" htmlFor="login-password">Password</label>
        <input
          id="login-password"
          className="login-input"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={!hasElectron || submitting}
        />

        {error && <div className="login-error">{error}</div>}

        <button
          type="submit"
          className="login-submit"
          disabled={!hasElectron || submitting || password.length === 0}
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="login-hint">Ask the team for the dev password.</div>
      </form>

      <style jsx>{`
        .login-shell {
          display: flex; align-items: center; justify-content: center;
          height: 100vh; width: 100vw;
          background: var(--bg);
          -webkit-app-region: drag;
        }
        .login-card {
          width: 360px; padding: 28px 28px 24px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 10px;
          box-shadow: var(--shadow-md);
          display: flex; flex-direction: column; gap: 10px;
          -webkit-app-region: no-drag;
        }
        .login-brand { font-size: 16px; font-weight: 600; color: var(--ink); }
        .login-sub { font-family: var(--mono); font-size: 11px; color: var(--ink-3); margin-bottom: 8px; }
        .login-notice {
          font-size: 12px; color: var(--ink-2);
          background: var(--warn-soft);
          border: 1px solid color-mix(in oklab, var(--warn) 25%, transparent);
          padding: 8px 10px; border-radius: 6px; margin-bottom: 4px;
        }
        .login-label {
          font-family: var(--mono); font-size: 10.5px; color: var(--ink-3);
          text-transform: uppercase; letter-spacing: 0.06em;
          margin-top: 6px;
        }
        .login-input {
          height: 36px; padding: 0 10px;
          border: 1px solid var(--line); border-radius: 6px;
          background: var(--surface); font-size: 13.5px;
          outline: none;
        }
        .login-input:focus { box-shadow: var(--shadow-focus); border-color: var(--accent); }
        .login-error {
          font-size: 12px; color: var(--danger);
        }
        .login-submit {
          margin-top: 6px; height: 36px;
          background: var(--ink); color: #fff;
          border-radius: 6px; font-weight: 500; font-size: 13px;
        }
        .login-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .login-hint { font-size: 11px; color: var(--ink-4); text-align: center; margin-top: 4px; }
      `}</style>
    </div>
  );
}
