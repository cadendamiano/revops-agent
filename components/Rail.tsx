'use client';

import Link from 'next/link';
import { useStore } from '@/lib/store';
import { Icon } from './primitives/Icon';
import { WorkspaceRailBody } from './WorkspaceRail';

export function Rail() {
  const mode = useStore(s => s.mode);

  return (
    <aside className="rail">
      <div className="rail-top">
        <WorkspaceRailBody />
      </div>

      <div className="rail-footer">
        <Link href="/settings" className="rail-settings">
          <span className="rail-settings-icon"><Icon.Gear /></span>
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
