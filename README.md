# RonDuel

> The daily duel for your group chat.

A mobile-first, 60-second daily trivia & logic Progressive Web App built with Next.js (App Router), TypeScript, Tailwind CSS, and Firebase (EU data residency).

## Repository layout

- `apps/web` — Next.js App Router PWA (`@ronduel/web`)
- `functions` — Firebase Cloud Functions 2nd gen (`europe-west1`, `@ronduel/functions`)
- `packages/shared` — Shared Zod schemas, scoring engine, and utilities (`@ronduel/shared`)
- `e2e` — Playwright end-to-end and accessibility (`@axe-core/playwright`) tests
- `docs` — Architecture, runbook, KPIs, and ADRs

## Quick start

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

- Web app: `http://localhost:3000`
- UI showcase (dev only): `http://localhost:3000/dev/ui`
- Firebase Emulator UI: `http://localhost:4000` (requires Java 21+ for Firestore emulator)

## Verification commands

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test:unit
pnpm build
pnpm test:e2e
```
