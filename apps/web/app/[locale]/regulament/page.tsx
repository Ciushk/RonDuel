import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui';
import { routing } from '@/i18n/routing';
import {
  hasLegalPlaceholders,
  REGULAMENT_ARTICLE_ANCHORS,
  renderLegalInline,
  RULES_RO_VERSION,
} from '@/lib/legal-markdown';

function loadRegulamentMarkdown(locale: string): string {
  let filePath = path.join(process.cwd(), 'content', 'legal', locale, 'regulament.md');
  if (!fs.existsSync(filePath)) {
    filePath = path.join(process.cwd(), 'content', 'legal', 'en', 'regulament.md');
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.join(process.cwd(), 'content', 'legal', 'ro', 'regulament.md');
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return raw
    .replace(/\[DATA\]/g, RULES_RO_VERSION.lastUpdated)
    .replace(/Versiunea: 1\.0/g, `Versiunea: ${RULES_RO_VERSION.version}`);
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    return {};
  }

  const t = await getTranslations({ locale });
  const md = loadRegulamentMarkdown(locale);
  const isDraft = hasLegalPlaceholders(md);

  const title = locale === 'ro' ? 'Regulamentul jocului | RonDuel' : t('rules.metaTitle');
  const description =
    locale === 'ro'
      ? 'Cum funcționează RonDuel: runda zilnică, calculul punctelor, egalități, ligi, dueluri, serii, trișat și ce include Pro. Fără premii, fără jocuri de noroc.'
      : t('rules.metaDescription');

  return {
    title,
    description,
    alternates: {
      canonical: `https://ronduel.eu/${locale}/regulament`,
    },
    robots: isDraft ? { index: false, follow: false } : { index: true, follow: true },
  };
}

interface ParsedArticle {
  num: number;
  anchor: string;
  heading: string;
}

function renderMarkdownDocument(md: string): {
  h1: string;
  articles: ParsedArticle[];
  elements: ReactNode[];
} {
  const lines = md.split(/\r?\n/);
  let h1 = '';
  const articles: ParsedArticle[] = [];
  const elements: ReactNode[] = [];

  let i = 0;
  let keyCounter = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // H1
    if (trimmed.startsWith('# ')) {
      h1 = trimmed.slice(2).trim();
      i += 1;
      continue;
    }

    // Horizontal rule
    if (trimmed === '---') {
      elements.push(
        <hr key={`hr-${keyCounter++}`} className="border-border-subtle my-6 border-t" />,
      );
      i += 1;
      continue;
    }

    // H2 Article heading
    if (trimmed.startsWith('## ')) {
      const headingText = trimmed.slice(3).trim();
      const numMatch = headingText.match(/^(\d+)\./);
      const artNum = numMatch ? Number(numMatch[1]) : articles.length + 1;
      const anchor = REGULAMENT_ARTICLE_ANCHORS[artNum] ?? `art-${artNum}`;
      articles.push({ num: artNum, anchor, heading: headingText });

      elements.push(
        <h2
          key={`h2-${keyCounter++}`}
          id={anchor}
          className="font-display text-ink mb-3 mt-8 scroll-mt-20 text-2xl font-extrabold"
        >
          {renderLegalInline(headingText, `h2-inl-${artNum}`)}
        </h2>,
      );
      i += 1;
      continue;
    }

    // Blockquote (> ...)
    if (trimmed.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('> ')) {
        quoteLines.push(lines[i]!.trim().slice(2));
        i += 1;
      }
      elements.push(
        <blockquote
          key={`bq-${keyCounter++}`}
          className="border-border bg-surface-2 text-ink my-3 rounded-[14px] border-l-4 px-4 py-3 font-mono text-sm font-bold"
        >
          <code>{quoteLines.join('\n')}</code>
        </blockquote>,
      );
      continue;
    }

    // Unordered list (- ...)
    if (trimmed.startsWith('- ')) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('- ')) {
        listItems.push(lines[i]!.trim().slice(2));
        i += 1;
      }
      elements.push(
        <ul
          key={`ul-${keyCounter++}`}
          className="text-ink my-2.5 list-disc space-y-1.5 pl-6 text-base leading-[1.6]"
        >
          {listItems.map((item, idx) => (
            <li key={idx}>{renderLegalInline(item, `li-${keyCounter}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Paragraph (collect consecutive non-empty normal lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !lines[i]!.trim().startsWith('# ') &&
      !lines[i]!.trim().startsWith('## ') &&
      !lines[i]!.trim().startsWith('> ') &&
      !lines[i]!.trim().startsWith('- ') &&
      lines[i]!.trim() !== '---'
    ) {
      paraLines.push(lines[i]!.trim());
      i += 1;
    }

    elements.push(
      <p key={`p-${keyCounter++}`} className="text-ink my-3 text-base leading-[1.6]">
        {paraLines.map((pl, pIdx) => (
          <span key={pIdx}>
            {pIdx > 0 && <br />}
            {renderLegalInline(pl, `p-inl-${keyCounter}-${pIdx}`)}
          </span>
        ))}
      </p>,
    );
  }

  return { h1, articles, elements };
}

export default async function RegulamentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const md = loadRegulamentMarkdown(locale);
  const isDraft = hasLegalPlaceholders(md);
  const isFallback = !['ro', 'en', 'es', 'pt'].includes(locale);
  const { h1, articles, elements } = renderMarkdownDocument(md);

  return (
    <main lang={locale} className="mx-auto max-w-[720px] space-y-5 px-4 py-6 leading-[1.6]">
      {isDraft && (
        <div
          role="status"
          data-testid="legal-draft-banner"
          className="border-border bg-gold rounded-[14px] border-2 px-4 py-3 text-sm font-extrabold text-[#16131F]"
        >
          {locale === 'ro' ? 'DRAFT – textul juridic nu este final' : t('rules.draftBanner')}
        </div>
      )}

      {isFallback && (
        <div
          role="note"
          className="border-border bg-surface-2 text-ink rounded-[14px] border px-4 py-2.5 text-xs font-bold"
        >
          {t('rules.englishOnlyNotice')}
        </div>
      )}

      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{h1}</h1>

      {/* Table of contents with all 14 anchor links */}
      <Card variant="subtle" className="p-4">
        <nav aria-label={t('rules.tocLabel')}>
          <p className="font-display mb-2.5 text-sm font-extrabold uppercase tracking-wide">
            {t('rules.tocLabel')}
          </p>
          <ol className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
            {articles.map((art) => (
              <li key={art.anchor}>
                <a
                  href={`#${art.anchor}`}
                  className="text-duel-strong inline-block py-0.5 font-bold underline underline-offset-2"
                >
                  {art.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </Card>

      <article className="space-y-1">{elements}</article>
    </main>
  );
}
