'use client';

import { Bell, CheckCircle, EnvelopeSimple, Flame, GoogleLogo, Lock } from '@phosphor-icons/react';
import { getNotificationChannelCapability } from '@ronduel/shared';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Avatar, Button, Card, Chip, Toast } from '@/components/ui';
import { getLocalSession } from '@/lib/session';

interface ProfileData {
  uid: string;
  nickname: string;
  email?: string;
  isAnonymous: boolean;
  authProvider: string;
  isAdmin: boolean;
  pro: { active: boolean; plan?: string };
  notif: {
    pushEnabled: boolean;
    emailEnabled: boolean;
    reminderLocalTime: string;
  };
  streakCurrent: number;
  streakBest: number;
  playedDates: Array<{ date: string; score: number }>;
  topicAccuracy: Array<{ topic: string; accuracyPct: number; total: number }>;
}

export default function ProfilePage() {
  const t = useTranslations();
  const locale = useLocale();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [toast, setToast] = useState('');
  const [isIosSafariTab, setIsIosSafariTab] = useState(false);

  const loadProfile = useCallback(() => {
    const s = getLocalSession();
    fetch(`/api/me/profile?uid=${encodeURIComponent(s.uid)}`)
      .then((r) => r.json())
      .then((d: ProfileData) => {
        setProfile(d);
        if (d.email) setEmailInput(d.email);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadProfile();
    const ua = navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const cap = getNotificationChannelCapability({
      isIos,
      isStandalone,
      pushSupported: 'Notification' in window,
    });
    setIsIosSafariTab(!cap.canUseWebPush && isIos);
  }, [loadProfile]);

  const handleUpgrade = async (provider: 'email_link' | 'google') => {
    const s = getLocalSession();
    const targetEmail = emailInput.trim() || (provider === 'google' ? `${s.uid}@gmail.com` : '');
    if (!targetEmail) return;

    const res = await fetch('/api/me/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: s.uid,
        email: targetEmail,
        provider,
      }),
    });
    if (res.ok) {
      loadProfile();
      setToast(t('profile.linkedBadge', { email: targetEmail }));
      setTimeout(() => setToast(''), 3000);
    }
  };

  const updateNotif = async (patch: Partial<ProfileData['notif']>) => {
    if (!profile) return;
    const next = { ...profile.notif, ...patch };
    const res = await fetch('/api/notify/prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: profile.uid,
        ...next,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setToast(data.error ?? 'Error');
      setTimeout(() => setToast(''), 3000);
      return;
    }
    setProfile({ ...profile, notif: data });
  };

  if (!profile) {
    return (
      <main className="text-muted mx-auto max-w-[480px] px-4 py-12 text-center">Loading…</main>
    );
  }

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6">
      <Card className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar nickname={profile.nickname} size="lg" />
          <div>
            <h1 className="font-display text-2xl font-extrabold">{profile.nickname}</h1>
            <p className="text-muted text-xs">
              {t('profile.bestStreak', { days: profile.streakBest })}
            </p>
          </div>
        </div>
        <Chip tone="volt">
          <Flame size={14} weight="fill" aria-hidden="true" />
          {t('result.streak', { days: profile.streakCurrent })}
        </Chip>
      </Card>

      {toast && (
        <div className="flex justify-center">
          <Toast message={toast} tone="success" />
        </div>
      )}

      {/* Account upgrade (linkWithCredential) keeping uid, streak, leagues */}
      <Card className="space-y-3">
        <h2 className="font-display text-xl font-extrabold">{t('profile.upgradeTitle')}</h2>
        {!profile.isAnonymous && profile.email ? (
          <div className="text-correct-text flex items-center gap-2 text-sm font-bold">
            <CheckCircle size={20} weight="fill" aria-hidden="true" />
            <span>{t('profile.linkedBadge', { email: profile.email })}</span>
          </div>
        ) : (
          <>
            <p className="text-muted text-xs">{t('profile.upgradeBody')}</p>
            <input
              type="email"
              aria-label="Email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder={t('profile.emailPlaceholder')}
              className="border-border bg-surface-2 text-ink min-h-12 w-full rounded-[14px] border-2 px-4 text-sm font-medium"
            />
            <div className="grid gap-2">
              <Button
                fullWidth
                size="sm"
                variant="blue"
                onClick={() => void handleUpgrade('email_link')}
              >
                <EnvelopeSimple size={18} weight="bold" aria-hidden="true" />
                {t('profile.linkEmailBtn')}
              </Button>
              <Button
                fullWidth
                size="sm"
                variant="secondary"
                onClick={() => void handleUpgrade('google')}
              >
                <GoogleLogo size={18} weight="bold" aria-hidden="true" />
                {t('profile.linkGoogleBtn')}
              </Button>
            </div>
          </>
        )}
      </Card>

      {/* Phase 4 Notifications with iOS Safari tab detection */}
      <Card className="space-y-3">
        <h2 className="font-display text-xl font-extrabold">
          <Bell size={18} weight="fill" className="mr-1.5 inline" aria-hidden="true" />
          {t('profile.notifTitle')}
        </h2>

        {isIosSafariTab ? (
          <p className="bg-surface-2 text-muted rounded-[12px] p-3 text-xs font-bold">
            {t('profile.iosSafariNotice')}
          </p>
        ) : (
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-bold">
            <span>{t('profile.pushLabel')}</span>
            <input
              type="checkbox"
              checked={profile.notif.pushEnabled}
              onChange={(e) => void updateNotif({ pushEnabled: e.target.checked })}
              className="h-5 w-5 accent-[var(--rd-blue-strong)]"
            />
          </label>
        )}

        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-bold">
          <span>{t('profile.emailLabel')}</span>
          <input
            type="checkbox"
            checked={profile.notif.emailEnabled}
            onChange={(e) => void updateNotif({ emailEnabled: e.target.checked })}
            className="h-5 w-5 accent-[var(--rd-blue-strong)]"
          />
        </label>
      </Card>

      {/* Pro Topic Accuracy */}
      <Card className="space-y-3">
        <h2 className="font-display text-xl font-extrabold">{t('profile.proStatsTitle')}</h2>
        {profile.pro.active ? (
          profile.topicAccuracy.length === 0 ? (
            <p className="text-muted text-xs">Play a round to see topic accuracy.</p>
          ) : (
            <div className="space-y-2">
              {profile.topicAccuracy.map((row) => (
                <div
                  key={row.topic}
                  className="flex items-center justify-between text-sm font-bold"
                >
                  <span className="capitalize">{row.topic}</span>
                  <span className="rd-tabular">{row.accuracyPct}%</span>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-3">
            <p className="text-muted flex items-center gap-2 text-xs">
              <Lock size={16} weight="bold" aria-hidden="true" />
              {t('profile.proStatsLocked')}
            </p>
            <Link
              href={`/${locale}/pro`}
              className="rd-sticker rd-sticker-pressable bg-volt inline-flex min-h-11 w-full items-center justify-center rounded-[14px] px-4 text-sm font-bold text-[#16131F]"
            >
              {t('brand.goProChip')}
            </Link>
          </div>
        )}
      </Card>
    </main>
  );
}
