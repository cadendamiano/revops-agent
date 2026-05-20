'use client';

import type { ToolRowSpec } from '@/lib/flows';
import { Icon } from '@/components/primitives/Icon';
import { describeToolRow } from '@/lib/toolPresentation';

export function ToolChip({ row }: { row: ToolRowSpec }) {
  const step = describeToolRow(row);
  const Glyph = step.state === 'running' ? Icon.Spinner : Icon[step.icon];

  return (
    <div className={`tool-chip ${step.state}`}>
      <span className="icon"><Glyph /></span>
      <span className="label">{step.label}</span>
      {step.result && <span className="result">{step.result}</span>}
    </div>
  );
}
