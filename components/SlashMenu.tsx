'use client';

import { matchSlashPrefixWithShortcuts } from '@/lib/slashCommands';
import { isShortcut, type MenuItem } from '@/lib/shortcuts';
import { useStore } from '@/lib/store';

type Props = {
  query: string;
  activeIndex: number;
  onSelect: (cmd: MenuItem) => void;
  onHover?: (index: number) => void;
};

export function SlashMenu({ query, activeIndex, onSelect, onHover }: Props) {
  const shortcuts = useStore(s => s.shortcuts);
  const matches = matchSlashPrefixWithShortcuts(query, shortcuts);

  if (matches.length === 0) {
    return (
      <div className="slash-menu" role="listbox" aria-label="Slash commands">
        <div className="slash-menu-empty">no commands match</div>
      </div>
    );
  }

  return (
    <div className="slash-menu" role="listbox" aria-label="Slash commands">
      {matches.map((item, i) => {
        const custom = isShortcut(item);
        const hint = custom ? item.description : item.hint;
        return (
          <div
            key={custom ? `sc:${item.id}` : `sl:${item.name}`}
            role="option"
            aria-selected={i === activeIndex}
            className={`slash-menu-item${i === activeIndex ? ' active' : ''}`}
            onMouseDown={e => {
              e.preventDefault();
              onSelect(item);
            }}
            onMouseEnter={() => onHover?.(i)}
          >
            <div className="slash-menu-name">
              /{item.name}
              {custom && <span className="shortcut-badge">custom</span>}
            </div>
            <div className="slash-menu-hint">{hint}</div>
          </div>
        );
      })}
    </div>
  );
}
