// sf_analytics — reports and dashboards.
import { z } from 'zod';
import { defineTool, type DefinedTool } from '../defineTool';
import { getPipelineForecast } from '@/lib/salesforce/queries';
import {
  OPPORTUNITIES, CASES, LEADS, ACTIVITIES,
} from '@/lib/salesforce/seed';
import { daysBetween, TODAY } from '@/lib/salesforce/types';

// ─── Inline report registry (mock) ──────────────────────────────────

type ReportDef = {
  Id: string;
  Name: string;
  Folder: string;
  Format: 'Tabular' | 'Summary' | 'Matrix';
  description: string;
  build: () => { columns: string[]; rows: Record<string, string | number>[]; grandTotal?: number };
};

const REPORTS: ReportDef[] = [
  {
    Id: 'ForecastQ2',
    Name: 'Q2 Pipeline Forecast (weighted)',
    Folder: 'Sales Reports',
    Format: 'Summary',
    description: 'Q2 weighted pipeline rollup by stage and owner.',
    build: () => {
      const f = getPipelineForecast('Q2');
      const rows: Record<string, string | number>[] = f.byStage.map(s => ({
        Stage: s.stage,
        Count: s.count,
        Unweighted: Math.round(s.unweighted),
        Weighted: Math.round(s.weighted),
      }));
      return { columns: ['Stage', 'Count', 'Unweighted', 'Weighted'], rows, grandTotal: Math.round(f.totalWeighted) };
    },
  },
  {
    Id: 'OpenOppsByOwner',
    Name: 'Open Opportunities by Owner',
    Folder: 'Sales Reports',
    Format: 'Summary',
    description: 'Open pipeline grouped by AE.',
    build: () => {
      const open = OPPORTUNITIES.filter(o => o.StageName !== 'Closed Won' && o.StageName !== 'Closed Lost');
      const byOwner = new Map<string, { count: number; amount: number }>();
      for (const o of open) {
        const cur = byOwner.get(o.OwnerId) ?? { count: 0, amount: 0 };
        cur.count += 1; cur.amount += o.Amount;
        byOwner.set(o.OwnerId, cur);
      }
      const rows = [...byOwner.entries()].map(([ownerId, v]) => ({
        OwnerId: ownerId, Count: v.count, OpenPipeline: Math.round(v.amount),
      }));
      return { columns: ['OwnerId', 'Count', 'OpenPipeline'], rows };
    },
  },
  {
    Id: 'CasesBreachingSla',
    Name: 'Cases Breaching SLA',
    Folder: 'Service Reports',
    Format: 'Tabular',
    description: 'Cases whose SLA target is past or within 24h.',
    build: () => {
      const breaching = CASES.filter(c => {
        if (c.Status === 'Closed') return false;
        return daysBetween(TODAY, c.SlaTargetDate) >= -1;
      });
      const rows = breaching.map(c => ({
        CaseNumber: c.CaseNumber, Account: c.AccountId,
        Priority: c.Priority, Status: c.Status,
        SlaTarget: c.SlaTargetDate,
      }));
      return { columns: ['CaseNumber', 'Account', 'Priority', 'Status', 'SlaTarget'], rows };
    },
  },
  {
    Id: 'NewLeads7d',
    Name: 'New Leads (last 7 days)',
    Folder: 'Marketing',
    Format: 'Tabular',
    description: 'Leads created in the last 7 days.',
    build: () => {
      const rows = LEADS
        .filter(l => daysBetween(TODAY, l.CreatedDate) <= 7)
        .map(l => ({ Name: l.Name, Company: l.Company, Status: l.Status, Source: l.LeadSource }));
      return { columns: ['Name', 'Company', 'Status', 'Source'], rows };
    },
  },
  {
    Id: 'ActivityVolumeByAE',
    Name: 'Activity Volume by AE (30d)',
    Folder: 'Sales Reports',
    Format: 'Summary',
    description: 'Activity count by owner over the last 30 days.',
    build: () => {
      const recent = ACTIVITIES.filter(a => daysBetween(TODAY, a.ActivityDate) <= 30);
      const byOwner = new Map<string, number>();
      for (const a of recent) byOwner.set(a.OwnerId, (byOwner.get(a.OwnerId) ?? 0) + 1);
      const rows = [...byOwner.entries()].map(([ownerId, count]) => ({ OwnerId: ownerId, Activities: count }));
      return { columns: ['OwnerId', 'Activities'], rows };
    },
  },
];

const REPORTS_BY_ID = new Map(REPORTS.map(r => [r.Id, r]));

// ─── Inline dashboard registry ──────────────────────────────────────

const DASHBOARDS = [
  {
    Id: 'DASH_SALES',
    Name: 'Sales Pulse',
    tiles: [
      { type: 'metric' as const, label: 'Open pipeline (count)', reportId: 'OpenOppsByOwner' },
      { type: 'bar' as const,    label: 'Open pipeline by owner', reportId: 'OpenOppsByOwner' },
      { type: 'bar' as const,    label: 'Q2 weighted by stage',   reportId: 'ForecastQ2' },
      { type: 'donut' as const,  label: 'Activity volume by AE',  reportId: 'ActivityVolumeByAE' },
    ],
  },
  {
    Id: 'DASH_SERVICE',
    Name: 'Service Pulse',
    tiles: [
      { type: 'metric' as const, label: 'Cases breaching SLA', reportId: 'CasesBreachingSla' },
      { type: 'bar' as const,    label: 'Breaches by priority', reportId: 'CasesBreachingSla' },
    ],
  },
  {
    Id: 'DASH_MARKETING',
    Name: 'Marketing Pulse',
    tiles: [
      { type: 'metric' as const, label: 'New leads (7d)', reportId: 'NewLeads7d' },
      { type: 'donut' as const,  label: 'Leads by source', reportId: 'NewLeads7d' },
    ],
  },
];

const DASHBOARDS_BY_ID = new Map(DASHBOARDS.map(d => [d.Id, d]));

// ─── Tool defs ──────────────────────────────────────────────────────

export const sfAnalyticsListDashboards = defineTool({
  name: 'sf_analytics_list_dashboards',
  label: 'sf analytics list dashboards',
  domain: 'org',
  description: 'List dashboards available in the org.',
  schema: z.object({}),
});

export const sfAnalyticsGetDashboard = defineTool({
  name: 'sf_analytics_get_dashboard',
  label: 'sf analytics get dashboard',
  domain: 'org',
  description: 'Fetch a dashboard by Id, including its tiles and their backing reports.',
  schema: z.object({ dashboardId: z.string().min(1) }),
});

export const sfAnalyticsListReports = defineTool({
  name: 'sf_analytics_list_reports',
  label: 'sf analytics list reports',
  domain: 'org',
  description: 'List reports available in the org (Id, Name, Folder, Format).',
  schema: z.object({}),
});

export const sfAnalyticsRunReport = defineTool({
  name: 'sf_analytics_run_report',
  label: 'sf analytics run report',
  domain: 'org',
  description: 'Run a report by Id. Returns { columns, rows, grandTotal? }. Use reportId="ForecastQ2" for the weighted Q2 forecast.',
  schema: z.object({ reportId: z.string().min(1) }),
});

export const SF_ANALYTICS_TOOLS: DefinedTool[] = [
  sfAnalyticsListDashboards, sfAnalyticsGetDashboard,
  sfAnalyticsListReports, sfAnalyticsRunReport,
];

// ─── Handlers ──────────────────────────────────────────────────────

export async function handleSfAnalyticsListDashboards() {
  return DASHBOARDS.map(d => ({ Id: d.Id, Name: d.Name, tileCount: d.tiles.length }));
}

export async function handleSfAnalyticsGetDashboard(input: { dashboardId: string }) {
  const d = DASHBOARDS_BY_ID.get(input.dashboardId);
  if (!d) return { error: 'NOT_FOUND', hint: `unknown dashboardId "${input.dashboardId}"` };
  // Resolve report data into each tile so the artifact can render without a follow-up call.
  const tiles = d.tiles.map(t => {
    const r = REPORTS_BY_ID.get(t.reportId);
    if (!r) return { ...t };
    const out = r.build();
    if (t.type === 'metric') {
      const total = out.grandTotal ?? out.rows.length;
      return { ...t, value: total };
    }
    return {
      ...t,
      series: out.rows.map(row => ({
        label: String(Object.values(row)[0]),
        value: Number(Object.values(row).slice(-1)[0]),
      })),
    };
  });
  return { Id: d.Id, Name: d.Name, tiles };
}

export async function handleSfAnalyticsListReports() {
  return REPORTS.map(r => ({ Id: r.Id, Name: r.Name, Folder: r.Folder, Format: r.Format, description: r.description }));
}

export async function handleSfAnalyticsRunReport(input: { reportId: string }) {
  const r = REPORTS_BY_ID.get(input.reportId);
  if (!r) return { error: 'NOT_FOUND', hint: `unknown reportId "${input.reportId}". Known: ${REPORTS.map(x => x.Id).join(', ')}` };
  return { Id: r.Id, Name: r.Name, ...r.build() };
}
