'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SUPPORTED_LOCALE_CODES, SupportedLocale } from '@/lib/locales';

function detectLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'ro';

  try {
    const saved = localStorage.getItem('ronduel_locale');
    if (saved && (SUPPORTED_LOCALE_CODES as readonly string[]).includes(saved)) {
      return saved as SupportedLocale;
    }
  } catch {
    // Ignore storage errors
  }

  const browserLangs =
    typeof navigator !== 'undefined'
      ? navigator.languages || [navigator.language]
      : [];

  for (const lang of browserLangs) {
    if (!lang) continue;
    const code = lang.toLowerCase().split('-')[0];
    if (code && (SUPPORTED_LOCALE_CODES as readonly string[]).includes(code)) {
      return code as SupportedLocale;
    }
  }

  return 'ro';
}

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const locale = detectLocale();
    router.replace(`/${locale}`);
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4 font-mono text-xs text-muted">
      <noscript>
        <meta httpEquiv="refresh" content="0;url=/ro" />
      </noscript>
      <span>RonDuel</span>
    </div>
  );
}
