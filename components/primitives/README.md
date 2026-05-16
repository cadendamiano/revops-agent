# UI Primitives

Atomic building blocks of the tokyo design system. Each primitive is prop-driven, uses CSS variables from `styles/globals.css`, and renders without external UI libraries (no shadcn / Radix / Tailwind).

This catalog mirrors what will live in the Figma library at the `Artifacts` file (node `142-2`).

## Design tokens (source: `styles/globals.css`)

| Group | Tokens |
| --- | --- |
| Surface | `--bg`, `--surface`, `--surface-2` |
| Ink (text) | `--ink`, `--ink-2`, `--ink-3`, `--ink-4` |
| Line | `--line`, `--line-2` |
| Accent (teal) | `--teal`, `--teal-ink`, `--teal-soft`, `--teal-line` |
| Semantic | `--warn`, `--warn-soft`, `--pos`, `--neg` |
| Radius | `--radius` (8px), `--radius-sm` (6px) |
| Shadow | `--shadow-sm`, `--shadow-md`, `--shadow-focus` |
| Type family | `--sans` (Geist), `--mono` (Geist Mono) |
| Type scale | `--fs-h1` 17, `--fs-h2` 18, `--fs-h3` 15, `--fs-body` 13.5, `--fs-body-sm` 12.5, `--fs-mono-md` 12, `--fs-mono-sm` 11.5, `--fs-mono-xs` 11, `--fs-mono-micro` 10.5, `--fs-mono-tiny` 10 (px) |
| Line height | `--lh-body` 1.5, `--lh-agent` 1.55, `--lh-table` 1.35 |
| Tracking | `--tr-caps` 0.06em, `--tr-caps-lg` 0.08em, `--tr-tight` -0.01em |

Color values use **oklch** for the accent / semantic palette. When mirrored to Figma variables (which only accept sRGB), the original oklch string belongs in the variable description so the round-trip stays unambiguous.

---

## Primitives

### Icon — `Icon.tsx`
Inline-SVG icon set. 14 glyphs sized 10–12px, `currentColor`-driven so they inherit text color from the parent.

- **Props:** none — exported as an object (`Icon.Plus`, `Icon.Send`, …) where each member is a render function.
- **Glyphs:** `Plus`, `Send`, `Arrow`, `Check`, `Close`, `Spinner` (animated), `Doc`, `Table`, `Chart`, `Rule`, `Flow`, `Code`, `Gear`, `Trash`.
- **Used by:** `Rail`, `WorkspaceRail`, `Turn`, `CanvasPane`, `SettingsPanel`, `DevConfigPanel`, `CredentialsColumn`, `app/settings/page.tsx`, and `APTable` (internal).
- **Why a primitive:** keeps icon weight / stroke / scale uniform without bringing in an icon library.

### StatusPill — `StatusPill.tsx`
Labeled status badge with a leading colored dot. CSS class drives background, border, dot, and label color.

- **Props:** `status: BillStatus | string`.
- **Variants:** `due-soon`, `overdue`, `open`, `scheduled`. Unknown statuses fall through to the raw string.
- **Used by:** `APTable` (composite primitive) — the only direct consumer.
- **Why a primitive:** isolates status-color semantics from any specific table or list.

### ToolRow — `ToolRow.tsx`
One-line API call summary: `verb · path · filter · status · result`. Auto-collapses long filter strings (>80 chars) into a chevron-toggled JSON detail block; pretty-prints valid JSON.

- **Props:** `row: ToolRowSpec` (verb, path, filter?, status?, result?).
- **Behaviors:** static row when filter is short; collapsible row with `tool-row-detail` pre-block when filter is long.
- **Used by:** `Turn` (chat turn renderer) — for showing the agent's tool calls inline.
- **Why a primitive:** unifies tool-call presentation across every flow without rendering layout caring about row state.

### Markdown — `Markdown.tsx`
Tiny markdown renderer for short agent text. No dependency.

- **Props:** `text: string`.
- **Supports:** paragraph splits on blank lines, `**bold**`, inline `` `code` ``. Anything else is passed through as plain text.
- **Used by:** `Turn`.
- **Why a primitive:** avoids pulling in a 30 KB markdown library for the small subset of formatting agent messages actually need.

### DonutChart — `DonutChart.tsx`
SVG donut chart with center total + sidebar legend (label, percentage, value). 6-color oklch teal palette baked in.

- **Props:** `data: Record[]`, `title: string`, `labelKey?` (default `cat`), `valueKey?` (default `amount`).
- **Visuals:** outer radius 70 / inner radius 46 / 180×180 SVG. Center text uses mono.
- **Used by:** `SpendChartArtifact`.
- **Why a primitive:** charts are reused across artifacts; a single tuned version keeps the visual language consistent.

### BarChart — `BarChart.tsx`
Vertical bar chart with horizontal grid lines and per-bar value labels. Theming via `accent`.

- **Props:** `data`, `title`, `valueKey?` (default `amount`), `labelKey?` (default `cat`), `height?` (220), `accent?` (`var(--teal)`).
- **Visuals:** 5 grid lines at 0/25/50/75/100%, bar width 42, gap 28, mono labels.
- **Used by:** `SpendChartArtifact`.
- **Why a primitive:** same reasoning as DonutChart.

### LineChart — `LineChart.tsx`
Time-series line chart for cash projections. Optional threshold band, min-balance marker, sweep `markers[]` for events.

- **Props:** `data: ProjectionPoint[]`, `threshold?: number`, `height?` (220), `accent?` (`var(--teal)`), `title?`, `markers?: LineChartMarker[]`.
- **Variants:**
  - Plain line (no threshold, auto min-balance marker shown)
  - With threshold band + floor label
  - With sweep markers (suppresses the auto min marker)
- **Visuals:** 4 dashed gridlines, 640×(h+top+bottom) viewbox, ~7 sampled X-axis labels.
- **Used by:** `ArtifactPreview`, `LiquidityBurndownArtifact`.
- **Why a primitive:** liquidity / projection visualization is a recurring artifact; one canonical chart prevents drift.

### APTable — `APTable.tsx` (composite primitive)
Accounts-payable table: KPI strip on top, selectable bills table below. Uses `Icon` and `StatusPill`.

- **Props:** `bills: Bill[]`, `vendors: Vendor[]`, `selected?: Set<string>`, `onToggle?`, `filter?: 'all' | 'overdue' | 'due-soon'`.
- **KPIs:** Open AP, Overdue, Due ≤7d, Selected (with totals + counts).
- **Filter variants:** `all` (default), `overdue`, `due-soon`.
- **Used by:** `APTableArtifact`.
- **Why a primitive:** AP listing is structural — multiple flows inspect the same data, so the table layout + selection + KPIs ship together.

### ApprovalCard — `ApprovalCard.tsx` (composite primitive)
Payment-batch approval card with typed-confirmation gate (`APPROVE XXXX`), stake-aware actions, and a state machine (pending → submitting → approved | rejected).

- **Props:** `payload: ApprovalPayload`, `state?: ApprovalState | null`, `simulated?: boolean`, `onApprove`, `onReject`.
- **Stakes:** `payment` (single approver), `large-payment` (requires Controller sign-off — UI replaces approve button with "Request approval from Controller" → "✓ Approval request sent").
- **States:** `pending`, `submitting` (pulse + disabled buttons), `approved` (✓ + batch id), `rejected` (× + batch id).
- **Used by:** `Turn`.
- **Why a primitive:** the approval flow is the highest-stakes surface in the app; consolidating its UX prevents accidental divergence.

### ArtifactSkeleton — `ArtifactSkeleton.tsx`
Pulsing placeholder shown in the right pane while a test-mode artifact's `dataJson` is missing or partial. Reuses the `shimmer` keyframe (`globals.css:552`) and the `.skel-block` class.

- **Props:** `kind?: ArtifactKind` — drives the layout shape.
- **Variants:** chart (line / bars), table, document, slides, rule, flow, generic. Unknown kinds fall back to generic.
- **Used by:** the dataJson-driven artifact renderers as their empty state (added per kind during the test-mode generic-artifacts refactor).
- **Why a primitive:** every refactored artifact needs the same loading/empty look; one component keeps the pulse cadence and shape consistent.

---

## Figma library mapping

When the Figma MCP write tools are reachable (see "Status" below), each primitive maps to a Figma component as follows:

| Primitive | Figma component set | Variants property |
| --- | --- | --- |
| Icon | `Icon` | `glyph = Plus \| Send \| Arrow \| Check \| Close \| Spinner \| Doc \| Table \| Chart \| Rule \| Flow \| Code \| Gear \| Trash` |
| StatusPill | `StatusPill` | `status = due-soon \| overdue \| open \| scheduled` |
| ToolRow | `ToolRow` | `state = default \| collapsed-detail \| error` |
| Markdown | `Markdown` | (single variant — sample text) |
| DonutChart | `DonutChart` | (single variant — Q1 spend dataset) |
| BarChart | `BarChart` | `accent = teal \| custom` |
| LineChart | `LineChart` | `state = plain \| threshold \| markers` |
| APTable | `APTable` | `filter = all \| overdue \| due-soon` |
| ApprovalCard | `ApprovalCard` | `state = pending \| submitting \| approved \| rejected \| large-payment` |

All fills / strokes / radii / text in the Figma components must bind to the variables in the `tokyo/tokens` collection — never hardcoded sRGB.

## Status

- **Documentation:** complete (this file).
- **Figma canvas push:** complete. Library lives in [Artifacts → Variables v2 → "UI Primitives"](https://www.figma.com/design/ub4ODfh3Zh0QV7Hcv4RdTE/Artifacts?node-id=142-2):
  - Variable collection `tokyo/tokens` with 17 color variables + 2 radius variables (all scoped, all with `var(...)` WEB code syntax; oklch source preserved in each variable description).
  - 10 text styles (`H1`, `H2`, `H3`, `Body`, `Body Small`, `Mono / Md/Sm/Xs/Micro/Tiny`).
  - 3 effect styles (`shadow / sm`, `shadow / md`, `shadow / focus`).
  - 9 primitive frames matching the catalog above, with per-frame purpose / props / code-path / used-by annotations and the variant matrix from the table.
- **Chat Primitives section** (sibling section to the right at the same node): 3 frames covering the conversation surface:
  - `Turn` — 8 of the 9 [Turn.tsx](../Turn.tsx) variants (`user`, `agent` streaming, `tools`, `libs`, `building`, `artifact-card`, `suggest`, `form-question`; the 9th, `approval`, is the existing `ApprovalCard` primitive).
  - `Composer` — 4 states (idle with demo chips, forced `/command` chip, slash menu open with `/approve` highlighted + custom shortcut badge, streaming/disabled).
  - `WorkspaceRail · Task Thread` — 4 task-row states demonstrating the recent **thread → task** refactor (commit 2ccf1e3): default "New task", auto-renamed from first prompt (≤50 chars), inline-rename input, manually renamed.
- **App Composition section** (third sibling section, full-app kitchen sink) — 1480×800 reconstructed app shell wiring the primitives end-to-end:
  - Top bar (traffic lights + product / breadcrumb / connector pill).
  - Left rail (280px) — `+ New task` with `⌘N`, History, WORKBOOKS section with active `BILL · Operations` expanded (4 task children including the active "Approve Acme Q1 batch"), inactive `Treasury · Sweeps`, CONNECTORS list with `BILL API` (sandbox), `Mercury Bank` (live), `QuickBooks · GL` (warn-syncing).
  - Conversation column (540px) — session header, USER pill, TOOLS turn (3 `ToolRow` rows), AGENT markdown turn with "Acme" bolded, `artifact-card` opening the AP table, SUGGEST chips with `✦ Recommend Acme batch first` highlighted, and `Composer` at bottom with `/approve` forced-command chip + focus ring + model picker + Send.
  - Artifact pane (660px) — tab strip with active "Cash projection ×", 4 KPI cards (Today 220K, Min 118K, End Mar 1 95K, Inflow +48K), `LineChart` with threshold band + Payroll/Vendor batch/AR drop sweep markers, legend, and a Notes block with two analyst-style lines.
