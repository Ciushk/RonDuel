# ADR 0001: Tech Stack & Monorepo Layout

- **Status:** Accepted
- **Date:** 2026-11-19

## Context

RonDuel needs a mobile-first PWA with zero-friction anonymous play, seamless upgrade to permanent accounts, real-time group leaderboards, server-enforced scoring/anti-cheat, Web Push, and EU data residency.

## Decision

- **Frontend:** Next.js 15 (App Router) + TypeScript (strict) + Tailwind CSS v4 + `next-intl`.
- **Backend:** Firebase (App Hosting, Auth with Anonymous → `linkWithCredential`, Cloud Firestore in `eur3`, Cloud Functions 2nd gen in `europe-west1`, FCM, App Check, Remote Config).
- **Monorepo:** `pnpm` workspaces (`apps/web`, `functions`, `packages/shared`).
- **Testing:** Vitest for unit tests, `@firebase/rules-unit-testing` for Firestore rules, Playwright + `@axe-core/playwright` for E2E & WCAG 2.2 AA checks.

## Consequences

- Single Google Cloud / Firebase console covers auth, database, functions, push, and hosting.
- Local development and CI run deterministically against the Firebase Emulator Suite without touching production services.
