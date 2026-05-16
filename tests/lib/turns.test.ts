import { describe, it, expect } from 'vitest';
import { newId } from '@/lib/turns';

describe('newId', () => {
  it('starts with the given prefix', () => {
    expect(newId('u')).toMatch(/^u_/);
    expect(newId('agent')).toMatch(/^agent_/);
  });

  it('contains a timestamp segment', () => {
    // format is prefix_<base36-timestamp>_<base36-seq>
    const id = newId('x');
    const parts = id.split('_');
    expect(parts).toHaveLength(3);
  });

  it('generates unique IDs across many calls', () => {
    const ids = Array.from({ length: 200 }, () => newId('t'));
    expect(new Set(ids).size).toBe(200);
  });

  it('increments the sequence counter monotonically', () => {
    const id1 = newId('s');
    const id2 = newId('s');
    const seq1 = parseInt(id1.split('_')[2], 36);
    const seq2 = parseInt(id2.split('_')[2], 36);
    expect(seq2).toBeGreaterThan(seq1);
  });

  it('works with different prefixes independently', () => {
    const a = newId('foo');
    const b = newId('bar');
    expect(a).not.toBe(b);
    expect(a.startsWith('foo_')).toBe(true);
    expect(b.startsWith('bar_')).toBe(true);
  });
});
