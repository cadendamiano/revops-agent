import { describe, it, expect } from 'vitest';
import {
  handleFindAtRiskOpps, handleFindStaleOpps, handleFindOppsMissingField,
  handleGetPipelineForecast, handleListOpps, handleGetOpp,
  handleListUsers, handleListAccounts, handleListLeads, handleGetAccount,
} from '@/lib/tools/sfdc-read';

describe('sfdc read tools', () => {
  it('find_at_risk_opps returns up to 10 rows with risks', async () => {
    const rows = await handleFindAtRiskOpps({ limit: 10 });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(10);
    for (const r of rows) {
      expect(Array.isArray(r.risks)).toBe(true);
      expect(r.risks.length).toBeGreaterThan(0);
    }
  });

  it('find_at_risk_opps honours limit', async () => {
    const rows = await handleFindAtRiskOpps({ limit: 3 });
    expect(rows.length).toBeLessThanOrEqual(3);
  });

  it('find_stale_opps with Negotiation+60 returns >= 28', async () => {
    const rows = await handleFindStaleOpps({
      minDaysSinceActivity: 60,
      stage: 'Negotiation',
    });
    expect(rows.length).toBeGreaterThanOrEqual(28);
  });

  it('find_opps_missing_field NextStep returns >= 14', async () => {
    const rows = await handleFindOppsMissingField({ field: 'NextStep' });
    expect(rows.length).toBeGreaterThanOrEqual(14);
  });

  it('get_pipeline_forecast Q2 returns positive totalWeighted and 4 AE owners', async () => {
    const f = await handleGetPipelineForecast({ quarter: 'Q2' });
    expect(f.quarter).toBe('Q2');
    expect(f.totalWeighted).toBeGreaterThan(0);
    expect(f.byOwner).toHaveLength(4);
    for (const row of f.byOwner) {
      expect(row.quota).toBeGreaterThan(0);
    }
    expect(f.byStage.length).toBeGreaterThan(0);
  });

  it('list_opps with no filter returns all', async () => {
    const rows = await handleListOpps({});
    expect(rows.length).toBeGreaterThan(40);
  });

  it('list_opps with stage filter narrows', async () => {
    const rows = await handleListOpps({ stage: 'Negotiation' });
    expect(rows.every(r => r.StageName === 'Negotiation')).toBe(true);
  });

  it('get_opp returns null for unknown id', async () => {
    const o = await handleGetOpp({ id: 'no_such_id' });
    expect(o).toBeNull();
  });

  it('get_opp returns the known opp', async () => {
    const o = await handleGetOpp({ id: '006N0001' });
    expect(o).not.toBeNull();
    expect(o!.Name).toContain('Northwind');
  });

  it('list_users returns 4 AEs plus a manager and RevOps', async () => {
    const users = await handleListUsers();
    const aes = users.filter(u => u.Role === 'AE');
    expect(aes).toHaveLength(4);
  });

  it('list_accounts and list_leads return non-empty', async () => {
    expect((await handleListAccounts()).length).toBeGreaterThan(0);
    expect((await handleListLeads()).length).toBeGreaterThan(0);
  });

  it('get_account returns null when missing', async () => {
    expect(await handleGetAccount({ id: 'no_such' })).toBeNull();
  });
});
