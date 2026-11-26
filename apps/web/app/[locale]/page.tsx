'use client';

import {
  Check,
  Crown,
  Flame,
  GlobeHemisphereWest,
  Play,
  Plus,
  ShareNetwork,
  SignIn,
  Sword,
  Trophy,
  User,
  Users,
} from '@phosphor-icons/react';
import { buildShareCardText, validateNickname } from '@ronduel/shared';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AccountLinkingSheet } from '@/components/AccountLinkingSheet';
import { CreateLeagueDialog } from '@/components/CreateLeagueDialog';
import { HowItWorksSection } from '@/components/HowItWorksSection';
import { JoinByCodeDialog } from '@/components/JoinByCodeDialog';
import { PushOptInCard } from '@/components/PushOptInCard';
import { Avatar, Button, Card, Chip, Sheet, Toast, Wordmark } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { apiErrorMessage } from '@/lib/api-error';
import { getLeagueTheme } from '@/lib/league-theme';
import { syncSessionWithSignedInUser } from '@/lib/link-account';
import { generateReadableNickname } from '@/lib/nickname-words';
import { serverProfileToApply } from '@/lib/onboarding-profile';
import {
  formatCountdown,
  getCountdownParts,
  getLocalDateKey,
  getSecondsUntilMidnight,
} from '@/lib/round-clock';
import { getBrowserTimeZone, getLocalSession, saveLocalSession } from '@/lib/session';

interface ActiveDuel {
  id: string;
  status: string;
  challengerNickname: string;
  opponentNickname: string;
  myTurn: boolean;
  timeLeftMs: number;
}

interface LeagueItem {
  id: string;
  name: string;
  inviteCode?: string;
  isOwner?: boolean;
  memberCount: number;
  maxMembers?: number;
  isFull?: boolean;
  playedTodayCount: number;
  myRankToday?: number | null;
  themeEmoji?: string;
  themeColor?: string;
  initials?: string[];
}

interface TodayStatus {
  date: string;
  roundNumber: number;
  themeKey?: string;
  topicOfTheDay: string;
  themeEmoji?: string;
  themeTitle?: string;
  played: boolean;
  inProgress: boolean;
  playId?: string;
  score?: number | null;
  totalScore?: number | null;
  emojiLine?: string | null;
  streakCurrent: number;
  streakBest: number;
  freezes?: number;
  streakAtRisk?: boolean;
  freezeNotice?: string | null;
  isPro?: boolean;
  nickname?: string;
  ageConfirmed16?: boolean;
  finishedPlaysCount?: number;
  ownedLeaguesCount?: number;
  maxOwnedLeagues?: number;
  activeDuelsCount?: number;
  maxActiveDuels?: number;
  monthlyDuelsCount?: number;
  maxMonthlyDuels?: number;
  activeDuels?: ActiveDuel[];
  worldLeague?: LeagueItem | null;
  privateLeagues?: LeagueItem[];
  hasFullFreeLeague?: boolean;
}

export default function LocaleHomePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [status, setStatus] = useState<TodayStatus | null>(null);
  const [nickSheetOpen, setNickSheetOpen] = useState(false);
  const [createLeagueOpen, setCreateLeagueOpen] = useState(false);
  const [joinCodeOpen, setJoinCodeOpen] = useState(false);
  const [isLinkSheetOpen, setIsLinkSheetOpen] = useState(false);
  const [showSlimBanner, setShowSlimBanner] = useState(false);
  const [toast, setToast] = useState('');
  const [nickname, setNickname] = useState('');
  const [ageOk, setAgeOk] = useState(false);
  const [nickError, setNickError] = useState('');
  const [countdown, setCountdown] = useState<string>('');
  const [srCountdown, setSrCountdown] = useState<{ hours: number; minutes: number }>({
    hours: 0,
    minutes: 0,
  });
  const [duelError, setDuelError] = useState('');
  const lastDateKeyRef = useRef<string | null>(null);

  // The account is the source of truth: a nickname confirmed earlier (here or on another device)
  // is adopted instead of asking the player to pick one again after signing in.
  const applyServerProfile = useCallback((data: TodayStatus) => {
    const session = getLocalSession();
    const next = serverProfileToApply({
      sessionNickname: session.nickname,
      sessionAgeConfirmed: Boolean(session.ageConfirmed16),
      serverNickname: data.nickname,
      serverAgeConfirmed: data.ageConfirmed16,
    });
    if (!next) return;
    saveLocalSession({ ...session, ...next });
  }, []);

  const loadStatus = useCallback(() => {
    const session = getLocalSession();
    const tz = getBrowserTimeZone();
    fetch(`/api/game/status?uid=${encodeURIComponent(session.uid)}&tz=${encodeURIComponent(tz)}`)
      .then((r) => r.json())
      .then((data: TodayStatus) => {
        setStatus(data);
        applyServerProfile(data);
        if (data.freezeNotice) {
          setToast(data.freezeNotice);
          setTimeout(() => setToast(''), 4000);
        }
        try {
          if (!session.isAnonymous && session.email) {
            setShowSlimBanner(false);
          } else {
            const plays = data.finishedPlaysCount ?? 0;
            const dismissed = localStorage.getItem('rd_home_banner_dismissed') === 'true';
            if (!dismissed && plays >= 2 && plays <= 3) {
              setShowSlimBanner(true);
            }
          }
        } catch {
          // ignore
        }
      })
      .catch(() => {});
  }, [applyServerProfile]);

  useEffect(() => {
    let cancelled = false;
    void syncSessionWithSignedInUser().finally(() => {
      if (cancelled) return;
      const session = getLocalSession();
      setNickname(session.nickname || generateReadableNickname(locale));
      loadStatus();
    });
    return () => {
      cancelled = true;
    };
  }, [locale, loadStatus]);

  // Timezone-accurate countdown to local midnight; pauses when tab is hidden and refreshes status at 0
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const tz = getBrowserTimeZone();

    const tick = () => {
      const now = new Date();
      const dateKey = getLocalDateKey(now, tz);
      const sec = getSecondsUntilMidnight(now, tz);
      setCountdown(formatCountdown(sec));

      const parts = getCountdownParts(sec);
      setSrCountdown((prev) =>
        prev.hours === parts.hours && prev.minutes === parts.minutes
          ? prev
          : { hours: parts.hours, minutes: parts.minutes },
      );

      const prevDateKey = lastDateKeyRef.current;
      lastDateKeyRef.current = dateKey;
      if (prevDateKey !== null && prevDateKey !== dateKey) {
        loadStatus();
      }
    };

    const start = () => {
      if (timer !== null || document.hidden) return;
      tick();
      timer = setInterval(() => {
        if (!document.hidden) tick();
      }, 1000);
    };

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadStatus]);

  const handleDismissBanner = () => {
    setShowSlimBanner(false);
    try {
      localStorage.setItem('rd_home_banner_dismissed', 'true');
    } catch {
      // ignore
    }
  };

  const handleShareClick = async () => {
    if (!status) return;
    const session = getLocalSession();
    const primary = status.privateLeagues?.[0] || status.worldLeague;
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://ronduel.web.app';
    const inviteUrl = primary?.inviteCode
      ? `${origin}/${locale}/l/${primary.inviteCode}?r=${session.uid}`
      : `${origin}/${locale}`;

    const cardText = buildShareCardText({
      roundNumber: status.roundNumber,
      totalScore: status.score ?? status.totalScore ?? 0,
      emojiLine: status.emojiLine || '',
      streakText: t('result.streak', { count: status.streakCurrent }),
      beatMeText: t('result.shareBeatMe', { url: inviteUrl }),
    });

    trackEvent('league_invite_shared', {
      league_id: primary?.id ?? 'lg_world',
      channel:
        typeof navigator !== 'undefined' && typeof navigator.share === 'function'
          ? 'native_share'
          : 'clipboard',
    });

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text: cardText });
        return;
      } catch {
        // fallback to clipboard
      }
    }
    await navigator.clipboard.writeText(cardText).catch(() => {});
    setToast(t('result.copied'));
    setTimeout(() => setToast(''), 3000);
  };

  const handlePrimaryCta = () => {
    if (status?.played && status.playId) {
      router.push(`/${locale}/result/${encodeURIComponent(status.playId)}`);
      return;
    }
    const session = getLocalSession();
    const adopted = serverProfileToApply({
      sessionNickname: session.nickname,
      sessionAgeConfirmed: Boolean(session.ageConfirmed16),
      serverNickname: status?.nickname,
      serverAgeConfirmed: status?.ageConfirmed16,
    });
    if ((!session.nickname || !session.ageConfirmed16) && !adopted) {
      setNickSheetOpen(true);
      return;
    }
    if (adopted) {
      saveLocalSession({ ...getLocalSession(), ...adopted });
    }
    router.push(`/${locale}/play`);
  };

  const handleConfirmNickname = () => {
    const check = validateNickname(nickname);
    if (!check.ok) {
      setNickError(t('onboarding.invalidNickname'));
      return;
    }
    if (!ageOk) return;
    const session = getLocalSession();
    saveLocalSession({ ...session, nickname: check.value, ageConfirmed16: true });
    setNickError('');
    setNickSheetOpen(false);
    router.push(`/${locale}/play`);
  };

  const handleCreateDuel = async () => {
    setDuelError('');
    const s = getLocalSession();
    if (!status?.isPro && (status?.monthlyDuelsCount ?? 0) >= (status?.maxMonthlyDuels ?? 4)) {
      setDuelError(t('duels.errorMonthlyLimit', { max: status?.maxMonthlyDuels ?? 4 }));
      return;
    }
    if (!status?.isPro && (status?.activeDuelsCount ?? 0) >= (status?.maxActiveDuels ?? 1)) {
      setDuelError(t('duels.errorActiveDuel'));
      return;
    }
    const res = await fetch('/api/duels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengerUid: s.uid,
        nickname: s.nickname || undefined,
        tz: getBrowserTimeZone(),
      }),
    });
    const created = await res.json();
    if (created.duelId) {
      trackEvent('duel_created', { duel_id: created.duelId });
      router.push(`/${locale}/duel/${encodeURIComponent(created.duelId)}`);
    } else {
      setDuelError(apiErrorMessage(t, created, 'duels.errorCreate'));
    }
  };

  const isFirstTimeVisitor =
    (status?.finishedPlaysCount ?? 0) === 0 && (status?.privateLeagues?.length ?? 0) === 0;

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-4 px-4 py-4">
      <h1 className="sr-only">{t('home.heroTitle')}</h1>

      {/* Streak badge for returning player */}
      {status && status.streakCurrent > 0 && (
        <div className="flex items-center justify-between">
          <Chip tone="volt" className="gap-1.5 px-3 py-1 font-bold">
            <Flame size={16} weight="fill" className="text-ron-strong" aria-hidden="true" />
            <span>{t('common.daysCount', { count: status.streakCurrent })}</span>
          </Chip>
        </div>
      )}

      {/* Streak at risk warning banner */}
      {status?.streakAtRisk && (
        <Card
          variant="sticker"
          className="border-ron-strong bg-ron/20 space-y-1 border-2 p-3.5 shadow-sm"
        >
          <div className="text-ink flex items-center gap-2.5">
            <span className="text-xl">⚠️</span>
            <div className="space-y-0.5">
              <p className="font-display text-ron-strong text-xs font-black">
                {t('home.streakAtRiskTitle', { days: status.streakCurrent })}
              </p>
              <p className="text-ink/80 text-[11px] font-bold">{t('home.streakAtRiskBody')}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Tagline only for first-time visitors who bypassed splash */}
      {isFirstTimeVisitor && (
        <p className="text-muted text-center text-sm font-medium">{t('brand.tagline')}</p>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="flex justify-center">
          <Toast message={toast} tone="success" />
        </div>
      )}

      {/* 5/5 Full Banner for Free League Owner */}
      {status?.hasFullFreeLeague && (
        <Card
          variant="sticker"
          className="bg-volt text-ink border-border space-y-2 border-2 p-4 shadow-sm"
        >
          <div className="flex items-start gap-2.5">
            <Crown size={22} weight="fill" className="text-ron-strong mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-extrabold leading-snug">{t('common.leagueFullBanner')}</p>
              <p className="text-ink/80 text-xs font-medium">{t('common.leagueFullBannerBody')}</p>
            </div>
          </div>
          <Link href={`/${locale}/pro`} className="block pt-1">
            <Button size="sm" variant="primary" fullWidth>
              {t('common.goPro')}
            </Button>
          </Link>
        </Card>
      )}

      {/* Hero Card */}
      <Card
        data-testid={status?.played ? 'home-done-card' : 'home-play-card'}
        className={status?.played ? 'rd-home-done-card space-y-3 p-4' : 'space-y-4'}
      >
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          {status ? (
            <>
              {status.played ? (
                <Chip
                  tone="volt"
                  data-testid="home-round-complete-chip"
                  className="whitespace-nowrap px-2 py-0.5 text-[11px]"
                >
                  <Check size={13} weight="bold" aria-hidden="true" />
                  <span>{t('home.roundComplete')}</span>
                </Chip>
              ) : (
                <Chip tone="volt">{t('brand.roundBadge', { number: status.roundNumber })}</Chip>
              )}
              <Chip
                tone="neutral"
                className={status.played ? 'whitespace-nowrap px-2 py-0.5 text-[11px]' : undefined}
              >
                {status.themeKey
                  ? t(`themes.${status.themeKey}` as Parameters<typeof t>[0])
                  : t('themes.worldScience')}
              </Chip>
            </>
          ) : (
            <>
              <span
                className="bg-surface-2 h-7 w-24 animate-pulse rounded-full"
                aria-hidden="true"
              />
              <span
                className="bg-surface-2 h-7 w-28 animate-pulse rounded-full"
                aria-hidden="true"
              />
            </>
          )}
        </div>

        {status?.played ? (
          <div className="space-y-2.5 text-center">
            <div className="space-y-1">
              <p
                data-testid="home-done-score"
                className="rd-tabular font-display text-ink text-[44px] font-extrabold leading-none"
              >
                {(status.score ?? status.totalScore ?? 0).toLocaleString()}
              </p>
              {status.emojiLine && (
                <p className="text-xl tracking-widest" aria-label={status.emojiLine}>
                  {status.emojiLine}
                </p>
              )}
            </div>

            <div className="border-border-subtle bg-surface-2 space-y-1 rounded-2xl border-2 px-3.5 py-2.5">
              <p className="text-muted text-[11px] font-black uppercase tracking-widest">
                {t('home.nextRoundLabel')}
              </p>
              <p
                data-testid="home-next-countdown"
                aria-hidden="true"
                className="rd-tabular text-ink text-[34px] font-extrabold leading-none tracking-tight"
              >
                {countdown || '00:00:00'}
              </p>
              <span className="sr-only" aria-live="off" data-testid="home-next-countdown-sr">
                {t('home.nextRoundSr', {
                  hours: srCountdown.hours,
                  minutes: srCountdown.minutes,
                })}
              </span>
              <p className="text-muted text-xs font-medium">
                {t('home.nextRoundAt', { number: status.roundNumber + 1 })}
              </p>
            </div>

            <div className="space-y-1 pt-0.5">
              <Button fullWidth size="md" variant="primary" onClick={handleShareClick}>
                <ShareNetwork size={19} weight="bold" aria-hidden="true" />
                {t('result.shareCta')}
              </Button>
              {status.playId && (
                <Link
                  href={`/${locale}/result/${encodeURIComponent(status.playId)}`}
                  data-testid="home-see-results-link"
                  className="text-duel-strong hover:text-ink inline-flex min-h-10 items-center justify-center px-3 text-sm font-extrabold underline underline-offset-4"
                >
                  {t('home.seeResults')}
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <h2 className="font-display text-ink text-2xl font-extrabold">
                {status?.inProgress ? t('brand.continueRound') : t('common.todayRound')}
              </h2>
              <p className="text-muted text-xs font-medium">{t('home.roundMeta')}</p>
            </div>

            <Button fullWidth size="lg" onClick={handlePrimaryCta}>
              <Play size={20} weight="fill" aria-hidden="true" />
              {status?.inProgress
                ? t('brand.continueRound')
                : isFirstTimeVisitor
                  ? t('brand.playToday')
                  : t('common.playNow')}
            </Button>

            <p className="text-muted text-center text-[11px] font-bold">
              {t('home.scoreCountsEverywhere')}
            </p>
          </div>
        )}

        <div className="border-border-subtle flex justify-center border-t pt-0.5">
          <Link
            href={`/${locale}/regulament`}
            data-testid="hero-rules-link"
            className="text-muted hover:text-duel-strong inline-flex min-h-10 items-center justify-center px-3 text-xs font-bold underline underline-offset-4"
          >
            {t('rules.heroLink')}
          </Link>
        </div>
      </Card>

      {/* Two big sticker tiles (RonTown + Duels) in the "done for today" state */}
      {status?.played && (
        <div
          data-testid="home-done-tiles"
          className="rd-home-done-tiles grid grid-cols-2 gap-3.5 py-0.5"
        >
          <Link
            href={`/${locale}/town`}
            data-testid="home-town-tile"
            className="flex min-h-[116px] -rotate-[1.5deg] flex-col items-start justify-between rounded-[20px] border-2 border-[#0E0D15] bg-[#C6FF3D] p-3.5 text-left text-[#0E0D15] shadow-[0_4px_0_0_#0E0D15] transition-transform duration-150 ease-out active:translate-y-[2px] active:shadow-[0_2px_0_0_#0E0D15] motion-reduce:rotate-0 motion-reduce:transition-none"
          >
            <span className="text-3xl leading-none" aria-hidden="true">
              🏡
            </span>
            <div className="space-y-0.5">
              <span className="font-display block text-lg font-extrabold leading-tight">
                {t('home.townTile')}
              </span>
              <span className="block text-xs font-bold text-[#0E0D15]/80">
                {t('home.townTileSub')}
              </span>
            </div>
          </Link>

          <Link
            href={`/${locale}/duels`}
            data-testid="home-duels-tile"
            className="bg-duel-strong flex min-h-[116px] rotate-[1.5deg] flex-col items-start justify-between rounded-[20px] border-2 border-[#0E0D15] p-3.5 text-left text-[var(--rd-on-blue)] shadow-[0_4px_0_0_#0E0D15] transition-transform duration-150 ease-out active:translate-y-[2px] active:shadow-[0_2px_0_0_#0E0D15] motion-reduce:rotate-0 motion-reduce:transition-none"
          >
            <span className="text-3xl leading-none" aria-hidden="true">
              ⚔️
            </span>
            <div className="space-y-0.5">
              <span className="font-display block text-lg font-extrabold leading-tight">
                {t('home.duelsTile')}
              </span>
              <span className="block text-xs font-bold opacity-90">{t('home.duelsTileSub')}</span>
            </div>
          </Link>
        </div>
      )}

      {/* Web Push opt-in card (hidden when unsupported, granted/denied, missing VAPID, <1 round, snoozed, or sheet open) */}
      {status && (
        <PushOptInCard
          finishedPlaysCount={status.finishedPlaysCount ?? (status.played ? 1 : 0)}
          anySheetOpen={nickSheetOpen || createLeagueOpen || joinCodeOpen || isLinkSheetOpen}
        />
      )}

      {/* Prominent Action Button: Leaderboards */}
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

      {/* RonTown Entry Card (hidden in played state where the RonTown sticker tile is shown above) */}
      {!status?.played && (
        <Link href={`/${locale}/town`} data-testid="home-town-entry-card" className="block">
          <div className="border-border bg-surface text-ink hover:border-volt hover:bg-surface-2 flex items-center justify-between gap-3 rounded-2xl border-2 p-3.5 shadow-[2px_2px_0px_0px_var(--border-color,#16131F)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">
            <div className="flex min-w-0 items-center gap-3">
              <div className="border-border flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 bg-[#C6FF3D] text-2xl shadow-sm">
                🏡
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-ink truncate text-sm font-black">RonTown</span>
                  <span className="border-border rounded border bg-[#C6FF3D] px-1.5 py-0.5 text-[10px] font-black text-[#0E0D15]">
                    {t('home.townCardBadge')}
                  </span>
                </div>
                <p className="text-muted truncate text-xs font-medium">{t('home.townCardSub')}</p>
              </div>
            </div>
            <Button size="sm" variant="volt" className="h-9 shrink-0 px-3 text-xs font-black">
              {t('common.playNow')}
            </Button>
          </div>
        </Link>
      )}

      {/* Two Equal Action Buttons: Create league & Join league */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          fullWidth
          size="md"
          variant="primary"
          onClick={() => setCreateLeagueOpen(true)}
          className="h-auto flex-col gap-1 py-3"
        >
          <Plus size={20} weight="bold" />
          <span className="text-xs font-extrabold">{t('league.createBtn')}</span>
        </Button>

        <Button
          fullWidth
          size="md"
          variant="secondary"
          onClick={() => setJoinCodeOpen(true)}
          className="h-auto flex-col gap-1 py-3"
        >
          <SignIn size={20} weight="bold" />
          <span className="text-xs font-extrabold">{t('home.joinLeagueTile')}</span>
        </Button>
      </div>

      {/* Non-first-time visitor sections: My leagues & My duels */}
      {!isFirstTimeVisitor && (
        <>
          {/* Slim account linking banner on days 2 and 3 if dismissed */}
          {showSlimBanner && (
            <div className="border-border-subtle bg-surface-2 flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 shadow-sm">
              <div className="min-w-0">
                <p className="text-ink truncate text-xs font-bold">{t('account.saveTitle')}</p>
                <p className="text-muted truncate text-[11px]">{t('account.saveBannerBody')}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="sm"
                  variant="volt"
                  onClick={() => {
                    setIsLinkSheetOpen(true);
                    trackEvent('account_link_prompt_shown', { trigger: 'banner' });
                  }}
                  className="h-8 min-h-8 px-2.5 py-1 text-xs font-extrabold"
                >
                  {t('common.save')}
                </Button>
                <button
                  type="button"
                  onClick={handleDismissBanner}
                  className="text-muted hover:text-ink p-1 text-xs font-bold"
                  aria-label={t('common.close')}
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* My leagues */}
          <section className="space-y-3" aria-labelledby="my-leagues-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="my-leagues-heading" className="font-display text-xl font-extrabold">
                {t('nav.leagues')}
              </h2>
              <button
                type="button"
                onClick={() => setCreateLeagueOpen(true)}
                className="text-duel-strong text-xs font-bold underline"
              >
                {t('home.newLeague')}
              </button>
            </div>

            {/* RonDuel World first */}
            {status?.worldLeague && (
              <Link href={`/${locale}/league/lg_world`} className="block">
                <Card
                  variant="subtle"
                  className="hover:border-border flex items-center justify-between gap-3 p-4 transition"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <GlobeHemisphereWest
                      size={28}
                      weight="bold"
                      className="text-duel-strong shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-display text-ink truncate text-base font-extrabold">
                        RonDuel World 🌍
                      </p>
                      <p className="text-muted text-xs font-medium">
                        {t('common.playedTodayCount', {
                          count: status.worldLeague.playedTodayCount,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="rd-tabular text-ink block text-xs font-extrabold">
                      {status.worldLeague.myRankToday
                        ? t('common.rankPlace', { rank: status.worldLeague.myRankToday })
                        : t('home.notPlayed')}
                    </span>
                    <span className="text-muted text-[10px] font-bold uppercase">
                      {t('nav.home')}
                    </span>
                  </div>
                </Card>
              </Link>
            )}

            {/* Private Leagues */}
            {status?.privateLeagues && status.privateLeagues.length > 0 ? (
              status.privateLeagues.map((lg) => (
                <Link key={lg.id} href={`/${locale}/league/${lg.id}`} className="block">
                  <Card
                    variant="subtle"
                    className="hover:border-border flex items-center justify-between gap-3 p-4 transition"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xl"
                        style={{
                          backgroundColor: `${getLeagueTheme(lg.themeColor).hex}22`,
                        }}
                        aria-hidden="true"
                      >
                        {lg.themeEmoji || '🏆'}
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-ink truncate text-base font-extrabold">
                          {lg.name}
                        </p>
                        <p className="text-muted text-xs font-medium">
                          {t('common.playedTodayCount', { count: lg.playedTodayCount })}
                        </p>
                        {/* Member initials */}
                        {lg.initials && lg.initials.length > 0 && (
                          <div className="flex items-center gap-1 pt-1.5">
                            {lg.initials.map((init, i) => (
                              <span
                                key={i}
                                className="border-border bg-surface-2 text-ink inline-flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-extrabold"
                              >
                                {init}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="rd-tabular text-ink block text-xs font-extrabold">
                        {lg.myRankToday
                          ? t('common.rankPlace', { rank: lg.myRankToday })
                          : t('home.notPlayed')}
                      </span>
                      <span className="text-muted text-[10px] font-bold uppercase">
                        {t('nav.home')}
                      </span>
                    </div>
                  </Card>
                </Link>
              ))
            ) : (
              <Card variant="secondary" className="space-y-2.5 p-5 text-center">
                <p className="font-display text-ink text-base font-extrabold">
                  {t('leagues.emptyTitle')}
                </p>
                <p className="text-muted mx-auto max-w-[340px] text-xs font-medium leading-relaxed">
                  {t('leagues.emptyBody', { max: 5 })}
                </p>
                <div className="pt-1">
                  <Button size="sm" variant="volt" onClick={() => setCreateLeagueOpen(true)}>
                    <Plus size={16} weight="bold" />
                    {t('leagues.createFirst')}
                  </Button>
                </div>
              </Card>
            )}
          </section>

          {/* My duels */}
          <section className="space-y-3" aria-labelledby="my-duels-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="my-duels-heading" className="font-display text-xl font-extrabold">
                {t('home.myDuels')}
              </h2>
              <span className="text-muted text-xs font-bold">
                {status?.isPro
                  ? t('duels.unlimitedPro')
                  : t('duels.monthlyUsageShort', {
                      count: status?.monthlyDuelsCount ?? 0,
                      max: status?.maxMonthlyDuels ?? 4,
                    })}
              </span>
            </div>

            {status?.activeDuels && status.activeDuels.length > 0
              ? status.activeDuels.map((d) => (
                  <Link key={d.id} href={`/${locale}/duel/${d.id}`} className="block">
                    <Card
                      variant="subtle"
                      className="hover:border-border flex items-center justify-between gap-3 p-3.5 transition"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Sword size={22} weight="bold" className="text-duel-strong shrink-0" />
                        <div className="min-w-0">
                          <p className="font-display text-ink truncate text-sm font-extrabold">
                            {t('common.versus', { name: d.opponentNickname })}
                          </p>
                          <p className="text-muted text-xs">
                            {t('common.hoursLeft', {
                              hours: Math.max(1, Math.ceil(d.timeLeftMs / (1000 * 60 * 60))),
                            })}
                          </p>
                        </div>
                      </div>
                      <Chip tone={d.myTurn ? 'volt' : 'neutral'} className="text-[11px] font-bold">
                        {d.myTurn ? t('duels.yourTurn') : t('duels.waitingOpponent')}
                      </Chip>
                    </Card>
                  </Link>
                ))
              : null}

            {duelError && <p className="text-wrong text-xs font-bold">{duelError}</p>}

            <Button fullWidth size="md" variant="secondary" onClick={() => void handleCreateDuel()}>
              <Sword size={18} weight="bold" />
              {t('home.challengeFriend')}
            </Button>
          </section>
        </>
      )}

      {/* How it works explainer section & FAQ */}
      <HowItWorksSection played={Boolean(status?.played)} onPrimaryCta={handlePrimaryCta} />

      {/* Nickname onboarding sheet */}
      <Sheet
        open={nickSheetOpen}
        onClose={() => setNickSheetOpen(false)}
        title={t('onboarding.pickNickname')}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="nick-input" className="text-muted mb-1 block text-xs font-bold">
              {t('onboarding.nicknameLabel')}
            </label>
            <input
              id="nick-input"
              type="text"
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="border-border bg-surface-2 text-ink min-h-12 w-full rounded-xl border px-3 text-base font-bold"
            />
            {nickError && <p className="text-wrong mt-1 text-xs">{nickError}</p>}
          </div>

          <label className="text-ink flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={ageOk}
              onChange={(e) => setAgeOk(e.target.checked)}
              className="h-4 w-4 rounded accent-[var(--rd-blue-strong)]"
            />
            <span>{t('onboarding.ageConfirm')}</span>
          </label>

          <Button fullWidth size="lg" disabled={!ageOk} onClick={handleConfirmNickname}>
            {t('onboarding.startPlaying')}
          </Button>
        </div>
      </Sheet>

      {/* Create League Dialog */}
      <CreateLeagueDialog
        open={createLeagueOpen}
        onClose={() => {
          setCreateLeagueOpen(false);
          loadStatus();
        }}
        uid={getLocalSession().uid}
        onCreated={() => {
          loadStatus();
        }}
      />

      {/* Join League by Code Dialog */}
      <JoinByCodeDialog
        open={joinCodeOpen}
        onClose={() => {
          setJoinCodeOpen(false);
          loadStatus();
        }}
      />

      {/* Account linking sheet */}
      <AccountLinkingSheet
        open={isLinkSheetOpen}
        onClose={() => setIsLinkSheetOpen(false)}
        score={status?.score ?? status?.totalScore ?? 0}
        streak={status?.streakCurrent ?? 0}
        onLinked={() => {
          setShowSlimBanner(false);
          loadStatus();
        }}
      />
    </main>
  );
}
