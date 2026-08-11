# Gold Journal

A personal trading journal for XAUUSD (gold) discretionary trading. Log trades with entry/exit details, R:R, and P&L; track a pre-trade rule checklist with streaks; monitor account balance, drawdown, and monthly profit targets; and unlock gamification badges for discipline and performance.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Firestore](https://firebase.google.com/docs/firestore) via the `firebase-admin` SDK
- [Vitest](https://vitest.dev) for tests, against the Firestore emulator

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Data lives in Firestore — set `FIREBASE_PROJECT_ID` and either `FIRESTORE_EMULATOR_HOST` (local dev, see `npm run emulator`) or `FIREBASE_SERVICE_ACCOUNT_KEY` (a real project) before starting the server. Uploaded trade chart images are stored on local disk under `data/uploads/` (gitignored) — this app is designed to run as a long-lived, self-hosted Node process, not on ephemeral/serverless compute.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run a production build |
| `npm run lint` | Lint with ESLint |
| `npm run test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run emulator` | Start the local Firestore emulator |

Firestore is schemaless, so there's no migration step — `npm run test` starts a throwaway Firestore
emulator instance (`firebase emulators:exec`) and runs the suite against it. Collection shapes are
defined only in TypeScript, in `src/server/firebase/collections.ts`. Security rules
(`firestore.rules`) and composite indexes (`firestore.indexes.json`) are deployed with
`firebase deploy --only firestore`.

## Project layout

- `src/app/` — routes (dashboard, trades, analytics, calendar, checklist, rules, account, achievements)
- `src/components/` — UI components, grouped by feature area, plus shared `ui/` primitives (shadcn)
- `src/server/queries/` — Firestore read/write logic per domain
- `src/server/actions/` — `"use server"` mutation entry points called directly from client forms
- `src/lib/` — pure, framework-independent logic (R:R/position-size calculations, CSV import/export, zod validation schemas, date helpers)
- `src/server/firebase/` — Firestore client, collection converters/refs, and shared write helpers (batching, id generation)

See `CLAUDE.md` for architecture notes and conventions relevant when making changes to this codebase.
