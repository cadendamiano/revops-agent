# exp-tokyo — Agent Instructions

This repo is an AI prototype harness built on Next.js + Electron. It ships as a branded demo environment for finance teams, wired to BILL APIs with Claude and Gemini as the AI backends. The original concept was called **"BILL Coworker"** — an agentic coworker for AP/AR workflows.

Teams fork or clone this to stand up their own branded prototype. The harness handles conversation turns, tool calls, approval flows, and demo data; you swap in your branding and use-case configuration.

## Configure Prototype

When the user says **"configure prototype"** (or expresses intent to set up or brand this harness for a new use case), gather the following before making any changes:

1. **Use case / workflow** — What scenario do you want to demo? (e.g. accounts payable, vendor payments, expense approvals, cash flow forecasting)
2. **Client company name** — What company should appear in the topbar breadcrumb? (currently "Atlas Tech")
3. **Subsidiaries / entities** — Any specific divisions or child companies to highlight in the demo?
4. **Product / concept name** — What should the AI coworker be called? (currently "Salesforce Coworker")
5. **Demo mode preference** — Deterministic demo mode (scripted, predictable AI responses) or live AI mode (real Claude/Gemini calls)?
6. **Key workflows** — List 2–3 core workflows to highlight in the prototype.

After gathering answers, update these locations:

| What | File | Line |
|------|------|------|
| Product name in topbar | `components/TopBar.tsx` | 25 |
| Client name in topbar | `components/TopBar.tsx` | 27 |
| Browser tab title | `app/layout.tsx` | 6 |
| Login screen brand | `app/login/page.tsx` | 50 |
| Electron app name | `package.json` | 71 (`productName`) |
| Default mode | `lib/store.ts` | 170 (`mode`: `'demo'` or `'testing'`) |
| Demo dataset | `lib/store.ts` | 170 (`demoDataset`: `'logistics'` or other) |
