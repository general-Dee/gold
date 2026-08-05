# Gold Journal

A personal trading journal for XAUUSD (gold) discretionary trading. Log trades with entry/exit details, R:R, and P&L; track a pre-trade rule checklist with streaks; monitor account balance, drawdown, and monthly profit targets; and unlock gamification badges for discipline and performance.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Drizzle ORM](https://orm.drizzle.team) over SQLite (via `@libsql/client`)
- [Vitest](https://vitest.dev) for tests

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). A SQLite database is created automatically on first run at `data/trading-journal.db` (override with the `DATABASE_URL` env var); uploaded trade chart images are stored under `data/uploads/`. Both are gitignored.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run a production build |
| `npm run lint` | Lint with ESLint |
| `npm run test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |

Schema changes go through Drizzle Kit:

```bash
npx drizzle-kit generate   # generate a migration from src/server/db/schema.ts
npx drizzle-kit push       # push schema changes to the local dev database
```

## Project layout

- `src/app/` — routes (dashboard, trades, analytics, calendar, checklist, rules, account, achievements)
- `src/components/` — UI components, grouped by feature area, plus shared `ui/` primitives (shadcn)
- `src/server/queries/` — Drizzle read/write logic per domain
- `src/server/actions/` — `"use server"` mutation entry points called directly from client forms
- `src/lib/` — pure, framework-independent logic (R:R/position-size calculations, CSV import/export, zod validation schemas, date helpers)
- `drizzle/` — SQL migrations generated from `src/server/db/schema.ts`

See `CLAUDE.md` for architecture notes and conventions relevant when making changes to this codebase.
