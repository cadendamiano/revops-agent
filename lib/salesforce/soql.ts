// Minimal SOQL parser/evaluator over the SFDC_BUNDLE.
//
// Supports: SELECT <fields|*> FROM <sobject> [WHERE …] [ORDER BY <field> [ASC|DESC]] [LIMIT n]
// WHERE supports: AND, OR, =, !=, <, <=, >, >=, LIKE, IN (…), NOT IN (…).
// Date literals: TODAY, YESTERDAY, LAST_N_DAYS:N, NEXT_N_DAYS:N, THIS_QUARTER, NEXT_QUARTER, LAST_QUARTER.
//
// On unsupported syntax, callers receive { error: 'UNSUPPORTED_SOQL', hint }.

import {
  OPPORTUNITIES, ACCOUNTS, LEADS, CONTACTS, USERS, CASES, ACTIVITIES,
} from './seed';
import { TODAY } from './types';

type Row = Record<string, unknown>;

const SOURCE: Record<string, Row[]> = {
  Opportunity: OPPORTUNITIES as unknown as Row[],
  Account:     ACCOUNTS as unknown as Row[],
  Lead:        LEADS as unknown as Row[],
  Contact:     CONTACTS as unknown as Row[],
  User:        USERS as unknown as Row[],
  Case:        CASES as unknown as Row[],
  Activity:    ACTIVITIES as unknown as Row[],
};

export type SoqlSuccess = {
  totalSize: number;
  done: boolean;
  records: Row[];
  fields: string[];
};

export type SoqlError = {
  error: 'UNSUPPORTED_SOQL';
  hint: string;
};

export type SoqlResult = SoqlSuccess | SoqlError;

const QUERY_RE = /^\s*SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?)?(?:\s+LIMIT\s+(\d+))?\s*$/is;

export function runSoql(soql: string, hardLimit = 1000): SoqlResult {
  const trimmed = soql.trim().replace(/;+$/, '');
  const m = QUERY_RE.exec(trimmed);
  if (!m) {
    return {
      error: 'UNSUPPORTED_SOQL',
      hint: 'Expected: SELECT <fields> FROM <sobject> [WHERE …] [ORDER BY …] [LIMIT n]',
    };
  }
  const [, rawFields, sobject, where, orderField, orderDir, limitStr] = m;
  const source = SOURCE[sobject];
  if (!source) {
    return {
      error: 'UNSUPPORTED_SOQL',
      hint: `Unknown sObject "${sobject}". Supported: ${Object.keys(SOURCE).join(', ')}.`,
    };
  }

  const fields = parseFields(rawFields, source[0]);
  let rows: Row[] = source.slice();

  if (where) {
    try {
      const pred = compileWhere(where);
      rows = rows.filter(pred);
    } catch (e: any) {
      return { error: 'UNSUPPORTED_SOQL', hint: e.message ?? 'WHERE clause not understood' };
    }
  }

  if (orderField) {
    const dir = (orderDir ?? 'ASC').toUpperCase() === 'DESC' ? -1 : 1;
    rows.sort((a, b) => cmp(a[orderField], b[orderField]) * dir);
  }

  const limit = limitStr ? Math.min(parseInt(limitStr, 10), hardLimit) : hardLimit;
  const total = rows.length;
  rows = rows.slice(0, limit);

  const projected = rows.map(r => {
    const o: Row = {};
    for (const f of fields) o[f] = r[f];
    return o;
  });

  return {
    totalSize: total,
    done: total <= limit,
    records: projected,
    fields,
  };
}

function parseFields(raw: string, sample: Row | undefined): string[] {
  const trimmed = raw.trim();
  if (trimmed === '*' || /^FIELDS\(ALL\)$/i.test(trimmed)) {
    return sample ? Object.keys(sample) : [];
  }
  return trimmed.split(',').map(s => s.trim()).filter(Boolean);
}

// ─── WHERE compiler ─────────────────────────────────────────────────

type Pred = (r: Row) => boolean;

function compileWhere(src: string): Pred {
  const tokens = tokenize(src);
  const { node, pos } = parseOr(tokens, 0);
  if (pos !== tokens.length) {
    throw new Error(`unexpected tokens after WHERE near "${tokens[pos]?.value ?? ''}"`);
  }
  return evalNode.bind(null, node);
}

type Token = { type: 'word' | 'op' | 'paren' | 'string' | 'number' | 'comma'; value: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '(' || c === ')') { out.push({ type: 'paren', value: c }); i++; continue; }
    if (c === ',') { out.push({ type: 'comma', value: c }); i++; continue; }
    if (c === '\'' || c === '"') {
      const quote = c;
      let j = i + 1;
      let v = '';
      while (j < src.length && src[j] !== quote) {
        if (src[j] === '\\' && j + 1 < src.length) { v += src[j + 1]; j += 2; continue; }
        v += src[j++];
      }
      if (j >= src.length) throw new Error('unterminated string literal');
      out.push({ type: 'string', value: v });
      i = j + 1; continue;
    }
    if (c === '=' || c === '<' || c === '>' || c === '!') {
      const next = src[i + 1];
      if ((c === '<' || c === '>' || c === '!') && next === '=') {
        out.push({ type: 'op', value: c + '=' }); i += 2; continue;
      }
      out.push({ type: 'op', value: c }); i++; continue;
    }
    if (/[0-9-]/.test(c) && (i === 0 || /[\s(,]/.test(src[i - 1]))) {
      let j = i;
      if (src[j] === '-') j++;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const v = src.slice(i, j);
      if (/^-?\d/.test(v)) { out.push({ type: 'number', value: v }); i = j; continue; }
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_:]/.test(src[j])) j++;
      out.push({ type: 'word', value: src.slice(i, j) }); i = j; continue;
    }
    throw new Error(`unrecognized character "${c}" in WHERE`);
  }
  return out;
}

type Node =
  | { kind: 'and'; a: Node; b: Node }
  | { kind: 'or'; a: Node; b: Node }
  | { kind: 'cmp'; field: string; op: string; value: unknown }
  | { kind: 'in'; field: string; values: unknown[]; negate: boolean }
  | { kind: 'like'; field: string; pattern: RegExp; negate: boolean };

function parseOr(t: Token[], pos: number): { node: Node; pos: number } {
  let { node, pos: p } = parseAnd(t, pos);
  while (p < t.length && t[p].type === 'word' && t[p].value.toUpperCase() === 'OR') {
    const right = parseAnd(t, p + 1);
    node = { kind: 'or', a: node, b: right.node };
    p = right.pos;
  }
  return { node, pos: p };
}

function parseAnd(t: Token[], pos: number): { node: Node; pos: number } {
  let { node, pos: p } = parseAtom(t, pos);
  while (p < t.length && t[p].type === 'word' && t[p].value.toUpperCase() === 'AND') {
    const right = parseAtom(t, p + 1);
    node = { kind: 'and', a: node, b: right.node };
    p = right.pos;
  }
  return { node, pos: p };
}

function parseAtom(t: Token[], pos: number): { node: Node; pos: number } {
  if (pos >= t.length) throw new Error('unexpected end of WHERE');
  if (t[pos].type === 'paren' && t[pos].value === '(') {
    const inner = parseOr(t, pos + 1);
    if (t[inner.pos]?.value !== ')') throw new Error('expected )');
    return { node: inner.node, pos: inner.pos + 1 };
  }
  if (t[pos].type !== 'word') throw new Error(`expected field name at "${t[pos].value}"`);
  const field = t[pos].value;
  let p = pos + 1;
  if (p >= t.length) throw new Error('unexpected end after field');
  const head = t[p];
  // NOT IN / NOT LIKE
  if (head.type === 'word' && head.value.toUpperCase() === 'NOT') {
    const inner = t[p + 1];
    if (!inner) throw new Error('expected IN or LIKE after NOT');
    if (inner.type === 'word' && inner.value.toUpperCase() === 'IN') {
      const r = parseInList(t, p + 2);
      return { node: { kind: 'in', field, values: r.values, negate: true }, pos: r.pos };
    }
    if (inner.type === 'word' && inner.value.toUpperCase() === 'LIKE') {
      const lit = t[p + 2];
      if (!lit || lit.type !== 'string') throw new Error('NOT LIKE needs a string literal');
      return { node: { kind: 'like', field, pattern: likeToRegex(lit.value), negate: true }, pos: p + 3 };
    }
    throw new Error(`unsupported NOT clause near "${inner.value}"`);
  }
  if (head.type === 'word' && head.value.toUpperCase() === 'IN') {
    const r = parseInList(t, p + 1);
    return { node: { kind: 'in', field, values: r.values, negate: false }, pos: r.pos };
  }
  if (head.type === 'word' && head.value.toUpperCase() === 'LIKE') {
    const lit = t[p + 1];
    if (!lit || lit.type !== 'string') throw new Error('LIKE needs a string literal');
    return { node: { kind: 'like', field, pattern: likeToRegex(lit.value), negate: false }, pos: p + 2 };
  }
  if (head.type !== 'op') throw new Error(`expected operator after "${field}" got "${head.value}"`);
  const op = head.value;
  const v = t[p + 1];
  if (!v) throw new Error(`expected value after "${op}"`);
  const value = literal(v);
  return { node: { kind: 'cmp', field, op, value }, pos: p + 2 };
}

function parseInList(t: Token[], pos: number): { values: unknown[]; pos: number } {
  if (t[pos]?.value !== '(') throw new Error('expected ( after IN');
  const values: unknown[] = [];
  let p = pos + 1;
  while (p < t.length && t[p].value !== ')') {
    if (t[p].type === 'comma') { p++; continue; }
    values.push(literal(t[p]));
    p++;
  }
  if (t[p]?.value !== ')') throw new Error('expected ) closing IN list');
  return { values, pos: p + 1 };
}

function literal(t: Token): unknown {
  if (t.type === 'string') return t.value;
  if (t.type === 'number') return Number(t.value);
  if (t.type === 'word') {
    const u = t.value.toUpperCase();
    if (u === 'TRUE') return true;
    if (u === 'FALSE') return false;
    if (u === 'NULL') return null;
    // Date literals → resolved to ISO date strings.
    const d = resolveDateLiteral(u);
    if (d) return d;
    // Bare identifier: treat as picklist string (Salesforce convention is quoted, but tolerate).
    return t.value;
  }
  throw new Error(`unsupported literal "${t.value}"`);
}

function likeToRegex(pat: string): RegExp {
  const escaped = pat.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const re = escaped.replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp('^' + re + '$', 'i');
}

function resolveDateLiteral(u: string): string | { start: string; end: string } | null {
  if (u === 'TODAY') return TODAY;
  if (u === 'YESTERDAY') return shiftDate(TODAY, -1);
  const lastN = /^LAST_N_DAYS:(\d+)$/.exec(u);
  if (lastN) return shiftDate(TODAY, -parseInt(lastN[1], 10));
  const nextN = /^NEXT_N_DAYS:(\d+)$/.exec(u);
  if (nextN) return shiftDate(TODAY, parseInt(nextN[1], 10));
  if (u === 'THIS_QUARTER') return { start: '2026-04-01', end: '2026-06-30' };
  if (u === 'NEXT_QUARTER') return { start: '2026-07-01', end: '2026-09-30' };
  if (u === 'LAST_QUARTER') return { start: '2026-01-01', end: '2026-03-31' };
  return null;
}

function shiftDate(iso: string, days: number): string {
  const d = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const out = new Date(d + days * 86400000);
  return out.toISOString().slice(0, 10);
}

function evalNode(n: Node, r: Row): boolean {
  if (n.kind === 'and') return evalNode(n.a, r) && evalNode(n.b, r);
  if (n.kind === 'or')  return evalNode(n.a, r) || evalNode(n.b, r);
  if (n.kind === 'in') {
    const ok = n.values.some(v => valueEq(r[n.field], v));
    return n.negate ? !ok : ok;
  }
  if (n.kind === 'like') {
    const s = r[n.field];
    const ok = typeof s === 'string' && n.pattern.test(s);
    return n.negate ? !ok : ok;
  }
  // cmp
  const lhs = r[n.field];
  // Date-range literal (THIS_QUARTER etc.) on '=': field in [start, end]
  if (n.value && typeof n.value === 'object' && 'start' in (n.value as any)) {
    const rng = n.value as { start: string; end: string };
    if (typeof lhs !== 'string') return false;
    if (n.op === '=') return lhs >= rng.start && lhs <= rng.end;
    if (n.op === '!=') return !(lhs >= rng.start && lhs <= rng.end);
  }
  switch (n.op) {
    case '=':  return valueEq(lhs, n.value);
    case '!=': return !valueEq(lhs, n.value);
    case '<':  return cmp(lhs, n.value) < 0;
    case '<=': return cmp(lhs, n.value) <= 0;
    case '>':  return cmp(lhs, n.value) > 0;
    case '>=': return cmp(lhs, n.value) >= 0;
  }
  return false;
}

function valueEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}
