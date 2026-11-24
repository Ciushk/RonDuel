'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Sheet } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { getLocalSession } from '@/lib/session';

interface JoinByCodeDialogProps {
  open: boolean;
  onClose: () => void;
}

export function JoinByCodeDialog({ open, onClose }: JoinByCodeDialogProps) {
  const t = useTranslations('splash');
  const tCommon = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 6 characters, case-insensitive, auto-uppercase, strip links/whitespace
    let val = e.target.value.trim().toUpperCase();
    if (val.includes('/L/')) {
      val = val.split('/L/').pop()?.split(/[?#/]/)[0] ?? val;
    }
    val = val.replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(val);
    setError('');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length < 6) {
      setError(t('codeNotFound'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      const session = getLocalSession();
      const res = await fetch(
        `/api/leagues/${encodeURIComponent(cleanCode)}?uid=${encodeURIComponent(session.uid)}`,
      );
      if (res.status === 404) {
        setError(t('codeNotFound'));
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? t('codeNotFound'));
        return;
      }

      const league = await res.json();
      if (league.memberCount >= league.maxMembers && !league.isMember) {
        setError(t('leagueFull'));
        return;
      }

      trackEvent('league_preview_viewed', { source: 'code', code: cleanCode });
      onClose();
      router.push(`/${locale}/l/${encodeURIComponent(cleanCode)}?src=code`);
    } catch {
      setError(t('codeNotFound'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('joinByCodeTitle')}>
      <form onSubmit={handleSearch} className="space-y-4">
        <div>
          <label htmlFor="league-code-input" className="text-muted mb-1 block text-xs font-bold">
            {t('codeLabel')}
          </label>
          <input
            id="league-code-input"
            type="text"
            required
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck="false"
            maxLength={6}
            value={code}
            onChange={handleChange}
            placeholder={t('codePlaceholder')}
            className="border-border bg-surface-2 text-ink rd-tabular w-full rounded-xl border-2 px-4 py-3 text-center text-xl font-extrabold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-[var(--rd-blue-strong)]"
          />
        </div>

        {error && <p className="text-wrong text-xs font-bold">{error}</p>}

        <p className="text-muted text-xs font-medium">{t('linkHint')}</p>

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" fullWidth onClick={onClose} type="button">
            {tCommon('common.cancel')}
          </Button>
          <Button variant="primary" fullWidth type="submit" disabled={code.length < 6 || loading}>
            {loading ? '...' : t('searchBtn')}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
