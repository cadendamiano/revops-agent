# PRD → TDD Delta Analysis: Revenue Operations Agentic Harness

**Status:** Draft for review
**Purpose:** Reconcile the "Revenue Operations Agentic Harness" PRD against the *existing* codebase, so the eventual Technical Design Document (TDD) only designs what is genuinely new.

---

## Context

The PRD asks for a TDD for an agent-first RevOps prototype over a mock CRM. It is written as if greenfield, prescribing a **React + Vite frontend, a Fastify/Express orchestrator, a DuckDB-backed Salesforce-shaped REST API, and a Beacon Plumbing Co. dataset.**

This repo is **not** greenfield. It is a mature **Next.js (App Router) + Electron** harness ("Salesforce Coworker") that already implements most of the PRD's *mechanics*: an SSE chat route, a multi-provider agent loop, a signed-token approval engine with dual-control, an in-memory Salesforce dataset with a working SOQL engine + schema-describe + forecast logic, a tool registry, and a catalog of CRM artifact renderers.

This document records what we **ignore** in the PRD (already covered by the harness, or a stack prescription we deliberately depart from) and what **new elements** the TDD must incorporate.

### Locked decisions
1. **Extend the existing Next.js/Electron harness** (do not rebuild on Vite/Fastify).
2. **Introduce a real embedded DB (SQLite)** for the mock CRM and re-point the query layer at it.
3. **Full reskin to Beacon Plumbing Co.** (data, custom fields, roster, seasonality, scenarios).
4. Deliverable now = this delta + plan; the TDD is authored against it next.

---

## Part A — What to IGNORE in the PRD

### A1. Stack prescriptions we deliberately depart from
| PRD says | Existing reality | Decision |
|---|---|---|
| §5.2 React + **Vite** frontend | Next.js App Router + React 18, `app/page.tsx`, `components/*` | **Ignore Vite.** Keep Next.js. |
| §5.3 Standalone **Fastify/Express** orchestrator | `app/api/chat/route.ts` (SSE) → `lib/agent/runAgentOnce.ts` agent loop | **Ignore Fastify.** Reuse the route + loop. |
| §5.4 Salesforce **REST endpoints** as the CRM surface | Agent talks to CRM via **tools** (`sf_data_query`, `sf_data_get_record`, `sf_data_*`), already Salesforce-shaped | **Ignore literal REST.** The tool layer IS the API surface. (Optional thin REST facade only if a demo needs it.) |
| §5.3 "stateless, rehydrated from frontend" | Already true: server holds no session state; client Zustand store is source of truth | Already satisfied — no work. |

### A2. PRD requirements ALREADY satisfied by the harness (reuse, no net-new build)
| PRD § | Capability | Existing implementation to reuse |
|---|---|---|
| 5.6 | LLM integration exists; reuse it | `lib/agent/runAgentOnce.ts` (Anthropic / Gemini / LLM-Gateway), `lib/models.ts` |
| 5.7 | Tool routing + gate enforcement | `tracedTool()` in `runAgentOnce.ts`; gate via `lib/policy/approvalPolicy.ts` |
| 5.8 | Artifact payload → inline render | SSE `{type:'artifact'}` → `lib/runtime.ts` → `components/ArtifactPreview.tsx` dispatch |
| 7.3 | Approval gates (writes/external/owner/activity) | `classifyStake` + `approvalPolicyFor` + signed `ApprovalToken` (`lib/approvals/token.ts`); staged batches (`lib/salesforce/stagedBatchStore.ts`); two-phase approve in `lib/runtime.ts` |
| 7.10 | Read/Analyze/Propose/Execute/Render tool categories | `lib/tools/sfdc/{data,sobject,analytics,case,activity,approval,render}.ts` |
| 7.15 | Writes always gated; deletes dual-control | `sf_data_*` propose tools always stage; delete forced to `mass-action` |
| 8.5.2 | Approval Batch artifact | `bulk-update-preview` artifact + `ApprovalCard` |
| 8.5.3 | Data Table artifact | `soql-results` artifact |
| 8.5.5 | Status Dashboard artifact | `dashboard-tiles` artifact |
| 6.17 | CRM ops (query/related/create/update/log) | `sf_data_*`, `sf_activity_*`, `runSoql` SOQL engine |

**Implication for the TDD:** these sections become "reuse" notes, not design work. The TDD documents the *existing* contracts (SSE event shapes, tool schemas, approval token claims, artifact dispatch) rather than redesigning them.

---

## Part B — What is GENUINELY NEW (must be designed/built in the TDD)

### B1. Mock CRM data store → SQLite (locked decision #2)
- **Today:** `lib/salesforce/seed.ts` exports fixed in-memory arrays; `soql.ts` and `tools/sfdc/data.ts` both read a `SOURCE` map of those arrays.
- **New:** introduce `better-sqlite3` (synchronous, zero-config, runs in the Next.js node runtime and Electron) as a local file DB. *(DuckDB is the PRD's stated preference; we recommend SQLite via better-sqlite3 for simpler Next.js/Electron integration and a smaller surface — the TDD documents this choice per §10. DuckDB vs SQLite is decided explicitly in the TDD.)*
- **Re-point the query layer (contained change):** keep the SOQL parser in `soql.ts`, but translate the parsed WHERE AST + ORDER BY + LIMIT into a parameterized SQL string executed against the DB, instead of `Array.filter`. `tools/sfdc/data.ts` `SOURCE` reads and the staged write-apply path also re-point to the DB.
- **Persistence/seed:** generate once into the DB file on first boot; reload same file on startup; regenerate from the same seed on demand (§6.15). DB file is server-side (§5.5).

### B2. Seeded data generator at PRD scale + Beacon Plumbing reskin (locked decision #3)
- **Today:** ~15 accounts / 42 opps, hand-written, SaaS-flavored (AE quotas, software/healthcare).
- **New:** a **deterministic seeded generator** (no current RNG) producing PRD volumes: 200–300 accounts, 500–700 contacts, 1,200–1,800 leads, 700–900 opps, 4,000–6,000 activities.
- **Domain reskin:** plumbing stages (`New Lead → Contacted → Qualified → Quoted → Scheduled → Job Complete → Invoiced → Closed Won` / `Closed Lost`), custom fields (`Service_Type__c`, `Urgency__c`, `Property_Type__c`), roster (3 inside-sales reps, 8 field plumbers, 1 ops manager), service mix (§6.8), lead sources (§6.9), seasonality (§6.13).
- **Planted realism + scenarios:** stale deals, missing fields, duplicate accounts, unlogged activities, abandoned leads, ghost contacts, bad ownership (§6.7); plus the 8 named demo scenarios (§6.16) discoverable via normal queries.
- **Touches:** `lib/salesforce/seed.ts` (rewrite as generator), `types.ts` (plumbing stages/custom fields), `schema.ts` (describe metadata), `lib/data.ts` (`DEMO_PROMPTS`), forecast/risk helpers in `queries.ts`. **Stage probabilities** (`STAGE_PROBABILITY`) and the SOQL `THIS_QUARTER`/`TODAY` literals must align to the new stage names and `TODAY`.

### B3. Plan / Auto operating modes (§7.2) — NEW, orthogonal to demo/testing
- **Today:** `Mode = 'demo' | 'testing'` (scripted vs. live LLM) — NOT the PRD's Plan/Auto.
- **New:** add a **per-session execution mode** `PlanMode | AutoMode` with a visible toggle, switchable mid-session. Plan = stop for per-item approval on every gated action (current default behavior). Auto = user pre-authorizes a batch category for the session; agent executes pre-approved items without per-item stops, **but hard gates (§7.3) still apply** — Auto pre-approves a batch, it does not waive the gate.
- **Mapping onto existing engine:** Auto mode = a session-scoped pre-issued approval scope that the two-phase approve flow consults; `mass-action` (dual-control) always still prompts.
- **Touches:** `lib/store.ts` (new session-scoped `execMode`), a toggle component near the composer/settings, `lib/runtime.ts` approve flow, gate check in the orchestrator.

### B4. Structured Session model: goal / plan / trace / end-state (§7.1, 7.9, 7.12, 7.13)
- **Today:** threads hold a flat `turns[]` list; the 4-iteration agent loop has no surfaced plan.
- **New:**
  - **Visible plan** rendered at top of session before execution (§9.1 "produces a visible plan"); plan = ordered steps with status.
  - **Multi-step orchestration with checkpoints**: pause / edit-plan / skip-step / reject-with-reason / terminate (§7.13); failed/empty step reports + proposes alternative (§7.9, 7.14).
  - **Structured trace** for replay/scroll/rehydration (§10.4) — today turns persist but there is no first-class trace schema (plan, tool calls w/ inputs+outputs, findings, decisions).
- **Touches:** new `lib/session/` types (Plan, PlanStep, TraceEvent), store actions, a Plan component, orchestrator emits plan + step-checkpoint SSE events.

### B5. Memory scoped to flagged records (§7.11) — NEW
- **Today:** none. Approval state persists per-thread, but no cross-session flag memory.
- **New:** client-side (localStorage) memory of flagged records (risk/opportunity/stale/dup), their flag state, and user actions (approved/rejected/dismissed/"ignore for now"). Agent must not re-surface a dismissed item unless record state changed (§7.15). Needs schema, index by record Id, and a query the agent consults during analysis.
- **Touches:** new `lib/memory/` types + store slice (Zustand persist), a read tool the agent calls before flagging, write on user decisions.

### B6. New / upgraded artifact types
| §8 type | Status | Work |
|---|---|---|
| 8.5.1 Forecast | **Upgrade** | `components/artifacts/ForecastTile.tsx` is **display-only**. Add adjustable stage-probability inputs, live recompute, and "ping the agent" on change (debounced, §8.4). Agent can propose probability adjustments from historical conversion. |
| 8.5.6 Action Draft | **New** | Editable email/call-script/activity-note draft; edit-in-place; edits ping agent; approve→send (gated). No equivalent today. |
| 8.5.4 Comparison View | **New** | Side-by-side options (e.g., "follow up now vs. wait", "close-lost vs. reassign"); select one → ping agent. No equivalent today. |
| 8.5.2 / 8.5.3 / 8.5.5 | Reuse | Approval Batch / Data Table / Status Dashboard already exist. |
| 8.4 interaction pings | **Extend** | Approve/reject/form pings exist; add slider-change and draft-edit ping paths into `lib/runtime.ts`. |

### B7. Five task types (§7.4–7.8) wired end-to-end on plumbing data
| Task | Reuse | New |
|---|---|---|
| 7.4 Pipeline review | dashboard-tiles, `queries.computeRisks` / `findAtRiskOpps` | plumbing risk rules, drill-in |
| 7.5 Lead re-engagement | lead queries | **email Draft tool + Action Draft + Approval Batch** |
| 7.6 Forecast modeling | forecast artifact + `getPipelineForecast` | **interactive sliders (B6)** |
| 7.7 Data hygiene | `findOppsMissingField`, dup detection | per-fix approval items on plumbing mess |
| 7.8 Stuck-deal intervention | `findStaleOpps` | recommended-action + Comparison View |

### B8. Draft tool category (§7.10 "Draft") — NEW
- No tool today generates emails/call-scripts/notes. Add `draft_*` tools (read-only, no gate) feeding the Action Draft artifact; the eventual "send" is a separate gated execute tool.

### B9. Guardrail gap (§7.15)
- "Must not modify closed-won/closed-lost opps": today `sf_data_stage_change` marks those irreversible/dual-control but does not **block** edits. TDD must add an explicit block, and a check against memory-dismissed records.

---

## Part C — Net delta summary (the TDD's spine)

- **Reuse as-is (document, don't redesign):** Next.js shell, SSE chat route, agent loop, LLM providers, tool-routing, approval engine + tokens + staged batches, artifact dispatch, Data Table / Approval Batch / Dashboard artifacts.
- **Re-point:** SOQL/query layer + write-apply onto SQLite.
- **Build new:** SQLite store + seeded plumbing generator at scale; Plan/Auto mode; structured session (plan/trace/checkpoints/intervention); flagged-record memory; Action Draft + Comparison View artifacts + interactive Forecast; Draft tools; closed-deal/dismissed-record guardrails.
- **Ignore from PRD:** Vite, Fastify/Express, literal Salesforce REST endpoints.

---

## Critical files

**Reuse / document:** `app/api/chat/route.ts`, `lib/agent/runAgentOnce.ts`, `lib/models.ts`, `lib/policy/approvalPolicy.ts`, `lib/approvals/token.ts`, `lib/salesforce/stagedBatchStore.ts`, `lib/runtime.ts`, `components/ArtifactPreview.tsx`, `components/Turn.tsx`, `components/Composer.tsx`.

**Re-point:** `lib/salesforce/soql.ts` (AST→SQL), `lib/tools/sfdc/data.ts` (`SOURCE` reads + write-apply), `lib/data.ts`.

**Rewrite/extend:** `lib/salesforce/seed.ts` (→ seeded generator), `lib/salesforce/types.ts`, `lib/salesforce/schema.ts`, `lib/salesforce/queries.ts`, `lib/store.ts` (execMode, memory slice), `lib/tools/sfdc/render.ts` (new artifact tools), `components/artifacts/ForecastTile.tsx`.

**New:** `lib/db/*` (SQLite init/seed/query), `lib/session/*` (plan/trace), `lib/memory/*`, `lib/tools/sfdc/draft.ts`, `components/artifacts/{ActionDraft,ComparisonView}.tsx`, Plan/Auto toggle + Plan/Trace components.

**Brand reskin (CLAUDE.md):** `app/layout.tsx:6`, `app/login/page.tsx:50`, `package.json` productName/appId.

---

## Verification (how the eventual build is validated against §9)

- **Data:** boot regenerates DB from seed; row counts hit §6.4 ranges; `sf_data_query` SOQL surfaces each of the 8 §6.16 scenarios without them being labeled.
- **Modes & gates:** Plan mode stops on every gated write; Auto mode runs a pre-approved batch but still prompts for a `mass-action`; no write reaches the DB without a redeemed token (§9.1).
- **Tasks & artifacts:** run all five §7.4–7.8 tasks end-to-end; all six §8.5 artifacts render on real data; forecast sliders recompute live and ping the agent (debounced).
- **Session/memory:** plan shows before execution; pause/edit/reject/terminate work; reload rehydrates trace + memory; a dismissed record is not re-flagged next session unless it changed.
- **Demo:** happy path runs <10 min, touches ≥3 task types, surfaces ≥3 scenarios, includes one Auto-mode batch and one Plan-mode approval, ends re-runnable from a fresh session (§9.3).
- **Run:** `npm run dev` (Next.js) and the Electron entry; exercise in-browser per the UI testing guidance.
