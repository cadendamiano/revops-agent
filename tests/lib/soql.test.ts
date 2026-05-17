import { describe, it, expect } from 'vitest';
import { runSoql } from '@/lib/salesforce/soql';

describe('runSoql', () => {
  it('returns an UNSUPPORTED_SOQL hint on bad input', () => {
    const r = runSoql('not a real query');
    expect('error' in r && r.error).toBe('UNSUPPORTED_SOQL');
  });

  it('returns an UNSUPPORTED_SOQL hint on unknown sObject', () => {
    const r = runSoql('SELECT Id FROM Foobar');
    expect('error' in r && r.error).toBe('UNSUPPORTED_SOQL');
  });

  it('SELECT * FROM Opportunity returns rows + fields', () => {
    const r = runSoql('SELECT * FROM Opportunity LIMIT 5');
    expect('records' in r).toBe(true);
    if ('records' in r) {
      expect(r.records.length).toBe(5);
      expect(r.fields).toContain('Id');
      expect(r.fields).toContain('Name');
    }
  });

  it('selects only requested fields', () => {
    const r = runSoql('SELECT Id, Name FROM Account LIMIT 3');
    if ('records' in r) {
      expect(r.fields).toEqual(['Id', 'Name']);
      for (const rec of r.records) {
        expect(Object.keys(rec)).toEqual(['Id', 'Name']);
      }
    }
  });

  it('applies WHERE with = comparison', () => {
    const r = runSoql("SELECT Id, StageName FROM Opportunity WHERE StageName = 'Negotiation'");
    if ('records' in r) {
      expect(r.records.length).toBeGreaterThan(20);
      expect(r.records.every(x => x.StageName === 'Negotiation')).toBe(true);
    }
  });

  it('supports AND', () => {
    const r = runSoql("SELECT Id FROM Opportunity WHERE StageName = 'Negotiation' AND Amount > 200000");
    if ('records' in r) {
      expect(r.records.length).toBeGreaterThan(0);
    }
  });

  it('supports IN (…) lists', () => {
    const r = runSoql("SELECT Id, StageName FROM Opportunity WHERE StageName IN ('Closed Won', 'Closed Lost')");
    if ('records' in r) {
      expect(r.records.every(x => x.StageName === 'Closed Won' || x.StageName === 'Closed Lost')).toBe(true);
    }
  });

  it('supports LIKE patterns', () => {
    const r = runSoql("SELECT Id, Name FROM Account WHERE Name LIKE 'Pacific%'");
    if ('records' in r) {
      expect(r.records.length).toBe(1);
      expect((r.records[0] as any).Name).toContain('Pacific');
    }
  });

  it('honours ORDER BY DESC', () => {
    const r = runSoql('SELECT Id, Amount FROM Opportunity ORDER BY Amount DESC LIMIT 3');
    if ('records' in r) {
      const amounts = r.records.map(x => Number(x.Amount));
      expect(amounts[0]).toBeGreaterThanOrEqual(amounts[1]);
      expect(amounts[1]).toBeGreaterThanOrEqual(amounts[2]);
    }
  });

  it('honours LIMIT', () => {
    const r = runSoql('SELECT Id FROM Opportunity LIMIT 7');
    if ('records' in r) expect(r.records.length).toBe(7);
  });

  it('supports THIS_QUARTER on CloseDate', () => {
    const r = runSoql("SELECT Id FROM Opportunity WHERE CloseDate = THIS_QUARTER");
    if ('records' in r) {
      expect(r.records.length).toBeGreaterThan(0);
    }
  });
});
