'use client';

import { Flame, ShareNetwork, Trophy } from '@phosphor-icons/react';
import { buildShareCardText } from '@ronduel/shared';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button, Card, Chip, Toast } from '@/components/ui';
import { getBrowserTimeZone, getLocalSession } from '@/lib/session';

interface ResultData {
  playId: string;
  date: string;
  roundNumber: number;
  totalScore: number;
  totalMs: number;
  emojiLine: string;
  streakCurrent: number;
  streakBest: number;
  review: Array<{
    index: number;
    prompt: string;
    correctAnswer: string;
    explanation?: string;
    points: number;
    emoji: string;
  }>;
  primaryLeague: { id: string; inviteCode?: string; name?: string } | null;
}

export default function ResultPage() {
  const t = useTranslations();
  const locale = useLocale();
  const params = useParams<{ playId: string }>();
  const playId = decodeURIComponent(params.playId);

  const [data, setData] = useState<ResultData | null>(null);
  const [toast, setToast] = useState<string>('');
  const [leagueInfo, setLeagueInfo] = useState<{
    id: string;
    inviteCode: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/game/result/${encodeURIComponent(playId)}`)
      .then((r) => r.json())
      .then((res: ResultData) => {
        setData(res);
        if (res.primaryLeague?.inviteCode) {
          setLeagueInfo({
            id: res.primaryLeague.id,
            inviteCode: res.primaryLeague.inviteCode,
            name: res.primaryLeague.name ?? 'My League',
          });
        }
      })
      .catch(() => {});
  }, [playId]);

  const handleShare = async () => {
    if (!data) return;
    const session = getLocalSession();
    let activeLeague = leagueInfo;

    // Auto-create league on first share (§3)
    if (!activeLeague) {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: session.uid,
          tz: getBrowserTimeZone(),
          locale,
        }),
      });
      const created = await res.json();
      activeLeague = {
        id: created.leagueId,
        inviteCode: created.inviteCode,
        name: created.name,
      };
      setLeagueInfo(activeLeague);
    }

    const origin = window.location.origin;
    const inviteUrl = `${origin}/${locale}/l/${activeLeague.inviteCode}?r=${session.uid}`;
    const cardText = buildShareCardText({
      roundNumber: data.roundNumber,
      totalScore: data.totalScore,
      emojiLine: data.emojiLine,
      streak: data.streakCurrent,
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

  if (!data) {
    return (
      <main className="text-muted mx-auto max-w-[480px] px-4 py-12 text-center">Loading…</main>
    );
  }

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6">
      <Card className="space-y-4 text-center">
        <Chip tone="volt">{t('result.title', { number: data.roundNumber })}</Chip>
        <p className="text-muted text-sm font-bold">{t('result.scoreLabel')}</p>
        <p className="rd-tabular font-display text-ink text-6xl font-extrabold">
          {data.totalScore.toLocaleString()}
        </p>
        <p className="text-3xl tracking-widest" aria-label={data.emojiLine}>
          {data.emojiLine}
        </p>
        <div className="flex items-center justify-center gap-2 text-sm font-bold">
          <Flame size={18} weight="fill" className="text-ron-strong" aria-hidden="true" />
          <span>{t('result.streak', { days: data.streakCurrent })}</span>
        </div>

        <Button fullWidth size="lg" onClick={() => void handleShare()}>
          <ShareNetwork size={20} weight="bold" aria-hidden="true" />
          {t('result.shareCta')}
        </Button>

        {!leagueInfo && <p className="text-muted text-xs">{t('result.shareHint')}</p>}

        {leagueInfo && (
          <Link
            href={`/${locale}/league/${leagueInfo.id}`}
            className="rd-sticker rd-sticker-pressable bg-duel-strong inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] px-5 text-base font-bold text-[var(--rd-on-blue)]"
          >
            <Trophy size={18} weight="fill" aria-hidden="true" />
            {t('result.openLeague')} ({leagueInfo.name})
          </Link>
        )}
      </Card>

      {toast && (
        <div className="flex justify-center">
          <Toast message={toast} tone="success" />
        </div>
      )}

      <section className="space-y-3" aria-labelledby="review-heading">
        <h2 id="review-heading" className="font-display text-xl font-extrabold">
          {t('result.reviewTitle')}
        </h2>
        {data.review.map((item) => (
          <Card key={item.index} variant="subtle" className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold">{item.prompt}</span>
              <span className="rd-tabular shrink-0 text-sm font-bold">
                {item.emoji} +{item.points}
              </span>
            </div>
            <p className="text-correct-text text-sm font-bold">{item.correctAnswer}</p>
            {item.explanation && <p className="text-muted text-xs">{item.explanation}</p>}
          </Card>
        ))}
      </section>
    </main>
  );
}
