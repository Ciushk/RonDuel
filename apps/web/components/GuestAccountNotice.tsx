'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui';
import { anonExpiresAtIso } from '@/lib/anon-retention';
import { getLocalSession } from '@/lib/session';

export function GuestAccountNotice({ onSave }: { onSave?: () => void }) {
  const t = useTranslations();
  const locale = useLocale();
  const [dateLabel, setDateLabel] = useState<string | null>(null);

  useEffect(() => {
    const session = getLocalSession();
    const anonymous = session.isAnonymous !== false && !session.email;
    if (!anonymous) {
      setDateLabel(null);
      return;
    }
    const iso =
      session.expiresAt || (session.createdAt ? anonExpiresAtIso(session.createdAt) : null);
    if (!iso) {
      setDateLabel(null);
      return;
    }
    const date = new Date(iso);
    setDateLabel(
      Number.isFinite(date.getTime())
        ? date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
        : null,
    );
  }, [locale]);

  if (!dateLabel) return null;

  return (
    <div className="border-ron-strong bg-ron/10 space-y-2 rounded-xl border-2 p-3">
      <p className="text-ink text-xs font-bold leading-snug">
        {t('account.guestExpiryBanner', { date: dateLabel })}
      </p>
      {onSave ? (
        <Button variant="volt" size="sm" fullWidth onClick={onSave}>
          {t('account.saveAccount')}
        </Button>
      ) : null}
    </div>
  );
}
