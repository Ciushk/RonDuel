'use client';

import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Copy,
  Lightning,
  Sword,
  Trophy,
  XCircle,
} from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AuthModal } from '@/components/AuthModal';
import { VersusCard } from '@/components/duel/VersusCard';
import { InstallAppSheet } from '@/components/InstallAppSheet';
import { Avatar, Button, Card, Chip, TimerBar, Toast } from '@/components/ui';
import { getBrowserTimeZone, getLocalSession, recordPlayedDuel, vibrate } from '@/lib/session';
import { useInstallPrompt } from '@/lib/use-install-prompt';

interface ClientItem {
  index: number;
  type: 'mcq' | 'order' | 'odd' | 'logic';
  prompt: string;
  options: string[];
  limitMs: number;
  isEnFallback: boolean;
}

interface DuelView {
  id: string;
  status: 'pending' | 'active' | 'complete' | 'expired';
  challengerUid: string;
  opponentUid: string | null;
  winnerUid: string | null;
  walkover: boolean;
  walkoverNote?: string;
  rated?: boolean;
  sides: Record<
    string,
    {
      uid: string;
      nickname: string;
      score: number;
      totalMs: number;
      finishedAt?: string;
    }
  >;
  headToHead: Record<string, number>;
  breakdown: Array<{
    index: number;
    prompt: string;
    correctAnswer: string;
    challengerPts: number;
    opponentPts: number;
  }>;
}

export default function DuelPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const rawDuelId = decodeURIComponent(params.id);
  const duelId =
    rawDuelId === '_shell' && typeof window !== 'undefined'
      ? decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() ?? rawDuelId)
      : rawDuelId;

  const [duel, setDuel] = useState<DuelView | null>(null);
  const [myUid, setMyUid] = useState('');
  const [playing, setPlaying] = useState(false);
  const [totalItems, setTotalItems] = useState(5);
  const [item, setItem] = useState<ClientItem | null>(null);
  const [orderList, setOrderList] = useState<string[]>([]);
  const [remainingMs, setRemainingMs] = useState(30_000);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    points: number;
    correctIndex?: number;
    timedOut?: boolean;
  } | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [lockedIndex, setLockedIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isFastAnswer, setIsFastAnswer] = useState(false);
  const [toast, setToast] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isRematching, setIsRematching] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const deadlineRef = useRef<number>(0);

  const { isInstallOpen, installPlatform, closeInstall } = useInstallPrompt({
    ready: Boolean(duel && duel.status === 'complete' && !playing),
    hasFinishedMatch: true,
    animationsComplete: true,
    blockedByOtherSheet: authModalOpen || playing,
  });

  const loadDuel = useCallback(() => {
    const s = getLocalSession();
    setMyUid(s.uid);
    setIsAnonymous(s.isAnonymous || !s.email);
    fetch(`/api/duels/${encodeURIComponent(duelId)}?locale=${encodeURIComponent(locale)}`)
      .then((r) => r.json())
      .then((d: DuelView) => setDuel(d))
      .catch(() => {});
  }, [duelId, locale]);

  useEffect(() => {
    loadDuel();
  }, [loadDuel]);

  const handleRematch = async () => {
    if (!duel || isRematching) return;
    const s = getLocalSession();
    const opponent =
      duel.sides.challenger?.uid === s.uid ? duel.sides.opponent : duel.sides.challenger;
    setIsRematching(true);
    try {
      const res = await fetch('/api/duels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengerUid: s.uid,
          opponentUid: opponent?.uid ?? null,
          nickname: s.nickname || undefined,
          tz: getBrowserTimeZone(),
        }),
      });
      const data = await res.json();
      if (data.duelId) {
        router.push(`/${locale}/duel/${encodeURIComponent(data.duelId)}`);
      } else {
        setToast(data.error || t('duel.errorRematch'));
        setIsRematching(false);
      }
    } catch {
      setToast(t('duel.errorRematchFailed'));
      setIsRematching(false);
    }
  };

  const startMyTurn = async () => {
    const s = getLocalSession();
    recordPlayedDuel(duelId);
    const res = await fetch(`/api/duels/${encodeURIComponent(duelId)}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: s.uid,
        nickname: s.nickname || `Player_${s.uid.slice(-3)}`,
        locale,
      }),
    });
    const data = await res.json();
    if (data.alreadyFinished) {
      loadDuel();
      return;
    }
    setTotalItems(data.totalItems);
    setItem(data.item);
    setOrderList(data.item.options);
    setRemainingMs(data.remainingMs);
    deadlineRef.current = Date.now() + data.remainingMs;
    setPlaying(true);
  };

  const submitTurnAnswer = useCallback(
    async (choice: number | string[] | null) => {
      if (!item || feedback || submitting) return;
      if (typeof choice === 'number') {
        setSelectedChoice(choice);
        setLockedIndex(choice);
        vibrate(15);
      }
      setSubmitting(true);

      const currentRemaining = Math.max(0, deadlineRef.current - Date.now());
      const isFast = item.limitMs > 0 && currentRemaining >= item.limitMs * 0.67;
      setIsFastAnswer(isFast);

      const s = getLocalSession();
      const res = await fetch(`/api/duels/${encodeURIComponent(duelId)}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: s.uid,
          index: item.index,
          choice,
          locale,
        }),
      });
      const data = await res.json();
      setFeedback({
        correct: Boolean(data.correct),
        points: data.points ?? 0,
        correctIndex: data.correctIndex,
        timedOut: Boolean(data.timedOut),
      });
      setSubmitting(false);
      vibrate(data.correct ? 20 : [40, 30, 40]);

      setTimeout(() => {
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
          setPlaying(false);
          setItem(null);
          setFeedback(null);
          setLockedIndex(null);
          setIsFastAnswer(false);
          loadDuel();
        }
      }, 900);
    },
    [item, feedback, submitting, duelId, locale, loadDuel],
  );

  useEffect(() => {
    if (!playing || !item || feedback) return;
    const interval = setInterval(() => {
      const left = Math.max(0, deadlineRef.current - Date.now());
      setRemainingMs(left);
      if (left <= 0) {
        clearInterval(interval);
        void submitTurnAnswer(null);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [playing, item, feedback, submitTurnAnswer]);

  const moveOrderItem = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= orderList.length) return;
    const next = [...orderList];
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    setOrderList(next);
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/${locale}/duel/${duelId}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setToast(t('duel.linkCopied'));
    setTimeout(() => setToast(''), 2500);
  };

  if (!duel) {
    return (
      <main className="text-muted mx-auto max-w-[480px] px-4 py-12 text-center">
        {t('common.loading')}
      </main>
    );
  }

  if (playing && item) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-4 py-6">
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
        <div className="flex items-center justify-between">
          <Chip tone="volt" className="rd-tabular">
            {t('play.itemCounter', { current: item.index + 1, total: totalItems })}
          </Chip>
          <Chip tone="neutral" className="uppercase">
            {item.type}
          </Chip>
        </div>

        <TimerBar remainingMs={remainingMs} limitMs={item.limitMs} />

        <Card className="space-y-4">
          <h1 className="font-display text-2xl font-extrabold">{item.prompt}</h1>
          {item.type === 'order' ? (
            <div className="space-y-2">
              {orderList.map((opt, idx) => (
                <div
                  key={opt}
                  className="border-border bg-surface-2 flex min-h-14 items-center justify-between gap-2 rounded-[14px] border-2 px-4 py-2 font-bold"
                >
                  <span>{opt}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={idx === 0 || Boolean(feedback)}
                      onClick={() => moveOrderItem(idx, -1)}
                      aria-label={`${t('play.moveUp')} ${opt}`}
                      className="border-border-subtle bg-surface inline-flex h-11 w-11 items-center justify-center rounded-[10px] border"
                    >
                      <ArrowUp size={18} weight="bold" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === orderList.length - 1 || Boolean(feedback)}
                      onClick={() => moveOrderItem(idx, 1)}
                      aria-label={`${t('play.moveDown')} ${opt}`}
                      className="border-border-subtle bg-surface inline-flex h-11 w-11 items-center justify-center rounded-[10px] border"
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
                onClick={() => void submitTurnAnswer(orderList)}
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
                    onClick={() => void submitTurnAnswer(idx)}
                    className={[
                      'rd-sticker rd-sticker-pressable relative flex min-h-14 w-full cursor-pointer items-center justify-between rounded-[14px] px-4 py-3 text-left text-base font-bold transition-all',
                      isLocked ? 'rd-locked' : '',
                      isDimmed ? 'pointer-events-none opacity-60' : '',
                      isCorrectChoice && isSelected
                        ? 'bg-correct rd-pop text-[#16131F]'
                        : isWrongSelected
                          ? 'bg-wrong rd-shake text-[var(--rd-on-wrong)]'
                          : isCorrectAnswerRevealed
                            ? 'border-correct-text bg-correct/20 text-ink animate-in fade-in border-2 duration-300'
                            : 'bg-surface text-ink hover:bg-surface-2',
                    ].join(' ')}
                  >
                    <span className="flex-1 pr-3">{opt}</span>

                    {feedback && feedback.correct && isSelected && (
                      <span className="rd-float-up bg-volt pointer-events-none absolute -top-3 right-3 z-30 inline-flex items-center gap-1 rounded-full border-2 border-[#16131F] px-2.5 py-0.5 text-xs font-black text-[#16131F] shadow-[0_2px_0_#16131F]">
                        +{feedback.points}
                      </span>
                    )}

                    {isCorrectChoice && (
                      <div className="relative inline-flex items-center justify-center">
                        <CheckCircle
                          size={22}
                          weight="fill"
                          className={
                            isCorrectAnswerRevealed
                              ? 'text-correct-text rd-pop-icon'
                              : 'rd-pop-icon'
                          }
                          aria-hidden="true"
                        />
                        {feedback?.correct && isSelected && isFastAnswer && (
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 flex items-center justify-center"
                          >
                            <span className="rd-ray-ring border-volt absolute h-6 w-6 rounded-full border-2" />
                            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                              <span
                                key={deg}
                                className="rd-ray bg-volt absolute h-3.5 w-1 rounded-full"
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

  const challenger = duel.sides[duel.challengerUid];
  const opponent = duel.opponentUid ? duel.sides[duel.opponentUid] : undefined;
  const mySide = duel.sides[myUid];
  const canPlayMyTurn =
    !mySide?.finishedAt && duel.status !== 'complete' && duel.status !== 'expired';
  const winnerSide = duel.winnerUid ? duel.sides[duel.winnerUid] : undefined;

  const headToHead = opponent
    ? {
        meWins: duel.headToHead[myUid] ?? 0,
        opponentWins:
          duel.headToHead[duel.opponentUid === myUid ? duel.challengerUid : duel.opponentUid!] ?? 0,
      }
    : null;

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6">
      {/* Header link & chip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <Chip tone="volt">
          <Sword size={14} weight="fill" aria-hidden="true" />
          {t('duel.title')}
        </Chip>
        <Link
          href={`/${locale}/regulament#dueluri`}
          data-testid="duel-rules-link"
          className="text-duel-strong inline-flex min-h-11 items-center font-bold underline underline-offset-2"
        >
          {t('rules.duelLink')}
        </Link>
      </div>

      {/* Versus Card */}
      <VersusCard
        duelId={duel.id}
        challenger={
          challenger ?? { uid: duel.challengerUid, nickname: t('duel.challengerFallback') }
        }
        opponent={opponent}
        myUid={myUid}
        winnerUid={duel.winnerUid}
        status={duel.status}
        canPlayMyTurn={canPlayMyTurn}
        onPlay={() => void startMyTurn()}
        headToHead={headToHead}
      />

      {/* Rematch & Share Actions */}
      <div className="flex flex-col gap-3">
        {duel.status === 'complete' && (
          <Button
            fullWidth
            size="lg"
            variant="primary"
            disabled={isRematching}
            onClick={() => void handleRematch()}
            className="font-black"
          >
            <Sword size={18} weight="bold" className="mr-1.5" />
            {isRematching ? t('duel.starting') : t('duel.rematch')}
          </Button>
        )}

        <Button fullWidth size="sm" variant="blue" onClick={() => void copyLink()}>
          <Copy size={16} weight="bold" aria-hidden="true" />
          {t('duel.copyChallengeLink')}
        </Button>
      </div>

      {/* Anonymous Warning Banner */}
      {duel.status === 'complete' && isAnonymous && (
        <Card
          variant="sticker"
          className="border-border bg-surface-2 space-y-2 border-2 p-3.5 text-left"
        >
          <p className="text-ink text-xs font-extrabold leading-snug">
            {t('duel.signInToKeepRecord')}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="volt"
              fullWidth
              onClick={() => setAuthModalOpen(true)}
              className="text-xs font-bold"
            >
              {t('duel.signInOrSignUp')}
            </Button>
          </div>
        </Card>
      )}

      {toast && (
        <div className="flex justify-center">
          <Toast message={toast} tone="success" />
        </div>
      )}

      {/* Auth Modal for anonymous users wanting to save duel stats */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="login"
        onSuccess={() => {
          setAuthModalOpen(false);
          loadDuel();
        }}
      />

      {duel.breakdown.length > 0 && (
        <section className="space-y-3" aria-labelledby="duel-breakdown-heading">
          <h2 id="duel-breakdown-heading" className="font-display text-xl font-extrabold">
            {t('duel.breakdownTitle')}
          </h2>
          {duel.breakdown.map((row) => (
            <Card key={row.index} variant="subtle" className="space-y-1.5">
              <p className="text-sm font-bold">{row.prompt}</p>
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-ron-strong">
                  {challenger?.nickname}: +{row.challengerPts}
                </span>
                <span className="text-correct-text">{row.correctAnswer}</span>
                <span className="text-duel-strong">
                  {opponent?.nickname}: +{row.opponentPts}
                </span>
              </div>
            </Card>
          ))}
        </section>
      )}

      {installPlatform && (
        <InstallAppSheet open={isInstallOpen} platform={installPlatform} onClose={closeInstall} />
      )}
    </main>
  );
}
