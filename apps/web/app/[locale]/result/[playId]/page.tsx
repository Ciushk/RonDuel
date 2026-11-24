'use client';

import {
  CheckCircle,
  Flame,
  GlobeHemisphereWest,
  ShareNetwork,
  ShieldCheck,
  Sword,
  Trophy,
  Users,
} from '@phosphor-icons/react';
import { buildShareCardText } from '@ronduel/shared';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AccountLinkingSheet } from '@/components/AccountLinkingSheet';
import { CreateLeagueDialog } from '@/components/CreateLeagueDialog';
import { JoinByCodeDialog } from '@/components/JoinByCodeDialog';
import { EmojiTiles } from '@/components/result/EmojiTiles';
import { ScoreCountUp } from '@/components/result/ScoreCountUp';
import { Button, Card, Chip, Sheet, Toast } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { getBrowserTimeZone, getLocalSession, vibrate } from '@/lib/session';

interface LeagueRankInfo {
  id: string;
  name: string;
  inviteCode: string;
  isWorld: boolean;
  rank: number;
  totalMembers: number;
}

interface ResultData {
  playId: string;
  date: string;
  roundNumber: number;
  totalScore: number;
  totalMs: number;
  emojiLine: string;
  streakCurrent: number;
  streakBest: number;
  finishedPlaysCount?: number;
  review: Array<{
    index: number;
    questionId?: string;
    prompt: string;
    correctAnswer: string;
    explanation?: string;
    points: number;
    emoji: string;
    correct?: boolean;
    timedOut?: boolean;
    userAnswer?: string | null;
  }>;
  leagueRanks?: LeagueRankInfo[];
  primaryLeague: { id: string; inviteCode?: string; name?: string } | null;
}

export default function ResultPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ playId: string }>();
  const rawPlayId = decodeURIComponent(params.playId);

  const [data, setData] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string>('');
  const [isCreateLeagueOpen, setIsCreateLeagueOpen] = useState(false);
  const [isJoinCodeOpen, setIsJoinCodeOpen] = useState(false);
  const [isSharePickerOpen, setIsSharePickerOpen] = useState(false);
  const [isLinkSheetOpen, setIsLinkSheetOpen] = useState(false);
  const [isAccountLinked, setIsAccountLinked] = useState(false);
  const [showSlimBanner, setShowSlimBanner] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [reportingQuestionId, setReportingQuestionId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<'wrong_answer' | 'ambiguous' | 'language_error'>(
    'wrong_answer',
  );
  const [isReporting, setIsReporting] = useState(false);

  const [animated, setAnimated] = useState(false);
  const [showPB, setShowPB] = useState(false);
  const [showTiles, setShowTiles] = useState(false);
  const [flameBumping, setFlameBumping] = useState(false);
  const [showRows, setShowRows] = useState(false);
  const [isPB, setIsPB] = useState(false);

  const skipAnimation = useCallback(() => {
    if (!animated) return;
    setAnimated(false);
    setShowPB(isPB);
    setShowTiles(true);
    setShowRows(true);
    setFlameBumping(false);
    if (data && typeof window !== 'undefined') {
      sessionStorage.setItem(`rd-result-seen-${data.playId}`, '1');
    }
  }, [animated, isPB, data]);

  useEffect(() => {
    if (!data || typeof window === 'undefined') return;

    const storageKeySeen = `rd-result-seen-${data.playId}`;
    const alreadySeen = sessionStorage.getItem(storageKeySeen);
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Check personal best
    const bestKey = 'rd_best_score_record';
    const recordedBest = parseInt(localStorage.getItem(bestKey) || '0', 10);
    // A first-ever round has nothing to beat, so it is never a personal best.
    const personalBest =
      (data.finishedPlaysCount ?? 1) > 1 && data.totalScore > 0 && data.totalScore >= recordedBest;
    if (data.totalScore > recordedBest) {
      localStorage.setItem(bestKey, String(data.totalScore));
    }
    setIsPB(personalBest);

    const isRankOne = Boolean(data.leagueRanks?.some((l) => l.rank === 1));

    if (alreadySeen || prefersReduced) {
      setAnimated(false);
      setShowPB(personalBest);
      setShowTiles(true);
      setShowRows(true);
      setFlameBumping(false);
      return;
    }

    setAnimated(true);

    const pbTimer = setTimeout(() => {
      if (personalBest) setShowPB(true);
    }, 620);

    const tilesTimer = setTimeout(() => {
      setShowTiles(true);
    }, 650);

    const confettiTimer = setTimeout(async () => {
      if (personalBest || isRankOne) {
        try {
          const confetti = (await import('canvas-confetti')).default;
          confetti({
            particleCount: 65,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#FF5A4E', '#3D7BFF', '#C6FF3D', '#FFC53D'],
          });
          vibrate([60, 40, 120]);
        } catch {}
      }
    }, 700);

    const flameTimer = setTimeout(() => {
      setFlameBumping(true);
    }, 1180);

    const rowsTimer = setTimeout(() => {
      setShowRows(true);
    }, 1250);

    const completeTimer = setTimeout(() => {
      setAnimated(false);
      sessionStorage.setItem(storageKeySeen, '1');
    }, 1600);

    return () => {
      clearTimeout(pbTimer);
      clearTimeout(tilesTimer);
      clearTimeout(confettiTimer);
      clearTimeout(flameTimer);
      clearTimeout(rowsTimer);
      clearTimeout(completeTimer);
    };
  }, [data]);

  useEffect(() => {
    const session = getLocalSession();
    setIsAccountLinked(!session.isAnonymous && Boolean(session.email));
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('returnTo');
      if (q) setReturnTo(q);
    }
  }, []);

  const loadResult = async () => {
    setLoading(true);
    setError(null);
    const resolvedPlayId =
      rawPlayId === '_shell' && typeof window !== 'undefined'
        ? decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() ?? rawPlayId)
        : rawPlayId;

    if (!resolvedPlayId || resolvedPlayId === '_shell') {
      setLoading(false);
      setError(t('result.errorInvalidId'));
      return;
    }

    let cached: ResultData | null = null;
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`rd_play_${resolvedPlayId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed.totalScore === 'number') {
            cached = parsed;
          }
        }
      } catch {}
    }

    try {
      const r = await fetch(
        `/api/game/result/${encodeURIComponent(resolvedPlayId)}?t=${Date.now()}`,
        { cache: 'no-store' },
      );
      if (!r.ok) {
        throw new Error(t('result.errorStatus', { status: r.status }));
      }
      const res: ResultData = await r.json();
      if (res && typeof res.totalScore === 'number') {
        setData(res);
        setError(null);

        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(`rd_play_${resolvedPlayId}`, JSON.stringify(res));
          } catch {}
        }

        // Account linking sheet logic
        const session = getLocalSession();
        const alreadyLinked = !session.isAnonymous && Boolean(session.email);
        if (!alreadyLinked) {
          try {
            const stored = localStorage.getItem('rd_link_sheet_state');
            const state: { dismissedDates: string[]; showCount: number } = stored
              ? JSON.parse(stored)
              : { dismissedDates: [], showCount: 0 };

            const today = res.date;
            const dismissedToday = state.dismissedDates.includes(today);
            const playsCount = res.finishedPlaysCount ?? 1;

            if (
              !dismissedToday &&
              state.showCount < 3 &&
              (playsCount === 1 || res.streakCurrent === 3)
            ) {
              const timer = setTimeout(() => {
                setIsLinkSheetOpen(true);
                const trigger = playsCount === 1 ? 'round_1' : 'streak_3';
                trackEvent('account_link_prompt_shown', { trigger });
                trackEvent('link_prompt_shown', {
                  score: res.totalScore,
                  streak: res.streakCurrent,
                  playsCount,
                });
              }, 1000);
              return () => clearTimeout(timer);
            } else if (playsCount >= 2 && playsCount <= 3) {
              setShowSlimBanner(true);
            }
          } catch {
            // fallback
          }
        }
        return;
      }
      throw new Error(t('result.errorInvalidData'));
    } catch (err: any) {
      if (cached) {
        setData(cached);
        setError(null);
      } else {
        setError(err?.message || t('result.errorLoad'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResult();
  }, [rawPlayId]);

  // After the score is shown, go back to the home screen, which switches to the
  // "already played today" state with the live countdown to the next round.
  useEffect(() => {
    if (!data || returnTo || typeof window === 'undefined') return;
    if (isLinkSheetOpen || isSharePickerOpen || isCreateLeagueOpen || isJoinCodeOpen) return;
    const key = `rd_result_auto_home_${data.playId}`;
    if (sessionStorage.getItem(key)) return;
    const timer = setTimeout(() => {
      sessionStorage.setItem(key, '1');
      router.replace(`/${locale}`);
    }, 10_000);
    return () => clearTimeout(timer);
  }, [
    data,
    locale,
    returnTo,
    router,
    isLinkSheetOpen,
    isSharePickerOpen,
    isCreateLeagueOpen,
    isJoinCodeOpen,
  ]);

  const handleLinkDismissed = () => {
    setIsLinkSheetOpen(false);
    if (!data) return;
    try {
      const stored = localStorage.getItem('rd_link_sheet_state');
      const state: { dismissedDates: string[]; showCount: number } = stored
        ? JSON.parse(stored)
        : { dismissedDates: [], showCount: 0 };
      if (!state.dismissedDates.includes(data.date)) {
        state.dismissedDates.push(data.date);
      }
      state.showCount += 1;
      localStorage.setItem('rd_link_sheet_state', JSON.stringify(state));
      setShowSlimBanner(true);
    } catch {
      // Ignore localStorage errors
    }
  };

  const handleLinkSuccess = () => {
    setIsAccountLinked(true);
    setShowSlimBanner(false);
    setIsLinkSheetOpen(false);
    setToast(t('result.accountSaved'));
    setTimeout(() => setToast(''), 3500);
  };

  const triggerShareWithLink = async (inviteUrl: string) => {
    if (!data) return;
    const streakText =
      data.streakCurrent > 0 ? t('result.shareStreak', { count: data.streakCurrent }) : undefined;
    const beatMeText = inviteUrl ? t('result.shareBeatMe', { url: inviteUrl }) : undefined;
    const cardText = buildShareCardText({
      roundNumber: data.roundNumber,
      totalScore: data.totalScore,
      emojiLine: data.emojiLine,
      streakText,
      beatMeText,
      inviteUrl,
    });

    if (navigator.share) {
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

  const [createdLeague, setCreatedLeague] = useState<{
    id: string;
    name: string;
    inviteCode: string;
  } | null>(null);

  const privateLeagues = (data?.leagueRanks ?? []).filter((l) => !l.isWorld);
  const primaryLeague =
    createdLeague || (privateLeagues.length > 0 ? privateLeagues[0] : null) || data?.primaryLeague;

  const handleShareClick = async () => {
    if (!data) return;
    const session = getLocalSession();
    if (privateLeagues.length === 0 && !createdLeague) {
      try {
        const res = await fetch('/api/leagues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: session.uid,
            tz: getBrowserTimeZone(),
            locale,
          }),
        });
        if (res.ok) {
          const created = await res.json();
          const info = {
            id: created.leagueId,
            name: created.name,
            inviteCode: created.inviteCode,
          };
          setCreatedLeague(info);
          const origin = window.location.origin;
          const url = `${origin}/${locale}/l/${created.inviteCode}?r=${session.uid}`;
          void triggerShareWithLink(url);
          return;
        }
      } catch {
        // fallback to dialog
      }
      setIsCreateLeagueOpen(true);
    } else if (privateLeagues.length <= 1) {
      const lg = createdLeague || privateLeagues[0] || data?.primaryLeague;
      const origin = window.location.origin;
      const url = lg?.inviteCode
        ? `${origin}/${locale}/l/${lg.inviteCode}?r=${session.uid}`
        : `${origin}/${locale}?r=${session.uid}`;
      void triggerShareWithLink(url);
    } else {
      setIsSharePickerOpen(true);
    }
  };

  const handleCreateDuel = async () => {
    const s = getLocalSession();
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
      router.push(`/${locale}/duel/${encodeURIComponent(created.duelId)}`);
    }
  };

  const submitQuestionReport = async () => {
    if (!reportingQuestionId || isReporting) return;
    setIsReporting(true);
    try {
      const session = getLocalSession();
      const res = await fetch('/api/questions/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: reportingQuestionId,
          reason: reportReason,
          reporterUid: session.uid,
        }),
      });
      if (res.ok) {
        setToast(t('result.reportSent'));
      } else {
        setToast(t('result.reportFailed'));
      }
    } catch {
      setToast(t('common.networkError'));
    } finally {
      setIsReporting(false);
      setReportingQuestionId(null);
      setTimeout(() => setToast(''), 3000);
    }
  };

  if (loading && !data) {
    return (
      <main className="text-muted mx-auto max-w-[480px] space-y-3 px-4 py-16 text-center font-bold">
        <div className="border-volt mx-auto h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
        <p>{t('result.calculating')}</p>
      </main>
    );
  }

  if (error || !data || typeof data.totalScore !== 'number') {
    return (
      <main className="mx-auto flex max-w-[480px] flex-col gap-4 px-4 py-12 text-center">
        <Card variant="sticker" className="space-y-4 p-6">
          <div className="bg-surface-2 border-border mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 text-2xl shadow-sm">
            🎯
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-ink text-xl font-extrabold">
              {t('result.processing')}
            </h1>
            <p className="text-muted mx-auto max-w-[280px] text-xs leading-relaxed">
              {t('result.savedRetryHint')}
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button variant="volt" fullWidth onClick={loadResult}>
              {t('common.retry')}
            </Button>
            <Link href={`/${locale}`} className="block">
              <Button variant="secondary" fullWidth>
                {t('result.backHome')}
              </Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  const worldRank = data.leagueRanks?.find((l) => l.isWorld);

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6">
      {/* Warning banner for unlinked anonymous users */}
      {!isAccountLinked && !showSlimBanner && (
        <Card
          variant="sticker"
          className="border-ron-strong bg-ron/10 space-y-1 border-2 p-3.5 text-left shadow-sm"
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 text-xl" aria-hidden="true">
              ⚠️
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="font-display text-ron-strong text-xs font-black">
                {t('result.saveScoreTitle')}
              </p>
              <p className="text-ink/80 text-[11px] font-bold leading-snug">
                {t('account.anonExpiry')}
              </p>
              <button
                type="button"
                onClick={() => setIsLinkSheetOpen(true)}
                className="text-ron-strong hover:text-ink mt-1 inline-flex cursor-pointer text-xs font-black underline"
              >
                {t('result.createFreeAccount')}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Slim banner on Day 2 & 3 for unlinked users */}
      {!isAccountLinked && showSlimBanner && (
        <button
          type="button"
          onClick={() => setIsLinkSheetOpen(true)}
          className="border-border-subtle bg-surface-2 hover:bg-surface text-ink flex w-full items-center justify-between rounded-xl border p-3 text-left shadow-sm transition"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} weight="bold" className="text-duel-strong shrink-0" />
            <span className="text-xs font-bold">{t('result.scoreNotSaved')}</span>
          </div>
          <span className="text-duel-strong text-xs font-extrabold underline">
            {t('common.save')}
          </span>
        </button>
      )}

      <Card
        onClick={skipAnimation}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') skipAnimation();
        }}
        tabIndex={animated ? 0 : undefined}
        className={cn('space-y-4 text-center', animated ? 'cursor-pointer' : '')}
      >
        <h1 className="sr-only">{t('result.title', { number: data.roundNumber })}</h1>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Chip tone="volt">{t('result.title', { number: data.roundNumber })}</Chip>
          {showPB && isPB && (
            <Chip tone="volt" className="rd-pop-in font-black">
              ⚡ {t('result.personalBest')}
            </Chip>
          )}
        </div>

        <p className="text-muted text-sm font-bold">{t('result.scoreLabel')}</p>
        <div className="flex items-center justify-center gap-3">
          <ScoreCountUp score={data.totalScore} animated={animated} />
          <Chip tone="neutral" className="rd-tabular text-sm font-bold">
            {t('result.correctCount', {
              correct: data.review.filter(
                (r) =>
                  r.correct || (r.points && r.points > 0) || r.emoji === '🟩' || r.emoji === '⚡',
              ).length,
              total: 6,
            })}
          </Chip>
        </div>

        {(() => {
          const correctCount = data.review.filter(
            (r) => r.correct || (r.points && r.points > 0) || r.emoji === '🟩' || r.emoji === '⚡',
          ).length;
          let cheerKey = 'result.cheer0';
          if (correctCount === 6) cheerKey = 'result.cheer6';
          else if (correctCount === 5) cheerKey = 'result.cheer5';
          else if (correctCount >= 3) cheerKey = 'result.cheer3_4';
          else if (correctCount >= 1) cheerKey = 'result.cheer1_2';
          return <p className="text-muted text-sm font-bold">{t(cheerKey)}</p>;
        })()}

        {/* Emoji Tiles with legend */}
        {showTiles && (
          <div className="space-y-1.5">
            <EmojiTiles emojiLine={data.emojiLine} animated={animated} />
            <p className="text-muted text-xs font-medium tracking-normal">
              {t('result.emojiLegend')}
            </p>
          </div>
        )}

        {/* Streak with Single Flame Bump */}
        <div className="flex items-center justify-center gap-2 text-sm font-bold">
          <Flame
            size={18}
            weight="fill"
            className={cn('text-ron-strong', flameBumping && animated ? 'rd-flame-bump' : '')}
            aria-hidden="true"
          />
          <span>{t('result.streak', { days: data.streakCurrent })}</span>
        </div>

        {/* League ranks breakdown */}
        <div className="border-border-subtle bg-surface-2 space-y-2 rounded-2xl border p-3.5 text-left">
          <p className="font-display text-muted text-xs font-extrabold uppercase tracking-wider">
            {t('result.scoreRecordedIn')}
          </p>
          <div className="space-y-2">
            {worldRank && (
              <div
                style={animated ? ({ animationDelay: '0ms' } as React.CSSProperties) : undefined}
                className={cn(
                  'flex items-center justify-between gap-2 text-xs font-bold',
                  animated && showRows ? 'rd-row-slide' : '',
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <GlobeHemisphereWest
                    size={16}
                    weight="bold"
                    className="text-duel-strong shrink-0"
                  />
                  <span className="text-ink truncate">RonDuel World</span>
                </div>
                <span className="rd-tabular text-ink shrink-0 font-extrabold">
                  {t('common.rankPlace', { rank: worldRank.rank })}{' '}
                  <span className="text-muted font-medium">
                    ({t('league.membersCount', { count: worldRank.totalMembers })})
                  </span>
                </span>
              </div>
            )}

            {privateLeagues.map((lg, idx) => (
              <div
                key={lg.id}
                style={
                  animated
                    ? ({
                        animationDelay: `${(idx + (worldRank ? 1 : 0)) * 80}ms`,
                      } as React.CSSProperties)
                    : undefined
                }
                className={cn(
                  'flex items-center justify-between gap-2 text-xs font-bold',
                  animated && showRows ? 'rd-row-slide' : '',
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Trophy size={16} weight="fill" className="text-volt-strong shrink-0" />
                  <span className="text-ink truncate">{lg.name}</span>
                </div>
                <span className="rd-tabular text-ink shrink-0 font-extrabold">
                  {t('common.rankPlace', { rank: lg.rank })}{' '}
                  <span className="text-muted font-medium">
                    ({t('league.membersCount', { count: lg.totalMembers })})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Primary action: Share to group */}
        <Button fullWidth size="lg" variant="primary" onClick={handleShareClick}>
          <ShareNetwork size={20} weight="bold" aria-hidden="true" />
          {t('result.shareCta')}
        </Button>

        {(primaryLeague || returnTo) && (
          <Link
            href={returnTo || `/${locale}/league/${primaryLeague?.id}`}
            className="rd-sticker rd-sticker-pressable bg-duel-strong inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] px-5 text-base font-bold text-[var(--rd-on-blue)]"
          >
            <Trophy size={18} weight="fill" aria-hidden="true" />
            {t('result.openLeague')} {primaryLeague?.name ? `(${primaryLeague.name})` : ''}
          </Link>
        )}

        {/* Secondary actions: Challenge friends & Have a code */}
        <div className="grid gap-2">
          <Button
            fullWidth
            size="md"
            variant="secondary"
            onClick={() => setIsCreateLeagueOpen(true)}
          >
            <Users size={18} weight="bold" aria-hidden="true" />
            {t('result.challengeCreateLeague')}
          </Button>

          <Button fullWidth size="sm" variant="secondary" onClick={() => setIsJoinCodeOpen(true)}>
            {t('result.haveCode')}
          </Button>

          <Button fullWidth size="sm" variant="secondary" onClick={() => void handleCreateDuel()}>
            <Sword size={16} weight="bold" aria-hidden="true" />
            {t('result.challengeFriend')}
          </Button>
        </div>
      </Card>

      {/* Share picker sheet if multiple private leagues */}
      <Sheet
        open={isSharePickerOpen}
        onClose={() => setIsSharePickerOpen(false)}
        title={t('result.pickLeagueToShare')}
      >
        <div className="space-y-2">
          {privateLeagues.map((lg) => (
            <button
              key={lg.id}
              type="button"
              onClick={() => {
                setIsSharePickerOpen(false);
                const origin = window.location.origin;
                const url = `${origin}/${locale}/l/${lg.inviteCode}?r=${getLocalSession().uid}`;
                void triggerShareWithLink(url);
              }}
              className="border-border bg-surface-2 hover:bg-surface flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition"
            >
              <div className="flex items-center gap-3">
                <Trophy size={20} weight="fill" className="text-volt-strong" />
                <span className="text-ink text-sm font-bold">{lg.name}</span>
              </div>
              <ShareNetwork size={18} weight="bold" className="text-muted" />
            </button>
          ))}
          <Button
            fullWidth
            size="md"
            variant="secondary"
            onClick={() => {
              setIsSharePickerOpen(false);
              const origin = window.location.origin;
              const url = `${origin}/${locale}?r=${getLocalSession().uid}`;
              void triggerShareWithLink(url);
            }}
          >
            {t('result.shareGeneralLink')}
          </Button>
        </div>
      </Sheet>

      {/* Account Linking Bottom Sheet */}
      <AccountLinkingSheet
        open={isLinkSheetOpen}
        onClose={handleLinkDismissed}
        score={data.totalScore}
        streak={data.streakCurrent}
        onLinked={handleLinkSuccess}
      />

      {/* Create League Dialog */}
      <CreateLeagueDialog
        open={isCreateLeagueOpen}
        onClose={() => setIsCreateLeagueOpen(false)}
        uid={getLocalSession().uid}
        onCreated={(league) => {
          const origin = window.location.origin;
          const url = `${origin}/${locale}/l/${league.inviteCode}?r=${getLocalSession().uid}`;
          void triggerShareWithLink(url);
        }}
      />

      {/* Join League by Code */}
      <JoinByCodeDialog open={isJoinCodeOpen} onClose={() => setIsJoinCodeOpen(false)} />

      {toast && (
        <div className="flex justify-center">
          <Toast message={toast} tone="success" />
        </div>
      )}

      {/* Review Section */}
      <section className="space-y-3" aria-labelledby="review-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="review-heading" className="font-display text-xl font-extrabold">
            {t('result.reviewTitle')}
          </h2>
          <Link
            href={`/${locale}/regulament#punctaj`}
            data-testid="result-rules-link"
            className="text-duel-strong inline-flex min-h-11 items-center text-xs font-bold underline underline-offset-2"
          >
            {t('rules.resultLink')}
          </Link>
        </div>
        {data.review.map((item) => {
          const isCorrect = Boolean(
            item.correct ||
            (item.points && item.points > 0) ||
            item.emoji === '🟩' ||
            item.emoji === '⚡',
          );
          return (
            <Card key={item.index} variant="subtle" className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">{item.prompt}</span>
                <span className="rd-tabular shrink-0 text-sm font-bold">
                  {item.emoji} +{item.points}
                </span>
              </div>

              <div className="space-y-1 text-xs font-bold sm:text-sm">
                {isCorrect ? (
                  <div className="text-correct-text flex items-center gap-1.5">
                    <span className="text-base" aria-hidden="true">
                      ✓
                    </span>
                    <span>{item.correctAnswer}</span>
                  </div>
                ) : (
                  <>
                    <div className="text-wrong flex items-center gap-1.5">
                      <span className="text-base" aria-hidden="true">
                        ✗
                      </span>
                      <span>
                        {t('result.yourAnswer', {
                          answer: item.userAnswer || (item.timedOut ? t('play.timedOut') : '—'),
                        })}
                      </span>
                    </div>
                    <div className="text-correct-text flex items-center gap-1.5">
                      <span className="text-base" aria-hidden="true">
                        ✓
                      </span>
                      <span>{item.correctAnswer}</span>
                    </div>
                  </>
                )}
              </div>

              {item.explanation && <p className="text-muted text-xs">{item.explanation}</p>}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setReportingQuestionId(item.questionId || `q_${item.index}`)}
                  className="text-muted hover:text-wrong cursor-pointer text-[11px] font-bold underline"
                >
                  {t('result.reportQuestion')}
                </button>
              </div>
            </Card>
          );
        })}
      </section>

      {/* Report Question Sheet */}
      <Sheet
        open={Boolean(reportingQuestionId)}
        onClose={() => setReportingQuestionId(null)}
        title={t('result.reportQuestion')}
      >
        <div className="space-y-3.5">
          <p className="text-muted text-xs font-medium">{t('result.reportPrompt')}</p>
          <div className="space-y-2">
            {[
              { id: 'wrong_answer', label: t('result.reportReasonWrongAnswer') },
              { id: 'ambiguous', label: t('result.reportReasonAmbiguous') },
              { id: 'language_error', label: t('result.reportReasonLanguage') },
            ].map((opt) => (
              <label
                key={opt.id}
                className="border-border bg-surface-2 text-ink hover:bg-surface flex cursor-pointer items-center gap-2.5 rounded-xl border-2 p-3 text-sm font-bold"
              >
                <input
                  type="radio"
                  name="report_reason"
                  value={opt.id}
                  checked={reportReason === opt.id}
                  onChange={() => setReportReason(opt.id as any)}
                  className="accent-ron-strong h-4 w-4"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              size="md"
              variant="secondary"
              fullWidth
              onClick={() => setReportingQuestionId(null)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              size="md"
              variant="danger"
              fullWidth
              disabled={isReporting}
              onClick={() => void submitQuestionReport()}
            >
              {isReporting ? t('common.sending') : t('result.reportSubmit')}
            </Button>
          </div>
        </div>
      </Sheet>
    </main>
  );
}
