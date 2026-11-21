'use client';

import { Copy, Lock, Trophy } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Avatar, Button, Card, Chip, Toast } from '@/components/ui';
import { getLocalSession } from '@/lib/session';

interface LeagueView {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  maxMembers: number;
  viewerFinishedToday: boolean;
  todayScores: Array<{
    uid: string;
    nickname: string;
    score: number | null;
    totalMs: number | null;
    emojiLine: string | null;
  }>;
  allTime: Array<{
    uid: string;
    nickname: string;
    allTimeScore: number;
    roundsPlayed: number;
    bestStreak: number;
  }>;
}

export default function LeaguePage() {
  const t = useTranslations();
  const locale = useLocale();
  const params = useParams<{ id: string }>();

  const [league, setLeague] = useState<LeagueView | null>(null);
  const [tab, setTab] = useState<'today' | 'alltime'>('today');
  const [toast, setToast] = useState('');

  useEffect(() => {
    const s = getLocalSession();
    const resolvedId =
      params.id === '_shell' && typeof window !== 'undefined'
        ? decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() ?? params.id)
        : params.id;
    fetch(`/api/leagues/${encodeURIComponent(resolvedId)}?uid=${encodeURIComponent(s.uid)}`)
      .then((r) => r.json())
      .then((d: LeagueView) => setLeague(d))
      .catch(() => {});
  }, [params.id]);

  const copyInvite = async () => {
    if (!league) return;
    const url = `${window.location.origin}/${locale}/l/${league.inviteCode}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setToast(t('league.inviteCopied'));
    setTimeout(() => setToast(''), 2500);
  };

  if (!league) {
    return (
      <main className="text-muted mx-auto max-w-[480px] px-4 py-12 text-center">Loading…</main>
    );
  }

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6">
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-extrabold">{league.name}</h1>
          <Chip tone="gold">
            <Trophy size={14} weight="fill" aria-hidden="true" />
            {league.memberCount}/{league.maxMembers}
          </Chip>
        </div>
        <Button size="sm" variant="blue" fullWidth onClick={() => void copyInvite()}>
          <Copy size={16} weight="bold" aria-hidden="true" />
          {t('league.invite')} ({league.inviteCode})
        </Button>
      </Card>

      {toast && (
        <div className="flex justify-center">
          <Toast message={toast} tone="success" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2" role="tablist">
        <Button
          size="sm"
          role="tab"
          aria-selected={tab === 'today'}
          variant={tab === 'today' ? 'primary' : 'secondary'}
          onClick={() => setTab('today')}
        >
          {t('league.tabToday')}
        </Button>
        <Button
          size="sm"
          role="tab"
          aria-selected={tab === 'alltime'}
          variant={tab === 'alltime' ? 'primary' : 'secondary'}
          onClick={() => setTab('alltime')}
        >
          {t('league.tabAllTime')}
        </Button>
      </div>

      {tab === 'today' && (
        <Card variant="subtle" className="space-y-3">
          {!league.viewerFinishedToday && (
            <div className="bg-surface-2 text-muted flex items-center gap-2 rounded-[12px] p-3 text-xs font-bold">
              <Lock size={16} weight="bold" aria-hidden="true" />
              <span>{t('league.scoresHidden')}</span>
            </div>
          )}

          {league.todayScores.length === 0 ? (
            <p className="text-muted text-center text-sm">{t('league.empty')}</p>
          ) : (
            league.todayScores.map((row, idx) => (
              <div
                key={row.uid}
                className="border-border-subtle flex items-center justify-between gap-3 border-b pb-2.5 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <span className="rd-tabular text-muted w-5 text-sm font-bold">#{idx + 1}</span>
                  <Avatar nickname={row.nickname} size="sm" />
                  <div>
                    <p className="text-sm font-bold">{row.nickname}</p>
                    {row.emojiLine && <p className="text-xs">{row.emojiLine}</p>}
                  </div>
                </div>
                <span className="rd-tabular text-base font-extrabold">
                  {row.score !== null ? row.score : '—'}
                </span>
              </div>
            ))
          )}
        </Card>
      )}

      {tab === 'alltime' && (
        <Card variant="subtle" className="space-y-3">
          {league.allTime.map((row, idx) => (
            <div
              key={row.uid}
              className="border-border-subtle flex items-center justify-between gap-3 border-b pb-2.5 last:border-b-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <span className="rd-tabular text-muted w-5 text-sm font-bold">#{idx + 1}</span>
                <Avatar nickname={row.nickname} size="sm" />
                <div>
                  <p className="text-sm font-bold">{row.nickname}</p>
                  <p className="text-muted text-xs">{row.roundsPlayed} rounds</p>
                </div>
              </div>
              <span className="rd-tabular text-base font-extrabold">
                {row.allTimeScore.toLocaleString()}
              </span>
            </div>
          ))}
        </Card>
      )}
    </main>
  );
}
