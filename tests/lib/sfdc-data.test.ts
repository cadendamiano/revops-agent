import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleSfDataQuery, handleSfDataSearch, handleSfDataGetRecord,
  handleSfDataCreate, handleSfDataUpdate, handleSfDataStageChange, handleSfDataDelete,
} from '@/lib/tools/sfdc/data';
import { handleSfSObjectDescribe, handleSfSObjectList } from '@/lib/tools/sfdc/sobject';
import { handleSfAnalyticsRunReport, handleSfAnalyticsListReports } from '@/lib/tools/sfdc/analytics';
import { handleSfCaseList, handleSfCaseSlaBreach } from '@/lib/tools/sfdc/case';
import { handleSfActivityList, handleSfActivityLog } from '@/lib/tools/sfdc/activity';
import { handleSfApprovalQueue, handleSfApprovalDecide } from '@/lib/tools/sfdc/approval';
import { __clearStagedSfdcBatchStoreForTests } from '@/lib/salesforce/stagedBatchStore';

beforeEach(() => __clearStagedSfdcBatchStoreForTests());

describe('sf_data_query', () => {
  it('runs a SOQL', async () => {
    const r = await handleSfDataQuery({ soql: 'SELECT Id, Name FROM Account LIMIT 3' });
    expect('records' in (r as any)).toBe(true);
    if ('records' in (r as any)) {
      expect((r as any).records.length).toBe(3);
    }
  });
});

describe('sf_data_search', () => {
  it('finds across name fields', async () => {
    const r = await handleSfDataSearch({ term: 'Pacific' });
    expect(r.total).toBeGreaterThan(0);
  });
});

describe('sf_data_get_record', () => {
  it('returns the known opp by id', async () => {
    const r = await handleSfDataGetRecord({ sobject: 'Opportunity', id: '006N0001' });
    expect(r).not.toBeNull();
    expect((r as any).Name).toContain('Northwind');
  });
  it('returns null for unknown id', async () => {
    expect(await handleSfDataGetRecord({ sobject: 'Opportunity', id: 'nope' })).toBeNull();
  });
});

describe('sf_data_update', () => {
  it('stages a bulk-update at 5 records', async () => {
    const r = await handleSfDataUpdate({
      sobject: 'Opportunity',
      ids: ['006N0001', '006N0002', '006N0003', '006N0004', '006N0005'],
      field: 'NextStep',
      value: 'follow up',
    });
    expect(r.recordCount).toBe(5);
    expect(r.stake).toBe('bulk-update');
  });

  it('escalates to mass-action at 26+ rows', async () => {
    const ids = Array.from({ length: 28 }, (_, i) => `006N00${String(i + 1).padStart(2, '0')}`);
    const r = await handleSfDataUpdate({
      sobject: 'Opportunity', ids, field: 'NextStep', value: 'x',
    });
    expect(r.stake).toBe('mass-action');
  });
});

describe('sf_data_stage_change', () => {
  it('Closed Lost is externally visible → mass-action', async () => {
    const r = await handleSfDataStageChange({
      ids: ['006N0001'], newStage: 'Closed Lost', reason: 'cleanup',
    });
    expect(r.stake).toBe('mass-action');
  });
  it('Discovery → bulk-update for 5 rows', async () => {
    const r = await handleSfDataStageChange({
      ids: ['006N0001', '006N0002', '006N0003', '006N0004', '006N0005'],
      newStage: 'Discovery',
      reason: 'reset',
    });
    expect(r.stake).toBe('bulk-update');
  });
});

describe('sf_data_delete', () => {
  it('always classifies as mass-action (irreversible)', async () => {
    const r = await handleSfDataDelete({
      sobject: 'Opportunity', ids: ['006N0001'], reason: 'duplicate',
    });
    expect(r.stake).toBe('mass-action');
  });
});

describe('sf_data_create', () => {
  it('stages a single-record-edit', async () => {
    const r = await handleSfDataCreate({
      sobject: 'Lead', fields: { Name: 'Test Lead', Company: 'Test Co' },
    });
    expect(r.stake).toBe('single-record-edit');
  });
});

describe('sf_sobject', () => {
  it('describes a known sObject', async () => {
    const r = await handleSfSObjectDescribe({ sobject: 'Opportunity' });
    expect('fields' in (r as any)).toBe(true);
  });

  it('lists sObjects', async () => {
    const r = await handleSfSObjectList();
    expect(r.length).toBeGreaterThan(5);
  });
});

describe('sf_analytics', () => {
  it('runs the ForecastQ2 report', async () => {
    const r = await handleSfAnalyticsRunReport({ reportId: 'ForecastQ2' });
    expect('grandTotal' in (r as any)).toBe(true);
    expect(((r as any).grandTotal as number)).toBeGreaterThan(0);
  });

  it('lists reports', async () => {
    const r = await handleSfAnalyticsListReports();
    expect(r.find(x => x.Id === 'ForecastQ2')).toBeTruthy();
  });
});

describe('sf_case', () => {
  it('lists cases', async () => {
    const r = await handleSfCaseList({});
    expect(r.length).toBeGreaterThan(0);
  });

  it('finds breaching cases', async () => {
    const r = await handleSfCaseSlaBreach();
    expect(r.some(c => c.priority === 'P1')).toBe(true);
  });
});

describe('sf_activity', () => {
  it('lists activities for an opp', async () => {
    const r = await handleSfActivityList({ relatedTo: '006H0001' });
    expect(r.length).toBeGreaterThan(0);
  });

  it('stages a logged activity', async () => {
    const r = await handleSfActivityLog({
      relatedTo: '001A0002', type: 'Call', subject: 'Test call', durationMin: 15,
    });
    expect(r.stake).toBe('single-record-edit');
  });
});

describe('sf_approval', () => {
  it('returns the pending approval queue', async () => {
    const r = await handleSfApprovalQueue();
    expect(r.length).toBeGreaterThan(0);
  });

  it('stages a decision', async () => {
    const r = await handleSfApprovalDecide({
      approvalIds: ['801A0001'], decision: 'Approved',
    });
    expect(r.recordCount).toBe(1);
    expect(r.stake).toBe('single-record-edit');
  });
});
