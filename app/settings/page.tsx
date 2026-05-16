'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/primitives/Icon';
import { ShortcutsColumn } from '@/components/settings/ShortcutsColumn';

type SettingsTab = 'shortcuts';

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'shortcuts', label: 'Shortcuts', icon: '⌘' },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('shortcuts');

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <Link href="/" className="settings-back-btn">
          <span style={{ display: 'inline-block', transform: 'rotate(180deg)' }}><Icon.Arrow /></span>
          <span>Back</span>
        </Link>
        <h1 className="settings-page-title">Settings</h1>
      </div>

      <div className="settings-body">
        <nav className="settings-nav" aria-label="Settings sections">
          {TABS.map(t => (
            <button
              key={t.id}
              className={'settings-nav-tab' + (tab === t.id ? ' active' : '')}
              onClick={() => setTab(t.id)}
              type="button"
            >
              <span className="settings-nav-tab-icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {tab === 'shortcuts' && <ShortcutsColumn />}
        </div>
      </div>
    </div>
  );
}
