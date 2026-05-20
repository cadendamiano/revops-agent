import { describe, it, expect } from 'vitest';
import { MODEL_TOOLS, runMockTool } from '@/lib/tools';

describe('tool registry', () => {
  it('exposes the memory and plan tools to the model', () => {
    const names = MODEL_TOOLS.map(t => t.name);
    expect(names).toContain('flag_records');
    expect(names).toContain('plan');
  });

  it('flag_records runs without an approval gate', async () => {
    const r = await runMockTool('flag_records', {
      records: [{ recordId: '006900001', flag: 'stale', name: 'Stuck quote' }],
    }, {});
    expect(r.ok).toBe(true);
  });

  it('plan runs and reports its step count', async () => {
    const r = await runMockTool('plan', {
      goal: 'Review pipeline', steps: [{ title: 'Query open opps' }, { title: 'Flag risks' }],
    }, {});
    expect(r.ok).toBe(true);
    expect(r.summary).toContain('2');
  });
});
