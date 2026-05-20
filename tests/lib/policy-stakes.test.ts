import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleSfDataUpdate, handleSfDataStageChange, handleSfDataDelete,
} from '@/lib/tools/sfdc/data';
import { __clearStagedSfdcBatchStoreForTests } from '@/lib/salesforce/stagedBatchStore';

beforeEach(() => __clearStagedSfdcBatchStoreForTests());

const leadIds = (n: number) => Array.from({ length: n }, (_, i) => `00Q${String(i + 1).padStart(7, '0')}`);

describe('policy stake escalation', () => {
  it('sf_data_delete is always mass-action even for a single record', async () => {
    const r = await handleSfDataDelete({
      sobject: 'Lead', ids: ['00Q0000001'], reason: 'duplicate',
    });
    expect(r.stake).toBe('mass-action');
  });

  it('sf_data_update at 26+ records → mass-action', async () => {
    const r = await handleSfDataUpdate({
      sobject: 'Lead', ids: leadIds(26), field: 'Status', value: 'Working',
    });
    expect(r.stake).toBe('mass-action');
  });

  it('sf_data_stage_change to Closed Lost → mass-action regardless of count', async () => {
    const r = await handleSfDataStageChange({
      ids: ['006900001'], newStage: 'Closed Lost', reason: 'churn',
    });
    expect(r.stake).toBe('mass-action');
  });

  it('sf_data_stage_change to Closed Won → mass-action (irreversible)', async () => {
    const r = await handleSfDataStageChange({
      ids: ['006900001'], newStage: 'Closed Won', reason: 'won',
    });
    expect(r.stake).toBe('mass-action');
  });

  it('sf_data_update of 1 row → single-record-edit', async () => {
    const r = await handleSfDataUpdate({
      sobject: 'Lead', ids: ['00Q0000001'], field: 'Status', value: 'Working',
    });
    expect(r.stake).toBe('single-record-edit');
  });

  it('sf_data_update of 25 rows → bulk-update', async () => {
    const r = await handleSfDataUpdate({
      sobject: 'Lead', ids: leadIds(25), field: 'Status', value: 'Working',
    });
    expect(r.stake).toBe('bulk-update');
  });
});
