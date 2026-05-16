'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { DEFAULT_MODEL_ID, MODELS, getModel, type Provider } from '@/lib/models';

const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Anthropic',
  gemini: 'Google',
  llmgateway: 'LLM Gateway',
};

export function ModelPicker() {
  const modelId = useStore(s => s.tweaks.modelId);
  const setTweak = useStore(s => s.setTweak);
  const streaming = useStore(s => s.streaming);
  const settingsStatus = useStore(s => s.settingsStatus);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const current = getModel(modelId) ?? getModel(DEFAULT_MODEL_ID)!;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isProviderConfigured = (p: Provider) =>
    settingsStatus == null ? true : settingsStatus[p];

  const select = (id: string) => {
    setTweak('modelId', id);
    setOpen(false);
    btnRef.current?.focus();
  };

  const groups: Provider[] = ['anthropic', 'gemini', 'llmgateway'];

  return (
    <div className="model-picker-wrap">
      <button
        ref={btnRef}
        type="button"
        className="composer-mode model-picker"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select model"
        disabled={streaming}
        onClick={() => setOpen(o => !o)}
      >
        <span className="dot" /> {current.label}
      </button>
      {open && (
        <div ref={menuRef} className="model-menu" role="listbox">
          {groups.map(p => {
            const items = MODELS.filter(m => m.provider === p);
            if (items.length === 0) return null;
            const configured = isProviderConfigured(p);
            return (
              <div key={p} className="model-menu-group-wrap">
                <div className="model-menu-group" aria-hidden="true">
                  {PROVIDER_LABELS[p]}
                </div>
                {items.map(m => {
                  const selected = m.id === modelId;
                  const disabled = !configured;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      aria-disabled={disabled}
                      className={
                        'model-option' +
                        (selected ? ' sel' : '') +
                        (disabled ? ' disabled' : '')
                      }
                      onClick={() => (disabled ? undefined : select(m.id))}
                    >
                      <strong>{m.label}</strong>
                      <span className="model-option-sub">{m.sub}</span>
                      {disabled && (
                        <span className="model-option-hint">Configure in Settings</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
