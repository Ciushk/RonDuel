'use client';

import {
  ArrowClockwise,
  Check,
  Copy,
  EnvelopeSimple,
  GoogleLogo,
  Lock,
  ShareNetwork,
  WhatsappLogo,
} from '@phosphor-icons/react';
import { suggestLeagueName, type Locale } from '@ronduel/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button, Card, Chip, Sheet, Toast } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { apiErrorMessage } from '@/lib/api-error';
import { getFirebaseAuth } from '@/lib/firebase';
import { linkSessionWithGoogle } from '@/lib/link-account';
import { formatYearlyPrice } from '@/lib/pricing';
import {
  getBrowserTimeZone,
  getLocalSession,
  recordLeagueId,
  saveLocalSession,
} from '@/lib/session';

interface CreateLeagueWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (league: { id: string; leagueId: string; name: string; inviteCode: string }) => void;
}

const EMOJI_OPTIONS = ['🏆', '⚡', '☕', '🧠', '🎯', '🚀', '👑', '🔥'];

const COLOR_OPTIONS = [
  { id: 'default', name: 'Classic', pro: false, bg: 'bg-[#FF5A4E]' },
  { id: 'volt', name: 'Volt', pro: false, bg: 'bg-[#C6FF3D]' },
  { id: 'gold', name: 'Gold', pro: false, bg: 'bg-[#FFB800]' },
  { id: 'midnight', name: 'Midnight', pro: true, bg: 'bg-[#0E0D15]' },
  { id: 'clay', name: 'Clay', pro: true, bg: 'bg-[#E07A5F]' },
  { id: 'neon', name: 'Neon', pro: true, bg: 'bg-[#00F5D4]' },
];

export function CreateLeagueWizard({ open, onClose, onCreated }: CreateLeagueWizardProps) {
  const t = useTranslations('league');
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;

  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [sessionUser, setSessionUser] = useState(() => getLocalSession());
  const [emailInput, setEmailInput] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [name, setName] = useState('');
  const [ownedCount, setOwnedCount] = useState(0);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🏆');
  const [selectedColor, setSelectedColor] = useState('default');
  const [chosenPlan, setChosenPlan] = useState<'free' | 'pro_trial'>('free');
  const [createdLeague, setCreatedLeague] = useState<{
    id: string;
    name: string;
    inviteCode: string;
    maxMembers: number;
    memberCount: number;
  } | null>(null);
  const [hasPlayedToday, setHasPlayedToday] = useState(false);
  const [toast, setToast] = useState('');

  // Check auth and limits on open
  useEffect(() => {
    if (!open) return;
    const s = getLocalSession();
    setSessionUser(s);
    setName(suggestLeagueName(locale));
    setError('');
    setCreatedLeague(null);

    const tz = getBrowserTimeZone();
    fetch(`/api/game/status?uid=${encodeURIComponent(s.uid)}&tz=${encodeURIComponent(tz)}&leagues=`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ownedLeaguesCount !== undefined) setOwnedCount(data.ownedLeaguesCount);
        if (data.isPro) setIsPro(true);
        if (data.played) setHasPlayedToday(true);
      })
      .catch(() => {});

    // Step 1: if user is not anonymous (already signed in), skip to Step 2
    if (
      !s.isAnonymous ||
      s.email ||
      s.authProvider === 'google' ||
      s.authProvider === 'google.com' ||
      s.authProvider === 'password' ||
      s.authProvider === 'email_link'
    ) {
      setStep(2);
      trackEvent('league_name_step_viewed');
    } else {
      setStep(1);
    }
  }, [open, locale]);

  const handleShuffleName = () => {
    setName(suggestLeagueName(locale));
  };

  // Step 1: Sign in with Google / Email
  const handleSignIn = async (provider: 'google' | 'email') => {
    setLoading(true);
    setError('');
    const s = getLocalSession();

    let targetEmail = '';
    let targetNickname = s.nickname;

    if (provider === 'google') {
      try {
        const saved = await linkSessionWithGoogle();
        targetEmail = saved.email;
        targetNickname = saved.nickname || targetNickname;
        setSessionUser(getLocalSession());
        trackEvent('signin_for_league_completed', { method: provider });
        setStep(2);
        trackEvent('league_name_step_viewed');
        setLoading(false);
        return;
      } catch (err: unknown) {
        const authErr = err as { code?: string; message?: string };
        if (authErr?.code === 'auth/popup-closed-by-user') {
          setError(tRoot('auth.errors.googleClosed'));
        } else {
          setError(tRoot('auth.errors.googleFailed'));
        }
        setLoading(false);
        return;
      }
    } else {
      targetEmail = emailInput.trim();
      if (!targetEmail) {
        setError(tRoot('account.invalidEmail'));
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/me/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: s.uid,
          email: targetEmail,
          nickname: targetNickname,
          provider: 'email_link',
          confirmMerge: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(apiErrorMessage(tRoot, data, 'league.errorAuthFailed'));
        return;
      }

      const finalUid = data.uid || data.existingUid || s.uid;
      saveLocalSession({
        ...s,
        uid: finalUid,
        isAnonymous: false,
        email: data.email || targetEmail,
        nickname: data.nickname || targetNickname,
        authProvider: 'email_link',
      });
      setSessionUser(getLocalSession());
      trackEvent('signin_for_league_completed', { method: provider });
      setStep(2);
      trackEvent('league_name_step_viewed');
    } catch {
      setError(tRoot('common.networkErrorRetry'));
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Choose Plan (Free or Pro Trial) -> Proceed to Step 3
  const handleProceedToTheme = async (plan: 'free' | 'pro_trial') => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      setError(t('errorNameLength'));
      return;
    }

    setLoading(true);
    setError('');
    setChosenPlan(plan);

    if (plan === 'pro_trial' && !isPro) {
      try {
        const s = getLocalSession();
        let idToken: string | null = null;
        try {
          const auth = getFirebaseAuth();
          idToken = (await auth?.currentUser?.getIdToken()) ?? null;
        } catch {
          idToken = null;
        }
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (idToken) {
          headers.Authorization = `Bearer ${idToken}`;
        }
        const res = await fetch('/api/billing/checkout', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            uid: s.uid,
            plan: 'yearly',
            trial: true,
            euWithdrawalConsent: true,
            locale,
          }),
        });
        if (res.ok) {
          setIsPro(true);
          trackEvent('pro_trial_started');
        }
      } catch {
        // Continue regardless for local dev
      }
    }

    setLoading(false);
    setStep(3);
  };

  // Step 3: Confirm Theme and Create League
  const handleCreateLeague = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    const s = getLocalSession();
    const tz = getBrowserTimeZone();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: s.uid,
          name: name.trim(),
          tz,
          locale,
          themeEmoji: selectedEmoji,
          themeColor: selectedColor,
          plan: chosenPlan,
          requestId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = apiErrorMessage(tRoot, data, 'league.errorCreateFailed');
        setError(errMsg);
        setToast(errMsg);
        setTimeout(() => setToast(''), 4000);
        return;
      }

      const created = {
        id: data.leagueId,
        name: data.name,
        inviteCode: data.inviteCode,
        maxMembers: isPro || chosenPlan === 'pro_trial' ? 200 : 5,
        memberCount: 1,
      };
      recordLeagueId(created.id);
      setCreatedLeague(created);
      trackEvent('league_created', {
        plan: isPro || chosenPlan === 'pro_trial' ? 'pro_trial' : 'free',
        leagueId: created.id,
      });

      if (onCreated) {
        onCreated({
          id: created.id,
          leagueId: created.id,
          name: created.name,
          inviteCode: created.inviteCode,
        });
      }
      setStep(4);
    } catch {
      const netErr = tRoot('common.networkErrorRetry');
      setError(netErr);
      setToast(netErr);
      setTimeout(() => setToast(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  // Step 4 Share Handlers
  const getInviteUrl = () => {
    if (!createdLeague) return '';
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://ronduel.web.app';
    return `${origin}/${locale}/l/${createdLeague.inviteCode}?r=${sessionUser.uid}`;
  };

  const getShareText = () => {
    if (!createdLeague) return '';
    return t('shareText', {
      name: createdLeague.name,
      link: getInviteUrl(),
    });
  };

  const handleShareWhatsApp = () => {
    trackEvent('invite_shared', { channel: 'whatsapp', code: createdLeague?.inviteCode ?? '' });
    const url = `https://wa.me/?text=${encodeURIComponent(getShareText())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShareNative = async () => {
    trackEvent('invite_shared', { channel: 'native', code: createdLeague?.inviteCode ?? '' });
    if (navigator.share) {
      try {
        await navigator.share({
          text: getShareText(),
          url: getInviteUrl(),
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    await handleCopyLink();
  };

  const handleCopyLink = async () => {
    trackEvent('invite_shared', { channel: 'copy', code: createdLeague?.inviteCode ?? '' });
    try {
      await navigator.clipboard.writeText(getInviteUrl());
      setToast(t('inviteCopied'));
      setTimeout(() => setToast(''), 3000);
    } catch {
      // Ignore copy error
    }
  };

  const handleFinish = () => {
    onClose();
    if (createdLeague) {
      if (hasPlayedToday) {
        router.push(`/${locale}/league/${createdLeague.id}`);
      } else {
        router.push(`/${locale}/play`);
      }
    }
  };

  const yearlyPriceText = formatYearlyPrice(locale);
  const freeLimitUsed = ownedCount >= 1 && !isPro;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        step === 1
          ? t('signInTitle')
          : step === 2
            ? t('createTitle')
            : step === 3
              ? t('chooseThemeTitle')
              : t('readyInviteTitle', { name: createdLeague?.name ?? '' })
      }
    >
      <div className="space-y-4">
        {toast && (
          <div className="flex justify-center">
            <Toast message={toast} tone="success" />
          </div>
        )}

        {/* STEP 1: SIGN IN */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-muted text-sm leading-relaxed">{t('signInSubtitle')}</p>

            <div className="grid gap-2 pt-2">
              <Button
                variant="primary"
                fullWidth
                size="md"
                disabled={loading}
                onClick={() => void handleSignIn('google')}
              >
                <GoogleLogo size={20} weight="bold" aria-hidden="true" />
                {t('continueWithGoogle')}
              </Button>

              {!showEmailInput ? (
                <Button
                  variant="secondary"
                  fullWidth
                  size="md"
                  onClick={() => setShowEmailInput(true)}
                >
                  <EnvelopeSimple size={20} weight="bold" aria-hidden="true" />
                  {t('continueWithEmail')}
                </Button>
              ) : (
                <div className="space-y-2 pt-2">
                  <input
                    type="email"
                    required
                    placeholder={tRoot('profile.emailPlaceholder')}
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="border-border bg-surface-2 text-ink w-full rounded-xl border-2 px-3.5 py-2.5 text-sm font-bold"
                  />
                  <Button
                    variant="blue"
                    fullWidth
                    size="sm"
                    disabled={loading || !emailInput.trim()}
                    onClick={() => void handleSignIn('email')}
                  >
                    {t('continueBtn')}
                  </Button>
                </div>
              )}
            </div>

            {error && <p className="text-wrong text-xs font-bold">{error}</p>}
          </div>
        )}

        {/* STEP 2: LEAGUE NAME + PLAN INFO */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="league-name-input"
                className="text-muted mb-1 block text-xs font-bold"
              >
                {t('nameLabel')}
              </label>
              <div className="flex gap-2">
                <input
                  id="league-name-input"
                  type="text"
                  required
                  minLength={2}
                  maxLength={30}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  className="border-border bg-surface-2 text-ink flex-1 rounded-xl border-2 px-3.5 py-2.5 text-sm font-bold"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={handleShuffleName}
                  title={t('randomizeName')}
                >
                  <ArrowClockwise size={18} weight="bold" aria-hidden="true" />
                </Button>
              </div>
            </div>

            {error && <p className="text-wrong text-xs font-bold">{error}</p>}

            {/* Plan Info Card */}
            <Card variant="subtle" className="space-y-2.5 p-3.5">
              <div className="space-y-1">
                <p className="text-ink text-xs font-bold">{t('freePlanInfo')}</p>
                <p className="text-muted text-xs leading-relaxed">
                  {t('proPlanInfo', { price: yearlyPriceText })}
                </p>
              </div>
            </Card>

            {freeLimitUsed && (
              <p className="text-wrong bg-surface-2 rounded-xl p-2.5 text-xs font-bold">
                {t('freeUsedNotice')}
              </p>
            )}

            <div className="grid gap-2 pt-2">
              {!freeLimitUsed && (
                <Button
                  variant="primary"
                  fullWidth
                  size="md"
                  disabled={loading || name.trim().length < 2}
                  onClick={() => void handleProceedToTheme('free')}
                >
                  {t('createFreeBtn')}
                </Button>
              )}

              <Button
                variant="volt"
                fullWidth
                size="md"
                disabled={loading || name.trim().length < 2}
                onClick={() => void handleProceedToTheme('pro_trial')}
              >
                {t('goProTrialBtn')}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: THEME SELECTION */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <p className="text-muted mb-2 text-xs font-bold">{t('emojiLabel')}</p>
              <div className="grid grid-cols-4 gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`flex h-12 items-center justify-center rounded-xl border-2 text-2xl transition-transform active:scale-95 ${
                      selectedEmoji === emoji
                        ? 'bg-surface-2 border-[var(--rd-blue-strong)] ring-2 ring-[var(--rd-blue-strong)]'
                        : 'border-border bg-surface'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-muted mb-2 text-xs font-bold">{t('styleColorLabel')}</p>
              <div className="grid grid-cols-3 gap-2">
                {COLOR_OPTIONS.map((col) => {
                  const locked = col.pro && !isPro && chosenPlan !== 'pro_trial';
                  return (
                    <button
                      key={col.id}
                      type="button"
                      disabled={locked}
                      onClick={() => setSelectedColor(col.id)}
                      className={`relative flex h-11 items-center justify-center gap-1.5 rounded-xl border-2 px-2 text-xs font-bold transition-transform disabled:opacity-50 ${
                        selectedColor === col.id
                          ? 'border-[var(--rd-blue-strong)] ring-2 ring-[var(--rd-blue-strong)]'
                          : 'border-border'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full ${col.bg}`} />
                      <span>{col.name}</span>
                      {locked && <Lock size={12} weight="bold" className="text-muted" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p className="text-wrong text-xs font-bold">{error}</p>}

            <div className="flex gap-2 pt-2">
              <Button
                variant="secondary"
                fullWidth
                size="md"
                disabled={loading}
                onClick={() => void handleCreateLeague()}
              >
                {t('skipBtn')}
              </Button>
              <Button
                variant="primary"
                fullWidth
                size="md"
                disabled={loading}
                onClick={() => void handleCreateLeague()}
              >
                {loading ? tRoot('common.creating') : t('continueBtn')}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: INVITE & SHARE */}
        {step === 4 && createdLeague && (
          <div className="space-y-4 text-center">
            <Card variant="sticker" className="space-y-3 p-4">
              <Chip tone="volt" className="mx-auto">
                {t('spotsOccupied', { count: createdLeague.memberCount })}
              </Chip>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl">{selectedEmoji}</span>
                <h3 className="font-display text-2xl font-extrabold">{createdLeague.name}</h3>
              </div>
              <p className="rd-tabular bg-surface-2 border-border text-ink mx-auto max-w-[200px] rounded-xl border-2 py-2 text-2xl font-extrabold tracking-widest">
                {createdLeague.inviteCode}
              </p>
            </Card>

            <div className="grid gap-2">
              <Button variant="volt" fullWidth size="md" onClick={handleShareWhatsApp}>
                <WhatsappLogo size={20} weight="fill" aria-hidden="true" />
                {t('shareWhatsApp')}
              </Button>

              <Button variant="blue" fullWidth size="md" onClick={() => void handleShareNative()}>
                <ShareNetwork size={20} weight="bold" aria-hidden="true" />
                {t('shareNative')}
              </Button>

              <Button variant="secondary" fullWidth size="md" onClick={() => void handleCopyLink()}>
                <Copy size={18} weight="bold" aria-hidden="true" />
                {t('copyLink')}
              </Button>
            </div>

            <div className="pt-2">
              <Button variant="primary" fullWidth size="lg" onClick={handleFinish}>
                <Check size={20} weight="bold" aria-hidden="true" />
                {hasPlayedToday ? t('viewLeaderboard') : t('playTodayRound')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
