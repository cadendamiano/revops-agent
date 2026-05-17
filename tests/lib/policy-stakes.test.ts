import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleSfDataUpdate, handleSfDataStageChange, handleSfDataDelete,
} from '@/lib/tools/sfdc/data';
import { __clearStagedSfdcBatchStoreForTests } from '@/lib/salesforce/stagedBatchStore';

beforeEach(() => __clearStagedSfdcBatchStoreForTests());

describe('policy stake escalation', () => {
  it('sf_data_delete is always mass-action even for a single record', async () => {
    const r = await handleSfDataDelete({
      sobject: 'Lead', ids: ['00Q0001'], reason: 'duplicate',
    });
    expect(r.stake).toBe('mass-action');
  });

  it('sf_data_update at 26+ records → mass-action', async () => {
    const ids = Array.from({ length: 26 }, (_, i) => `006N00${String(i + 1).padStart(2, '0')}`);
    const r = await handleSfDataUpdate({
      sobject: 'Opportunity', ids, field: 'NextStep', value: 'follow up',
    });
    expect(r.stake).toBe('mass-action');
  });

  it('sf_data_stage_change to Closed Lost → mass-action regardless of count', async () => {
    const r = await handleSfDataStageChange({
      ids: ['006N0001'], newStage: 'Closed Lost', reason: 'churn',
    });
    expect(r.stake).toBe('mass-action');
  });

  it('sf_data_stage_change to Closed Won → mass-action (irreversible)', async () => {
    const r = await handleSfDataStageChange({
      ids: ['006H0001'], newStage: 'Closed Won', reason: 'won',
    });
    expect(r.stake).toBe('mass-action');
  });

  it('sf_data_update of 1 row → single-record-edit', async () => {
    const r = await handleSfDataUpdate({
      sobject: 'Opportunity', ids: ['006H0001'], field: 'NextStep', value: 'x',
    });
    expect(r.stake).toBe('single-record-edit');
  });

  it('sf_data_update of 25 rows → bulk-update', async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `006N00${String(i + 1).padStart(2, '0')}`);
    const r = await handleSfDataUpdate({
      sobject: 'Opportunity', ids, field: 'NextStep', value: 'x',
    });
    expect(r.stake).toBe('bulk-update');
  });
});
