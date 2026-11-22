'use client';

import {
  Clock,
  Crown,
  Play,
  Plus,
  ShareNetwork,
  Sword,
  Trophy,
  User,
} from '@phosphor-icons/react';
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
  isChallenger: boolean;
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
}

function formatHoursLeft(ms: number): string {
  const hours = Math.max(1, Math.ceil(ms / (1000 * 60 * 60)));
  return `${hours}h rămase`;
}

export default function DuelsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [duelsData, setDuelsData] = useState<DuelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
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
      setError('Ai atins limita de 4 dueluri pe lună pentru contul gratuit. Treci la Pro pentru dueluri nelimitate.');
      return;
    }
    if (!duelsData?.isPro && (duelsData?.activeCount ?? 0) >= (duelsData?.maxActive ?? 1)) {
      setError('Ai deja un duel activ. Termină-l sau treci la Pro pentru dueluri nelimitate.');
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
        setError(created.error ?? 'Nu s-a putut crea duelul');
        setCreating(false);
      }
    } catch {
      setError('Eroare la crearea duelului');
      setCreating(false);
    }
  };

  const handleShareDuel = async (duelId: string) => {
    const link = `${window.location.origin}/${locale}/duel/${encodeURIComponent(duelId)}`;
    const shareText = `Te provoc la un duel pe RonDuel! Ai 5 întrebări rapide: ${link}`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text: shareText, url: link });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(shareText).catch(() => {});
    setToast('Linkul duelului a fost copiat!');
    setTimeout(() => setToast(''), 3000);
  };

  const yourTurn = duelsData?.yourTurn ?? [];
  const waiting = duelsData?.waiting ?? [];
  const finished = duelsData?.finished ?? [];
  const totalDuels = yourTurn.length + waiting.length + finished.length;

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink">{t('nav.duels')}</h1>
          <p className="text-muted text-xs font-bold">
            {duelsData?.isPro
              ? 'Nelimitat (Pro) · 1v1 Split Court'
              : `${duelsData?.monthlyCount ?? 0}/${duelsData?.maxMonthly ?? 4} dueluri luna aceasta`}
          </p>
        </div>
        <Button
          size="sm"
          variant="volt"
          disabled={creating}
          className="h-10 px-3 text-xs font-black shadow-[2px_2px_0px_0px_var(--border-color,#16131F)]"
          onClick={handleCreateDuel}
        >
          <Plus size={16} weight="bold" />
          <span>{creating ? 'Se creează…' : 'Duel nou'}</span>
        </Button>
      </div>

      {/* Error or Limit Banner */}
      {error && (
        <Card variant="sticker" className="bg-volt text-ink border-2 border-border p-4 shadow-sm space-y-2">
          <div className="flex items-start gap-2.5">
            <Crown size={22} weight="fill" className="text-ron-strong shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-extrabold text-sm leading-snug">{error}</p>
              <p className="text-xs font-medium text-ink/80">
                Abonamentul Pro oferă dueluri nelimitate, scut pentru serie și teme vizuale.
              </p>
            </div>
          </div>
          <Link href={`/${locale}/pro`} className="block pt-1">
            <Button size="sm" variant="primary" fullWidth>
              Treci la Pro
            </Button>
          </Link>
        </Card>
      )}

      {toast && (
        <div className="flex justify-center">
          <Toast message={toast} tone="success" />
        </div>
      )}

      {/* Empty State */}
      {totalDuels === 0 && !loading && (
        <Card className="p-6 text-center space-y-3 border-2 border-dashed border-border bg-surface-2/60">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface border-2 border-border text-2xl shadow-sm">
            <Sword size={24} weight="bold" className="text-volt-strong dark:text-volt" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display font-black text-base text-ink">Niciun duel încă</h3>
            <p className="text-muted text-xs max-w-[280px] mx-auto">
              Provoacă un prieten la un duel 1v1 rapid de 60 de secunde!
            </p>
          </div>
          <div className="pt-2 flex justify-center">
            <Button size="sm" variant="volt" onClick={handleCreateDuel}>
              Începe un duel nou
            </Button>
          </div>
        </Card>
      )}

      {/* 1. Rândul tău (Your turn) first! */}
      {yourTurn.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-ron-strong animate-pulse" />
            <h2 className="text-xs font-black uppercase tracking-wider text-ron-strong">
              Rândul tău ({yourTurn.length})
            </h2>
          </div>
          <div className="space-y-2">
            {yourTurn.map((duel) => (
              <div
                key={duel.id}
                className="border-2 border-ron-strong bg-surface rounded-2xl p-4 shadow-[var(--rd-shadow-key)] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar nickname={duel.opponentNickname} size="md" />
                  <div className="min-w-0">
                    <p className="font-display font-extrabold text-sm truncate">
                      vs {duel.opponentNickname}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted font-bold flex items-center gap-1">
                        <Clock size={12} weight="bold" />
                        {formatHoursLeft(duel.timeLeftMs)}
                      </span>
                      {duel.h2h && (
                        <span className="border border-border bg-surface-2 text-ink px-1.5 py-0.2 rounded text-[10px] font-black">
                          H2H: {duel.h2h.myWins}–{duel.h2h.opponentWins}
                        </span>
                      )}
                      {duel.h2h && duel.h2h.winStreak >= 3 && (
                        <span className="text-ron-strong text-[11px] font-black">
                          🔥 {duel.h2h.winStreak} la rând
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Link href={`/${locale}/duel/${encodeURIComponent(duel.id)}`}>
                  <Button size="sm" variant="volt" className="shrink-0 font-black text-xs h-10 px-3">
                    <Play size={14} weight="fill" />
                    <span>Joacă acum</span>
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. În așteptarea adversarului */}
      {waiting.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
            În așteptarea adversarului ({waiting.length})
          </h2>
          <div className="space-y-2">
            {waiting.map((duel) => (
              <div
                key={duel.id}
                className="border-2 border-border bg-surface rounded-2xl p-4 shadow-[var(--rd-shadow-key)] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar nickname={duel.opponentNickname} size="md" />
                  <div className="min-w-0">
                    <p className="font-display font-extrabold text-sm truncate">
                      vs {duel.opponentNickname}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span>
                        Scorul tău: <strong className="text-ink">{duel.myScore} pct</strong> · {formatHoursLeft(duel.timeLeftMs)}
                      </span>
                      {duel.h2h && (
                        <span className="border border-border bg-surface-2 text-ink px-1.5 py-0.2 rounded text-[10px] font-black">
                          H2H: {duel.h2h.myWins}–{duel.h2h.opponentWins}
                        </span>
                      )}
                      {duel.h2h && duel.h2h.winStreak >= 3 && (
                        <span className="text-ron-strong text-[11px] font-black">
                          🔥 {duel.h2h.winStreak} la rând
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
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
                      Deschide
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Finalizate */}
      {finished.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
            Finalizate ({finished.length})
          </h2>
          <div className="space-y-2">
            {finished.map((duel) => (
              <Link
                key={duel.id}
                href={`/${locale}/duel/${encodeURIComponent(duel.id)}`}
                className="border-2 border-border bg-surface text-ink hover:border-border-subtle active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-between gap-3 rounded-2xl p-4 shadow-[var(--rd-shadow-key)] transition-all select-none"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar nickname={duel.opponentNickname} size="md" />
                  <div className="min-w-0">
                    <p className="font-display font-extrabold text-sm truncate">
                      vs {duel.opponentNickname}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span>
                        {duel.myScore} - {duel.opponentScore} pct
                      </span>
                      {duel.h2h && (
                        <span className="border border-border bg-surface-2 text-ink px-1.5 py-0.2 rounded text-[10px] font-black">
                          H2H: {duel.h2h.myWins}–{duel.h2h.opponentWins}
                        </span>
                      )}
                      {duel.h2h && duel.h2h.winStreak >= 3 && (
                        <span className="text-ron-strong text-[11px] font-black">
                          🔥 {duel.h2h.winStreak} la rând
                        </span>
                      )}
                    </div>
                    {duel.walkover && (
                      <p className="text-[11px] font-bold text-ron-strong mt-0.5">
                        {duel.walkoverNote || 'câștigat prin neprezentare'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {duel.isWinner ? (
                    <Chip tone="volt" className="font-black text-xs">
                      {duel.walkover ? 'Neprezentare 🏆' : 'Ai câștigat! 🎉'}
                    </Chip>
                  ) : duel.isTie ? (
                    <Chip tone="neutral" className="font-bold text-xs">
                      Egalitate
                    </Chip>
                  ) : (
                    <Chip tone="neutral" className="text-muted font-bold text-xs">
                      Ai pierdut
                    </Chip>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
