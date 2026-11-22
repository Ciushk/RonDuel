import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Card, Chip } from '@/components/ui';
import { routing } from '@/i18n/routing';

const DOC_SECTIONS: Record<
  'terms' | 'privacy' | 'cookies' | 'imprint',
  Array<{ titleKey: string; bodyKey: string }>
> = {
  terms: [
    { titleKey: 'legal.terms.s1Title', bodyKey: 'legal.terms.s1Body' },
    { titleKey: 'legal.terms.s2Title', bodyKey: 'legal.terms.s2Body' },
    { titleKey: 'legal.terms.s3Title', bodyKey: 'legal.terms.s3Body' },
    { titleKey: 'legal.terms.s4Title', bodyKey: 'legal.terms.s4Body' },
    { titleKey: 'legal.terms.s5Title', bodyKey: 'legal.terms.s5Body' },
    { titleKey: 'legal.terms.s6Title', bodyKey: 'legal.terms.s6Body' },
    { titleKey: 'legal.terms.s7Title', bodyKey: 'legal.terms.s7Body' },
  ],
  privacy: [
    { titleKey: 'legal.privacy.s1Title', bodyKey: 'legal.privacy.s1Body' },
    { titleKey: 'legal.privacy.s2Title', bodyKey: 'legal.privacy.s2Body' },
    { titleKey: 'legal.privacy.s3Title', bodyKey: 'legal.privacy.s3Body' },
    { titleKey: 'legal.privacy.s4Title', bodyKey: 'legal.privacy.s4Body' },
    { titleKey: 'legal.privacy.s5Title', bodyKey: 'legal.privacy.s5Body' },
  ],
  cookies: [
    { titleKey: 'legal.cookies.s1Title', bodyKey: 'legal.cookies.s1Body' },
    { titleKey: 'legal.cookies.s2Title', bodyKey: 'legal.cookies.s2Body' },
  ],
  imprint: [{ titleKey: 'legal.imprint.s1Title', bodyKey: 'legal.imprint.s1Body' }],
};

export function generateStaticParams() {
  return (Object.keys(DOC_SECTIONS) as Array<keyof typeof DOC_SECTIONS>).map((doc) => ({ doc }));
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; doc: string }>;
}) {
  const { locale, doc } = await params;

  if (
    !routing.locales.includes(locale as (typeof routing.locales)[number]) ||
    !(doc in DOC_SECTIONS)
  ) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const typedDoc = doc as keyof typeof DOC_SECTIONS;
  const sections = DOC_SECTIONS[typedDoc];
  const title = t(`legal.${typedDoc}.title` as Parameters<typeof t>[0]);

  const navDocs: Array<{ key: keyof typeof DOC_SECTIONS; label: string }> = [
    { key: 'terms', label: t('legal.footerTerms') },
    { key: 'privacy', label: t('legal.footerPrivacy') },
    { key: 'cookies', label: t('legal.footerCookies') },
    { key: 'imprint', label: t('legal.footerImprint') },
  ];

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-4 px-4 py-6">
      <div className="space-y-2">
        <Chip tone="volt">{t('legal.lastUpdated')}</Chip>
        <h1 className="font-display text-3xl font-extrabold">{title}</h1>
      </div>

      <nav aria-label={t('legal.navLabel')} className="flex flex-wrap gap-2">
        {navDocs.map((item) => (
          <Link
            key={item.key}
            href={`/${locale}/legal/${item.key}`}
            className={`rounded-[10px] border px-3 py-1.5 text-xs font-bold ${
              item.key === typedDoc
                ? 'border-border bg-volt text-[#16131F]'
                : 'border-border-subtle bg-surface-2 text-ink'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="space-y-3">
        {sections.map((sec) => (
          <Card key={sec.titleKey} variant="subtle" className="space-y-1.5">
            <h2 className="font-display text-base font-extrabold">
              {t(sec.titleKey as Parameters<typeof t>[0])}
            </h2>
            <p className="text-muted text-sm leading-relaxed">
              {t(sec.bodyKey as Parameters<typeof t>[0])}
            </p>
          </Card>
        ))}
      </div>
    </main>
  );
}
