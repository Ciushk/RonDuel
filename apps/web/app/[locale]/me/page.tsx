'use client';

import {
  Bell,
  CaretRight,
  CheckCircle,
  Crown,
  EnvelopeSimple,
  Flame,
  GearSix,
  GoogleLogo,
  Lock,
  PencilSimple,
  Sword,
  Trophy,
} from '@phosphor-icons/react';
import { getNotificationChannelCapability } from '@ronduel/shared';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AuthModal, type AuthMode } from '@/components/AuthModal';
import { CreateLeagueWizard } from '@/components/CreateLeagueWizard';
import { Avatar, Button, Card, Chip, Sheet, Toast } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { loginWithGoogle, logoutUser } from '@/lib/firebase';
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
  t: (key: string, values?: Record<string, any>) => string
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

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [toast, setToast] = useState('');
  const [isIosSafariTab, setIsIosSafariTab] = useState(false);
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

  const handleBuyFreeze = async (pack: 'freeze_1' | 'freeze_3') => {
    if (!profile) return;
    setBuyingFreeze(true);
    try {
      const res = await fetch('/api/billing/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: profile.uid, pack }),
      });
      if (res.ok) {
        setToast('Scut adăugat cu succes! ✓');
        loadProfile();
        setFreezeSheetOpen(false);
      } else {
        setToast('Achiziția nu a putut fi procesată.');
      }
    } catch {
      setToast('Eroare de rețea.');
    } finally {
      setBuyingFreeze(false);
      setTimeout(() => setToast(''), 3000);
    }
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
      setProfile((prev) => prev ?? {
        uid: s.uid,
        nickname: s.nickname || 'Anonim',
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
      });
      if (s.email) setEmailInput(s.email);
    }

    // Detect iOS Safari standalone tab
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      setIsIosSafariTab(isIos && !isStandalone);
    }

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
        setNickError(data.error || 'Nu s-a putut schimba porecla');
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
      setToast('Poreclă actualizată cu succes ✓');
      setNickModalOpen(false);
      loadProfile();
      setTimeout(() => setToast(''), 3000);
    } catch {
      setNickError('Eroare de rețea');
    } finally {
      setNickSaving(false);
    }
  };

  const handleGoogleDirect = async () => {
    try {
      const user = await loginWithGoogle();
      if (!user.email) {
        setToast('Contul Google nu are o adresă de email asociată.');
        setTimeout(() => setToast(''), 3000);
        return;
      }
      const s = getLocalSession();
      const userNick = user.displayName || s.nickname;

      const res = await fetch('/api/me/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: s.uid,
          email: user.email,
          nickname: userNick,
          provider: 'google',
          confirmMerge: true,
        }),
      });
      const data = await res.json().catch(() => ({}));

      saveLocalSession({
        ...s,
        uid: data.uid || user.uid,
        email: data.email || user.email,
        nickname: data.nickname || userNick,
        isAnonymous: false,
        authProvider: 'google',
      });

      trackEvent('login_completed', { method: 'google' });
      setToast('Conectat cu Google cu succes! ✓');
      loadProfile();
      setTimeout(() => setToast(''), 3000);
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string };
      if (authErr?.code === 'auth/popup-closed-by-user') {
        setToast('Fereastra de conectare Google a fost închisă.');
      } else {
        setToast(authErr?.message || 'Autentificarea Google a fost anulată sau a eșuat.');
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
    setToast('Te-ai deconectat cu succes.');
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
      setToast(data.error ?? 'Error');
      setTimeout(() => setToast(''), 3000);
      return;
    }
    setProfile({ ...profile, notif: data });
  };

  if (!profile) {
    return (
      <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-8 w-32 rounded bg-surface-2" />
          <div className="h-10 w-10 rounded-[10px] bg-surface-2 border-2 border-border" />
        </div>
        <Card className="flex items-center gap-4 p-5">
          <div className="h-16 w-16 rounded-full bg-surface-2 border-2 border-border" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-36 rounded bg-surface-2" />
            <div className="h-4 w-24 rounded bg-surface-2" />
          </div>
        </Card>
        <Card className="h-40 bg-surface-2/50" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6">
      {/* Top contextual bar with Settings gear icon */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold text-ink">{t('nav.profile')}</h1>
        <Link
          href={`/${locale}/settings`}
          aria-label={t('settings.title')}
          onClick={() => trackEvent('settings_opened', { from: 'profile' })}
          className="border-2 border-border bg-surface-2 text-ink hover:bg-surface active:translate-x-[2px] active:translate-y-[2px] active:shadow-none inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] shadow-[2px_2px_0px_0px_var(--border-color,#16131F)] transition-all select-none"
        >
          <GearSix size={20} weight="bold" />
        </Link>
      </div>

      {/* Pro Card at top of Profil */}
      {profile.pro.active ? (
        <Card variant="sticker" className="border-2 border-border bg-surface p-4 shadow-[var(--rd-shadow-key)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-volt border-2 border-border text-[#16131F] shadow-sm">
                <Crown size={22} weight="fill" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-black text-sm text-ink">
                    {t('profile.proActiveForever')}
                  </span>
                  <Chip tone="volt" className="text-[10px] py-0 px-1 font-black">
                    PRO
                  </Chip>
                </div>
                <p className="text-muted text-xs">
                  {profile.pro.plan === 'yearly' ? 'Abonament anual activ' : 'Abonament lunar activ'}
                </p>
              </div>
            </div>
            <Link href={`/${locale}/pro`}>
              <Button size="sm" variant="secondary" className="h-9 px-3 text-xs font-bold">
                Detalii
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card variant="sticker" className="border-2 border-border bg-volt/30 p-4 shadow-[var(--rd-shadow-key)] space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-volt border-2 border-border text-[#16131F] shadow-sm mt-0.5">
                <Crown size={22} weight="fill" />
              </div>
              <div className="space-y-0.5">
                <span className="font-display font-black text-sm text-ink block leading-snug">
                  {t('profile.proTrialCard')}
                </span>
                <p className="text-muted text-xs">
                  Ligi mari de 200 membri, dueluri nelimitate & scut serie
                </p>
              </div>
            </div>
          </div>
          <Link href={`/${locale}/pro`} className="block pt-1">
            <Button size="sm" variant="primary" fullWidth className="h-10 text-xs font-black">
              Activează gratuit
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
                aria-label="Schimbă porecla"
                className="border-2 border-border bg-surface-2 text-ink hover:bg-surface active:translate-y-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg shadow-sm cursor-pointer select-none"
              >
                <PencilSimple size={14} weight="bold" />
              </button>
            </div>
            <p className="text-muted truncate text-xs">
              {t('profile.bestStreak', { days: profile.streakBest })}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Chip tone="volt" className="shrink-0 whitespace-nowrap">
            <Flame size={14} weight="fill" aria-hidden="true" />
            <span>{formatStreakText(profile.streakCurrent, locale, t)}</span>
          </Chip>
          <button
            type="button"
            onClick={() => setFreezeSheetOpen(true)}
            className="border-2 border-border bg-surface-2 text-ink hover:bg-surface active:translate-y-0.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black shadow-[1px_1px_0px_0px_var(--border-color,#16131F)] transition-all cursor-pointer select-none"
          >
            <span>🧊 {profile.freezes ?? 0} {profile.freezes === 1 ? 'scut' : 'scuturi'}</span>
          </button>
        </div>
      </Card>

      {/* Prominent Action Button: Clasamente sub nume */}
      <Link href={`/${locale}/leagues?tab=leaderboard`} className="block">
        <Button
          fullWidth
          size="md"
          variant="volt"
          className="h-12 font-black flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_var(--border-color,#16131F)] text-[#16131F]"
        >
          <Trophy size={20} weight="fill" className="text-[#16131F]" />
          <span className="text-sm font-black">Clasamente</span>
        </Button>
      </Link>

      {toast && (
        <div className="flex justify-center">
          <Toast message={toast} tone="success" />
        </div>
      )}

      {/* Account Authentication & Linking */}
      <Card className="space-y-3.5 border-2 border-border p-4 shadow-[var(--rd-shadow-key)]">
        <div>
          <h2 className="font-display text-xl font-extrabold text-ink">
            {!profile.isAnonymous && profile.email ? 'Contul tău' : 'Cont & Salvare Progres'}
          </h2>
          <p className="text-muted text-xs font-medium leading-relaxed mt-0.5">
            {!profile.isAnonymous && profile.email
              ? 'Progresul, seria și ligile tale sunt salvate pe acest cont securizat.'
              : 'Loghează-te cu email și parolă sau Google pentru a-ți păstra seria și a apărea în clasamentul global.'}
          </p>
        </div>

        {!profile.isAnonymous && profile.email ? (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between rounded-xl border-2 border-correct/40 bg-correct/10 p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle size={22} weight="fill" className="text-correct shrink-0" />
                <div className="min-w-0">
                  <span className="font-extrabold text-xs text-ink truncate block">
                    {profile.email}
                  </span>
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
                    {profile.authProvider === 'google' ? 'Autentificat cu Google' : 'Autentificat cu Email & Parolă'}
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
              Deconectează-te
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="volt"
                size="md"
                onClick={() => handleOpenAuth('login')}
                className="font-black text-xs h-11 shadow-sm"
              >
                Loghează-te
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => handleOpenAuth('signup')}
                className="font-black text-xs h-11 shadow-sm"
              >
                Creează cont
              </Button>
            </div>

            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => void handleGoogleDirect()}
              className="font-bold text-xs h-11 flex items-center justify-center gap-2"
            >
              <GoogleLogo size={18} weight="bold" />
              <span>Continuă cu Google</span>
            </Button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => handleOpenAuth('forgot')}
                className="text-xs font-bold text-muted hover:text-ink cursor-pointer hover:underline"
              >
                Am uitat parola?
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

      {/* Phase 4 Notifications with iOS Safari tab detection */}
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
          <AppToggle
            label={t('profile.pushLabel')}
            checked={profile.notif.pushEnabled}
            onChange={(val) => void updateNotif({ pushEnabled: val })}
          />
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

      {/* Dueluri 1v1 Card */}
      <Card className="space-y-3.5 border-2 border-border p-4 shadow-[var(--rd-shadow-key)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sword size={22} weight="bold" className="text-volt-strong shrink-0" />
            <h2 className="font-display text-xl font-extrabold text-ink">Bilanț Dueluri 1v1</h2>
          </div>
          <Link href={`/${locale}/duels`}>
            <Button size="sm" variant="secondary" className="h-8 px-2.5 text-xs font-bold">
              Vezi dueluri
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-border bg-surface-2 p-2.5">
            <span className="text-[10px] font-bold uppercase text-muted block">Jucate</span>
            <span className="rd-tabular font-display text-lg font-extrabold text-ink">
              {profile.duelStats?.played ?? 0}
            </span>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-2.5">
            <span className="text-[10px] font-bold uppercase text-correct block">Victorii</span>
            <span className="rd-tabular font-display text-lg font-extrabold text-ink">
              {profile.duelStats?.wins ?? 0}
            </span>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-2.5">
            <span className="text-[10px] font-bold uppercase text-wrong block">Înfrângeri</span>
            <span className="rd-tabular font-display text-lg font-extrabold text-ink">
              {profile.duelStats?.losses ?? 0}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center pt-0.5">
          <div className="rounded-xl border border-border bg-surface-2 p-2.5">
            <span className="text-[10px] font-bold uppercase text-muted block">Rată de victorie</span>
            <span className="rd-tabular font-display text-base font-extrabold text-ink">
              {Math.round(((profile.duelStats?.wins ?? 0) / (profile.duelStats?.played || 1)) * 100)}%
            </span>
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-2.5">
            <span className="text-[10px] font-bold uppercase text-muted block">Cea mai bună serie</span>
            <span className="rd-tabular font-display text-base font-extrabold text-ink flex items-center justify-center gap-1">
              🔥 {profile.duelStats?.bestWinStreak ?? 0}
            </span>
          </div>
        </div>

        {/* Top 3 Rivali */}
        {profile.topRivals && profile.topRivals.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border-subtle">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted">
              Top Rivali
            </h3>
            <div className="space-y-1.5">
              {profile.topRivals.map((rival) => (
                <div
                  key={rival.opponentUid}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface p-2.5 text-xs font-bold"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar nickname={rival.opponentNickname} size="sm" />
                    <span className="truncate text-ink">{rival.opponentNickname}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-muted rd-tabular">
                      {rival.wins}V – {rival.losses}Î
                    </span>
                    {rival.currentWinStreak >= 3 && (
                      <span className="text-ron-strong font-black text-[11px]">
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

      {/* Row "Setări" */}
      <Link
        href={`/${locale}/settings`}
        onClick={() => trackEvent('settings_opened', { from: 'profile' })}
        className="border-2 border-border bg-surface text-ink hover:border-border-subtle active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-between gap-3 rounded-2xl p-4 shadow-[var(--rd-shadow-key)] transition-all select-none"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-border bg-surface-2 text-ink shadow-sm">
            <GearSix size={22} weight="bold" />
          </div>
          <div>
            <span className="font-display font-extrabold text-sm text-ink block">{t('profile.settingsRow')}</span>
            <p className="text-muted text-xs">Temă, limbă, cronometru relaxat, export date</p>
          </div>
        </div>
        <CaretRight size={20} weight="bold" className="text-muted shrink-0" />
      </Link>

      {/* Streak Freeze Explanation & Store Sheet */}
      <Sheet
        open={freezeSheetOpen}
        onClose={() => setFreezeSheetOpen(false)}
        title="Scuturi de Serie (Streak Freeze)"
      >
        <div className="space-y-4">
          <div className="space-y-2 text-xs font-medium text-ink/90 leading-relaxed">
            <p>
              Scuturile te protejează automat când uiți sau nu ai timp să joci runda zilnică.
            </p>
            <p>
              Dacă la miezul nopții nu ai jucat, un scut este <strong>consumat automat</strong>, iar seria ta de zile (streak) rămâne intactă!
            </p>
            <p className="text-muted">
              Poți deține maximum <strong>5 scuturi</strong> în inventar. Ai acum: <strong>{profile.freezes ?? 0}/5 scuturi</strong>.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between p-3 rounded-xl border-2 border-border bg-surface-2">
              <div>
                <p className="font-extrabold text-sm text-ink">1 Scut de Serie</p>
                <p className="text-[11px] text-muted font-bold">Protecție pentru o zi omisă</p>
              </div>
              <Button
                size="sm"
                variant="volt"
                disabled={buyingFreeze || (profile.freezes ?? 0) >= 5}
                onClick={() => void handleBuyFreeze('freeze_1')}
                className="font-black text-xs h-9 px-3"
              >
                0,99 €
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border-2 border-volt bg-volt/20 relative">
              <span className="absolute -top-2.5 right-3 bg-ron-strong text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-border">
                Cel mai bun preț
              </span>
              <div>
                <p className="font-extrabold text-sm text-ink">3 Scuturi de Serie</p>
                <p className="text-[11px] text-muted font-bold">Economisești 33%</p>
              </div>
              <Button
                size="sm"
                variant="volt"
                disabled={buyingFreeze || (profile.freezes ?? 0) >= 5}
                onClick={() => void handleBuyFreeze('freeze_3')}
                className="font-black text-xs h-9 px-3"
              >
                1,99 €
              </Button>
            </div>
          </div>

          {!profile.pro.active && (
            <div className="p-3 rounded-xl border border-border bg-surface text-center space-y-1.5 pt-2">
              <p className="text-xs font-bold text-ink">
                Vrei scuturi incluse în fiecare lună?
              </p>
              <p className="text-[11px] text-muted">
                Abonații RonDuel Pro primesc automat 2 scuturi gratuite lunar!
              </p>
              <Link href={`/${locale}/pro`} onClick={() => setFreezeSheetOpen(false)}>
                <Button size="sm" variant="primary" fullWidth className="mt-1 h-9 text-xs font-black">
                  Treci la Pro
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
        title="Schimbă porecla"
      >
        <form onSubmit={handleSaveNickname} className="space-y-4 pt-1">
          {getNicknameCooldownDays() > 0 ? (
            <div className="rounded-xl border-2 border-ron-strong bg-ron/10 p-3 space-y-1">
              <p className="text-xs font-black text-ron-strong">
                Perioadă de așteptare activă (30 de zile)
              </p>
              <p className="text-[11px] font-bold text-ink/80 leading-snug">
                Îți poți schimba porecla o singură dată pe lună. Mai ai de așteptat {getNicknameCooldownDays()} {getNicknameCooldownDays() === 1 ? 'zi' : 'zile'}.
              </p>
            </div>
          ) : (
            <p className="text-muted text-xs font-medium leading-relaxed">
              Alege o poreclă unică. O poți schimba o singură dată la 30 de zile.
            </p>
          )}

          <div>
            <label className="text-muted text-xs font-bold block mb-1">
              Poreclă nouă (2-20 caractere)
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

          {nickError && (
            <p className="text-wrong text-xs font-bold leading-snug">{nickError}</p>
          )}

          {nickSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-bold text-muted">Sugestii disponibile:</span>
              {nickSuggestions.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => {
                    setNewNickInput(sug);
                    setNickSuggestions([]);
                    setNickError('');
                  }}
                  className="rounded-lg border-2 border-border bg-surface px-2.5 py-1 text-xs font-bold text-ink hover:bg-volt active:translate-y-0.5 cursor-pointer shadow-sm"
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
              Anulează
            </Button>
            <Button
              type="submit"
              variant="volt"
              fullWidth
              disabled={nickSaving || getNicknameCooldownDays() > 0}
            >
              {nickSaving ? 'Se salvează…' : 'Salvează porecla'}
            </Button>
          </div>
        </form>
      </Sheet>
    </main>
  );
}
