'use client';

import { ArrowDown, ArrowUp, CheckCircle, Lightning, XCircle } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, Card, Chip, TimerBar } from '@/components/ui';
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
  const [remainingMs, setRemainingMs] = useState(10_000);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const deadlineRef = useRef<number>(0);

  const beginRound = useCallback(async () => {
    const session = getLocalSession();
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
    const data = await res.json();
    if (data.alreadyFinished && data.playId) {
      router.replace(`/${locale}/result/${encodeURIComponent(data.playId)}`);
      return;
    }
    setPlayId(data.playId);
    setTotalItems(data.totalItems);
    setItem(data.item);
    setOrderList(data.item.options);
    setRemainingMs(data.remainingMs);
    deadlineRef.current = Date.now() + data.remainingMs;
    setPhase('playing');
  }, [locale, router]);

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
      setSubmitting(true);
      if (typeof choice === 'number') setSelectedChoice(choice);

      const session = getLocalSession();
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
      const data: AnswerFeedback = await res.json();
      setFeedback(data);
      setSubmitting(false);

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
        } else {
          await fetch('/api/game/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: session.uid, playId }),
          });
          router.replace(`/${locale}/result/${encodeURIComponent(playId)}`);
        }
      }, 1100);
    },
    [item, playId, submitting, feedback, locale, router],
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
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-6 px-4">
        <div className="rd-seam h-2 w-24 rounded-full" aria-hidden="true" />
        <Card className="w-full space-y-5 text-center">
          <h1 className="font-display text-3xl font-extrabold">{t('play.readyTitle')}</h1>
          <p className="text-muted text-sm">{t('play.readySubtitle')}</p>
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
      </main>
    );
  }

  if (phase === 'countdown') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-4 px-4">
        <div className="font-display text-ron-strong text-8xl font-extrabold" aria-live="assertive">
          {countdown}
        </div>
        <div className="rd-seam h-2 w-32 rounded-full" aria-hidden="true" />
      </main>
    );
  }

  if (!item) return null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-4 py-6">
      <div className="rd-seam h-1.5 w-full rounded-full" aria-hidden="true" />

      <div className="flex items-center justify-between gap-2">
        <Chip tone="neutral" className="rd-tabular">
          {t('play.itemCounter', { current: item.index + 1, total: totalItems })}
        </Chip>
        <div className="flex items-center gap-2">
          {item.isEnFallback && locale !== 'en' && <Chip tone="blue">{t('play.enFallback')}</Chip>}
          <Chip tone="neutral" className="uppercase">
            {item.type}
          </Chip>
        </div>
      </div>

      <TimerBar remainingMs={remainingMs} limitMs={item.limitMs} />

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
              const isCorrectChoice = feedback && feedback.correctIndex === idx;
              const isWrongSelected = feedback && !feedback.correct && selectedChoice === idx;
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={Boolean(feedback) || submitting}
                  onClick={() => void handleSubmit(idx)}
                  className={[
                    'rd-sticker rd-sticker-pressable flex min-h-14 w-full cursor-pointer items-center justify-between rounded-[14px] px-4 py-3 text-left text-base font-bold transition-colors',
                    isCorrectChoice
                      ? 'bg-correct text-[#16131F]'
                      : isWrongSelected
                        ? 'bg-wrong text-[var(--rd-on-wrong)]'
                        : 'bg-surface text-ink hover:bg-surface-2',
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

      <div aria-live="polite" className="min-h-10 text-center">
        {feedback && (
          <div className="inline-flex items-center gap-2">
            <Chip tone={feedback.correct ? 'volt' : 'wrong'}>
              {feedback.correct && <Lightning size={14} weight="fill" aria-hidden="true" />}
              {feedback.timedOut
                ? t('play.timedOut')
                : feedback.correct
                  ? `${t('play.correct')} +${feedback.points}`
                  : t('play.wrong')}
            </Chip>
          </div>
        )}
      </div>
    </main>
  );
}
