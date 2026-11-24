import Link from 'next/link';

import { Button, Wordmark } from '@/components/ui';

export default function RootNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <Wordmark size="lg" />
      <div className="space-y-2">
        <span
          id="nf-code"
          className="font-display text-muted text-sm font-extrabold uppercase tracking-widest"
        >
          404 · Not Found
        </span>
        <h1 id="nf-title" className="font-display text-ink text-3xl font-extrabold">
          Page Not Found
        </h1>
        <p id="nf-body" className="text-muted mx-auto max-w-xs text-sm">
          Sorry, the page you are looking for does not exist or has been moved.
        </p>
      </div>
      <Link id="nf-link" href="/" className="w-full">
        <Button id="nf-btn" variant="volt" fullWidth size="lg">
          Back to today's round
        </Button>
      </Link>
    </main>
  );
}
