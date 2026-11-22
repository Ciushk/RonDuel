import Link from 'next/link';

import { Button, Wordmark } from '@/components/ui';

export default function RootNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <Wordmark size="lg" />
      <div className="space-y-2">
        <span className="font-display text-muted text-sm font-extrabold tracking-widest uppercase">
          404 · Error
        </span>
        <h1 className="font-display text-ink text-3xl font-extrabold">Pagina nu există</h1>
        <p className="text-muted mx-auto max-w-xs text-sm">
          Ne pare rău, pagina pe care o cauți nu există sau a fost mutată.
        </p>
      </div>
      <Link href="/ro" className="w-full">
        <Button variant="volt" fullWidth size="lg">
          Înapoi la runda de azi
        </Button>
      </Link>
    </main>
  );
}
