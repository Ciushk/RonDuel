'use client';

import { Clock, Crown, Play, Plus, ShareNetwork, Sword, Trophy, User } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Avatar, Button, Card, Chip, Toast } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { getBrowserTimeZone, getLocalSession } from '@/lib/session';

interface DuelSummary {
  id: string;
  status: string;
  isDuelHost?: boolean;
  myNickname: string;
  opponentNickname: string;
  opponentUid: string | null;
  myScore: number;
  opponentScore: number;
  winnerUid: string | null;
  isWinner: boolean;
  isTie: boolean;
  myTurn: boolean;
  timeLeftMs: number;
  createdAt: string;
  walkover?: boolean;
  walkoverNote?: string;
  h2h?: {
    myWins: number;
    opponentWins: number;
    draws: number;
    winStreak: number;
  } | null;
}

interface DuelsResponse {
  yourTurn: DuelSummary[];
  waiting: DuelSummary[];
  finished: DuelSummary[];
  isPro: boolean;
  activeCount: number;
  maxActive: number;
  monthlyCount?: number;
  maxMonthly?: number;
  stats?: {
    totalScore: number;
    wins: number;
    losses: number;
    draws: number;
    played: number;
  };
}

function formatHoursLeft(ms: number, t: (key: any, values?: any) => string): string {
  const hours = Math.max(1, Math.ceil(ms / (1000 * 60 * 60)));
  return t('common.hoursLeft', { hours });
}

export default function DuelsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [duelsData, setDuelsData] = useState<DuelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'active' | 'finished' | 'stats'>('active');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const loadDuels = () => {
    const session = getLocalSession();
    fetch(`/api/duels?uid=${encodeURIComponent(session.uid)}`)
      .then((r) => r.json())
      .then((data) => {
        setDuelsData(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadDuels();
  }, []);

  const handleCreateDuel = async () => {
    setError('');
    const session = getLocalSession();
    if (!duelsData?.isPro && (duelsData?.monthlyCount ?? 0) >= (duelsData?.maxMonthly ?? 4)) {
      setError(t('duels.errorMonthlyLimit', { max: duelsData?.maxMonthly ?? 4 }));
      return;
    }
    if (!duelsData?.isPro && (duelsData?.activeCount ?? 0) >= (duelsData?.maxActive ?? 1)) {
      setError(t('duels.errorActiveDuel'));
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/duels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengerUid: session.uid,
          nickname: session.nickname || undefined,
          tz: getBrowserTimeZone(),
        }),
      });
      const created = await res.json();
      if (created.duelId) {
        trackEvent('duel_created', { duel_id: created.duelId });
        router.push(`/${locale}/duel/${encodeURIComponent(created.duelId)}`);
      } else {
        setError(created.error ?? t('duels.errorCreate'));
        setCreating(false);
      }
    } catch {
      setError(t('duels.errorCreateFailed'));
      setCreating(false);
    }
  };

  const handleShareDuel = async (duelId: string) => {
    const link = `${window.location.origin}/${locale}/duel/${encodeURIComponent(duelId)}`;
    const shareText = t('duels.shareText', { link });

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text: shareText, url: link });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(shareText).catch(() => {});
    setToast(t('duel.linkCopied'));
    setTimeout(() => setToast(''), 3000);
  };

  const yourTurn = duelsData?.yourTurn ?? [];
  const waiting = duelsData?.waiting ?? [];
  const finished = duelsData?.finished ?? [];
  const totalDuels = yourTurn.length + waiting.length + finished.length;

  const startedCount = yourTurn.length + waiting.length;

  const statsWins = duelsData?.stats?.wins ?? finished.filter((d) => d.isWinner).length;
  const statsDraws = duelsData?.stats?.draws ?? finished.filter((d) => d.isTie).length;
  const statsLosses = duelsData?.stats?.losses ?? finished.filter((d) => !d.isWinner && !d.isTie).length;
  const statsTotalScore = duelsData?.stats?.totalScore ?? finished.reduce((sum, d) => sum + (d.myScore ?? 0), 0);
  const statsPlayed = duelsData?.stats?.played ?? (statsWins + statsDraws + statsLosses);
  const winRate = statsPlayed > 0 ? Math.round((statsWins / statsPlayed) * 100) : 0;

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-ink text-2xl font-extrabold">{t('nav.duels')}</h1>
          <div className="mt-0.5">
            {duelsData?.isPro ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-500 dark:text-amber-400">
                <Crown size={14} weight="fill" />
                {t('duels.unlimitedProLong')}
              </span>
            ) : (
              <p className="text-muted text-xs font-bold">
                {t('duels.monthlyUsage', {
                  count: duelsData?.monthlyCount ?? 0,
                  max: duelsData?.maxMonthly ?? 4,
                })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Card Incepe un duel nou */}
      <Card
        variant="sticker"
        className="border-border bg-surface text-ink flex flex-col gap-3.5 border-2 p-4 shadow-[var(--rd-shadow-key)]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="border-border bg-volt text-[#16131F] flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 shadow-sm">
              <Sword size={22} weight="fill" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display truncate text-base font-extrabold text-ink">
                {t('duels.startNew')}
              </h2>
              <p className="text-muted text-xs font-bold truncate">
                {duelsData?.isPro ? (
                  <span className="inline-flex items-center gap-1 text-amber-500 dark:text-amber-400">
                    <Crown size={14} weight="fill" />
                    {t('duels.unlimitedPro')}
                  </span>
                ) : (
                  t('duels.monthlyUsageShort', {
                    count: duelsData?.monthlyCount ?? 0,
                    max: duelsData?.maxMonthly ?? 4,
                  })
                )}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="volt"
            disabled={creating}
            className="h-10 shrink-0 px-3 text-xs font-black shadow-[2px_2px_0px_0px_var(--border-color,#16131F)]"
            onClick={handleCreateDuel}
          >
            <Plus size={16} weight="bold" />
            <span>{creating ? t('common.creating') : t('duels.newDuel')}</span>
          </Button>
        </div>
      </Card>

      {/* 3 Taburi sub cardul Incepe un duel nou */}
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border-2 border-border bg-surface-2 p-1.5 shadow-sm" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'active'}
          onClick={() => setTab('active')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-1 text-xs font-black transition-all cursor-pointer ${
            tab === 'active'
              ? 'bg-surface text-ink border-2 border-border shadow-[2px_2px_0px_0px_var(--border-color,#16131F)]'
              : 'text-muted hover:text-ink'
          }`}
        >
          <span>Începute</span>
          {startedCount > 0 && (
            <span className="bg-volt-strong text-[#16131F] flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black">
              {startedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === 'finished'}
          onClick={() => setTab('finished')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-1 text-xs font-black transition-all cursor-pointer ${
            tab === 'finished'
              ? 'bg-surface text-ink border-2 border-border shadow-[2px_2px_0px_0px_var(--border-color,#16131F)]'
              : 'text-muted hover:text-ink'
          }`}
        >
          <span>Terminate</span>
          {finished.length > 0 && (
            <span className="bg-surface border border-border text-ink flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black">
              {finished.length}
            </span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === 'stats'}
          onClick={() => setTab('stats')}
          className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-1 text-xs font-black transition-all cursor-pointer ${
            tab === 'stats'
              ? 'bg-surface text-ink border-2 border-border shadow-[2px_2px_0px_0px_var(--border-color,#16131F)]'
              : 'text-muted hover:text-ink'
          }`}
        >
          <span>Scorul meu</span>
        </button>
      </div>

      {/* Error or Limit Banner */}
      {error && (
        <Card
          variant="sticker"
          className="bg-volt text-ink border-border space-y-2 border-2 p-4 shadow-sm"
        >
          <div className="flex items-start gap-2.5">
            <Crown size={22} weight="fill" className="text-ron-strong mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-extrabold leading-snug">{error}</p>
              <p className="text-ink/80 text-xs font-medium">{t('duels.proUpsell')}</p>
            </div>
          </div>
          <Link href={`/${locale}/pro`} className="block pt-1">
            <Button size="sm" variant="primary" fullWidth>
              {t('common.goPro')}
            </Button>
          </Link>
        </Card>
      )}

      {toast && (
        <div className="flex justify-center">
          <Toast message={toast} tone="success" />
        </div>
      )}

      {/* TAB 1: DUELURI INCEPUTE */}
      {tab === 'active' && (
        <div className="space-y-4">
          {startedCount === 0 && !loading && (
            <Card className="border-border bg-surface-2/60 space-y-3 border-2 border-dashed p-6 text-center">
              <div className="bg-surface border-border mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border-2 text-2xl shadow-sm">
                <Sword size={24} weight="bold" className="text-volt-strong dark:text-volt" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-ink text-base font-black">Niciun duel în derulare</h3>
                <p className="text-muted mx-auto max-w-[280px] text-xs">
                  Provoacă un prieten la un duel 1v1 rapid sau așteaptă să răspundă la provocare!
                </p>
              </div>
              <div className="flex justify-center pt-2">
                <Button size="sm" variant="volt" onClick={handleCreateDuel}>
                  {t('duels.startNew')}
                </Button>
              </div>
            </Card>
          )}

          {/* 1. Your turn first! */}
          {yourTurn.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="bg-ron-strong flex h-2.5 w-2.5 animate-pulse rounded-full" />
                <h2 className="text-ron-strong text-xs font-black uppercase tracking-wider">
                  {t('duels.sectionYourTurn', { count: yourTurn.length })}
                </h2>
              </div>
              <div className="space-y-2">
                {yourTurn.map((duel) => (
                  <div
                    key={duel.id}
                    className="border-ron-strong bg-surface flex items-center justify-between gap-3 rounded-2xl border-2 p-4 shadow-[var(--rd-shadow-key)]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar nickname={duel.opponentNickname} size="md" />
                      <div className="min-w-0">
                        <p className="font-display truncate text-sm font-extrabold">
                          {t('common.versus', { name: duel.opponentNickname })}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="text-muted flex items-center gap-1 font-bold">
                            <Clock size={12} weight="bold" />
                            {formatHoursLeft(duel.timeLeftMs, t)}
                          </span>
                          {duel.h2h && (
                            <span className="border-border bg-surface-2 text-ink py-0.2 rounded border px-1.5 text-[10px] font-black">
                              H2H: {duel.h2h.myWins}–{duel.h2h.opponentWins}
                            </span>
                          )}
                          {duel.h2h && duel.h2h.winStreak >= 3 && (
                            <span className="text-ron-strong text-[11px] font-black">
                              🔥 {t('duels.winStreak', { count: duel.h2h.winStreak })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link href={`/${locale}/duel/${encodeURIComponent(duel.id)}`}>
                      <Button
                        size="sm"
                        variant="volt"
                        className="h-10 shrink-0 px-3 text-xs font-black"
                      >
                        <Play size={14} weight="fill" />
                        <span>{t('common.playNow')}</span>
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 2. Waiting for opponent */}
          {waiting.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-muted text-xs font-bold uppercase tracking-wider">
                {t('duels.sectionWaiting', { count: waiting.length })}
              </h2>
              <div className="space-y-2">
                {waiting.map((duel) => (
                  <div
                    key={duel.id}
                    className="border-border bg-surface flex items-center justify-between gap-3 rounded-2xl border-2 p-4 shadow-[var(--rd-shadow-key)]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar nickname={duel.opponentNickname} size="md" />
                      <div className="min-w-0">
                        <p className="font-display truncate text-sm font-extrabold">
                          {t('common.versus', { name: duel.opponentNickname })}
                        </p>
                        <div className="text-muted flex flex-wrap items-center gap-1.5 text-xs">
                          <span>
                            {t('duels.yourScore', { score: duel.myScore ?? 0 })} ·{' '}
                            {formatHoursLeft(duel.timeLeftMs, t)}
                          </span>
                          {duel.h2h && (
                            <span className="border-border bg-surface-2 text-ink py-0.2 rounded border px-1.5 text-[10px] font-black">
                              H2H: {duel.h2h.myWins}–{duel.h2h.opponentWins}
                            </span>
                          )}
                          {duel.h2h && duel.h2h.winStreak >= 3 && (
                            <span className="text-ron-strong text-[11px] font-black">
                              🔥 {t('duels.winStreak', { count: duel.h2h.winStreak })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-10 px-2.5 text-xs font-bold"
                        onClick={() => handleShareDuel(duel.id)}
                      >
                        <ShareNetwork size={16} weight="bold" />
                      </Button>
                      <Link href={`/${locale}/duel/${encodeURIComponent(duel.id)}`}>
                        <Button size="sm" variant="secondary" className="h-10 px-3 text-xs font-bold">
                          {t('common.open')}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 2: DUELURI TERMINATE */}
      {tab === 'finished' && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-muted text-xs font-bold uppercase tracking-wider">
              {t('duels.sectionFinished', { count: finished.length })}
            </h2>
          </div>
          {finished.length === 0 ? (
            <Card className="border-border bg-surface-2/60 space-y-3 border-2 border-dashed p-6 text-center">
              <div className="bg-surface border-border mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border-2 text-2xl shadow-sm">
                🏆
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-ink text-base font-black">Niciun duel finalizat încă</h3>
                <p className="text-muted mx-auto max-w-[280px] text-xs">
                  Aici vor apărea duelurile tale terminate și rezultatele confruntărilor!
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {finished.map((duel) => (
                <Link
                  key={duel.id}
                  href={`/${locale}/duel/${encodeURIComponent(duel.id)}`}
                  className="border-border bg-surface text-ink hover:border-border-subtle flex select-none items-center justify-between gap-3 rounded-2xl border-2 p-4 shadow-[var(--rd-shadow-key)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar nickname={duel.opponentNickname} size="md" />
                    <div className="min-w-0">
                      <p className="font-display truncate text-sm font-extrabold">
                        {t('common.versus', { name: duel.opponentNickname })}
                      </p>
                      <div className="text-muted flex flex-wrap items-center gap-1.5 text-xs">
                        <span>
                          {duel.myScore} - {duel.opponentScore}{' '}
                          {t('common.points', { points: '' }).trim()}
                        </span>
                        {duel.h2h && (
                          <span className="border-border bg-surface-2 text-ink py-0.2 rounded border px-1.5 text-[10px] font-black">
                            H2H: {duel.h2h.myWins}–{duel.h2h.opponentWins}
                          </span>
                        )}
                        {duel.h2h && duel.h2h.winStreak >= 3 && (
                          <span className="text-ron-strong text-[11px] font-black">
                            🔥 {t('duels.winStreak', { count: duel.h2h.winStreak })}
                          </span>
                        )}
                      </div>
                      {duel.walkover && (
                        <p className="text-ron-strong mt-0.5 text-[11px] font-bold">
                          {duel.walkoverNote || t('duels.walkoverBadge')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {duel.isWinner ? (
                      <Chip tone="volt" className="text-xs font-black">
                        {duel.walkover ? t('duels.walkoverBadge') : t('duels.won')}
                      </Chip>
                    ) : duel.isTie ? (
                      <Chip tone="neutral" className="text-xs font-bold">
                        {t('duels.draw')}
                      </Chip>
                    ) : (
                      <Chip tone="neutral" className="text-muted text-xs font-bold">
                        {t('duels.lost')}
                      </Chip>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: SCORUL MEU TOTAL PE DUELURI */}
      {tab === 'stats' && (
        <section className="space-y-4">
          <Card
            variant="sticker"
            className="border-border bg-surface text-ink space-y-4 border-2 p-5 shadow-[var(--rd-shadow-key)]"
          >
            <div className="flex items-center justify-between border-b-2 border-border pb-3">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-muted">
                  Scor total dueluri
                </span>
                <p className="font-display rd-tabular text-3xl font-black text-ink mt-0.5">
                  {statsTotalScore.toLocaleString()}{' '}
                  <span className="text-base font-bold text-muted">puncte</span>
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-border bg-volt text-2xl shadow-sm">
                ⚡
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 p-3">
                <span className="block text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {statsWins}
                </span>
                <span className="text-xs font-extrabold text-ink">Câștiguri</span>
              </div>
              <div className="rounded-xl border-2 border-rose-500/30 bg-rose-500/10 p-3">
                <span className="block text-2xl font-black text-rose-600 dark:text-rose-400">
                  {statsLosses}
                </span>
                <span className="text-xs font-extrabold text-ink">Pierderi</span>
              </div>
              <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/10 p-3">
                <span className="block text-2xl font-black text-amber-600 dark:text-amber-400">
                  {statsDraws}
                </span>
                <span className="text-xs font-extrabold text-ink">Egalități</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 p-3 text-xs">
                <span className="font-bold text-muted">Total dueluri</span>
                <span className="font-black text-ink rd-tabular text-sm">{statsPlayed}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 p-3 text-xs">
                <span className="font-bold text-muted">Rată de victorie</span>
                <span className="font-black text-volt-strong rd-tabular text-sm">{winRate}%</span>
              </div>
            </div>
          </Card>
        </section>
      )}
    </main>
  );
}
