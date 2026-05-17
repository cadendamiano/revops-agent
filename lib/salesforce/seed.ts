// Deterministic seed data for Atlas Tech demo. TODAY = 2026-05-16.
// No randomness, no clock reads — all dates are explicit strings.
import type {
  Account, Lead, Opportunity, OpportunityStage, SfdcBundle, User,
  Contact, Activity, Case, ApprovalRequest,
} from './types';
import { STAGE_PROBABILITY } from './types';

export const TODAY = '2026-05-16';

// ─── Users ───────────────────────────────────────────────────────────
export const USERS: User[] = [
  { Id: '005AE001', Name: 'Priya Shah',        Email: 'priya.shah@atlastech.com',     Role: 'AE',      Quota: 1_200_000 },
  { Id: '005AE002', Name: 'Marcus Lee',        Email: 'marcus.lee@atlastech.com',     Role: 'AE',      Quota:   900_000 },
  { Id: '005AE003', Name: 'Devon Carter',      Email: 'devon.carter@atlastech.com',   Role: 'AE',      Quota:   600_000 },
  { Id: '005AE004', Name: 'Hana Yamamoto',     Email: 'hana.yamamoto@atlastech.com',  Role: 'AE',      Quota:   400_000 },
  { Id: '005MG001', Name: 'Renée Okafor',      Email: 'renee.okafor@atlastech.com',   Role: 'Manager' },
  { Id: '005RV001', Name: 'Theo Brandt',       Email: 'theo.brandt@atlastech.com',    Role: 'RevOps'  },
];

const AE_IDS = ['005AE001', '005AE002', '005AE003', '005AE004'] as const;

// ─── Accounts ────────────────────────────────────────────────────────
export const ACCOUNTS: Account[] = [
  { Id: '001A0001', Name: 'Northwind Robotics',    Industry: 'Manufacturing', AnnualRevenue: 220_000_000, Employees: 1800, OwnerId: '005AE001' },
  { Id: '001A0002', Name: 'Pacific Health Systems',Industry: 'Healthcare',    AnnualRevenue: 480_000_000, Employees: 4200, OwnerId: '005AE002' },
  { Id: '001A0003', Name: 'Crestline Capital',     Industry: 'FinServ',       AnnualRevenue: 310_000_000, Employees:  950, OwnerId: '005AE003' },
  { Id: '001A0004', Name: 'Lumen Software',        Industry: 'Software',      AnnualRevenue:  62_000_000, Employees:  340, OwnerId: '005AE004' },
  { Id: '001A0005', Name: 'Cobalt Retail Group',   Industry: 'Retail',        AnnualRevenue: 880_000_000, Employees: 6500, OwnerId: '005AE001' },
  { Id: '001A0006', Name: 'Veritas Manufacturing', Industry: 'Manufacturing', AnnualRevenue: 145_000_000, Employees: 1100, OwnerId: '005AE002' },
  { Id: '001A0007', Name: 'Helios Biotech',        Industry: 'Healthcare',    AnnualRevenue:  92_000_000, Employees:  520, OwnerId: '005AE003' },
  { Id: '001A0008', Name: 'Quantum Ledger Inc',    Industry: 'FinServ',       AnnualRevenue: 210_000_000, Employees:  780, OwnerId: '005AE004' },
  { Id: '001A0009', Name: 'Beacon Software',       Industry: 'Software',      AnnualRevenue:  38_000_000, Employees:  210, OwnerId: '005AE001' },
  { Id: '001A0010', Name: 'Summit Outdoor Retail', Industry: 'Retail',        AnnualRevenue: 410_000_000, Employees: 3300, OwnerId: '005AE002' },
  { Id: '001A0011', Name: 'Aurora Diagnostics',    Industry: 'Healthcare',    AnnualRevenue: 168_000_000, Employees: 1400, OwnerId: '005AE003' },
  { Id: '001A0012', Name: 'Granite Industrials',   Industry: 'Manufacturing', AnnualRevenue: 540_000_000, Employees: 4800, OwnerId: '005AE004' },
  { Id: '001A0013', Name: 'Mosaic Insurance',      Industry: 'FinServ',       AnnualRevenue: 720_000_000, Employees: 5600, OwnerId: '005AE001' },
  { Id: '001A0014', Name: 'Polaris Data',          Industry: 'Software',      AnnualRevenue:  84_000_000, Employees:  410, OwnerId: '005AE002' },
  { Id: '001A0015', Name: 'Ironwood Logistics',    Industry: 'Manufacturing', AnnualRevenue: 195_000_000, Employees: 1650, OwnerId: '005AE003' },
];

// ─── Opportunities ──────────────────────────────────────────────────
// Engineered patterns:
//   • 28 Negotiation opps with LastActivityDate 60+ days ago (mass-action pool)
//   • Of those, 14 are missing NextStep (hygiene pool)
//   • Healthy mix of advancing + closed opps for forecast credibility
// Owner rotation across AE pool keeps the per-owner forecast plausible.

type OppSeed = Omit<Opportunity, 'Probability'> & { Probability?: number };

function prob(stage: OpportunityStage, override?: number): number {
  return override ?? STAGE_PROBABILITY[stage];
}

const OPP_SEEDS: OppSeed[] = [
  // ─── 28 Negotiation, stale 60d+ (mass-action pool) ───
  // 14 of these are missing NextStep (hygiene pool).
  { Id: '006N0001', Name: 'Northwind Robotics - Platform Renewal', AccountId: '001A0001', OwnerId: '005AE001', StageName: 'Negotiation', Amount: 185_000, CloseDate: '2026-06-30', CreatedDate: '2025-11-04', LastActivityDate: '2026-02-14', LeadSource: 'Inbound' },
  { Id: '006N0002', Name: 'Pacific Health Systems - EHR Expansion', AccountId: '001A0002', OwnerId: '005AE002', StageName: 'Negotiation', Amount: 320_000, CloseDate: '2026-06-15', CreatedDate: '2025-10-22', LastActivityDate: '2026-02-02', LeadSource: 'Outbound' },
  { Id: '006N0003', Name: 'Crestline Capital - Risk Module', AccountId: '001A0003', OwnerId: '005AE003', StageName: 'Negotiation', Amount: 145_000, CloseDate: '2026-07-12', CreatedDate: '2025-11-18', LastActivityDate: '2026-02-20', LeadSource: 'Partner' },
  { Id: '006N0004', Name: 'Lumen Software - Enterprise License', AccountId: '001A0004', OwnerId: '005AE004', StageName: 'Negotiation', Amount:  62_000, CloseDate: '2026-06-28', CreatedDate: '2025-12-05', LastActivityDate: '2026-03-01', LeadSource: 'Inbound' },
  { Id: '006N0005', Name: 'Cobalt Retail Group - POS Refresh', AccountId: '001A0005', OwnerId: '005AE001', StageName: 'Negotiation', Amount: 410_000, CloseDate: '2026-08-05', CreatedDate: '2025-09-30', LastActivityDate: '2026-02-11', LeadSource: 'Event' },
  { Id: '006N0006', Name: 'Veritas Manufacturing - ERP Add-on', AccountId: '001A0006', OwnerId: '005AE002', StageName: 'Negotiation', Amount: 230_000, CloseDate: '2026-07-20', CreatedDate: '2025-10-14', LastActivityDate: '2026-01-30', LeadSource: 'Inbound' },
  { Id: '006N0007', Name: 'Helios Biotech - Lab Suite', AccountId: '001A0007', OwnerId: '005AE003', StageName: 'Negotiation', Amount:  95_000, CloseDate: '2026-06-22', CreatedDate: '2025-12-12', LastActivityDate: '2026-03-04', LeadSource: 'Partner' },
  { Id: '006N0008', Name: 'Quantum Ledger Inc - Treasury Suite', AccountId: '001A0008', OwnerId: '005AE004', StageName: 'Negotiation', Amount: 175_000, CloseDate: '2026-07-30', CreatedDate: '2025-11-08', LastActivityDate: '2026-02-08', LeadSource: 'Outbound' },
  { Id: '006N0009', Name: 'Beacon Software - Tier-3 Upgrade', AccountId: '001A0009', OwnerId: '005AE001', StageName: 'Negotiation', Amount:  48_000, CloseDate: '2026-07-04', CreatedDate: '2025-12-20', LastActivityDate: '2026-03-08', LeadSource: 'Inbound' },
  { Id: '006N0010', Name: 'Summit Outdoor Retail - Loyalty Platform', AccountId: '001A0010', OwnerId: '005AE002', StageName: 'Negotiation', Amount: 280_000, CloseDate: '2026-08-15', CreatedDate: '2025-10-02', LastActivityDate: '2026-02-22', LeadSource: 'Event' },
  { Id: '006N0011', Name: 'Aurora Diagnostics - Imaging Cloud', AccountId: '001A0011', OwnerId: '005AE003', StageName: 'Negotiation', Amount: 132_000, CloseDate: '2026-06-18', CreatedDate: '2025-11-25', LastActivityDate: '2026-02-26', LeadSource: 'Inbound' },
  { Id: '006N0012', Name: 'Granite Industrials - Field Service', AccountId: '001A0012', OwnerId: '005AE004', StageName: 'Negotiation', Amount: 365_000, CloseDate: '2026-07-25', CreatedDate: '2025-10-08', LastActivityDate: '2026-02-17', LeadSource: 'Outbound' },
  { Id: '006N0013', Name: 'Mosaic Insurance - Claims Automation', AccountId: '001A0013', OwnerId: '005AE001', StageName: 'Negotiation', Amount: 295_000, CloseDate: '2026-06-12', CreatedDate: '2025-11-12', LastActivityDate: '2026-02-04', LeadSource: 'Partner' },
  { Id: '006N0014', Name: 'Polaris Data - Analytics Tier', AccountId: '001A0014', OwnerId: '005AE002', StageName: 'Negotiation', Amount:  72_000, CloseDate: '2026-07-08', CreatedDate: '2025-12-02', LastActivityDate: '2026-03-06', LeadSource: 'Inbound' },
  // Above 14 have NO NextStep. The next 14 have a NextStep set (still stale Negotiation).
  { Id: '006N0015', Name: 'Ironwood Logistics - Fleet Suite', AccountId: '001A0015', OwnerId: '005AE003', StageName: 'Negotiation', Amount: 158_000, CloseDate: '2026-07-15', CreatedDate: '2025-11-01', LastActivityDate: '2026-02-09', NextStep: 'Waiting on procurement sign-off', LeadSource: 'Outbound' },
  { Id: '006N0016', Name: 'Northwind Robotics - Add-on Modules', AccountId: '001A0001', OwnerId: '005AE001', StageName: 'Negotiation', Amount:  98_000, CloseDate: '2026-08-01', CreatedDate: '2025-10-25', LastActivityDate: '2026-02-15', NextStep: 'Legal red-line round 2', LeadSource: 'Inbound' },
  { Id: '006N0017', Name: 'Pacific Health Systems - Telehealth', AccountId: '001A0002', OwnerId: '005AE002', StageName: 'Negotiation', Amount: 210_000, CloseDate: '2026-06-29', CreatedDate: '2025-11-14', LastActivityDate: '2026-02-19', NextStep: 'CFO escalation pending', LeadSource: 'Partner' },
  { Id: '006N0018', Name: 'Crestline Capital - Compliance Toolkit', AccountId: '001A0003', OwnerId: '005AE003', StageName: 'Negotiation', Amount:  85_000, CloseDate: '2026-07-22', CreatedDate: '2025-12-08', LastActivityDate: '2026-03-10', NextStep: 'Awaiting redline from counsel', LeadSource: 'Outbound' },
  { Id: '006N0019', Name: 'Lumen Software - Pro Services', AccountId: '001A0004', OwnerId: '005AE004', StageName: 'Negotiation', Amount:  42_000, CloseDate: '2026-06-26', CreatedDate: '2025-12-18', LastActivityDate: '2026-03-12', NextStep: 'Scoping workshop scheduled', LeadSource: 'Inbound' },
  { Id: '006N0020', Name: 'Cobalt Retail Group - Mobile App', AccountId: '001A0005', OwnerId: '005AE001', StageName: 'Negotiation', Amount: 188_000, CloseDate: '2026-08-08', CreatedDate: '2025-10-10', LastActivityDate: '2026-02-13', NextStep: 'Procurement RFP response due', LeadSource: 'Event' },
  { Id: '006N0021', Name: 'Veritas Manufacturing - Quality Tools', AccountId: '001A0006', OwnerId: '005AE002', StageName: 'Negotiation', Amount: 122_000, CloseDate: '2026-07-18', CreatedDate: '2025-11-20', LastActivityDate: '2026-02-28', NextStep: 'Pilot results review', LeadSource: 'Inbound' },
  { Id: '006N0022', Name: 'Helios Biotech - Compliance Suite', AccountId: '001A0007', OwnerId: '005AE003', StageName: 'Negotiation', Amount:  68_000, CloseDate: '2026-06-24', CreatedDate: '2025-12-15', LastActivityDate: '2026-03-09', NextStep: 'Awaiting customer response', LeadSource: 'Partner' },
  { Id: '006N0023', Name: 'Quantum Ledger Inc - API Tier', AccountId: '001A0008', OwnerId: '005AE004', StageName: 'Negotiation', Amount: 118_000, CloseDate: '2026-07-29', CreatedDate: '2025-11-06', LastActivityDate: '2026-02-12', NextStep: 'Security review in progress', LeadSource: 'Outbound' },
  { Id: '006N0024', Name: 'Beacon Software - Premium Support', AccountId: '001A0009', OwnerId: '005AE001', StageName: 'Negotiation', Amount:  35_000, CloseDate: '2026-07-02', CreatedDate: '2025-12-22', LastActivityDate: '2026-03-13', NextStep: 'Quote revision sent', LeadSource: 'Inbound' },
  { Id: '006N0025', Name: 'Summit Outdoor Retail - In-store Kiosks', AccountId: '001A0010', OwnerId: '005AE002', StageName: 'Negotiation', Amount: 245_000, CloseDate: '2026-08-12', CreatedDate: '2025-10-04', LastActivityDate: '2026-02-24', NextStep: 'Hardware vendor coordination', LeadSource: 'Event' },
  { Id: '006N0026', Name: 'Aurora Diagnostics - Workflow Engine', AccountId: '001A0011', OwnerId: '005AE003', StageName: 'Negotiation', Amount:  88_000, CloseDate: '2026-06-20', CreatedDate: '2025-11-28', LastActivityDate: '2026-03-03', NextStep: 'Stakeholder demo Friday', LeadSource: 'Inbound' },
  { Id: '006N0027', Name: 'Granite Industrials - IoT Sensors', AccountId: '001A0012', OwnerId: '005AE004', StageName: 'Negotiation', Amount: 198_000, CloseDate: '2026-07-27', CreatedDate: '2025-10-18', LastActivityDate: '2026-02-21', NextStep: 'POC kickoff next week', LeadSource: 'Outbound' },
  { Id: '006N0028', Name: 'Mosaic Insurance - Underwriting Co-pilot', AccountId: '001A0013', OwnerId: '005AE001', StageName: 'Negotiation', Amount: 268_000, CloseDate: '2026-06-14', CreatedDate: '2025-11-16', LastActivityDate: '2026-02-06', NextStep: 'Board sponsor briefing', LeadSource: 'Partner' },

  // ─── 14 other opps: a credible Q2 forecast mix ───
  // Healthy advancing deals (have NextStep, recent activity, in-flight stages).
  { Id: '006H0001', Name: 'Polaris Data - SaaS Bundle',          AccountId: '001A0014', OwnerId: '005AE002', StageName: 'Proposal',     Amount:  56_000, CloseDate: '2026-06-08', CreatedDate: '2026-02-12', LastActivityDate: '2026-05-12', NextStep: 'Pricing approval Thu',     LeadSource: 'Inbound' },
  { Id: '006H0002', Name: 'Ironwood Logistics - Route Optimizer', AccountId: '001A0015', OwnerId: '005AE003', StageName: 'Proposal',     Amount: 118_000, CloseDate: '2026-06-19', CreatedDate: '2026-02-04', LastActivityDate: '2026-05-09', NextStep: 'Procurement intro mtg',   LeadSource: 'Partner' },
  { Id: '006H0003', Name: 'Lumen Software - Tier-2 Expansion',   AccountId: '001A0004', OwnerId: '005AE004', StageName: 'Discovery',    Amount:  38_000, CloseDate: '2026-06-30', CreatedDate: '2026-03-01', LastActivityDate: '2026-05-13', NextStep: 'Tech deep-dive scheduled',LeadSource: 'Inbound' },
  { Id: '006H0004', Name: 'Northwind Robotics - Field Tablets',  AccountId: '001A0001', OwnerId: '005AE001', StageName: 'Discovery',    Amount:  74_000, CloseDate: '2026-06-25', CreatedDate: '2026-03-10', LastActivityDate: '2026-05-11', NextStep: 'IT review with CTO',      LeadSource: 'Event' },
  { Id: '006H0005', Name: 'Quantum Ledger Inc - Audit Module',   AccountId: '001A0008', OwnerId: '005AE004', StageName: 'Qualification',Amount:  29_000, CloseDate: '2026-06-26', CreatedDate: '2026-04-02', LastActivityDate: '2026-05-08', NextStep: 'Discovery call set',      LeadSource: 'Outbound' },
  { Id: '006H0006', Name: 'Helios Biotech - Reporting Pack',     AccountId: '001A0007', OwnerId: '005AE003', StageName: 'Qualification',Amount:  21_000, CloseDate: '2026-06-29', CreatedDate: '2026-04-15', LastActivityDate: '2026-05-14', NextStep: 'Demo request received',    LeadSource: 'Inbound' },
  // Closed Won (counts toward attainment).
  { Id: '006W0001', Name: 'Beacon Software - Onboarding Tier',   AccountId: '001A0009', OwnerId: '005AE001', StageName: 'Closed Won',  Amount:  82_000, CloseDate: '2026-04-30', CreatedDate: '2025-12-02', LastActivityDate: '2026-04-28', NextStep: 'Kickoff scheduled',       LeadSource: 'Inbound' },
  { Id: '006W0002', Name: 'Pacific Health Systems - Pilot',      AccountId: '001A0002', OwnerId: '005AE002', StageName: 'Closed Won',  Amount: 142_000, CloseDate: '2026-04-22', CreatedDate: '2025-11-30', LastActivityDate: '2026-04-20', NextStep: 'Implementation phase 1',  LeadSource: 'Partner' },
  { Id: '006W0003', Name: 'Crestline Capital - Quickstart',      AccountId: '001A0003', OwnerId: '005AE003', StageName: 'Closed Won',  Amount:  54_000, CloseDate: '2026-05-02', CreatedDate: '2026-01-12', LastActivityDate: '2026-04-30', NextStep: 'Handoff to CS team',      LeadSource: 'Inbound' },
  { Id: '006W0004', Name: 'Polaris Data - Starter Pack',         AccountId: '001A0014', OwnerId: '005AE002', StageName: 'Closed Won',  Amount:  26_000, CloseDate: '2026-04-10', CreatedDate: '2026-02-01', LastActivityDate: '2026-04-09', NextStep: 'Provisioning complete',   LeadSource: 'Outbound' },
  // Closed Lost (recent, normal churn).
  { Id: '006L0001', Name: 'Veritas Manufacturing - Trial Bundle',AccountId: '001A0006', OwnerId: '005AE002', StageName: 'Closed Lost', Amount:  18_000, CloseDate: '2026-04-18', CreatedDate: '2026-01-22', LastActivityDate: '2026-04-15', NextStep: 'Budget pulled',           LeadSource: 'Inbound' },
  { Id: '006L0002', Name: 'Aurora Diagnostics - Light Tier',     AccountId: '001A0011', OwnerId: '005AE003', StageName: 'Closed Lost', Amount:  12_000, CloseDate: '2026-04-25', CreatedDate: '2026-02-08', LastActivityDate: '2026-04-22', NextStep: 'Chose competitor',        LeadSource: 'Inbound' },
  // Prospecting (new pipeline).
  { Id: '006P0001', Name: 'Granite Industrials - Discovery',     AccountId: '001A0012', OwnerId: '005AE004', StageName: 'Prospecting', Amount:   8_500, CloseDate: '2026-09-10', CreatedDate: '2026-04-28', LastActivityDate: '2026-05-13', NextStep: 'Initial outreach call',   LeadSource: 'Outbound' },
  { Id: '006P0002', Name: 'Mosaic Insurance - Quick Win',        AccountId: '001A0013', OwnerId: '005AE001', StageName: 'Prospecting', Amount:   6_000, CloseDate: '2026-09-20', CreatedDate: '2026-05-01', LastActivityDate: '2026-05-15', NextStep: 'Intro meeting Tuesday',   LeadSource: 'Event' },
];

export const OPPORTUNITIES: Opportunity[] = OPP_SEEDS.map(o => ({
  ...o,
  Probability: prob(o.StageName, o.Probability),
}));

// ─── Leads ───────────────────────────────────────────────────────────
export const LEADS: Lead[] = [
  { Id: '00Q0001', Name: 'Alex Rivera',  Company: 'Northwind Robotics',     Email: 'arivera@northwind.example',   Status: 'New',         LeadSource: 'Inbound',  CreatedDate: '2026-05-09', OwnerId: '005AE001' },
  { Id: '00Q0002', Name: 'Sam Patel',    Company: 'Pacific Health Systems', Email: 'spatel@pacifichealth.example',Status: 'Working',     LeadSource: 'Outbound', CreatedDate: '2026-05-02', OwnerId: '005AE002' },
  { Id: '00Q0003', Name: 'Jordan Kim',   Company: 'Crestline Capital',      Email: 'jkim@crestline.example',      Status: 'Qualified',   LeadSource: 'Partner',  CreatedDate: '2026-04-22', OwnerId: '005AE003' },
  { Id: '00Q0004', Name: 'Riley Choi',   Company: 'Lumen Software',         Email: 'rchoi@lumen.example',         Status: 'Unqualified', LeadSource: 'Event',    CreatedDate: '2026-04-10', OwnerId: '005AE004' },
  { Id: '00Q0005', Name: 'Casey Brown',  Company: 'Cobalt Retail Group',    Email: 'cbrown@cobalt.example',       Status: 'New',         LeadSource: 'Inbound',  CreatedDate: '2026-05-10' },
  { Id: '00Q0006', Name: 'Morgan Diaz',  Company: 'Veritas Manufacturing',  Email: 'mdiaz@veritas.example',       Status: 'Working',     LeadSource: 'Outbound', CreatedDate: '2026-04-30', OwnerId: '005AE002' },
  { Id: '00Q0007', Name: 'Avery Lin',    Company: 'Helios Biotech',         Email: 'alin@helios.example',         Status: 'Qualified',   LeadSource: 'Inbound',  CreatedDate: '2026-04-18', OwnerId: '005AE003' },
  { Id: '00Q0008', Name: 'Drew Khan',    Company: 'Quantum Ledger Inc',     Email: 'dkhan@quantumledger.example', Status: 'New',         LeadSource: 'Partner',  CreatedDate: '2026-05-08', OwnerId: '005AE004' },
  { Id: '00Q0009', Name: 'Robin Park',   Company: 'Beacon Software',        Email: 'rpark@beacon.example',        Status: 'Working',     LeadSource: 'Inbound',  CreatedDate: '2026-04-26', OwnerId: '005AE001' },
  { Id: '00Q0010', Name: 'Skyler Owens', Company: 'Summit Outdoor Retail',  Email: 'sowens@summitoutdoor.example',Status: 'Unqualified', LeadSource: 'Event',    CreatedDate: '2026-04-05', OwnerId: '005AE002' },
  { Id: '00Q0011', Name: 'Quinn Rao',    Company: 'Aurora Diagnostics',     Email: 'qrao@aurora.example',         Status: 'New',         LeadSource: 'Inbound',  CreatedDate: '2026-05-11', OwnerId: '005AE003' },
  { Id: '00Q0012', Name: 'Reese Vega',   Company: 'Granite Industrials',    Email: 'rvega@granite.example',       Status: 'Qualified',   LeadSource: 'Outbound', CreatedDate: '2026-04-14', OwnerId: '005AE004' },
  { Id: '00Q0013', Name: 'Taylor Cruz',  Company: 'Mosaic Insurance',       Email: 'tcruz@mosaic.example',        Status: 'Working',     LeadSource: 'Partner',  CreatedDate: '2026-04-28', OwnerId: '005AE001' },
  { Id: '00Q0014', Name: 'Cameron Holt', Company: 'Polaris Data',           Email: 'cholt@polaris.example',       Status: 'New',         LeadSource: 'Inbound',  CreatedDate: '2026-05-13', OwnerId: '005AE002' },
  { Id: '00Q0015', Name: 'Hayden Singh', Company: 'Ironwood Logistics',     Email: 'hsingh@ironwood.example',     Status: 'Qualified',   LeadSource: 'Event',    CreatedDate: '2026-04-16', OwnerId: '005AE003' },
  { Id: '00Q0016', Name: 'Emery Watts',  Company: 'Northwind Robotics',     Email: 'ewatts@northwind.example',    Status: 'Unqualified', LeadSource: 'Outbound', CreatedDate: '2026-04-02', OwnerId: '005AE001' },
  { Id: '00Q0017', Name: 'Logan Fox',    Company: 'Pacific Health Systems', Email: 'lfox@pacifichealth.example',  Status: 'New',         LeadSource: 'Inbound',  CreatedDate: '2026-05-14', OwnerId: '005AE002' },
  { Id: '00Q0018', Name: 'Sage Walker',  Company: 'Beacon Software',        Email: 'swalker@beacon.example',      Status: 'Working',     LeadSource: 'Outbound', CreatedDate: '2026-04-24', OwnerId: '005AE001' },
  { Id: '00Q0019', Name: 'Phoenix Cole', Company: 'Quantum Ledger Inc',     Email: 'pcole@quantumledger.example', Status: 'Qualified',   LeadSource: 'Inbound',  CreatedDate: '2026-04-20', OwnerId: '005AE004' },
  { Id: '00Q0020', Name: 'Riley Adams',  Company: 'Crestline Capital',      Email: 'radams@crestline.example',    Status: 'New',         LeadSource: 'Partner',  CreatedDate: '2026-05-06', OwnerId: '005AE003' },
];

void AE_IDS;

// ─── Contacts ────────────────────────────────────────────────────────
export const CONTACTS: Contact[] = [
  { Id: '003C0001', AccountId: '001A0001', Name: 'Marta Chen',     Title: 'VP Operations',     Email: 'mchen@northwind.example',     Phone: '+1-415-555-0101', OwnerId: '005AE001' },
  { Id: '003C0002', AccountId: '001A0001', Name: 'Owen Briggs',    Title: 'Director of IT',    Email: 'obriggs@northwind.example',   Phone: '+1-415-555-0102', OwnerId: '005AE001' },
  { Id: '003C0003', AccountId: '001A0002', Name: 'Dr. Linh Tran',  Title: 'CIO',               Email: 'ltran@pacifichealth.example', Phone: '+1-415-555-0103', OwnerId: '005AE002' },
  { Id: '003C0004', AccountId: '001A0002', Name: 'Beatrice Howe',  Title: 'Director of EHR',   Email: 'bhowe@pacifichealth.example', Phone: '+1-415-555-0104', OwnerId: '005AE002' },
  { Id: '003C0005', AccountId: '001A0003', Name: 'Theo Marsh',     Title: 'Head of Risk',      Email: 'tmarsh@crestline.example',    Phone: '+1-212-555-0201', OwnerId: '005AE003' },
  { Id: '003C0006', AccountId: '001A0004', Name: 'Anika Roe',      Title: 'CTO',               Email: 'aroe@lumen.example',          Phone: '+1-415-555-0301', OwnerId: '005AE004' },
  { Id: '003C0007', AccountId: '001A0005', Name: 'Damien Park',    Title: 'VP Retail Tech',    Email: 'dpark@cobalt.example',        Phone: '+1-415-555-0401', OwnerId: '005AE001' },
  { Id: '003C0008', AccountId: '001A0005', Name: 'Yara Holloway',  Title: 'Director of Stores',Email: 'yholloway@cobalt.example',    Phone: '+1-415-555-0402', OwnerId: '005AE001' },
  { Id: '003C0009', AccountId: '001A0006', Name: 'Felix Lund',     Title: 'IT Director',       Email: 'flund@veritas.example',       Phone: '+1-503-555-0501', OwnerId: '005AE002' },
  { Id: '003C0010', AccountId: '001A0007', Name: 'Dr. Isobel Vance',Title: 'Head of Lab Ops',  Email: 'ivance@helios.example',       Phone: '+1-617-555-0601', OwnerId: '005AE003' },
  { Id: '003C0011', AccountId: '001A0008', Name: 'Reggie Stone',   Title: 'Treasury Lead',     Email: 'rstone@quantumledger.example',Phone: '+1-212-555-0701', OwnerId: '005AE004' },
  { Id: '003C0012', AccountId: '001A0009', Name: 'Lila Okafor',    Title: 'Procurement',       Email: 'lokafor@beacon.example',      Phone: '+1-415-555-0801', OwnerId: '005AE001' },
  { Id: '003C0013', AccountId: '001A0010', Name: 'Marcus Eilers',  Title: 'CMO',               Email: 'meilers@summitoutdoor.example',Phone: '+1-303-555-0901', OwnerId: '005AE002' },
  { Id: '003C0014', AccountId: '001A0011', Name: 'Sana Bukhari',   Title: 'Imaging Director',  Email: 'sbukhari@aurora.example',     Phone: '+1-415-555-1001', OwnerId: '005AE003' },
  { Id: '003C0015', AccountId: '001A0012', Name: 'Pete Halvorsen', Title: 'Field Service VP',  Email: 'phalvorsen@granite.example',  Phone: '+1-414-555-1101', OwnerId: '005AE004' },
  { Id: '003C0016', AccountId: '001A0013', Name: 'Elena Vargas',   Title: 'Chief Underwriter', Email: 'evargas@mosaic.example',      Phone: '+1-312-555-1201', OwnerId: '005AE001' },
  { Id: '003C0017', AccountId: '001A0013', Name: 'Henry Joon',     Title: 'Claims Director',   Email: 'hjoon@mosaic.example',        Phone: '+1-312-555-1202', OwnerId: '005AE001' },
  { Id: '003C0018', AccountId: '001A0014', Name: 'Kade Whitman',   Title: 'Head of Analytics', Email: 'kwhitman@polaris.example',    Phone: '+1-415-555-1301', OwnerId: '005AE002' },
  { Id: '003C0019', AccountId: '001A0015', Name: 'Nora Petrescu',  Title: 'Fleet Director',    Email: 'npetrescu@ironwood.example',  Phone: '+1-216-555-1401', OwnerId: '005AE003' },
  { Id: '003C0020', AccountId: '001A0002', Name: 'Owen Pereira',   Title: 'Telehealth Lead',   Email: 'opereira@pacifichealth.example',Phone: '+1-415-555-0105', OwnerId: '005AE002' },
];

// ─── Activities ──────────────────────────────────────────────────────
// Recent activity on healthy opps; silence on the stale Negotiation pool.
// Cross-references opps in OPPORTUNITIES.
export const ACTIVITIES: Activity[] = [
  // Healthy advancing opps — fresh activity in the last 7 days.
  { Id: '00T0001', WhatId: '006H0001', WhoId: '003C0018', Type: 'Email',   Subject: 'Pricing approval request sent', ActivityDate: '2026-05-12', OwnerId: '005AE002' },
  { Id: '00T0002', WhatId: '006H0001', WhoId: '003C0018', Type: 'Call',    Subject: 'Deal review with Kade', ActivityDate: '2026-05-10', DurationMin: 30, OwnerId: '005AE002' },
  { Id: '00T0003', WhatId: '006H0002', WhoId: '003C0019', Type: 'Meeting', Subject: 'Procurement intro', ActivityDate: '2026-05-09', DurationMin: 45, OwnerId: '005AE003' },
  { Id: '00T0004', WhatId: '006H0003', WhoId: '003C0006', Type: 'Meeting', Subject: 'Tech deep-dive', ActivityDate: '2026-05-13', DurationMin: 60, OwnerId: '005AE004' },
  { Id: '00T0005', WhatId: '006H0004', WhoId: '003C0001', Type: 'Call',    Subject: 'IT review with CTO', ActivityDate: '2026-05-11', DurationMin: 30, OwnerId: '005AE001' },
  { Id: '00T0006', WhatId: '006H0004', WhoId: '003C0002', Type: 'Email',   Subject: 'Follow-up notes', ActivityDate: '2026-05-12', OwnerId: '005AE001' },
  { Id: '00T0007', WhatId: '006H0005', WhoId: '003C0011', Type: 'Call',    Subject: 'Discovery call', ActivityDate: '2026-05-08', DurationMin: 25, OwnerId: '005AE004' },
  { Id: '00T0008', WhatId: '006H0006', WhoId: '003C0010', Type: 'Email',   Subject: 'Demo request', ActivityDate: '2026-05-14', OwnerId: '005AE003' },
  // Closed Won — handoff activity.
  { Id: '00T0009', WhatId: '006W0001', WhoId: '003C0012', Type: 'Meeting', Subject: 'Kickoff scheduled', ActivityDate: '2026-04-28', DurationMin: 30, OwnerId: '005AE001' },
  { Id: '00T0010', WhatId: '006W0002', WhoId: '003C0003', Type: 'Meeting', Subject: 'Implementation kickoff', ActivityDate: '2026-04-20', DurationMin: 60, OwnerId: '005AE002' },
  { Id: '00T0011', WhatId: '006W0002', WhoId: '003C0020', Type: 'Email',   Subject: 'Phase 1 plan', ActivityDate: '2026-04-22', OwnerId: '005AE002' },
  { Id: '00T0012', WhatId: '006W0003', WhoId: '003C0005', Type: 'Call',    Subject: 'CS handoff', ActivityDate: '2026-04-30', DurationMin: 20, OwnerId: '005AE003' },
  // Stale Negotiation pool — only the older "stage change" log entries (silence since).
  { Id: '00T0020', WhatId: '006N0013', WhoId: '003C0016', Type: 'StageChange', Subject: 'Moved to Negotiation', ActivityDate: '2026-02-04', OwnerId: '005AE001' },
  { Id: '00T0021', WhatId: '006N0013', WhoId: '003C0016', Type: 'Email',       Subject: 'Pricing question', ActivityDate: '2026-02-04', OwnerId: '005AE001' },
  { Id: '00T0022', WhatId: '006N0002', WhoId: '003C0003', Type: 'Meeting',     Subject: 'EHR scoping', ActivityDate: '2026-02-02', DurationMin: 45, OwnerId: '005AE002' },
  { Id: '00T0023', WhatId: '006N0001', WhoId: '003C0001', Type: 'Email',       Subject: 'Renewal terms draft', ActivityDate: '2026-02-14', OwnerId: '005AE001' },
  // Account 360 — Pacific Health: multiple touches across both open opps + cases.
  { Id: '00T0030', WhatId: '001A0002', WhoId: '003C0003', Type: 'Call',    Subject: 'Quarterly account review', ActivityDate: '2026-05-05', DurationMin: 45, OwnerId: '005AE002' },
  { Id: '00T0031', WhatId: '001A0002', WhoId: '003C0004', Type: 'Email',   Subject: 'EHR roadmap update', ActivityDate: '2026-05-07', OwnerId: '005AE002' },
  { Id: '00T0032', WhatId: '001A0002', WhoId: '003C0020', Type: 'Meeting', Subject: 'Telehealth pilot review', ActivityDate: '2026-04-29', DurationMin: 60, OwnerId: '005AE002' },
  { Id: '00T0033', WhatId: '001A0002', WhoId: '003C0003', Type: 'Note',    Subject: 'CFO escalation logged', ActivityDate: '2026-02-19', OwnerId: '005AE002' },
  // Case-related (support touches).
  { Id: '00T0040', WhatId: '500C0001', Type: 'Email', Subject: 'Acknowledged SLA breach', ActivityDate: '2026-05-14', OwnerId: '005AE002' },
  { Id: '00T0041', WhatId: '500C0002', Type: 'Call',  Subject: 'P1 triage', ActivityDate: '2026-05-15', DurationMin: 15, OwnerId: '005MG001' },
  // A few more for breadth.
  { Id: '00T0050', WhatId: '006N0005', WhoId: '003C0007', Type: 'Email',   Subject: 'Quote review', ActivityDate: '2026-02-11', OwnerId: '005AE001' },
  { Id: '00T0051', WhatId: '006N0010', WhoId: '003C0013', Type: 'Meeting', Subject: 'Loyalty roadmap', ActivityDate: '2026-02-22', DurationMin: 45, OwnerId: '005AE002' },
  { Id: '00T0052', WhatId: '006P0001', Type: 'Call', Subject: 'Initial outreach', ActivityDate: '2026-05-13', DurationMin: 15, OwnerId: '005AE004' },
  { Id: '00T0053', WhatId: '006P0002', WhoId: '003C0016', Type: 'Meeting', Subject: 'Intro meeting', ActivityDate: '2026-05-15', DurationMin: 30, OwnerId: '005AE001' },
];

// ─── Cases ──────────────────────────────────────────────────────────
// 12 cases. Include 2 P1 SLA breaches (created early, target already past).
export const CASES: Case[] = [
  { Id: '500C0001', CaseNumber: 'C-1001', AccountId: '001A0002', Subject: 'EHR sync failing on overnight job',          Priority: 'P1', Status: 'Escalated', CreatedDate: '2026-05-10', SlaTargetDate: '2026-05-14', OwnerId: '005AE002' },
  { Id: '500C0002', CaseNumber: 'C-1002', AccountId: '001A0013', Subject: 'Claims API 502s under load',                 Priority: 'P1', Status: 'Working',   CreatedDate: '2026-05-12', SlaTargetDate: '2026-05-15', OwnerId: '005MG001' },
  { Id: '500C0003', CaseNumber: 'C-1003', AccountId: '001A0001', Subject: 'Field tablet sync drift',                    Priority: 'P2', Status: 'Working',   CreatedDate: '2026-05-09', SlaTargetDate: '2026-05-18', OwnerId: '005AE001' },
  { Id: '500C0004', CaseNumber: 'C-1004', AccountId: '001A0005', Subject: 'POS pricing discrepancy on bundle SKU',      Priority: 'P2', Status: 'Working',   CreatedDate: '2026-05-08', SlaTargetDate: '2026-05-17', OwnerId: '005AE001' },
  { Id: '500C0005', CaseNumber: 'C-1005', AccountId: '001A0008', Subject: 'Audit export missing columns',               Priority: 'P3', Status: 'New',       CreatedDate: '2026-05-13', SlaTargetDate: '2026-05-25', OwnerId: '005AE004' },
  { Id: '500C0006', CaseNumber: 'C-1006', AccountId: '001A0011', Subject: 'Workflow engine latency spike',              Priority: 'P2', Status: 'Working',   CreatedDate: '2026-05-11', SlaTargetDate: '2026-05-19', OwnerId: '005AE003' },
  { Id: '500C0007', CaseNumber: 'C-1007', AccountId: '001A0004', Subject: 'SAML SSO redirect loop',                     Priority: 'P3', Status: 'New',       CreatedDate: '2026-05-14', SlaTargetDate: '2026-05-22', OwnerId: '005AE004' },
  { Id: '500C0008', CaseNumber: 'C-1008', AccountId: '001A0012', Subject: 'IoT sensor heartbeat drops',                 Priority: 'P2', Status: 'New',       CreatedDate: '2026-05-13', SlaTargetDate: '2026-05-20', OwnerId: '005AE004' },
  { Id: '500C0009', CaseNumber: 'C-1009', AccountId: '001A0007', Subject: 'Compliance suite report PDF blank',          Priority: 'P3', Status: 'Working',   CreatedDate: '2026-05-09', SlaTargetDate: '2026-05-23', OwnerId: '005AE003' },
  { Id: '500C0010', CaseNumber: 'C-1010', AccountId: '001A0010', Subject: 'Kiosk pairing failures in-store',            Priority: 'P2', Status: 'Working',   CreatedDate: '2026-05-12', SlaTargetDate: '2026-05-19', OwnerId: '005AE002' },
  { Id: '500C0011', CaseNumber: 'C-1011', AccountId: '001A0014', Subject: 'Dashboard chart export error',               Priority: 'P3', Status: 'Closed',    CreatedDate: '2026-04-28', SlaTargetDate: '2026-05-08', OwnerId: '005AE002' },
  { Id: '500C0012', CaseNumber: 'C-1012', AccountId: '001A0015', Subject: 'Route planner timeout on multi-stop',        Priority: 'P3', Status: 'New',       CreatedDate: '2026-05-14', SlaTargetDate: '2026-05-22', OwnerId: '005AE003' },
];

// ─── Approval Requests (discount on Opportunities) ──────────────────
export const APPROVAL_REQUESTS: ApprovalRequest[] = [
  { Id: '801A0001', SubmittedFor: '006N0013', SubmittedById: '005AE001', Reason: '15% discount to secure Mosaic underwriting deal', DiscountPct: 15, Amount: 295_000, Status: 'Pending', CreatedDate: '2026-05-12' },
  { Id: '801A0002', SubmittedFor: '006N0002', SubmittedById: '005AE002', Reason: '12% discount – Pacific Health EHR expansion',     DiscountPct: 12, Amount: 320_000, Status: 'Pending', CreatedDate: '2026-05-13' },
  { Id: '801A0003', SubmittedFor: '006N0012', SubmittedById: '005AE004', Reason: '10% discount – Granite field service',            DiscountPct: 10, Amount: 365_000, Status: 'Pending', CreatedDate: '2026-05-14' },
  { Id: '801A0004', SubmittedFor: '006H0002', SubmittedById: '005AE003', Reason: '8% discount – Ironwood route optimizer',          DiscountPct:  8, Amount: 118_000, Status: 'Pending', CreatedDate: '2026-05-15' },
];

export const SFDC_BUNDLE: SfdcBundle = {
  users: USERS,
  accounts: ACCOUNTS,
  opportunities: OPPORTUNITIES,
  leads: LEADS,
  contacts: CONTACTS,
  activities: ACTIVITIES,
  cases: CASES,
  approvalRequests: APPROVAL_REQUESTS,
};
