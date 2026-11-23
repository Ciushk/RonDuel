'use client';

import {
  Clock,
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
import { useEffect, useState } from 'react';

import { AccountLinkingSheet } from '@/components/AccountLinkingSheet';
import { CreateLeagueDialog } from '@/components/CreateLeagueDialog';
import { HowItWorksSection } from '@/components/HowItWorksSection';
import { JoinByCodeDialog } from '@/components/JoinByCodeDialog';
import { Avatar, Button, Card, Chip, Sheet, Toast, Wordmark } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { apiErrorMessage } from '@/lib/api-error';
import { getLeagueTheme } from '@/lib/league-theme';
import { syncSessionWithSignedInUser } from '@/lib/link-account';
import { generateReadableNickname } from '@/lib/nickname-words';
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

// Nickname the API generates for players who never picked one (see getOrCreateUser).
function isAutoNickname(nickname: string): boolean {
  return /^Player_[A-Za-z0-9]{2,8}$/.test(nickname);
}

function getSecondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
  return Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
}

function formatCountdown(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
  const [duelError, setDuelError] = useState('');

  // The account is the source of truth: a nickname confirmed earlier (here or on another device)
  // is adopted instead of asking the player to pick one again after signing in.
  const applyServerProfile = (data: TodayStatus) => {
    const session = getLocalSession();
    if (session.nickname && session.ageConfirmed16) return;
    const serverNickname = (data.nickname ?? '').trim();
    if (!serverNickname || isAutoNickname(serverNickname)) return;
    if (data.ageConfirmed16 === false) return;
    saveLocalSession({
      ...session,
      nickname: session.nickname || serverNickname,
      ageConfirmed16: true,
    });
  };

  const loadStatus = () => {
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
  };

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
  }, [locale]);

  // Countdown timer to midnight
  useEffect(() => {
    const update = () => setCountdown(formatCountdown(getSecondsUntilMidnight()));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

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
    const serverNickname = (status?.nickname ?? '').trim();
    const confirmedElsewhere =
      Boolean(serverNickname) &&
      !isAutoNickname(serverNickname) &&
      status?.ageConfirmed16 !== false;
    if ((!session.nickname || !session.ageConfirmed16) && !confirmedElsewhere) {
      setNickSheetOpen(true);
      return;
    }
    if (!session.nickname || !session.ageConfirmed16) {
      saveLocalSession({ ...session, nickname: serverNickname, ageConfirmed16: true });
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
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6">
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
      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          {status ? (
            <>
              <Chip tone="volt">{t('brand.roundBadge', { number: status.roundNumber })}</Chip>
              <Chip tone="neutral">
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
          <div className="space-y-3 py-2 text-center">
            <h2 className="font-display text-ink text-xl font-extrabold">
              {t('home.playedToday')}
            </h2>
            <p className="rd-tabular font-display text-ink text-5xl font-extrabold">
              {(status.score ?? status.totalScore ?? 0).toLocaleString()}
            </p>
            {status.emojiLine && (
              <p className="text-2xl tracking-widest" aria-label={status.emojiLine}>
                {status.emojiLine}
              </p>
            )}
            <div className="text-muted flex items-center justify-center gap-1.5 pt-1 text-xs font-bold">
              <Clock size={16} weight="bold" />
              <span>{t('home.nextRoundIn', { time: countdown })}</span>
            </div>

            <div className="border-border-subtle bg-surface-2 space-y-2.5 rounded-2xl border p-3.5">
              <p className="text-muted text-xs font-bold leading-snug">{t('home.duelAnytime')}</p>
              <Button fullWidth size="lg" variant="blue" onClick={() => void handleCreateDuel()}>
                <Sword size={20} weight="bold" aria-hidden="true" />
                {t('home.createDuel')}
              </Button>
              {duelError && <p className="text-wrong text-xs font-bold">{duelError}</p>}
            </div>

            <div className="space-y-2 pt-2">
              <Button fullWidth size="lg" variant="primary" onClick={handleShareClick}>
                <ShareNetwork size={20} weight="bold" aria-hidden="true" />
                {t('result.shareCta')}
              </Button>
              {status.playId && (
                <Link
                  href={`/${locale}/result/${encodeURIComponent(status.playId)}`}
                  className="text-muted hover:text-ink block py-1 text-xs font-bold underline"
                >
                  {t('home.viewDetailedResult')}
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

        <div className="border-border-subtle flex justify-center border-t pt-1">
          <Link
            href={`/${locale}/regulament`}
            data-testid="hero-rules-link"
            className="text-muted hover:text-duel-strong inline-flex min-h-11 items-center justify-center px-3 text-xs font-bold underline underline-offset-4"
          >
            {t('rules.heroLink')}
          </Link>
        </div>
      </Card>

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
