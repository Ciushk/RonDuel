'use client';

import {
  Bell,
  BellSlash,
  CaretRight,
  CheckCircle,
  Crown,
  EnvelopeSimple,
  Flame,
  GearSix,
  GoogleLogo,
  Lock,
  PaperPlaneTilt,
  PencilSimple,
  Sword,
  Trophy,
  WarningCircle,
} from '@phosphor-icons/react';
import { getNotificationChannelCapability } from '@ronduel/shared';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AuthModal, type AuthMode } from '@/components/AuthModal';
import { CreateLeagueWizard } from '@/components/CreateLeagueWizard';
import { GuestAccountNotice } from '@/components/GuestAccountNotice';
import { usePaymentAuthGate } from '@/components/PaymentAuthGate';
import { Avatar, Button, Card, Chip, Sheet, Toast } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { getFirebaseAuth, logoutUser, updateProfile } from '@/lib/firebase';
import { linkSessionWithGoogle } from '@/lib/link-account';
import {
  disablePush,
  enablePush,
  getPermission,
  getPushPlatform,
  hasVapidKey,
  sendTestPush,
  type PushPermissionState,
} from '@/lib/push';
import { isIOS, isStandalone } from '@/lib/pwa-env';
import { clearLocalSession, getLocalSession, saveLocalSession } from '@/lib/session';

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
  freezes: number;
  lastNicknameChangeAt?: string;
  expiresAt?: string | null;
  createdAt?: string;
  duelStats?: {
    played: number;
    wins: number;
    losses: number;
    draws: number;
    bestWinStreak: number;
    currentWinStreak: number;
  };
  topRivals?: Array<{
    opponentUid: string;
    opponentNickname: string;
    wins: number;
    losses: number;
    draws: number;
    lastDuelAt: string;
    currentWinStreak: number;
  }>;
  playedDates: Array<{ date: string; score: number }>;
  topicAccuracy: Array<{ topic: string; accuracyPct: number; total: number }>;
}

function formatStreakText(
  days: number,
  locale: string,
  t: (key: string, values?: Record<string, any>) => string,
): string {
  if (locale === 'ro') {
    if (days === 1) return t('profile.streakOne');
    const mod100 = days % 100;
    if (days === 0 || (mod100 >= 2 && mod100 <= 19)) {
      return t('profile.streakFew', { days });
    }
    return t('profile.streakMany', { days });
  }
  if (days === 1) return t('profile.streakOne');
  return t('profile.streakFew', { days });
}

function AppToggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const id = `toggle-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 text-sm font-bold">
      <span id={id}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rd-blue-strong)] focus-visible:ring-offset-2 ${
          checked ? 'bg-[var(--rd-blue-strong)]' : 'border-border bg-surface-2'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

export default function ProfilePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { requireAccount } = usePaymentAuthGate();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [toast, setToast] = useState('');
  const [isIosSafariTab, setIsIosSafariTab] = useState(false);
  const [pushPerm, setPushPerm] = useState<PushPermissionState>('default');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  const [pushTestBusy, setPushTestBusy] = useState(false);
  const [pushTestSent, setPushTestSent] = useState(false);
  const [isCreateLeagueOpen, setIsCreateLeagueOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthMode>('login');
  const [freezeSheetOpen, setFreezeSheetOpen] = useState(false);
  const [buyingFreeze, setBuyingFreeze] = useState(false);
  const [nickModalOpen, setNickModalOpen] = useState(false);
  const [newNickInput, setNewNickInput] = useState('');
  const [nickError, setNickError] = useState('');
  const [nickSuggestions, setNickSuggestions] = useState<string[]>([]);
  const [nickSaving, setNickSaving] = useState(false);

  const handleOpenAuth = (mode: AuthMode) => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const executeBuyFreeze = async (pack: 'freeze_1' | 'freeze_3') => {
    const uid = getLocalSession().uid || profile?.uid;
    if (!uid) return;
    setBuyingFreeze(true);
    try {
      const res = await fetch('/api/billing/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, pack }),
      });
      if (res.ok) {
        setToast(t('profile.shieldAddedToast'));
        loadProfile();
        setFreezeSheetOpen(false);
      } else {
        setToast(t('profile.purchaseFailed'));
      }
    } catch {
      setToast(t('common.networkError'));
    } finally {
      setBuyingFreeze(false);
      setTimeout(() => setToast(''), 3000);
    }
  };

  const handleBuyFreeze = (pack: 'freeze_1' | 'freeze_3') => {
    const label = pack === 'freeze_3' ? '1,99 €' : '0,99 €';
    void requireAccount({ kind: 'shield_pack', label }, () => {
      void executeBuyFreeze(pack);
    });
  };

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
    // Immediate fallback from local session so UI renders without delay
    const s = getLocalSession();
    if (s && s.uid) {
      setProfile(
        (prev) =>
          prev ?? {
            uid: s.uid,
            nickname: s.nickname || t('profile.anonymous'),
            email: s.email,
            isAnonymous: s.isAnonymous ?? true,
            authProvider: s.authProvider ?? 'anonymous',
            isAdmin: false,
            pro: { active: false },
            notif: { pushEnabled: false, emailEnabled: false, reminderLocalTime: '20:00' },
            streakCurrent: 0,
            streakBest: 0,
            freezes: 0,
            playedDates: [],
            topicAccuracy: [],
          },
      );
      if (s.email) setEmailInput(s.email);
    }

    // Detect iOS / iPadOS non-standalone browser tab and current notification permission
    setIsIosSafariTab(isIOS() && !isStandalone());
    setPushPerm(getPermission());

    // Fetch latest profile from server
    loadProfile();
  }, [loadProfile]);

  const getNicknameCooldownDays = () => {
    if (!profile?.lastNicknameChangeAt) return 0;
    const elapsed = Date.now() - new Date(profile.lastNicknameChangeAt).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    if (elapsed < thirtyDaysMs) {
      return Math.ceil((thirtyDaysMs - elapsed) / (24 * 60 * 60 * 1000));
    }
    return 0;
  };

  const handleOpenNickModal = () => {
    setNewNickInput(profile?.nickname || '');
    setNickError('');
    setNickSuggestions([]);
    setNickModalOpen(true);
  };

  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setNickError('');
    setNickSuggestions([]);
    setNickSaving(true);
    try {
      const res = await fetch('/api/me/nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: profile.uid,
          nickname: newNickInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNickError(data.error || t('profile.nicknameChangeFailed'));
        try {
          const checkRes = await fetch('/api/me/nickname', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: profile.uid,
              nickname: newNickInput.trim(),
              checkOnly: true,
            }),
          });
          const checkData = await checkRes.json();
          if (checkData.suggestions && Array.isArray(checkData.suggestions)) {
            setNickSuggestions(checkData.suggestions);
          }
        } catch {}
        return;
      }

      const s = getLocalSession();
      saveLocalSession({ ...s, nickname: data.nickname });
      try {
        const auth = getFirebaseAuth();
        if (auth?.currentUser) {
          await updateProfile(auth.currentUser, { displayName: data.nickname });
        }
      } catch {}
      setToast(t('profile.nicknameUpdated'));
      setNickModalOpen(false);
      loadProfile();
      setTimeout(() => setToast(''), 3000);
    } catch {
      setNickError(t('common.networkError'));
    } finally {
      setNickSaving(false);
    }
  };

  const handleGoogleDirect = async () => {
    try {
      const saved = await linkSessionWithGoogle();
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              uid: saved.uid,
              email: saved.email,
              nickname: saved.nickname,
              isAnonymous: false,
              authProvider: 'google.com',
              expiresAt: null,
            }
          : null,
      );

      trackEvent('login_completed', { method: 'google' });
      setToast(t('profile.googleLinkedToast'));
      loadProfile();
      setTimeout(() => setToast(''), 3000);
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string };
      if (authErr?.code === 'auth/popup-closed-by-user') {
        setToast(t('profile.googleAuthFailed'));
      } else {
        setToast(authErr?.message || t('profile.googleAuthFailed'));
      }
      setTimeout(() => setToast(''), 3000);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    clearLocalSession();
    getLocalSession();
    trackEvent('logout_completed');
    loadProfile();
    setToast(t('profile.signedOutToast'));
    setTimeout(() => setToast(''), 3000);
  };

  const handleUpgrade = async (provider: 'email_link') => {
    const s = getLocalSession();
    const targetEmail = emailInput.trim();
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
      setToast(data.error ?? t('common.error'));
      setTimeout(() => setToast(''), 3000);
      return;
    }
    setProfile({ ...profile, notif: data });
  };

  const handlePushToggle = (val: boolean) => {
    if (!profile || pushBusy) return;
    setPushError('');
    setPushTestSent(false);
    setPushBusy(true);

    if (val) {
      // Must call enablePush synchronously in the click handler so Notification.requestPermission()
      // executes directly inside the user gesture (required by iOS Safari PWA).
      void enablePush({
        locale,
        uid: profile.uid,
        emailEnabled: profile.notif.emailEnabled,
        reminderLocalTime: profile.notif.reminderLocalTime,
      }).then((outcome) => {
        setPushBusy(false);
        setPushPerm(getPermission());
        if (outcome === 'granted') {
          setProfile((prev) =>
            prev ? { ...prev, notif: { ...prev.notif, pushEnabled: true } } : prev,
          );
        } else if (outcome === 'denied') {
          setPushPerm('denied');
        } else if (outcome === 'error' || outcome === 'unsupported') {
          setPushError(t('push.error'));
        }
      });
      return;
    }

    void disablePush({
      uid: profile.uid,
      emailEnabled: profile.notif.emailEnabled,
      reminderLocalTime: profile.notif.reminderLocalTime,
    }).then(() => {
      setPushBusy(false);
      setPushPerm(getPermission());
      setProfile((prev) =>
        prev ? { ...prev, notif: { ...prev.notif, pushEnabled: false } } : prev,
      );
    });
  };

  const handleSendTestPush = async () => {
    if (pushTestBusy) return;
    setPushTestBusy(true);
    setPushError('');
    const res = await sendTestPush(locale);
    setPushTestBusy(false);
    if (res.ok) {
      setPushTestSent(true);
    } else {
      setPushError(t('push.error'));
    }
  };

  if (!profile) {
    return (
      <main className="mx-auto flex max-w-[480px] animate-pulse flex-col gap-5 px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="bg-surface-2 h-8 w-32 rounded" />
          <div className="bg-surface-2 border-border h-10 w-10 rounded-[10px] border-2" />
        </div>
        <Card className="flex items-center gap-4 p-5">
          <div className="bg-surface-2 border-border h-16 w-16 rounded-full border-2" />
          <div className="flex-1 space-y-2">
            <div className="bg-surface-2 h-6 w-36 rounded" />
            <div className="bg-surface-2 h-4 w-24 rounded" />
          </div>
        </Card>
        <Card className="bg-surface-2/50 h-40" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6">
      {/* Top contextual bar with Settings gear icon */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-ink text-2xl font-extrabold">{t('nav.profile')}</h1>
        <Link
          href={`/${locale}/settings`}
          aria-label={t('settings.title')}
          onClick={() => trackEvent('settings_opened', { from: 'profile' })}
          className="border-border bg-surface-2 text-ink hover:bg-surface inline-flex h-10 w-10 cursor-pointer select-none items-center justify-center rounded-[10px] border-2 shadow-[2px_2px_0px_0px_var(--border-color,#16131F)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <GearSix size={20} weight="bold" />
        </Link>
      </div>

      {/* Pro Card at top of Profil */}
      {profile.pro.active ? (
        <Card
          variant="sticker"
          className="border-border bg-surface border-2 p-4 shadow-[var(--rd-shadow-key)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-volt border-border flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 text-[#16131F] shadow-sm">
                <Crown size={22} weight="fill" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-ink text-sm font-black">
                    {t('profile.proActiveForever')}
                  </span>
                  <Chip tone="volt" className="px-1 py-0 text-[10px] font-black">
                    {t('profile.proBadge')}
                  </Chip>
                </div>
                <p className="text-muted text-xs">
                  {profile.pro.plan === 'yearly'
                    ? t('profile.subscriptionYearly')
                    : t('profile.subscriptionMonthly')}
                </p>
              </div>
            </div>
            <Link href={`/${locale}/pro`}>
              <Button size="sm" variant="secondary" className="h-9 px-3 text-xs font-bold">
                {t('profile.details')}
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card
          variant="sticker"
          className="border-border bg-volt/30 space-y-2.5 border-2 p-4 shadow-[var(--rd-shadow-key)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="bg-volt border-border mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 text-[#16131F] shadow-sm">
                <Crown size={22} weight="fill" />
              </div>
              <div className="space-y-0.5">
                <span className="font-display text-ink block text-sm font-black leading-snug">
                  {t('profile.proTrialCard')}
                </span>
                <p className="text-muted text-xs">{t('profile.proPitch')}</p>
              </div>
            </div>
          </div>
          <Link href={`/${locale}/pro`} className="block pt-1">
            <Button size="sm" variant="primary" fullWidth className="h-10 text-xs font-black">
              {t('profile.activateFree')}
            </Button>
          </Link>
        </Card>
      )}

      {/* User Info Card */}
      <Card className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar nickname={profile.nickname} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2
                className="font-display max-w-[170px] truncate text-2xl font-extrabold sm:max-w-[220px]"
                title={profile.nickname}
              >
                {profile.nickname}
              </h2>
              <button
                type="button"
                onClick={handleOpenNickModal}
                aria-label={t('profile.changeNickname')}
                className="border-border bg-surface-2 text-ink hover:bg-surface inline-flex h-8 w-8 cursor-pointer select-none items-center justify-center rounded-lg border-2 shadow-sm active:translate-y-0.5"
              >
                <PencilSimple size={14} weight="bold" />
              </button>
            </div>
            <p className="text-muted truncate text-xs">
              {t('profile.bestStreak', { days: profile.streakBest })}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Chip tone="volt" className="shrink-0 whitespace-nowrap">
            <Flame size={14} weight="fill" aria-hidden="true" />
            <span>{formatStreakText(profile.streakCurrent, locale, t)}</span>
          </Chip>
          <button
            type="button"
            onClick={() => setFreezeSheetOpen(true)}
            className="border-border bg-surface-2 text-ink hover:bg-surface inline-flex cursor-pointer select-none items-center gap-1 rounded-full border-2 px-2.5 py-1 text-xs font-black shadow-[1px_1px_0px_0px_var(--border-color,#16131F)] transition-all active:translate-y-0.5"
          >
            <span>🧊 {profile.freezes ?? 0}</span>
          </button>
        </div>
      </Card>

      {/* Prominent Action Button: Leaderboards under name */}
      <Link href={`/${locale}/leagues?tab=leaderboard`} className="block">
        <Button
          fullWidth
          size="md"
          variant="volt"
          className="flex h-12 items-center justify-center gap-2 font-black text-[#16131F] shadow-[2px_2px_0px_0px_var(--border-color,#16131F)]"
        >
          <Trophy size={20} weight="fill" className="text-[#16131F]" />
          <span className="text-sm font-black">{t('common.leaderboards')}</span>
        </Button>
      </Link>

      {toast && (
        <div className="flex justify-center">
          <Toast message={toast} tone="success" />
        </div>
      )}

      {/* Account Authentication & Linking */}
      <Card className="border-border space-y-3.5 border-2 p-4 shadow-[var(--rd-shadow-key)]">
        <div>
          <h2 className="font-display text-ink text-xl font-extrabold">
            {!profile.isAnonymous && profile.email
              ? t('profile.accountTitleLinked')
              : t('profile.accountTitleAnon')}
          </h2>
          <p className="text-muted mt-0.5 text-xs font-medium leading-relaxed">
            {!profile.isAnonymous && profile.email
              ? t('profile.accountLinkedBody')
              : t('profile.accountAnonBody')}
          </p>
        </div>

        {!profile.isAnonymous && profile.email ? (
          <div className="space-y-3 pt-1">
            <div className="border-correct/40 bg-correct/10 flex items-center justify-between rounded-xl border-2 p-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <CheckCircle size={22} weight="fill" className="text-correct shrink-0" />
                <div className="min-w-0">
                  <span className="text-ink block truncate text-xs font-extrabold">
                    {profile.email}
                  </span>
                  <span className="text-muted text-[10px] font-bold uppercase tracking-wider">
                    {profile.authProvider === 'google' || profile.authProvider === 'google.com'
                      ? t('profile.signedInGoogle')
                      : t('profile.signedInEmail')}
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onClick={() => void handleLogout()}
              className="text-xs font-bold"
            >
              {t('profile.signOut')}
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5 pt-1">
            <GuestAccountNotice onSave={() => handleOpenAuth('signup')} />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="volt"
                size="md"
                onClick={() => handleOpenAuth('login')}
                className="h-11 text-xs font-black shadow-sm"
              >
                {t('auth.loginButton')}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => handleOpenAuth('signup')}
                className="h-11 text-xs font-black shadow-sm"
              >
                {t('account.createAccountBtn')}
              </Button>
            </div>

            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => void handleGoogleDirect()}
              className="flex h-11 items-center justify-center gap-2 text-xs font-bold"
            >
              <GoogleLogo size={18} weight="bold" />
              <span>{t('auth.continueWithGoogle')}</span>
            </Button>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => handleOpenAuth('forgot')}
                className="text-muted hover:text-ink cursor-pointer text-xs font-bold hover:underline"
              >
                {t('auth.forgotPasswordLink')}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Leagues creation */}
      <Card className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-extrabold">{t('league.createTitle')}</h2>
          <p className="text-muted text-xs">{t('league.aloneSubtitle')}</p>
        </div>
        <Button
          variant="volt"
          size="sm"
          className="shrink-0"
          onClick={() => setIsCreateLeagueOpen(true)}
        >
          {t('profile.createLeagueBtn')}
        </Button>
      </Card>

      <CreateLeagueWizard
        open={isCreateLeagueOpen}
        onClose={() => setIsCreateLeagueOpen(false)}
        onCreated={(league) => {
          router.push(`/${locale}/league/${league.id ?? league.leagueId}`);
        }}
      />

      {/* Phase 4 Notifications with iOS Safari tab detection and real Web Push opt-in */}
      <Card className="space-y-3">
        <h2 className="font-display text-xl font-extrabold">
          <Bell size={18} weight="fill" className="mr-1.5 inline" aria-hidden="true" />
          {t('profile.notifTitle')}
        </h2>

        {isIosSafariTab ? (
          <p className="border-border bg-surface-2 text-muted rounded-[12px] border p-3 text-xs font-bold">
            {t('profile.iosSafariNotice')}
          </p>
        ) : (
          <div className="space-y-2">
            <AppToggle
              label={t('profile.pushLabel')}
              checked={profile.notif.pushEnabled && pushPerm === 'granted'}
              disabled={
                pushBusy || pushPerm === 'denied' || pushPerm === 'unsupported' || !hasVapidKey()
              }
              onChange={handlePushToggle}
            />

            {pushPerm === 'denied' && (
              <div
                role="status"
                data-testid="profile-push-blocked"
                className="border-border-subtle bg-surface-2 flex items-start gap-2 rounded-xl border p-3 text-xs"
              >
                <BellSlash
                  size={18}
                  weight="fill"
                  aria-hidden="true"
                  className="text-wrong mt-0.5 shrink-0"
                />
                <div className="space-y-0.5">
                  <p className="text-ink font-extrabold">{t('push.blocked')}</p>
                  <p className="text-muted font-semibold leading-snug">
                    {t(
                      getPushPlatform() === 'android'
                        ? 'push.blockedHelpAndroid'
                        : getPushPlatform() === 'ios'
                          ? 'push.blockedHelpIos'
                          : 'push.blockedHelpDesktop',
                    )}
                  </p>
                </div>
              </div>
            )}

            {profile.notif.pushEnabled && pushPerm === 'granted' && (
              <div className="space-y-1.5">
                <button
                  type="button"
                  disabled={pushTestBusy}
                  onClick={() => void handleSendTestPush()}
                  data-testid="profile-send-test-btn"
                  className="text-duel-strong hover:text-ink inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-xs font-extrabold underline underline-offset-4 disabled:opacity-50"
                >
                  <PaperPlaneTilt size={15} weight="bold" aria-hidden="true" />
                  <span>{t('push.sendTest')}</span>
                </button>
                {pushTestSent && (
                  <p
                    role="status"
                    data-testid="profile-test-sent-msg"
                    className="text-correct-text flex items-center gap-1.5 text-xs font-bold"
                  >
                    <CheckCircle size={15} weight="fill" aria-hidden="true" className="shrink-0" />
                    <span>{t('push.testSent')}</span>
                  </p>
                )}
              </div>
            )}

            {pushError && (
              <p role="status" className="text-wrong flex items-center gap-1.5 text-xs font-bold">
                <WarningCircle size={15} weight="fill" aria-hidden="true" className="shrink-0" />
                <span>{pushError}</span>
              </p>
            )}
          </div>
        )}

        <AppToggle
          label={t('profile.emailLabel')}
          checked={profile.notif.emailEnabled}
          onChange={(val) => void updateNotif({ emailEnabled: val })}
        />
      </Card>

      {/* Pro Topic Accuracy */}
      <Card className="space-y-3">
        <h2 className="font-display text-xl font-extrabold">{t('profile.proStatsTitle')}</h2>
        {profile.pro.active ? (
          profile.topicAccuracy.length === 0 ? (
            <p className="text-muted text-xs">{t('profile.topicAccuracyEmpty')}</p>
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

      {/* Dueluri 1v1 Card */}
      <Card className="border-border space-y-3.5 border-2 p-4 shadow-[var(--rd-shadow-key)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sword size={22} weight="bold" className="text-volt-strong shrink-0" />
            <h2 className="font-display text-ink text-xl font-extrabold">
              {t('profile.duelRecordTitle')}
            </h2>
          </div>
          <Link href={`/${locale}/duels`}>
            <Button size="sm" variant="secondary" className="h-8 px-2.5 text-xs font-bold">
              {t('profile.viewDuels')}
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="border-border bg-surface-2 rounded-xl border p-2.5">
            <span className="text-muted block text-[10px] font-bold uppercase">
              {t('profile.duelsPlayed')}
            </span>
            <span className="rd-tabular font-display text-ink text-lg font-extrabold">
              {profile.duelStats?.played ?? 0}
            </span>
          </div>
          <div className="border-border bg-surface-2 rounded-xl border p-2.5">
            <span className="text-correct block text-[10px] font-bold uppercase">
              {t('profile.duelsWon')}
            </span>
            <span className="rd-tabular font-display text-ink text-lg font-extrabold">
              {profile.duelStats?.wins ?? 0}
            </span>
          </div>
          <div className="border-border bg-surface-2 rounded-xl border p-2.5">
            <span className="text-wrong block text-[10px] font-bold uppercase">
              {t('profile.duelsLost')}
            </span>
            <span className="rd-tabular font-display text-ink text-lg font-extrabold">
              {profile.duelStats?.losses ?? 0}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-0.5 text-center">
          <div className="border-border bg-surface-2 rounded-xl border p-2.5">
            <span className="text-muted block text-[10px] font-bold uppercase">
              {t('profile.winRate')}
            </span>
            <span className="rd-tabular font-display text-ink text-base font-extrabold">
              {Math.round(
                ((profile.duelStats?.wins ?? 0) / (profile.duelStats?.played || 1)) * 100,
              )}
              %
            </span>
          </div>
          <div className="border-border bg-surface-2 rounded-xl border p-2.5">
            <span className="text-muted block text-[10px] font-bold uppercase">
              {t('profile.bestWinStreak')}
            </span>
            <span className="rd-tabular font-display text-ink flex items-center justify-center gap-1 text-base font-extrabold">
              🔥 {profile.duelStats?.bestWinStreak ?? 0}
            </span>
          </div>
        </div>

        {/* Top 3 Rivali */}
        {profile.topRivals && profile.topRivals.length > 0 && (
          <div className="border-border-subtle space-y-2 border-t pt-2">
            <h3 className="text-muted text-xs font-black uppercase tracking-wider">
              {t('profile.topRivals')}
            </h3>
            <div className="space-y-1.5">
              {profile.topRivals.map((rival) => (
                <div
                  key={rival.opponentUid}
                  className="border-border bg-surface flex items-center justify-between rounded-xl border p-2.5 text-xs font-bold"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar nickname={rival.opponentNickname} size="sm" />
                    <span className="text-ink truncate">{rival.opponentNickname}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-muted rd-tabular">
                      {rival.wins}
                      {t('profile.duelsWon').slice(0, 1).toUpperCase()} – {rival.losses}
                      {t('profile.duelsLost').slice(0, 1).toUpperCase()}
                    </span>
                    {rival.currentWinStreak >= 3 && (
                      <span className="text-ron-strong text-[11px] font-black">
                        🔥 {rival.currentWinStreak}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Row "Settings" */}
      <Link
        href={`/${locale}/settings`}
        onClick={() => trackEvent('settings_opened', { from: 'profile' })}
        className="border-border bg-surface text-ink hover:border-border-subtle flex select-none items-center justify-between gap-3 rounded-2xl border-2 p-4 shadow-[var(--rd-shadow-key)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
      >
        <div className="flex items-center gap-3">
          <div className="border-border bg-surface-2 text-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 shadow-sm">
            <GearSix size={22} weight="bold" />
          </div>
          <div>
            <span className="font-display text-ink block text-sm font-extrabold">
              {t('profile.settingsRow')}
            </span>
            <p className="text-muted text-xs">{t('profile.settingsHint')}</p>
          </div>
        </div>
        <CaretRight size={20} weight="bold" className="text-muted shrink-0" />
      </Link>

      {/* Streak Freeze Explanation & Store Sheet */}
      <Sheet
        open={freezeSheetOpen}
        onClose={() => setFreezeSheetOpen(false)}
        title={t('profile.shieldsTitle')}
      >
        <div className="space-y-4">
          <div className="text-ink/90 space-y-2 text-xs font-medium leading-relaxed">
            <p>{t('profile.shieldsIntro')}</p>
            <p>{t.rich('profile.shieldsHow', { b: (chunks) => <strong>{chunks}</strong> })}</p>
            <p className="text-muted">
              {t.rich('profile.shieldsInventory', {
                max: 5,
                count: `${profile.freezes ?? 0}/5`,
                b: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <div className="border-border bg-surface-2 flex items-center justify-between rounded-xl border-2 p-3">
              <div>
                <p className="text-ink text-sm font-extrabold">{t('profile.shieldOneTitle')}</p>
                <p className="text-muted text-[11px] font-bold">{t('profile.shieldOneBody')}</p>
              </div>
              <Button
                size="sm"
                variant="volt"
                disabled={buyingFreeze || (profile.freezes ?? 0) >= 5}
                onClick={() => void handleBuyFreeze('freeze_1')}
                className="h-9 px-3 text-xs font-black"
              >
                0,99 €
              </Button>
            </div>

            <div className="border-volt bg-volt/20 relative flex items-center justify-between rounded-xl border-2 p-3">
              <span className="bg-ron-strong border-border absolute -top-2.5 right-3 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase text-white">
                {t('profile.bestPrice')}
              </span>
              <div>
                <p className="text-ink text-sm font-extrabold">{t('profile.shieldThreeTitle')}</p>
                <p className="text-muted text-[11px] font-bold">
                  {t('profile.savePercent', { percent: 33 })}
                </p>
              </div>
              <Button
                size="sm"
                variant="volt"
                disabled={buyingFreeze || (profile.freezes ?? 0) >= 5}
                onClick={() => void handleBuyFreeze('freeze_3')}
                className="h-9 px-3 text-xs font-black"
              >
                1,99 €
              </Button>
            </div>
          </div>

          {!profile.pro.active && (
            <div className="border-border bg-surface space-y-1.5 rounded-xl border p-3 pt-2 text-center">
              <p className="text-ink text-xs font-bold">{t('profile.shieldsProQuestion')}</p>
              <p className="text-muted text-[11px]">{t('profile.shieldsProBody')}</p>
              <Link href={`/${locale}/pro`} onClick={() => setFreezeSheetOpen(false)}>
                <Button
                  size="sm"
                  variant="primary"
                  fullWidth
                  className="mt-1 h-9 text-xs font-black"
                >
                  {t('common.goPro')}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </Sheet>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onSuccess={(user) => {
          loadProfile();
          setToast(t('profile.linkedBadge', { email: user.email }));
          setTimeout(() => setToast(''), 3000);
        }}
      />

      {/* Edit Nickname Sheet with Uniqueness Check and 30-day Cooldown */}
      <Sheet
        open={nickModalOpen}
        onClose={() => setNickModalOpen(false)}
        title={t('profile.changeNickname')}
      >
        <form onSubmit={handleSaveNickname} className="space-y-4 pt-1">
          {getNicknameCooldownDays() > 0 ? (
            <div className="border-ron-strong bg-ron/10 space-y-1 rounded-xl border-2 p-3">
              <p className="text-ron-strong text-xs font-black">
                {t('profile.nicknameCooldownTitle')}
              </p>
              <p className="text-ink/80 text-[11px] font-bold leading-snug">
                {t('profile.nicknameCooldownBody', {
                  days: t('common.daysCount', { count: getNicknameCooldownDays() }),
                })}
              </p>
            </div>
          ) : (
            <p className="text-muted text-xs font-medium leading-relaxed">
              {t('profile.nicknameIntro')}
            </p>
          )}

          <div>
            <label className="text-muted mb-1 block text-xs font-bold">
              {t('profile.nicknameNewLabel')}
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={20}
              value={newNickInput}
              disabled={getNicknameCooldownDays() > 0}
              onChange={(e) => {
                setNewNickInput(e.target.value);
                setNickError('');
              }}
              className="border-border bg-surface-2 text-ink min-h-12 w-full rounded-xl border-2 px-3.5 py-2.5 text-base font-bold disabled:opacity-50"
            />
          </div>

          {nickError && <p className="text-wrong text-xs font-bold leading-snug">{nickError}</p>}

          {nickSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-muted text-[11px] font-bold">
                {t('profile.nicknameSuggestions')}
              </span>
              {nickSuggestions.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => {
                    setNewNickInput(sug);
                    setNickSuggestions([]);
                    setNickError('');
                  }}
                  className="border-border bg-surface text-ink hover:bg-volt cursor-pointer rounded-lg border-2 px-2.5 py-1 text-xs font-bold shadow-sm active:translate-y-0.5"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setNickModalOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="volt"
              fullWidth
              disabled={nickSaving || getNicknameCooldownDays() > 0}
            >
              {nickSaving ? t('common.saving') : t('profile.nicknameSave')}
            </Button>
          </div>
        </form>
      </Sheet>
    </main>
  );
}
