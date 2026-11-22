import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

import { Button, Wordmark } from '@/components/ui';

export default function LocaleNotFound() {
  const t = useTranslations('notFound');
  const locale = useLocale();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <Wordmark size="lg" />
      <div className="space-y-2">
        <span className="font-display text-muted text-sm font-extrabold tracking-widest uppercase">
          {t('code')}
        </span>
        <h1 className="font-display text-ink text-3xl font-extrabold">{t('title')}</h1>
        <p className="text-muted mx-auto max-w-xs text-sm">{t('body')}</p>
      </div>
      <Link href={`/${locale}`} className="w-full">
        <Button variant="volt" fullWidth size="lg">
          {t('backToToday')}
        </Button>
      </Link>
    </main>
  );
}
