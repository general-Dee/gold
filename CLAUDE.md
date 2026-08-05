# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal trading journal for XAUUSD (gold) discretionary trading. It tracks individual trades (entry/exit, R:R, P&L, setup/mood tags), a pre-trade rule checklist with streaks, account balance/drawdown/profit-target tracking, and gamification badges — built with Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 + shadcn/ui, and Drizzle ORM over SQLite (via `@libsql/client`).

## Commands

```bash
npm run dev          # Next.js dev server (Turbopack)
npm run build         # production build
npm run lint           # eslint

npm run test           # vitest run — full suite, single pass
npm run test:watch     # vitest — watch mode
npx vitest run src/server/actions/trades.test.ts   # single file
npx vitest run -t "creates the trade"              # by test name

npx tsc --noEmit       # typecheck (no dedicated script)

npx drizzle-kit generate   # generate a migration from schema.ts changes
npx drizzle-kit push       # push schema changes straight to the local db (dev only)
```

The SQLite db file lives at `data/trading-journal.db` (gitignored, along with `data/uploads/` for trade chart images) and is created on first run. Override its location with `DATABASE_URL` (defaults to `file:./data/trading-journal.db`; tests use `:memory:`).

## Architecture

**Layering**: `src/app/**/page.tsx` (Server Components, data fetching) → `src/server/queries/*` (Drizzle queries, business logic) for reads, and `src/server/actions/*` (`"use server"`, one file per domain: `trades`, `account`, `checklist`, `rules`, `images`, `import`) for writes. Actions are thin: zod-parse input (`src/lib/validation.ts`) → call a query function → `revalidatePath(...)` → sometimes `redirect(...)`. Client form components (`src/components/trades/TradeForm.tsx`, `CloseTradeForm.tsx`, etc.) call actions directly as props, not via fetch.

**Server/Client Component boundary — the sharpest edge in this codebase.** Two failure modes have bitten this repo before and are easy to reintroduce:
- Never call a function exported from a `"use client"` file (e.g. `toDatetimeLocal` in `TradeForm.tsx`) from a Server Component. It throws at runtime, not at build/typecheck time.
- Never pass an inline closure that wraps a server action as a prop to a Client Component (e.g. `onSubmitAction={(input) => updateTradeAction(id, input)}`) — Next can't serialize it across the RSC boundary. Use `updateTradeAction.bind(null, id)` instead (see `src/app/trades/[id]/edit/page.tsx` / `close/page.tsx`).

**Domain model** (`src/server/db/schema.ts`): `trades` is the central table — `status` (`open`/`closed`) drives the open-trade lifecycle (see `close/page.tsx` vs `edit/page.tsx`), and most trade fields are nullable because an open trade hasn't accrued exit data yet. `tradeRuleChecks` snapshots the rule's text at check-time (not a live FK join), so editing a rule later doesn't retroactively change historical trades' displayed checklist. `tradeSetupTags`/`tradeRuleChecks` are wholesale-replaced (delete-all-then-reinsert) on every trade update, not diffed — any code (including new close/edit flows) that fetches a trade and re-submits it must carry these arrays forward unchanged or they'll be silently wiped. `rules`/`setupTags`/`moodTags`/`checklistItems` all soft-delete via `isActive`/`archivedAt` rather than hard delete, since trades and checklist completions reference them historically.

**Calculations** (`src/lib/calculations.ts`): R-multiples (`plannedRiskReward`/`realizedRiskReward`) are broker/point-value-agnostic by design — they're computed from price distances, not $ P&L, so they stay meaningful across different account/lot conventions. Position sizing (`suggestPositionSize`) is hardcoded to XAUUSD's 100oz standard lot; this app is single-instrument by design, not a generic multi-symbol sizer.

**CSV import/export**: hand-rolled RFC4180-ish parser in `src/lib/csv.ts` (no external CSV library). Export columns and `tradeImportRowSchema` (`src/lib/validation.ts`) are meant to be exact round-trip mirrors of each other — changing one without the other breaks re-import of your own exports.

**Testing** (`src/server/**/*.test.ts`, `vitest.config.mts`): 100% real-DB integration style against an in-memory SQLite instance, no mocked query layer. Every test file follows the same shape — see `src/server/testUtils/testDb.ts`'s doc comment for why:
```ts
let db: Awaited<ReturnType<typeof bootstrapTestDb>>["db"];
let schema: Awaited<ReturnType<typeof bootstrapTestDb>>["schema"];
let someFn: typeof import("@/server/actions/whatever").someFn;

beforeAll(async () => {
  ({ db, schema } = await bootstrapTestDb());          // sets DATABASE_URL=":memory:" then applies drizzle/*.sql
  ({ someFn } = await import("@/server/actions/whatever")); // dynamic — see below
});
```
The module(s)-under-test **must** be imported dynamically inside `beforeAll`, after `bootstrapTestDb()` — a static top-of-file import would create the sqlite client (via `@/server/db/client`'s module-load side effect) before `DATABASE_URL` is set, since Vitest's `forks`/`isolate: true` pool gives each test file a fresh module registry. Pure, db-independent modules (zod schemas, `src/lib/*`) are fine as static imports. `beforeEach` deletes rows in FK-dependency order (children before parents) rather than resetting the whole db.

Action tests (`src/server/actions/*.test.ts`) additionally need `next/cache` (and, for `trades.ts`, `next/navigation`) mocked per-file via `vi.mock(...)` — calling `revalidatePath`/`redirect` unmocked throws immediately outside a real Next.js request context. This is deliberately per-file, not a global `setupFiles` mock, so it can't silently swallow a `revalidatePath` call that leaked into the wrong layer. The `redirect` mock is a no-op (not a throw), which makes the action's own return value reachable for assertions even though it's technically unreachable in production. Mock call history persists across tests within a file, so `beforeEach` must `mockClear()` it before any test that asserts "was not called".
