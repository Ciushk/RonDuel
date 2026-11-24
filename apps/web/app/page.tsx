'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SUPPORTED_LOCALE_CODES, SupportedLocale } from '@/lib/locales';

function detectLocale(): SupportedLocale {
  if (typeof window === 'undefined') return 'en';

  // 1. Read NEXT_LOCALE cookie first
  try {
    const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
    if (match) {
      let code = decodeURIComponent(match[1]!).trim().toLowerCase();
      if (code === 'no' || code === 'nn') code = 'nb';
      if ((SUPPORTED_LOCALE_CODES as readonly string[]).includes(code)) {
        return code as SupportedLocale;
      }
    }
  } catch {
    // Ignore cookie errors
  }

  // 2. Read saved localStorage
  try {
    const saved = localStorage.getItem('ronduel_locale');
    if (saved) {
      let code = saved.trim().toLowerCase();
      if (code === 'no' || code === 'nn') code = 'nb';
      if ((SUPPORTED_LOCALE_CODES as readonly string[]).includes(code)) {
        return code as SupportedLocale;
      }
    }
  } catch {
    // Ignore storage errors
  }

  // 3. Inspect browser languages
  const browserLangs =
    typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [];

  for (const lang of browserLangs) {
    if (!lang) continue;
    let code = lang.toLowerCase().split('-')[0];
    if (code === 'no' || code === 'nn') code = 'nb';
    if (code && (SUPPORTED_LOCALE_CODES as readonly string[]).includes(code)) {
      return code as SupportedLocale;
    }
  }

  return 'en';
}

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const locale = detectLocale();
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    const target = `/${locale}${search}${hash}`;
    window.location.replace(target);
  }, [router]);

  return (
    <div className="bg-bg text-muted flex min-h-dvh items-center justify-center p-4 font-mono text-xs">
      <noscript>
        <meta httpEquiv="refresh" content="0;url=/en" />
      </noscript>
      <span>RonDuel</span>
    </div>
  );
}
