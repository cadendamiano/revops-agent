'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { MODELS } from '@/lib/models';
import { Icon } from './primitives/Icon';
import { CredentialsColumn } from './settings/CredentialsColumn';
import { BrainTrustColumn } from './settings/BrainTrustColumn';
import { ToolsColumn } from './settings/ToolsColumn';
import { UsageSparkline } from './settings/UsageSparkline';

type Tab = 'configuration' | 'observability' | 'tools';

const HUES = [195, 170, 215, 245, 25, 145];

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'configuration', label: 'Configuration', icon: '⚙' },
  { id: 'observability', label: 'AI Observability', icon: '◎' },
  { id: 'tools', label: 'Prompts & Tools', icon: '⬡' },
];

function TweaksSection() {
  const tweaks = useStore(s => s.tweaks);
  const set = useStore(s => s.setTweak);

  return (
    <div className="scol-body">
      <section className="settings-section">
        <span className="settings-col-subtitle">App Tweaks</span>
        <div className="tweak-row">
          <label>Model</label>
          <select
            value={tweaks.modelId}
            onChange={(e) => set('modelId', e.target.value)}
          >
            {MODELS.map(m => (
              <option key={m.id} value={m.id}>
                {m.label} — {m.sub}
              </option>
            ))}
          </select>
        </div>
        <div className="tweak-row">
          <label>Accent <code>{tweaks.accentHue}°</code></label>
          <div className="tweak-swatches">
            {HUES.map(h => (
              <div
                key={h}
                className={'tweak-swatch' + (tweaks.accentHue === h ? ' sel' : '')}
                style={{ background: `oklch(0.62 0.10 ${h})` }}
                onClick={() => set('accentHue', h)}
              />
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <label>Density</label>
          <select
            value={tweaks.density}
            onChange={(e) => set('density', e.target.value as 'comfortable' | 'compact')}
          >
            <option value="comfortable">comfortable</option>
            <option value="compact">compact</option>
          </select>
        </div>
        <div className="tweak-row">
          <label>Stream speed</label>
          <select
            value={tweaks.streamSpeed}
            onChange={(e) => set('streamSpeed', e.target.value as 'fast' | 'normal' | 'slow')}
          >
            <option value="fast">fast (demo)</option>
            <option value="normal">normal</option>
            <option value="slow">slow (teaching)</option>
          </select>
        </div>
        <label className="tweak-toggle">
          <input
            type="checkbox"
            checked={tweaks.showConnectors}
            onChange={(e) => set('showConnectors', e.target.checked)}
          />
          Show connectors in sidebar
        </label>
        <label className="tweak-toggle">
          <input
            type="checkbox"
            checked={tweaks.showCodeView}
            onChange={(e) => set('showCodeView', e.target.checked)}
          />
          Sidebar code review
        </label>
      </section>
    </div>
  );
}

export function DevConfigPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('configuration');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="dev-panel-overlay" role="dialog" aria-label="Dev Config">
      <div className="dev-panel">
        <nav className="dev-panel-nav">
          <div className="dev-panel-nav-header">
            <span>Dev Config</span>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon.Close />
            </button>
          </div>
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className={'dev-panel-tab' + (tab === t.id ? ' active' : '')}
              onClick={() => setTab(t.id)}
            >
              <span className="dev-panel-tab-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="dev-panel-content">
          {tab === 'configuration' && (
            <div className="dev-config-columns">
              <div className="scol-body">
                <CredentialsColumn />
              </div>
              <TweaksSection />
            </div>
          )}
          {tab === 'observability' && (
            <div className="scol-body">
              <UsageSparkline />
              <BrainTrustColumn />
            </div>
          )}
          {tab === 'tools' && <ToolsColumn />}
        </div>
      </div>
    </div>
  );
}
