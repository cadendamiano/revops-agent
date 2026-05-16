import { describe, it, expect } from 'vitest';
import { fmtMoney, fmtMoneyShort, fmtDate } from '@/lib/format';

describe('fmtMoney', () => {
  it('formats with 2 decimal places and $ sign', () => {
    expect(fmtMoney(1234.5)).toBe('$1,234.50');
  });

  it('formats zero', () => {
    expect(fmtMoney(0)).toBe('$0.00');
  });

  it('formats negative values', () => {
    expect(fmtMoney(-100)).toBe('-$100.00');
  });

  it('includes comma separators for large numbers', () => {
    expect(fmtMoney(1000000)).toBe('$1,000,000.00');
  });

  it('rounds to 2 decimals', () => {
    expect(fmtMoney(9.999)).toBe('$10.00');
  });
});

describe('fmtMoneyShort', () => {
  it('formats millions with one decimal', () => {
    expect(fmtMoneyShort(2000000)).toBe('$2.0M');
  });

  it('formats millions with one decimal for non-round values', () => {
    expect(fmtMoneyShort(1500000)).toBe('$1.5M');
  });

  it('formats thousands with one decimal', () => {
    expect(fmtMoneyShort(5500)).toBe('$5.5k');
  });

  it('formats exactly 1000 as 1.0k', () => {
    expect(fmtMoneyShort(1000)).toBe('$1.0k');
  });

  it('formats exactly 1000000 as 1.0M', () => {
    expect(fmtMoneyShort(1000000)).toBe('$1.0M');
  });

  it('formats small numbers as rounded integer', () => {
    expect(fmtMoneyShort(42)).toBe('$42');
  });

  it('rounds small numbers', () => {
    expect(fmtMoneyShort(42.7)).toBe('$43');
  });

  it('formats 999 as $999', () => {
    expect(fmtMoneyShort(999)).toBe('$999');
  });
});

describe('fmtDate', () => {
  it('formats an ISO date to short month and day', () => {
    expect(fmtDate('2026-04-22')).toBe('Apr 22');
  });

  it('formats January correctly', () => {
    expect(fmtDate('2026-01-05')).toBe('Jan 5');
  });

  it('formats December correctly', () => {
    expect(fmtDate('2026-12-31')).toBe('Dec 31');
  });

  it('does not include the year', () => {
    expect(fmtDate('2026-06-15')).not.toContain('2026');
  });
});
