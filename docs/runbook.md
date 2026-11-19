# RonDuel Runbook

## Local Development

1. Copy `.env.example` to `.env.local`.
2. Run `pnpm install`.
3. Run `pnpm dev` to start Next.js (`:3000`) and the Firebase Emulator Suite (`:4000` UI, `:8080` Firestore, `:9099` Auth, `:5001` Functions).
   - Note: The Firestore emulator requires Java 21+ on `PATH`.

## CI Checks

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR to `main`:

- `pnpm lint`
- `pnpm format:check`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm build`
- `pnpm test:e2e` (Playwright + axe-core)

## Deployment & Rollback (Phase 1+)

- Deployment targets Firebase App Hosting (`europe-west4`) and Cloud Functions (`europe-west1`).
- Rollback via Firebase Console App Hosting rollouts or `firebase deploy --only functions` from the previous git tag.
