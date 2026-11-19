# RonDuel Architecture

## Overview

RonDuel is a pnpm monorepo with three main workspaces:

1. **`apps/web`** — Next.js 15 App Router PWA with Tailwind CSS v4 ("Split Court" design system), `next-intl` (EN/ES/PT/RO), and `next/og` dynamic Open Graph images.
2. **`functions`** — Firebase Cloud Functions (2nd gen) deployed to `europe-west1`. All scoring, timing, anti-cheat, league rollovers, Stripe webhooks, and notification scheduling happen server-side.
3. **`packages/shared`** — Pure TypeScript + Zod schemas shared between web and functions (scoring formula, time limits, emoji-line builder).

## EU Data Residency

- **Cloud Firestore:** `eur3` multi-region
- **Cloud Functions (2nd gen):** `europe-west1`
- **Firebase App Hosting:** `europe-west4`
- **Analytics:** PostHog Cloud EU (`https://eu.i.posthog.com`), opt-in only

## Security Model

- Default-deny `firestore.rules` (expanded per phase with `@firebase/rules-unit-testing` coverage).
- Answers never reach the client before an item is answered or timed out.
- All server secrets are managed via Google Secret Manager (`defineSecret`).
