import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import { APPLE_STARTUP_IMAGES } from '@/app/manifest';

import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-bricolage',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FF5A4E' },
    { media: '(prefers-color-scheme: dark)', color: '#0E0D15' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL('https://ronduel.web.app'),
  title: 'RonDuel — Daily Trivia with Your Friends',
  description:
    'Daily 6-question trivia duel with your friends. 30 seconds per question, one attempt per day. Create your league!',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'RonDuel',
    statusBarStyle: 'default',
    startupImage: APPLE_STARTUP_IMAGES,
  },
  openGraph: {
    title: 'RonDuel — Daily Trivia with Your Friends',
    description:
      'Daily 6-question trivia duel with your friends. 30 seconds per question, one attempt per day. Create your league!',
    url: 'https://ronduel.web.app',
    siteName: 'RonDuel',
    type: 'website',
    images: [
      {
        url: '/brand/og-card-ro.png',
        width: 1200,
        height: 630,
        alt: 'RonDuel',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RonDuel — Daily Trivia with Your Friends',
    description:
      'Daily 6-question trivia duel with your friends. 30 seconds per question, one attempt per day. Create your league!',
    images: ['/brand/og-card-ro.png'],
  },
};

// The [locale] layout overwrites `lang` on <html> with an inline script before
// hydration, so React must not reconcile that attribute back to the server value.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ro"
      suppressHydrationWarning
      data-theme="light"
      className={`${bricolage.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-bg text-ink min-h-dvh antialiased">
        {children}
      </body>
    </html>
  );
}
