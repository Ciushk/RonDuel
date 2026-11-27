'use client';

import type { Locale } from '@ronduel/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button, Wordmark } from '@/components/ui';
import { NOT_FOUND_MESSAGES, resolveNotFoundLocale } from '@/lib/not-found-messages';

export default function RootNotFound() {
  const [locale, setLocale] = useState<Locale>('en');

  useEffect(() => {
    const detected = resolveNotFoundLocale(
      typeof window !== 'undefined' ? window.location.pathname : undefined,
    );
    setLocale(detected);
    const copy = NOT_FOUND_MESSAGES[detected] ?? NOT_FOUND_MESSAGES.en;
    document.documentElement.lang = detected;
    document.title = `${copy.title} — RonDuel`;
  }, []);

  const copy = NOT_FOUND_MESSAGES[locale] ?? NOT_FOUND_MESSAGES.en;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <Wordmark size="lg" />
      <div className="space-y-2">
        <span
          id="nf-code"
          className="font-display text-muted text-sm font-extrabold uppercase tracking-widest"
        >
          {copy.code}
        </span>
        <h1 id="nf-title" className="font-display text-ink text-3xl font-extrabold">
          {copy.title}
        </h1>
        <p id="nf-body" className="text-muted mx-auto max-w-xs text-sm">
          {copy.body}
        </p>
      </div>
      <Link id="nf-link" href={`/${locale}`} className="w-full">
        <Button id="nf-btn" variant="volt" fullWidth size="lg">
          {copy.backToToday}
        </Button>
      </Link>
    </main>
  );
}
