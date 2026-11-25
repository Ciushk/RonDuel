import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/AppShell';
import { DeferredRonBot } from '@/components/DeferredRonBot';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = routing.locales.includes(locale as (typeof routing.locales)[number])
    ? locale
    : 'ro';
  const t = await getTranslations({ locale: resolvedLocale });

  const title = t('seo.title');
  const description = t('seo.description');
  const ogImageUrl = `/brand/og-card-${resolvedLocale}.png`;

  return {
    title,
    description,
    manifest: `/manifest-${resolvedLocale}.webmanifest`,
    alternates: {
      canonical: `https://ronduel.web.app/${resolvedLocale}`,
      languages: {
        ...Object.fromEntries(
          routing.locales.map((code) => [code, `https://ronduel.web.app/${code}`]),
        ),
        'x-default': 'https://ronduel.web.app/ro',
      },
    },
    openGraph: {
      title,
      description,
      url: `https://ronduel.web.app/${resolvedLocale}`,
      siteName: 'RonDuel',
      locale: resolvedLocale,
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: 'RonDuel #12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.lang = ${JSON.stringify(locale)};`,
        }}
      />
      <AppShell>{children}</AppShell>
      <DeferredRonBot />
    </NextIntlClientProvider>
  );
}
