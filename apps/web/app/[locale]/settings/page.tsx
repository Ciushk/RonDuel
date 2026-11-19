'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button, Card, Toast } from '@/components/ui';
import {
  clearLocalSession,
  getLocalSession,
  saveLocalSession,
  type LocalSession,
} from '@/lib/session';

export default function SettingsPage() {
  const t = useTranslations();
  const [session, setSession] = useState<LocalSession | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    setSession(getLocalSession());
  }, []);

  if (!session) return null;

  const update = (patch: Partial<LocalSession>) => {
    const next = { ...session, ...patch };
    saveLocalSession(next);
    setSession(next);
    if (patch.theme) {
      document.documentElement.setAttribute('data-theme', patch.theme);
    }
  };

  const handleExport = async () => {
    const res = await fetch(`/api/me/export?uid=${encodeURIComponent(session.uid)}`);
    const json = await res.json();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ronduel-data-${session.uid}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    await fetch('/api/me/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: session.uid }),
    });
    clearLocalSession();
    setSession(getLocalSession());
    setToast(t('settings.deleted'));
  };

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6">
      <h1 className="font-display text-3xl font-extrabold">{t('settings.title')}</h1>

      <Card className="space-y-4">
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm font-bold">
          <span>{t('settings.theme')}</span>
          <select
            aria-label={t('settings.theme')}
            value={session.theme}
            onChange={(e) => update({ theme: e.target.value as LocalSession['theme'] })}
            className="border-border-subtle bg-surface-2 text-ink min-h-11 rounded-[10px] border px-3 text-xs font-bold"
          >
            <option value="light">Light (Cream Paper)</option>
            <option value="dark">Dark (Ink Night)</option>
            <option value="high-contrast">High Contrast</option>
            <option value="midnight-court">Pro: Midnight Court</option>
            <option value="clay-court">Pro: Clay Court</option>
            <option value="neon-arcade">Pro: Neon Arcade</option>
          </select>
        </label>

        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-bold">
          <span>{t('settings.relaxedTimer')}</span>
          <input
            type="checkbox"
            checked={session.relaxedTimer}
            onChange={(e) => update({ relaxedTimer: e.target.checked })}
            className="h-5 w-5 accent-[var(--rd-blue-strong)]"
          />
        </label>

        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-bold">
          <span>{t('settings.analyticsConsent')}</span>
          <input
            type="checkbox"
            checked={session.analyticsConsent === 'accepted'}
            onChange={(e) =>
              update({ analyticsConsent: e.target.checked ? 'accepted' : 'rejected' })
            }
            className="h-5 w-5 accent-[var(--rd-blue-strong)]"
          />
        </label>

        <div className="border-border-subtle space-y-2 border-t pt-4">
          <Button fullWidth variant="secondary" onClick={() => void handleExport()}>
            {t('settings.exportData')}
          </Button>
          <Button fullWidth variant="danger" onClick={() => void handleDelete()}>
            {t('settings.deleteAccount')}
          </Button>
        </div>
      </Card>

      {toast && <Toast message={toast} tone="info" />}
    </main>
  );
}
