import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';
import { SUPPORTED_LOCALE_CODES } from './lib/locales';

const intlMiddleware = createMiddleware(routing);

function detectPreferredLocale(req: NextRequest): string {
  // 1. Check NEXT_LOCALE cookie
  const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && (SUPPORTED_LOCALE_CODES as readonly string[]).includes(cookieLocale)) {
    return cookieLocale;
  }

  // 2. Check Accept-Language header
  const acceptLang = req.headers.get('accept-language');
  if (acceptLang) {
    const langs = acceptLang
      .split(',')
      .map((part) => {
        const [lang, q] = part.trim().split(';q=');
        return {
          code: lang?.split('-')[0]?.toLowerCase() ?? '',
          quality: q ? parseFloat(q) : 1.0,
        };
      })
      .filter((item) => Boolean(item.code))
      .sort((a, b) => b.quality - a.quality);

    for (const item of langs) {
      if ((SUPPORTED_LOCALE_CODES as readonly string[]).includes(item.code)) {
        return item.code;
      }
    }
  }

  // 3. Fallback to ro
  return 'ro';
}

export default function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Handle /l/CODE redirect without locale prefix
  if (pathname.startsWith('/l/')) {
    const detected = detectPreferredLocale(req);
    const url = new URL(`/${detected}${pathname}${search}`, req.url);
    return NextResponse.redirect(url, 307);
  }

  // Handle root visit / redirect with 307
  if (pathname === '/') {
    const detected = detectPreferredLocale(req);
    const url = new URL(`/${detected}${search}`, req.url);
    const response = NextResponse.redirect(url, 307);
    if (!req.cookies.has('NEXT_LOCALE')) {
      response.cookies.set('NEXT_LOCALE', detected, {
        path: '/',
        maxAge: 31536000,
        sameSite: 'lax',
      });
    }
    return response;
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ['/((?!api|admin|dev|offline|_next|_vercel|.*\\..*).*)'],
};
