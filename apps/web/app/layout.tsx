import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, DM_Sans, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import { APPLE_STARTUP_IMAGES } from '@/app/manifest';
import { RonBotMascot } from '@/components/RonBotMascot';

import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  weight: ['700', '800'],
  variable: '--font-bricolage',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '700'],
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
  title: 'RonDuel — Trivia zilnic pentru grupul tău de prieteni',
  description:
    '6 întrebări pe zi, un minut, o singură încercare. Fă-ți ligă cu prietenii și vezi cine e cel mai tare.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/brand/icon.svg', type: 'image/svg+xml' },
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
    title: 'RonDuel — Trivia zilnic pentru grupul tău de prieteni',
    description:
      '6 întrebări pe zi, un minut, o singură încercare. Fă-ți ligă cu prietenii și vezi cine e cel mai tare.',
    url: 'https://ronduel.web.app',
    siteName: 'RonDuel',
    type: 'website',
    images: [
      {
        url: '/brand/og-card-ro.png',
        width: 1200,
        height: 630,
        alt: 'RonDuel #12 · 🟩🟩🟥🟩🟩🟩 · 987/1200 · 🔥 5',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RonDuel — Trivia zilnic pentru grupul tău de prieteni',
    description:
      '6 întrebări pe zi, un minut, o singură încercare. Fă-ți ligă cu prietenii și vezi cine e cel mai tare.',
    images: ['/brand/og-card-ro.png'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ro"
      data-theme="light"
      className={`${bricolage.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-bg text-ink min-h-dvh antialiased">
        {children}
        <RonBotMascot />
      </body>
    </html>
  );
}
