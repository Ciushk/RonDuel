'use client';

import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Copy,
  Sword,
  Trophy,
  XCircle,
} from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Avatar, Button, Card, Chip, TimerBar, Toast } from '@/components/ui';
import { getLocalSession, vibrate } from '@/lib/session';

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
  const [remainingMs, setRemainingMs] = useState(10_000);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    points: number;
    correctIndex?: number;
  } | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const deadlineRef = useRef<number>(0);

  const loadDuel = useCallback(() => {
    const s = getLocalSession();
    setMyUid(s.uid);
    fetch(`/api/duels/${encodeURIComponent(duelId)}?locale=${encodeURIComponent(locale)}`)
      .then((r) => r.json())
      .then((d: DuelView) => setDuel(d))
      .catch(() => {});
  }, [duelId, locale]);

  useEffect(() => {
    loadDuel();
  }, [loadDuel]);

  const startMyTurn = async () => {
    const s = getLocalSession();
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
      if (!item || feedback) return;
      if (typeof choice === 'number') setSelectedChoice(choice);
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
      });
      vibrate(data.correct ? 20 : [40, 30, 40]);

      setTimeout(() => {
        if (data.next) {
          setItem(data.next);
          setOrderList(data.next.options);
          setRemainingMs(data.next.limitMs);
          deadlineRef.current = Date.now() + data.next.limitMs;
          setFeedback(null);
          setSelectedChoice(null);
        } else {
          setPlaying(false);
          setItem(null);
          setFeedback(null);
          loadDuel();
        }
      }, 900);
    },
    [item, feedback, duelId, locale, loadDuel],
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
      <main className="text-muted mx-auto max-w-[480px] px-4 py-12 text-center">Loading…</main>
    );
  }

  if (playing && item) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-4 py-6">
        <div className="rd-seam h-1.5 w-full rounded-full" aria-hidden="true" />
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
                disabled={Boolean(feedback)}
                onClick={() => void submitTurnAnswer(orderList)}
              >
                {t('play.submitOrder')}
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {item.options.map((opt, idx) => {
                const isCorrectChoice = feedback && feedback.correctIndex === idx;
                const isWrongSelected = feedback && !feedback.correct && selectedChoice === idx;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={Boolean(feedback)}
                    onClick={() => void submitTurnAnswer(idx)}
                    className={[
                      'rd-sticker rd-sticker-pressable flex min-h-14 w-full cursor-pointer items-center justify-between rounded-[14px] px-4 py-3 text-left text-base font-bold',
                      isCorrectChoice
                        ? 'bg-correct text-[#16131F]'
                        : isWrongSelected
                          ? 'bg-wrong text-[var(--rd-on-wrong)]'
                          : 'bg-surface text-ink',
                    ].join(' ')}
                  >
                    <span>{opt}</span>
                    {isCorrectChoice && <CheckCircle size={22} weight="fill" aria-hidden="true" />}
                    {isWrongSelected && <XCircle size={22} weight="fill" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </main>
    );
  }

  const challenger = duel.sides[duel.challengerUid];
  const opponent = duel.opponentUid ? duel.sides[duel.opponentUid] : undefined;
  const mySide = duel.sides[myUid];
  const canPlayMyTurn =
    !mySide?.finishedAt && duel.status !== 'complete' && duel.status !== 'expired';
  const winnerSide = duel.winnerUid ? duel.sides[duel.winnerUid] : undefined;

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6">
      <Card className="space-y-4 text-center">
        <Chip tone="volt">
          <Sword size={14} weight="fill" aria-hidden="true" />
          {t('duel.title')}
        </Chip>
        <p className="text-muted text-xs">{t('duel.subtitle')}</p>

        {/* Split Court Versus Arena */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="border-border bg-ron/20 rounded-[16px] border-2 p-4 text-center">
            <Avatar nickname={challenger?.nickname ?? 'Red'} size="md" />
            <p className="font-display mt-2 text-base font-extrabold">
              {challenger?.nickname ?? 'Challenger'}
            </p>
            <p className="rd-tabular mt-1 text-2xl font-extrabold">
              {challenger?.finishedAt ? challenger.score : '—'}
            </p>
          </div>

          <div className="border-border bg-duel/20 rounded-[16px] border-2 p-4 text-center">
            <Avatar nickname={opponent?.nickname ?? 'VS'} size="md" />
            <p className="font-display mt-2 text-base font-extrabold">
              {opponent?.nickname ?? 'Open Opponent'}
            </p>
            <p className="rd-tabular mt-1 text-2xl font-extrabold">
              {opponent?.finishedAt ? opponent.score : '—'}
            </p>
          </div>
        </div>

        {duel.status === 'complete' && winnerSide && (
          <div className="border-border bg-volt rounded-[14px] border-2 p-3 text-sm font-extrabold text-[#16131F]">
            <Trophy size={18} weight="fill" className="mr-1.5 inline" aria-hidden="true" />
            {t('duel.winnerBanner', { name: winnerSide.nickname })}
            {duel.walkover && ` · ${t('duel.walkoverNote')}`}
          </div>
        )}

        {canPlayMyTurn ? (
          <Button fullWidth size="lg" onClick={() => void startMyTurn()}>
            {t('duel.yourTurn')}
          </Button>
        ) : (
          duel.status !== 'complete' && (
            <p className="text-muted text-sm font-bold">{t('duel.waitingOpponent')}</p>
          )
        )}

        <Button fullWidth size="sm" variant="blue" onClick={() => void copyLink()}>
          <Copy size={16} weight="bold" aria-hidden="true" />
          {t('duel.copyChallengeLink')}
        </Button>
      </Card>

      {toast && (
        <div className="flex justify-center">
          <Toast message={toast} tone="success" />
        </div>
      )}

      {duel.opponentUid && (
        <Card variant="subtle" className="flex items-center justify-between text-sm font-bold">
          <span>{t('duel.headToHead')}</span>
          <span className="rd-tabular">
            {challenger?.nickname}: {duel.headToHead[duel.challengerUid] ?? 0}W —{' '}
            {opponent?.nickname}: {duel.headToHead[duel.opponentUid] ?? 0}W
          </span>
        </Card>
      )}

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
    </main>
  );
}
