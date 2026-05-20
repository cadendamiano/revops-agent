// Deterministic, seeded generator for Beacon Plumbing Co.
// Produces PRD-scale data (Section 6) from a fixed seed so the dataset is
// identical on every boot. Bulk records are generated randomly; the named
// demo scenarios (Section 6.16) are injected explicitly so they always exist.
import type {
  Account, Activity, ApprovalRequest, Case, Contact, Lead, Opportunity,
  OpportunityStage, LeadSource, ServiceType, SfdcBundle, Urgency, User,
} from './types';
import { STAGE_PROBABILITY, daysBetween } from './types';

export const TODAY = '2026-05-16';
export const SEED = 0xBEAC04;

// ─── Seeded RNG (mulberry32) ────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const randInt = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T,>(r: Rng, arr: readonly T[]): T => arr[Math.floor(r() * arr.length)];
function weighted<T>(r: Rng, table: readonly [T, number][]): T {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of table) { if ((x -= w) <= 0) return v; }
  return table[table.length - 1][0];
}

// ISO date `days` before TODAY.
function daysAgo(days: number): string {
  const base = Date.UTC(2026, 4, 16); // 2026-05-16
  return new Date(base - days * 86400000).toISOString().slice(0, 10);
}
function pad(n: number, w: number) { return n.toString().padStart(w, '0'); }

// ─── Name pools (Seattle metro) ─────────────────────────────────────
const FIRST = ['James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda','David','Elizabeth','William','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Karen','Carlos','Nancy','Maria','Daniel','Lisa','Paul','Sandra','Mark','Ashley','Donald','Kimberly','Steven','Emily','Andrew','Hana','Priya','Devon','Wei','Sofia','Omar','Grace','Liam'];
const LAST = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Nguyen','Patel','Kim','Cho','Okafor','Brandt','Petrescu','Halvorsen'];
const COMMERCIAL = ['Cascade Property Group','Emerald City Management','Rainier Holdings','Pike Place Realty','Sound Commercial RE','Northgate Plaza LLC','Ballard Mills','Greenlake Apartments','Fremont Works','Capitol Hill Properties','Westlake Tower','SoDo Industrial Park','Bellevue Office Park','Redmond Tech Campus','Kirkland Waterfront','Renton Logistics','Tukwila Retail Center','Magnolia Estates','Queen Anne Lofts','Georgetown Brewing Co'];
const STREETS = ['Pine St','Pike St','Madison Ave','Denny Way','Aurora Ave N','Rainier Ave S','California Ave SW','Greenwood Ave N','15th Ave NW','Roosevelt Way','Boren Ave','Mercer St','Stone Way N','Leary Way','Fauntleroy Ave'];
const CITIES = ['Seattle','Bellevue','Redmond','Kirkland','Renton','Tukwila','Ballard','Shoreline','Burien','SeaTac'];

function fullName(r: Rng) { return `${pick(r, FIRST)} ${pick(r, LAST)}`; }
function emailFor(name: string, domain: string) {
  return name.toLowerCase().replace(/[^a-z]+/g, '.') + '@' + domain;
}
function phone(r: Rng) { return `+1-206-555-${pad(randInt(r, 100, 9999), 4)}`; }

// ─── Service mix (Section 6.8) ──────────────────────────────────────
const SERVICE_MIX: [ServiceType, number][] = [
  ['Residential Repair', 40], ['Residential Install', 20],
  ['Commercial Service', 15], ['Commercial Install', 15], ['Emergency', 10],
];
function ticketSize(r: Rng, s: ServiceType): number {
  const ranges: Record<ServiceType, [number, number]> = {
    'Residential Repair': [200, 2000],
    'Residential Install': [2000, 15000],
    'Commercial Service': [500, 10000],
    'Commercial Install': [15000, 150000],
    Emergency: [400, 3500],
  };
  const [lo, hi] = ranges[s];
  return Math.round((lo + r() * (hi - lo)) / 25) * 25;
}
const URGENCY_BY_SERVICE: Record<ServiceType, Urgency> = {
  'Residential Repair': 'Routine', 'Residential Install': 'Routine',
  'Commercial Service': 'Routine', 'Commercial Install': 'Routine', Emergency: 'Emergency',
};

const LEAD_SOURCE_MIX: [LeadSource, number][] = [
  ['Google Ads', 30], ['Website', 20], ['Referral', 20],
  ['Repeat Customer', 15], ['Yelp', 10], ['Unknown', 5],
];

// Seasonality multiplier by month (0-11). Winter emergencies, spring installs.
function seasonalWeight(month: number, s: ServiceType): number {
  const winter = month === 11 || month <= 1;
  const spring = month >= 2 && month <= 4;
  if (s === 'Emergency') return winter ? 2.2 : 1;
  if (s === 'Residential Install' || s === 'Commercial Install') return spring ? 1.8 : 1;
  return 1;
}

// ─── Generator ──────────────────────────────────────────────────────
export function generateBundle(seed = SEED): SfdcBundle {
  const r = mulberry32(seed);

  // Users / roster ----------------------------------------------------
  const users: User[] = [];
  const insideSales: string[] = [];
  const plumbers: string[] = [];
  for (let i = 0; i < 3; i++) {
    const id = '005IS' + pad(i + 1, 3);
    insideSales.push(id);
    users.push({ Id: id, Name: fullName(r), Email: emailFor('rep' + (i + 1), 'beaconplumbing.example'), Role: 'InsideSales', Quota: [180000, 150000, 120000][i] });
  }
  const specialties: User['Specialty'][] = ['Commercial', 'Commercial', 'Emergency', 'Emergency', 'Residential', 'Residential', 'Install', 'Residential'];
  for (let i = 0; i < 8; i++) {
    const id = '005PL' + pad(i + 1, 3);
    plumbers.push(id);
    users.push({ Id: id, Name: fullName(r), Email: emailFor('plumber' + (i + 1), 'beaconplumbing.example'), Role: 'Plumber', Specialty: specialties[i] });
  }
  const opsManager = '005OM001';
  users.push({ Id: opsManager, Name: 'Dale Rourke', Email: 'dale.rourke@beaconplumbing.example', Role: 'OpsManager' });

  const ownerForLead = (i: number) => insideSales[i % insideSales.length]; // round-robin

  // Accounts ----------------------------------------------------------
  const accounts: Account[] = [];
  const nAccounts = 220;
  for (let i = 0; i < nAccounts; i++) {
    const isCommercial = r() < 0.35;
    const type = isCommercial ? (r() < 0.5 ? 'Commercial' : 'Property Management') : 'Residential';
    const name = isCommercial ? pick(r, COMMERCIAL) + ' ' + pad(i, 3) : `${fullName(r)} Residence`;
    accounts.push({
      Id: '001' + pad(i + 1, 7),
      Name: name,
      Industry: type,
      AnnualRevenue: isCommercial ? randInt(r, 20000, 400000) : randInt(r, 300, 6000),
      Employees: isCommercial ? randInt(r, 5, 400) : 1,
      OwnerId: pick(r, insideSales),
    });
  }

  // Contacts ----------------------------------------------------------
  const contacts: Contact[] = [];
  let cSeq = 0;
  for (const a of accounts) {
    const n = a.Industry === 'Residential' ? (r() < 0.25 ? 2 : 1) : randInt(r, 3, 6);
    for (let j = 0; j < n; j++) {
      const name = fullName(r);
      contacts.push({
        Id: '003' + pad(++cSeq, 7),
        AccountId: a.Id,
        Name: name,
        Title: a.Industry === 'Residential' ? 'Homeowner' : pick(r, ['Facilities Manager', 'Property Manager', 'Operations Lead', 'Owner', 'Maintenance Supervisor']),
        Email: emailFor(name, 'example.com'),
        Phone: r() < 0.85 ? phone(r) : undefined, // ~15% missing phone (hygiene)
        OwnerId: a.OwnerId,
        LastActivityDate: daysAgo(randInt(r, 1, 200)),
      });
    }
    if (contacts.length >= 700) break;
  }

  // Leads -------------------------------------------------------------
  const leads: Lead[] = [];
  const nLeads = 1350;
  for (let i = 0; i < nLeads; i++) {
    // Slight downward trend in recent months: bias creation toward older days.
    const age = Math.floor(Math.pow(r(), 0.8) * 360);
    const source = weighted(r, LEAD_SOURCE_MIX);
    const status = weighted(r, [
      ['Converted', 28], ['Unqualified', 22], ['Qualified', 14],
      ['Contacted', 16], ['New', 20],
    ] as [Lead['Status'], number][]);
    const svc = weighted(r, SERVICE_MIX);
    const abandoned = status === 'New' && r() < 0.18; // created, never contacted
    leads.push({
      Id: '00Q' + pad(i + 1, 7),
      Name: fullName(r),
      Company: r() < 0.3 ? pick(r, COMMERCIAL) : '',
      Email: emailFor('lead' + i, 'example.com'),
      Status: status,
      LeadSource: source === 'Unknown' ? 'Unknown' : source,
      CreatedDate: daysAgo(age),
      LastActivityDate: abandoned ? undefined : daysAgo(Math.max(0, age - randInt(r, 0, 10))),
      OwnerId: r() < 0.06 ? undefined : ownerForLead(i), // ~6% unassigned (hygiene)
      Phone: r() < 0.9 ? phone(r) : undefined,
      Service_Type__c: svc,
    });
  }

  // Opportunities -----------------------------------------------------
  const commercialAccts = accounts.filter(a => a.Industry !== 'Residential');
  const resAccts = accounts.filter(a => a.Industry === 'Residential');
  const opportunities: Opportunity[] = [];
  const nOpps = 760;
  const openStages: OpportunityStage[] = ['Qualified', 'Quoted', 'Scheduled', 'Job Complete', 'Invoiced'];

  for (let i = 0; i < nOpps; i++) {
    const historical = r() < 0.7; // 70% historical / 30% active
    const svc = weighted(r, SERVICE_MIX);
    const commercial = svc.startsWith('Commercial');
    const acct = commercial
      ? (commercialAccts.length ? pick(r, commercialAccts) : pick(r, accounts))
      : (resAccts.length ? pick(r, resAccts) : pick(r, accounts));
    const created = daysAgo(randInt(r, historical ? 60 : 5, 360));
    const createdMonth = +created.slice(5, 7) - 1;
    // Seasonality gate: skip-and-retry weighting via probability of keeping.
    if (r() > seasonalWeight(createdMonth, svc) / 2.2 && r() < 0.25) { /* thin out off-season */ }

    let stage: OpportunityStage;
    if (historical) {
      stage = r() < 0.62 ? 'Closed Won' : 'Closed Lost';
    } else {
      stage = pick(r, openStages);
    }
    const amount = ticketSize(r, svc);
    const lastAct = stage === 'Closed Won' || stage === 'Closed Lost'
      ? daysAgo(randInt(r, 60, 320))
      : daysAgo(randInt(r, 0, 40));
    const missingNextStep = r() < 0.12;
    opportunities.push({
      Id: '006' + pad(i + 1, 7),
      Name: `${acct.Name.split(' ')[0]} - ${svc}`,
      AccountId: acct.Id,
      OwnerId: pick(r, insideSales),
      StageName: stage,
      Amount: amount,
      Probability: STAGE_PROBABILITY[stage],
      CloseDate: stage === 'Closed Won' || stage === 'Closed Lost'
        ? lastAct
        : daysAgo(-randInt(r, 5, 90)),
      CreatedDate: created,
      LastActivityDate: lastAct,
      NextStep: missingNextStep ? undefined : pick(r, ['Send quote', 'Schedule crew', 'Confirm parts', 'Follow up on quote', 'Await customer go-ahead']),
      LeadSource: weighted(r, LEAD_SOURCE_MIX),
      Service_Type__c: svc,
      Urgency__c: URGENCY_BY_SERVICE[svc],
      Property_Type__c: commercial ? 'Commercial' : 'Residential',
    });
  }

  // Activities --------------------------------------------------------
  const activities: Activity[] = [];
  let tSeq = 0;
  const actTypes: Activity['Type'][] = ['Call', 'Email', 'SMS', 'Meeting', 'Note', 'Quote'];
  for (const o of opportunities) {
    const won = o.StageName === 'Closed Won';
    const lost = o.StageName === 'Closed Lost';
    const count = won ? randInt(r, 5, 12) : lost ? randInt(r, 2, 6) : randInt(r, 1, 8);
    // ~10% of progressed opps get NO activity logged (unlogged-activity mess).
    const unlogged = r() < 0.1 && !won;
    if (unlogged) continue;
    for (let k = 0; k < count; k++) {
      const ageSpan = daysBetween(TODAY, o.CreatedDate);
      const at = daysAgo(randInt(r, 0, Math.max(1, ageSpan)));
      activities.push({
        Id: '00T' + pad(++tSeq, 7),
        WhatId: o.Id,
        WhoId: undefined,
        Type: pick(r, actTypes),
        Subject: pick(r, ['Left voicemail', 'Sent quote', 'Customer call', 'On-site assessment', 'Follow-up email', 'Text reminder', 'Scheduling call']),
        ActivityDate: at,
        DurationMin: r() < 0.5 ? randInt(r, 10, 90) : undefined,
        OwnerId: o.OwnerId,
      });
    }
  }

  // Cases (service tickets) -------------------------------------------
  const cases: Case[] = [];
  for (let i = 0; i < 30; i++) {
    const created = daysAgo(randInt(r, 0, 20));
    const priority = weighted(r, [['P1', 2], ['P2', 5], ['P3', 8]] as [Case['Priority'], number][]);
    const slaDays = priority === 'P1' ? 2 : priority === 'P2' ? 5 : 10;
    const acct = pick(r, accounts);
    cases.push({
      Id: '500' + pad(i + 1, 7),
      CaseNumber: 'C-' + pad(1000 + i, 4),
      AccountId: acct.Id,
      Subject: pick(r, ['No hot water', 'Burst pipe callback', 'Drain backing up', 'Leak under sink', 'Water heater error code', 'Sewer smell', 'Low water pressure']),
      Priority: priority,
      Status: weighted(r, [['New', 4], ['Working', 4], ['Escalated', 1], ['Closed', 3]] as [Case['Status'], number][]),
      CreatedDate: created,
      SlaTargetDate: daysAgo(randInt(r, 0, slaDays) - slaDays + 1),
      OwnerId: pick(r, [...plumbers, opsManager]),
    });
  }

  // Approval requests (discount sign-off) -----------------------------
  const approvalRequests: ApprovalRequest[] = [];
  const bigOpps = opportunities.filter(o => o.Amount > 30000).slice(0, 4);
  bigOpps.forEach((o, i) => approvalRequests.push({
    Id: '801' + pad(i + 1, 7),
    SubmittedFor: o.Id,
    SubmittedById: o.OwnerId,
    Reason: `${randInt(r, 8, 18)}% discount to win ${o.Name}`,
    DiscountPct: randInt(r, 8, 18),
    Amount: o.Amount,
    Status: 'Pending',
    CreatedDate: daysAgo(randInt(r, 1, 6)),
  }));

  const bundle: SfdcBundle = { users, accounts, opportunities, leads, contacts, activities, cases, approvalRequests };
  injectScenarios(bundle, r, { insideSales, plumbers, commercialAccts, resAccts });
  return bundle;
}

// ─── Planted demo scenarios (Section 6.16) ──────────────────────────
function injectScenarios(
  b: SfdcBundle,
  r: Rng,
  ctx: { insideSales: string[]; plumbers: string[]; commercialAccts: Account[]; resAccts: Account[] },
) {
  const is0 = ctx.insideSales[0];
  const commAcct = ctx.commercialAccts[0] ?? b.accounts[0];

  // 1. Hot lead gone cold: strong source, contacted, no follow-up in 14+ days.
  b.leads.unshift({
    Id: '00Q9000001', Name: 'Gabriela Ferreira', Company: '', Email: 'g.ferreira@example.com',
    Status: 'Contacted', LeadSource: 'Referral', CreatedDate: daysAgo(22),
    LastActivityDate: daysAgo(18), OwnerId: is0, Phone: '+1-206-555-7788',
    Service_Type__c: 'Residential Install',
  });

  // 2. Deal stuck in Quoted 60+ days, high value.
  b.opportunities.unshift({
    Id: '006900001', Name: `${commAcct.Name.split(' ')[0]} - Commercial Install`, AccountId: commAcct.Id,
    OwnerId: is0, StageName: 'Quoted', Amount: 88000, Probability: STAGE_PROBABILITY.Quoted,
    CloseDate: daysAgo(-30), CreatedDate: daysAgo(95), LastActivityDate: daysAgo(64),
    NextStep: 'Awaiting PO from facilities', LeadSource: 'Referral',
    Service_Type__c: 'Commercial Install', Urgency__c: 'Routine', Property_Type__c: 'Commercial',
  });

  // 3. High-value commercial account, closed-won history, no contact 90+ days.
  const dormant = ctx.commercialAccts[1] ?? commAcct;
  b.opportunities.unshift({
    Id: '006900002', Name: `${dormant.Name.split(' ')[0]} - Commercial Service`, AccountId: dormant.Id,
    OwnerId: is0, StageName: 'Closed Won', Amount: 42000, Probability: 100,
    CloseDate: daysAgo(140), CreatedDate: daysAgo(200), LastActivityDate: daysAgo(140),
    NextStep: undefined, LeadSource: 'Repeat Customer',
    Service_Type__c: 'Commercial Service', Urgency__c: 'Routine', Property_Type__c: 'Commercial',
  });
  b.contacts.filter(c => c.AccountId === dormant.Id).forEach(c => { c.LastActivityDate = daysAgo(randInt(r, 95, 160)); });

  // 4. Cluster of cancelled (Closed Lost) jobs from one referral source (Yelp).
  for (let i = 0; i < 6; i++) {
    const acct = pick(r, ctx.resAccts);
    b.opportunities.push({
      Id: '006900100' + i, Name: `${acct.Name.split(' ')[0]} - Residential Repair`, AccountId: acct.Id,
      OwnerId: ctx.insideSales[i % ctx.insideSales.length], StageName: 'Closed Lost',
      Amount: ticketSizeFixed(i), Probability: 0, CloseDate: daysAgo(20 + i * 3),
      CreatedDate: daysAgo(40 + i * 3), LastActivityDate: daysAgo(20 + i * 3),
      NextStep: 'Customer cancelled', LeadSource: 'Yelp',
      Service_Type__c: 'Residential Repair', Urgency__c: 'Routine', Property_Type__c: 'Residential',
    });
  }

  // 5. Repeat residential customer due for follow-up (water heater install ~8yr ago).
  const repeatAcct = ctx.resAccts[0] ?? b.accounts[0];
  b.opportunities.push({
    Id: '006900200', Name: `${repeatAcct.Name.split(' ')[0]} - Water Heater Install`, AccountId: repeatAcct.Id,
    OwnerId: is0, StageName: 'Closed Won', Amount: 3200, Probability: 100,
    CloseDate: '2018-03-12', CreatedDate: '2018-02-20', LastActivityDate: '2018-03-12',
    NextStep: undefined, LeadSource: 'Repeat Customer',
    Service_Type__c: 'Residential Install', Urgency__c: 'Routine', Property_Type__c: 'Residential',
  });

  // 6. Lead assigned to a rep with no logged activity (accountability gap).
  b.leads.unshift({
    Id: '00Q9000002', Name: 'Trevor Nash', Company: '', Email: 't.nash@example.com',
    Status: 'New', LeadSource: 'Google Ads', CreatedDate: daysAgo(12),
    LastActivityDate: undefined, OwnerId: ctx.insideSales[1], Phone: '+1-206-555-3322',
    Service_Type__c: 'Emergency',
  });

  // 7. Duplicate account: same business entered twice with slight variation.
  const dupBase = ctx.commercialAccts[2] ?? commAcct;
  b.accounts.push({
    Id: '001900001', Name: dupBase.Name.replace(/\s+\d+$/, '') + ' LLC', Industry: dupBase.Industry,
    AnnualRevenue: dupBase.AnnualRevenue + 1500, Employees: dupBase.Employees, OwnerId: dupBase.OwnerId,
  });
  b.opportunities.push({
    Id: '006900300', Name: `${dupBase.Name.split(' ')[0]} - Commercial Service`, AccountId: '001900001',
    OwnerId: dupBase.OwnerId, StageName: 'Scheduled', Amount: 6200, Probability: STAGE_PROBABILITY.Scheduled,
    CloseDate: daysAgo(-14), CreatedDate: daysAgo(30), LastActivityDate: daysAgo(4),
    NextStep: 'Crew assigned', LeadSource: 'Repeat Customer',
    Service_Type__c: 'Commercial Service', Urgency__c: 'Routine', Property_Type__c: 'Commercial',
  });

  // 8. Forecast concentration: 3 big open commercial deals dominating pipeline.
  for (let i = 0; i < 3; i++) {
    const acct = ctx.commercialAccts[3 + i] ?? commAcct;
    b.opportunities.unshift({
      Id: '006900400' + i, Name: `${acct.Name.split(' ')[0]} - Commercial Install`, AccountId: acct.Id,
      OwnerId: ctx.insideSales[i % ctx.insideSales.length], StageName: i === 0 ? 'Quoted' : 'Scheduled',
      Amount: [120000, 95000, 110000][i], Probability: STAGE_PROBABILITY[i === 0 ? 'Quoted' : 'Scheduled'],
      CloseDate: daysAgo(-randInt(r, 20, 50)), CreatedDate: daysAgo(randInt(r, 30, 80)),
      LastActivityDate: daysAgo(randInt(r, 2, 18)), NextStep: 'Finalize scope',
      LeadSource: 'Referral', Service_Type__c: 'Commercial Install', Urgency__c: 'Routine', Property_Type__c: 'Commercial',
    });
  }

  // Deterministic anchors for the stuck-quote scenario: a short activity trail
  // that then goes silent (matches LastActivityDate 64d ago).
  let aSeq = 0;
  const anchorActivity = (whatId: string, type: Activity['Type'], subject: string, age: number) =>
    b.activities.push({ Id: '00T900' + pad(++aSeq, 4), WhatId: whatId, Type: type, Subject: subject, ActivityDate: daysAgo(age), OwnerId: is0 });
  anchorActivity('006900001', 'Quote', 'Sent commercial install quote', 70);
  anchorActivity('006900001', 'Call', 'Reviewed scope with facilities', 66);
  anchorActivity('006900001', 'Email', 'Followed up on PO timing', 64);

  // Guaranteed P1 SLA breach (CASE) so SLA-breach detection always has a hit.
  b.cases.push({
    Id: '500900001', CaseNumber: 'C-9001', AccountId: commAcct.Id,
    Subject: 'Commercial water main leak — no response', Priority: 'P1', Status: 'Escalated',
    CreatedDate: daysAgo(4), SlaTargetDate: daysAgo(2), OwnerId: ctx.plumbers[0],
  });
}

function ticketSizeFixed(i: number): number { return 350 + i * 75; }
