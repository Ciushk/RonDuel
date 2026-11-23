'use client';

import { ArrowDown, ArrowUp, CheckCircle, Lightning, XCircle } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, Card, Chip, TimerBar, Wordmark } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { apiErrorMessage } from '@/lib/api-error';
import { getBrowserTimeZone, getLocalSession, vibrate } from '@/lib/session';

interface ClientItem {
  index: number;
  type: 'mcq' | 'order' | 'odd' | 'logic';
  prompt: string;
  options: string[];
  limitMs: number;
  isEnFallback: boolean;
}

interface AnswerFeedback {
  correct: boolean;
  points: number;
  timedOut: boolean;
  emoji: '⚡' | '🟩' | '🟥';
  correctIndex?: number;
  correctOrder?: string[];
  explanation?: string;
  next: ClientItem | null;
}

export default function PlayPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [phase, setPhase] = useState<'ready' | 'countdown' | 'playing'>('ready');
  const [countdown, setCountdown] = useState(3);
  const [playId, setPlayId] = useState<string>('');
  const [totalItems, setTotalItems] = useState(6);
  const [item, setItem] = useState<ClientItem | null>(null);
  const [orderList, setOrderList] = useState<string[]>([]);
  const [remainingMs, setRemainingMs] = useState(30_000);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [lockedIndex, setLockedIndex] = useState<number | null>(null);
  const [isFastAnswer, setIsFastAnswer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [todayInfo, setTodayInfo] = useState<{ roundNumber: number; theme: string } | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [roundError, setRoundError] = useState<string | null>(null);

  const deadlineRef = useRef<number>(0);
  const clientAnswersRef = useRef<Array<{ index: number; points: number; emoji: string }>>([]);
  const streakRef = useRef<{ current: number; best: number }>({ current: 0, best: 0 });

  const beginRound = useCallback(async (resync = false) => {
    if (!resync) clientAnswersRef.current = [];
    const session = getLocalSession();
    setRoundError(null);
    let data: any;
    try {
      const res = await fetch('/api/game/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: session.uid,
          tz: getBrowserTimeZone(),
          locale,
          nickname: session.nickname || undefined,
          relaxedTimer: session.relaxedTimer,
        }),
      });
      data = await res.json().catch(() => null);
      // 409 carries { alreadyFinished: true, playId }, handled below.
      if (!data || (!data.alreadyFinished && (!res.ok || !data.playId || !data.item))) {
        setRoundError(apiErrorMessage(t, data, 'common.networkErrorRetry'));
        setPhase('ready');
        return;
      }
    } catch {
      setRoundError(t('common.networkErrorRetry'));
      setPhase('ready');
      return;
    }
    const returnTo = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('returnTo') : null;
    if (data.alreadyFinished && data.playId) {
      router.replace(
        returnTo
          ? `/${locale}/result/${encodeURIComponent(data.playId)}?returnTo=${encodeURIComponent(returnTo)}`
          : `/${locale}/result/${encodeURIComponent(data.playId)}`,
      );
      return;
    }
    setPlayId(data.playId);
    setTotalItems(data.totalItems);
    setItem(data.item);
    setOrderList(data.item.options);
    setRemainingMs(data.remainingMs);
    deadlineRef.current = Date.now() + data.remainingMs;
    setFeedback(null);
    setSelectedChoice(null);
    setLockedIndex(null);
    setIsFastAnswer(false);
    setAnswerError(null);
    setPhase('playing');
    trackEvent('round_started', { play_id: data.playId });
  }, [locale, router, t]);

  useEffect(() => {
    const session = getLocalSession();
    const tz = getBrowserTimeZone();
    fetch(`/api/game/status?uid=${encodeURIComponent(session.uid)}&tz=${encodeURIComponent(tz)}`)
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.streakCurrent === 'number') {
          streakRef.current = { current: d.streakCurrent, best: d.streakBest ?? d.streakCurrent };
        }
        if (d.roundNumber) {
          setTodayInfo({ roundNumber: d.roundNumber, theme: d.topicOfTheDay || d.theme });
        }
        if (d.played && d.playId) {
          router.replace(`/${locale}/result/${encodeURIComponent(d.playId)}`);
        } else if (d.inProgress) {
          void beginRound();
        }
      })
      .catch(() => {});
  }, [locale, router, beginRound]);

  // 3-2-1 countdown
  useEffect(() => {
    if (phase !== 'countdown') return;
    vibrate(15);
    if (countdown <= 1) {
      const timer = setTimeout(() => {
        void beginRound();
      }, 650);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 650);
    return () => clearTimeout(timer);
  }, [phase, countdown, beginRound]);

  const handleSubmit = useCallback(
    async (choice: number | string[] | null) => {
      if (!item || !playId || submitting || feedback) return;
      if (typeof choice === 'number') {
        setSelectedChoice(choice);
        setLockedIndex(choice);
        vibrate(15);
      }
      setSubmitting(true);

      const currentRemaining = Math.max(0, deadlineRef.current - Date.now());
      const isFast = item.limitMs > 0 && currentRemaining >= item.limitMs * 0.67;
      setIsFastAnswer(isFast);

      const session = getLocalSession();
      setAnswerError(null);
      let data: AnswerFeedback;
      try {
        const res = await fetch('/api/game/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: session.uid,
            playId,
            index: item.index,
            choice,
          }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body || typeof body.correct !== 'boolean') {
          const code = body?.code;
          if (
            code === 'ITEM_ALREADY_ANSWERED' ||
            code === 'ITEM_NOT_SERVED' ||
            code === 'PLAY_NOT_FOUND' ||
            code === 'PLAY_ALREADY_FINISHED'
          ) {
            // Server state differs from ours (lost response, restarted server): re-sync.
            setSubmitting(false);
            await beginRound(true);
            return;
          }
          throw new Error(apiErrorMessage(t, body, 'common.networkErrorRetry'));
        }
        data = body as AnswerFeedback;
      } catch (err) {
        // Unlock the question so the player can tap again; never end the round on an error.
        setSubmitting(false);
        setSelectedChoice(null);
        setLockedIndex(null);
        setAnswerError(err instanceof Error && err.message ? err.message : t('common.networkErrorRetry'));
        return;
      }
      setFeedback(data);
      setSubmitting(false);

      const announcement = data.timedOut
        ? t('play.srTimeout')
        : data.correct
          ? t('play.srCorrect', { points: data.points ?? 0 })
          : t('play.srWrong', { answer: item.options[data.correctIndex ?? 0] ?? '' });
      setLiveAnnouncement(announcement);

      clientAnswersRef.current.push({
        index: item.index,
        points: data.points ?? 0,
        emoji: data.correct ? '🟩' : '🟥',
      });

      if (data.correct) {
        vibrate(20);
      } else {
        vibrate([40, 30, 40]);
      }

      setTimeout(async () => {
        if (data.next) {
          setItem(data.next);
          setOrderList(data.next.options);
          setRemainingMs(data.next.limitMs);
          deadlineRef.current = Date.now() + data.next.limitMs;
          setFeedback(null);
          setSelectedChoice(null);
          setLockedIndex(null);
          setIsFastAnswer(false);
        } else {
          const totalScore = clientAnswersRef.current.reduce((sum, a) => sum + (a.points || 0), 0);
          const emojiLine = clientAnswersRef.current.map((a) => a.emoji).join('');
          const clientSummary = {
            totalScore,
            emojiLine,
            items: clientAnswersRef.current,
          };

          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(
                `rd_play_${playId}`,
                JSON.stringify({
                  playId,
                  date: new Date().toISOString().slice(0, 10),
                  roundNumber: todayInfo?.roundNumber ?? 1,
                  totalScore,
                  totalMs: 0,
                  emojiLine,
                  streakCurrent: streakRef.current.current + 1,
                  streakBest: Math.max(streakRef.current.best, streakRef.current.current + 1),
                  review: [],
                  leagueRanks: [],
                  primaryLeague: null,
                }),
              );
            } catch {}
          }

          trackEvent('round_finished', {
            play_id: playId,
            score: totalScore,
            round_number: todayInfo?.roundNumber,
          });

          // Retry a few times: if finish never reaches the server the result page has no data.
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              const finishRes = await fetch('/api/game/finish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: session.uid, playId, clientSummary }),
              });
              if (finishRes.ok) break;
            } catch {
              // network error, retry below
            }
            await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          }

          const returnTo =
            typeof window !== 'undefined'
              ? new URLSearchParams(window.location.search).get('returnTo')
              : null;
          router.replace(
            returnTo
              ? `/${locale}/result/${encodeURIComponent(playId)}?returnTo=${encodeURIComponent(returnTo)}`
              : `/${locale}/result/${encodeURIComponent(playId)}`,
          );
        }
      }, 1500);
    },
    [item, playId, submitting, feedback, locale, router, todayInfo?.roundNumber, t, beginRound],
  );

  // Item countdown tick
  useEffect(() => {
    if (phase !== 'playing' || !item || feedback) return;
    const interval = setInterval(() => {
      const left = Math.max(0, deadlineRef.current - Date.now());
      setRemainingMs(left);
      if (left <= 0) {
        clearInterval(interval);
        void handleSubmit(null);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [phase, item, feedback, handleSubmit]);

  const moveOrderItem = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= orderList.length) return;
    const next = [...orderList];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    setOrderList(next);
  };

  if (phase === 'ready') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col justify-between px-4 py-6">
        <header className="flex items-center justify-between">
          <Link
            href={`/${locale}`}
            className="text-muted hover:text-ink text-sm font-bold transition-colors"
          >
            ← {t('play.backToHome')}
          </Link>
          <Wordmark size="sm" />
        </header>

        <div className="my-auto flex flex-col items-center justify-center gap-6">
          <div className="rd-seam h-2 w-24 rounded-full" aria-hidden="true" />
          <Card className="w-full space-y-5 text-center">
            {todayInfo && (
              <div className="flex justify-center">
                <Chip tone="volt">
                  {t('brand.roundBadge', { number: todayInfo.roundNumber })} · {todayInfo.theme}
                </Chip>
              </div>
            )}
            <h1 className="font-display text-3xl font-extrabold">{t('play.readyTitle')}</h1>
            <p className="text-muted text-sm">{t('play.readySubtitle')}</p>
            {roundError && (
              <p role="alert" className="text-wrong text-sm font-bold">
                {roundError}
              </p>
            )}
            <Button
              fullWidth
              size="lg"
              onClick={() => {
                setCountdown(3);
                setPhase('countdown');
              }}
            >
              {t('play.startNow')}
            </Button>
          </Card>
        </div>

        <div className="h-6" aria-hidden="true" />
      </main>
    );
  }

  if (phase === 'countdown') {
    return (
      <main className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col justify-between overflow-hidden px-4 py-6">
        <header className="flex items-center justify-between">
          <Link
            href={`/${locale}`}
            className="text-muted hover:text-ink text-sm font-bold transition-colors"
          >
            ← {t('play.backToHome')}
          </Link>
          <Wordmark size="sm" />
        </header>

        <div className="my-auto flex flex-col items-center justify-center text-center">
          {todayInfo && (
            <div className="mb-6 flex flex-col items-center justify-center gap-1">
              <span className="font-display text-muted text-sm font-black uppercase tracking-wider">
                {t('brand.roundBadge', { number: todayInfo.roundNumber })}
              </span>
              <span className="font-display text-ink text-xl font-extrabold">
                {todayInfo.theme}
              </span>
            </div>
          )}

          <div
            className="font-display text-ron-strong text-9xl font-extrabold animate-pulse"
            aria-live="assertive"
          >
            {countdown}
          </div>
          <div className="rd-seam mt-6 h-2 w-32 rounded-full" aria-hidden="true" />
        </div>

        <div className="h-6" aria-hidden="true" />
      </main>
    );
  }

  if (!item) return null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-4 py-6">
      {/* Persistent live region for screen readers */}
      <div role="status" aria-live="assertive" className="sr-only">
        {liveAnnouncement}
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalItems}
        aria-valuenow={Math.min(totalItems, item.index + (feedback ? 1 : 0))}
        className="bg-surface-2 border-border-subtle h-2 w-full overflow-hidden rounded-full border"
      >
        <div
          className="rd-seam h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, ((item.index + (feedback ? 1 : 0)) / Math.max(1, totalItems)) * 100)}%`,
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Chip tone="neutral" className="rd-tabular">
          {t('play.itemCounter', { current: item.index + 1, total: totalItems })}
        </Chip>
        <div className="flex items-center gap-2">
          {item.isEnFallback && locale !== 'en' && <Chip tone="blue">{t('play.enFallback')}</Chip>}
          <Chip tone="neutral" className="uppercase">
            {t(`play.typeLabels.${item.type}` as any)}
          </Chip>
        </div>
      </div>

      <TimerBar
        remainingMs={remainingMs}
        limitMs={item.limitMs}
        label={t('play.timeLeft')}
      />

      <Card className="space-y-5">
        <h1 className="font-display text-2xl font-extrabold leading-snug">{item.prompt}</h1>

        {item.type === 'order' ? (
          <div className="space-y-2.5">
            {orderList.map((opt, idx) => (
              <div
                key={opt}
                className="border-border bg-surface-2 flex min-h-14 items-center justify-between gap-2 rounded-[14px] border-2 px-4 py-2 font-bold"
              >
                <span className="rd-tabular text-muted mr-2 text-xs">{idx + 1}.</span>
                <span className="flex-1 text-left">{opt}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={idx === 0 || Boolean(feedback)}
                    onClick={() => moveOrderItem(idx, -1)}
                    aria-label={`${t('play.moveUp')} ${opt}`}
                    className="border-border-subtle bg-surface inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[10px] border disabled:opacity-30"
                  >
                    <ArrowUp size={18} weight="bold" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === orderList.length - 1 || Boolean(feedback)}
                    onClick={() => moveOrderItem(idx, 1)}
                    aria-label={`${t('play.moveDown')} ${opt}`}
                    className="border-border-subtle bg-surface inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[10px] border disabled:opacity-30"
                  >
                    <ArrowDown size={18} weight="bold" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
            <Button
              fullWidth
              size="lg"
              variant="blue"
              disabled={Boolean(feedback) || submitting}
              onClick={() => void handleSubmit(orderList)}
            >
              {t('play.submitOrder')}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {item.options.map((opt, idx) => {
              const isLocked = submitting && lockedIndex === idx;
              const isDimmed = submitting && lockedIndex !== null && lockedIndex !== idx;
              const isSelected = selectedChoice === idx;
              const isCorrectChoice = feedback && feedback.correctIndex === idx;
              const isWrongSelected = feedback && !feedback.correct && isSelected;
              const isCorrectAnswerRevealed = feedback && !feedback.correct && isCorrectChoice;

              return (
                <button
                  key={opt}
                  type="button"
                  disabled={Boolean(feedback) || submitting}
                  aria-pressed={lockedIndex === idx}
                  onClick={() => void handleSubmit(idx)}
                  className={[
                    'rd-sticker rd-sticker-pressable relative flex min-h-14 w-full cursor-pointer items-center justify-between rounded-[14px] px-4 py-3 text-left text-base font-bold transition-all',
                    isLocked ? 'rd-locked' : '',
                    isDimmed ? 'opacity-60 pointer-events-none' : '',
                    isCorrectChoice && isSelected
                      ? 'bg-correct text-[#16131F] rd-pop'
                      : isWrongSelected
                        ? 'bg-wrong text-[var(--rd-on-wrong)] rd-shake'
                        : isCorrectAnswerRevealed
                          ? 'border-2 border-correct-text bg-correct/20 text-ink animate-in fade-in duration-300'
                          : 'bg-surface text-ink hover:bg-surface-2',
                  ].join(' ')}
                >
                  <span className="flex-1 pr-3">{opt}</span>

                  {/* Screen reader text for choices */}
                  {isCorrectChoice && <span className="sr-only">{t('play.srOptionCorrect')}</span>}
                  {isWrongSelected && <span className="sr-only">{t('play.srOptionWrong')}</span>}

                  {/* Float score tag when selected & correct */}
                  {feedback && feedback.correct && isSelected && (
                    <span className="rd-float-up pointer-events-none absolute right-3 -top-3 z-30 inline-flex items-center gap-1 rounded-full border-2 border-[#16131F] bg-volt px-2.5 py-0.5 text-xs font-black text-[#16131F] shadow-[0_2px_0_#16131F]">
                      +{feedback.points}
                    </span>
                  )}

                  {/* Status Icons */}
                  {isCorrectChoice && (
                    <div className="relative inline-flex items-center justify-center">
                      <CheckCircle
                        size={22}
                        weight="fill"
                        className={isCorrectAnswerRevealed ? 'text-correct-text rd-pop-icon' : 'rd-pop-icon'}
                        aria-hidden="true"
                      />
                      {/* Fast Answer Bonus Spark Rays */}
                      {feedback?.correct && isSelected && isFastAnswer && (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 flex items-center justify-center"
                        >
                          <span className="rd-ray-ring absolute h-6 w-6 rounded-full border-2 border-volt" />
                          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                            <span
                              key={deg}
                              className="rd-ray absolute h-3.5 w-1 rounded-full bg-volt"
                              style={{ '--r': `${deg}deg` } as React.CSSProperties}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {isWrongSelected && <XCircle size={22} weight="fill" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {answerError && (
        <p role="alert" className="text-wrong text-center text-sm font-bold">
          {answerError}
        </p>
      )}

      <div className="min-h-10 text-center">
        {feedback && (
          <div className="inline-flex items-center gap-2">
            <Chip tone={feedback.correct ? 'volt' : 'wrong'}>
              {feedback.correct && <Lightning size={14} weight="fill" aria-hidden="true" />}
              {feedback.timedOut
                ? t('play.timedOut')
                : feedback.correct
                  ? `${t('play.correct')} +${feedback.points}${isFastAnswer ? ` · ${t('play.fastBonus')}` : ''}`
                  : t('play.wrong')}
            </Chip>
          </div>
        )}
      </div>
    </main>
  );
}
