// Embedded SQLite store for the mock CRM. The dataset is generated
// deterministically (lib/salesforce/generate.ts) and loaded into a real
// SQLite database so the SOQL layer runs against genuine SQL query semantics.
//
// Persistence (PRD §6.15): the DB lives in a file under .data/. Because the
// generator is seeded, the same dataset is produced every time; the DB is
// (re)seeded whenever the file is missing or the schema/seed version changes.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { generateBundle, SEED } from '@/lib/salesforce/generate';
import type { SfdcBundle } from '@/lib/salesforce/types';

const SCHEMA_VERSION = 1;

type ColType = 'TEXT' | 'REAL' | 'INTEGER';
type TableSpec = { table: string; bundleKey: keyof SfdcBundle; columns: [string, ColType][] };

export const TABLES: TableSpec[] = [
  { table: 'User', bundleKey: 'users', columns: [
    ['Id', 'TEXT'], ['Name', 'TEXT'], ['Email', 'TEXT'], ['Role', 'TEXT'], ['Quota', 'REAL'], ['Specialty', 'TEXT'],
  ] },
  { table: 'Account', bundleKey: 'accounts', columns: [
    ['Id', 'TEXT'], ['Name', 'TEXT'], ['Industry', 'TEXT'], ['AnnualRevenue', 'REAL'], ['Employees', 'INTEGER'], ['OwnerId', 'TEXT'],
  ] },
  { table: 'Opportunity', bundleKey: 'opportunities', columns: [
    ['Id', 'TEXT'], ['Name', 'TEXT'], ['AccountId', 'TEXT'], ['OwnerId', 'TEXT'], ['StageName', 'TEXT'],
    ['Amount', 'REAL'], ['Probability', 'REAL'], ['CloseDate', 'TEXT'], ['CreatedDate', 'TEXT'],
    ['LastActivityDate', 'TEXT'], ['NextStep', 'TEXT'], ['LeadSource', 'TEXT'],
    ['Service_Type__c', 'TEXT'], ['Urgency__c', 'TEXT'], ['Property_Type__c', 'TEXT'],
  ] },
  { table: 'Lead', bundleKey: 'leads', columns: [
    ['Id', 'TEXT'], ['Name', 'TEXT'], ['Company', 'TEXT'], ['Email', 'TEXT'], ['Status', 'TEXT'],
    ['LeadSource', 'TEXT'], ['CreatedDate', 'TEXT'], ['LastActivityDate', 'TEXT'], ['OwnerId', 'TEXT'],
    ['Phone', 'TEXT'], ['Service_Type__c', 'TEXT'],
  ] },
  { table: 'Contact', bundleKey: 'contacts', columns: [
    ['Id', 'TEXT'], ['AccountId', 'TEXT'], ['Name', 'TEXT'], ['Title', 'TEXT'], ['Email', 'TEXT'],
    ['Phone', 'TEXT'], ['OwnerId', 'TEXT'], ['LastActivityDate', 'TEXT'],
  ] },
  { table: 'Activity', bundleKey: 'activities', columns: [
    ['Id', 'TEXT'], ['WhatId', 'TEXT'], ['WhoId', 'TEXT'], ['Type', 'TEXT'], ['Subject', 'TEXT'],
    ['ActivityDate', 'TEXT'], ['DurationMin', 'INTEGER'], ['OwnerId', 'TEXT'],
  ] },
  { table: 'Case', bundleKey: 'cases', columns: [
    ['Id', 'TEXT'], ['CaseNumber', 'TEXT'], ['AccountId', 'TEXT'], ['Subject', 'TEXT'], ['Priority', 'TEXT'],
    ['Status', 'TEXT'], ['CreatedDate', 'TEXT'], ['SlaTargetDate', 'TEXT'], ['OwnerId', 'TEXT'],
  ] },
];

export const TABLE_NAMES = TABLES.map(t => t.table);

let db: Database.Database | null = null;

function dbPath(): string {
  if (process.env.VITEST) return ':memory:';
  if (process.env.BEACON_DB_PATH) return process.env.BEACON_DB_PATH;
  return path.join(process.cwd(), '.data', 'beacon-crm.db');
}

function seed(database: Database.Database, bundle: SfdcBundle) {
  database.pragma('journal_mode = WAL');
  database.exec('BEGIN');
  try {
    for (const spec of TABLES) {
      database.exec(`DROP TABLE IF EXISTS "${spec.table}"`);
      const cols = spec.columns.map(([n, t], i) => `"${n}" ${t}${i === 0 ? ' PRIMARY KEY' : ''}`).join(', ');
      database.exec(`CREATE TABLE "${spec.table}" (${cols})`);
      const colNames = spec.columns.map(([n]) => n);
      const placeholders = colNames.map(() => '?').join(', ');
      const insert = database.prepare(
        `INSERT INTO "${spec.table}" (${colNames.map(n => `"${n}"`).join(', ')}) VALUES (${placeholders})`,
      );
      const rows = bundle[spec.bundleKey] as Record<string, unknown>[];
      for (const row of rows) {
        insert.run(colNames.map(n => {
          const v = row[n];
          return v === undefined ? null : (typeof v === 'boolean' ? (v ? 1 : 0) : v);
        }));
      }
    }
    database.exec(`CREATE TABLE IF NOT EXISTS _meta (k TEXT PRIMARY KEY, v TEXT)`);
    database.prepare(`INSERT OR REPLACE INTO _meta (k, v) VALUES ('version', ?)`).run(String(SCHEMA_VERSION));
    database.prepare(`INSERT OR REPLACE INTO _meta (k, v) VALUES ('seed', ?)`).run(String(SEED));
    database.exec('COMMIT');
  } catch (e) {
    database.exec('ROLLBACK');
    throw e;
  }
}

function needsSeed(database: Database.Database): boolean {
  try {
    const meta = database.prepare(`SELECT v FROM _meta WHERE k = 'version'`).get() as { v: string } | undefined;
    if (!meta || meta.v !== String(SCHEMA_VERSION)) return true;
    const seedMeta = database.prepare(`SELECT v FROM _meta WHERE k = 'seed'`).get() as { v: string } | undefined;
    return !seedMeta || seedMeta.v !== String(SEED);
  } catch {
    return true;
  }
}

export function getDb(): Database.Database {
  if (db) return db;
  const p = dbPath();
  if (p !== ':memory:') {
    fs.mkdirSync(path.dirname(p), { recursive: true });
  }
  db = new Database(p);
  if (needsSeed(db)) seed(db, generateBundle());
  return db;
}

/** Force a regenerate from the same seed (PRD §6.15). */
export function regenerate(): void {
  const database = getDb();
  seed(database, generateBundle());
}
