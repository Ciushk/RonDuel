'use client';

import {
  ArrowClockwise,
  Copy,
  Lock,
  MagnifyingGlass,
  ShareNetwork,
  Trash,
  Trophy,
  WhatsappLogo,
} from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getPodiumStyle, RankBadge, StickyUserRank } from '@/components/LeaderboardPodium';
import { Avatar, Button, Card, Chip, Toast } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { getLocalSession } from '@/lib/session';

interface LeagueMemberRow {
  rank?: number;
  uid: string;
  nickname: string;
  allTimeScore: number;
  roundsPlayed: number;
  bestStreak?: number;
  joinedAt?: string;
  scoreToday?: number | null;
  isCurrentUser?: boolean;
}

interface LeagueView {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
  maxMembers: number;
  ownerUid?: string;
  adminName?: string;
  themeEmoji?: string;
  themeColor?: string;
  isOwner?: boolean;
  isMember?: boolean;
  isWorld?: boolean;
  intlRank?: number | null;
  privateApproval?: boolean;
  viewerFinishedToday: boolean;
  viewerScoreToday?: number | null;
  viewerRankToday?: number | null;
  viewerRankAllTime?: number | null;
  todayScores: Array<{
    rank?: number;
    uid: string;
    nickname: string;
    score: number | null;
    totalMs: number | null;
    emojiLine: string | null;
    isCurrentUser?: boolean;
  }>;
  allTime: LeagueMemberRow[];
}

export default function LeaguePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [league, setLeague] = useState<LeagueView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'today' | 'alltime'>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionUid, setSessionUid] = useState<string>('');
  const [sessionNickname, setSessionNickname] = useState<string>('');
  const [toast, setToast] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const s = getLocalSession();
    if (s?.uid) setSessionUid(s.uid);
    if (s?.nickname) setSessionNickname(s.nickname);
  }, []);

  const loadLeague = () => {
    setLoading(true);
    setError(null);
    const s = getLocalSession();
    if (s?.uid) setSessionUid(s.uid);
    if (s?.nickname) setSessionNickname(s.nickname);

    let resolvedId: string = params?.id || '';
    if ((!resolvedId || resolvedId === '_shell') && typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/').filter(Boolean);
      const lIdx = parts.indexOf('league');
      if (lIdx !== -1 && parts[lIdx + 1]) {
        resolvedId = decodeURIComponent(parts[lIdx + 1] as string);
      } else {
        resolvedId = parts.pop() || '';
      }
    }

    if (!resolvedId || resolvedId === '_shell') {
      setLoading(false);
      setError('Identificatorul ligii nu este valid.');
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    fetch(`/api/leagues/${encodeURIComponent(resolvedId)}?uid=${encodeURIComponent(s.uid)}`, {
      signal: controller.signal,
    })
      .then((r) => {
        clearTimeout(timer);
        if (!r.ok) {
          throw new Error(`Status ${r.status}`);
        }
        return r.json();
      })
      .then((d: LeagueView | null) => {
        if (d && d.id) {
          setLeague(d);
          setError(null);
        } else {
          throw new Error('League not found');
        }
      })
      .catch((err) => {
        clearTimeout(timer);
        if (resolvedId === 'lg_world') {
          setLeague({
            id: 'lg_world',
            name: 'RonDuel World',
            inviteCode: 'WORLD1',
            memberCount: 1,
            maxMembers: 10_000_000,
            themeEmoji: '🌍',
            themeColor: 'default',
            isWorld: true,
            viewerFinishedToday: false,
            todayScores: [],
            allTime: [],
          });
          setError(null);
        } else {
          setError(
            err?.name === 'AbortError'
              ? 'Timpul de încărcare a expirat. Te rugăm să reîncerci.'
              : 'Liga nu există sau a fost ștearsă.',
          );
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadLeague();
  }, [params?.id]);

  const getInviteUrl = () => {
    if (!league || typeof window === 'undefined') return '';
    return `${window.location.origin}/${locale}/l/${league.inviteCode}`;
  };

  const copyInvite = async () => {
    const url = getInviteUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url).catch(() => {});
    trackEvent('invite_shared', { method: 'copy', leagueId: league?.id });
    setToast(t('league.inviteCopied'));
    setTimeout(() => setToast(''), 2500);
  };

  const shareNative = async () => {
    const url = getInviteUrl();
    if (!url || !league) return;
    const shareText = t('league.shareText', { name: league.name, link: url });
    trackEvent('invite_shared', { method: 'native', leagueId: league.id });

    if (navigator.share) {
      try {
        await navigator.share({
          title: `RonDuel — ${league.name}`,
          text: shareText,
          url,
        });
        return;
      } catch {
        // user cancelled or failed, fall back to copy
      }
    }
    copyInvite();
  };

  const shareWhatsApp = () => {
    const url = getInviteUrl();
    if (!url || !league) return;
    trackEvent('invite_shared', { method: 'whatsapp', leagueId: league.id });
    const text = t('league.shareText', { name: league.name, link: url });
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleRename = async () => {
    if (!league) return;
    const s = getLocalSession();
    const newName = window.prompt(t('league.renameTitle'), league.name);
    if (!newName || newName.trim() === league.name) return;
    const res = await fetch(`/api/leagues/${league.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rename', actorUid: s.uid, name: newName.trim() }),
    });
    if (res.ok) {
      setToast('League renamed');
      loadLeague();
    }
  };

  const handleRegenerateCode = async () => {
    if (!league) return;
    if (!window.confirm(t('league.regenerateConfirm'))) return;
    const s = getLocalSession();
    setActionLoading(true);
    try {
      const res = await fetch(`/api/leagues/${league.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate_code', actorUid: s.uid }),
      });
      if (res.ok) {
        setToast('Codul de invitație a fost actualizat');
        loadLeague();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePrivateApproval = async () => {
    if (!league) return;
    const s = getLocalSession();
    const nextVal = !league.privateApproval;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/leagues/${league.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'private_approval',
          actorUid: s.uid,
          enabled: nextVal,
        }),
      });
      if (res.ok) {
        setToast(nextVal ? 'Aprobare privată activată' : 'Aprobare privată dezactivată');
        loadLeague();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (targetUid: string) => {
    if (!league) return;
    if (!window.confirm(t('league.removeMemberConfirm'))) return;
    const s = getLocalSession();
    setActionLoading(true);
    try {
      const res = await fetch(`/api/leagues/${league.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_member',
          actorUid: s.uid,
          targetUid,
        }),
      });
      if (res.ok) {
        setToast('Membrul a fost eliminat');
        loadLeague();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!league || league.isWorld) return;
    if (!window.confirm(t('league.deleteConfirm'))) return;
    const s = getLocalSession();
    const res = await fetch(`/api/leagues/${league.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actorUid: s.uid }),
    });
    if (res.ok) {
      router.push(`/${locale}/me`);
    }
  };

  const handleLeave = async () => {
    if (!league || league.isWorld) return;
    if (!window.confirm(t('league.leaveConfirm'))) return;
    const s = getLocalSession();
    const res = await fetch(`/api/leagues/${league.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'leave', actorUid: s.uid }),
    });
    if (res.ok) {
      router.push(`/${locale}/me`);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading && !league) {
    return (
      <main className="text-muted mx-auto max-w-[480px] px-4 py-16 text-center font-bold space-y-3">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-volt border-t-transparent" />
        <p>Se încarcă liga…</p>
      </main>
    );
  }

  if (error || !league) {
    return (
      <main className="mx-auto flex max-w-[480px] flex-col gap-4 px-4 py-12 text-center">
        <Card variant="sticker" className="p-6 space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 border-2 border-border text-2xl shadow-sm">
            🏆
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-xl font-extrabold text-ink">
              Liga nu există sau a fost ștearsă
            </h1>
            <p className="text-muted text-xs leading-relaxed max-w-[280px] mx-auto">
              {error || 'Această ligă nu există sau a fost ștearsă.'}
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Button variant="volt" fullWidth onClick={loadLeague}>
              Reîncearcă
            </Button>
            <Link href={`/${locale}/leagues`} className="block">
              <Button variant="secondary" fullWidth>
                Înapoi la ligi
              </Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  const isProLeague = league.maxMembers > 5 && !league.isWorld;
  const isWorldLeague = Boolean(league.isWorld || league.id === 'lg_world');

  // Filtered rows by username search query
  const q = searchQuery.trim().toLowerCase();
  const filteredTodayScores = q
    ? league.todayScores.filter((row) => row.nickname.toLowerCase().includes(q))
    : league.todayScores;
  const filteredAllTime = q
    ? league.allTime.filter((row) => row.nickname.toLowerCase().includes(q))
    : league.allTime;

  const currentViewerAllTimeScore = league.allTime.find((m) => m.uid === sessionUid)?.allTimeScore;

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-4 px-4 py-6 pb-28">
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl shrink-0" aria-hidden="true">
              {league.themeEmoji ?? (isWorldLeague ? '🌍' : '🏆')}
            </span>
            <div className="min-w-0">
              <h1 className="font-display truncate text-2xl font-extrabold text-ink" title={league.name}>
                {league.name}
              </h1>
              {league.intlRank != null && !isWorldLeague && (
                <p className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Trophy size={13} weight="fill" />
                  Locul #{league.intlRank} mondial în topul ligilor
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Chip tone={isWorldLeague ? 'volt' : isProLeague ? 'gold' : 'volt'}>
              <Trophy size={14} weight="fill" aria-hidden="true" />
              {isWorldLeague
                ? 'Publică · Fără limită'
                : league.maxMembers > 5
                  ? `${league.memberCount}/200 jucători`
                  : `${league.memberCount}/5 jucători`}
            </Chip>
            {league.isOwner && !isWorldLeague && (
              <Link href={`/${locale}/league/${league.id}/admin`}>
                <Button size="sm" variant="secondary" className="text-xs">
                  Administrează
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Invite Code & Link Section (Only for private leagues) */}
        {!isWorldLeague && (
          <div className="border-border-subtle bg-surface-2 rounded-xl border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-muted block text-[10px] font-bold uppercase">
                  Cod de invitație
                </span>
                <span className="rd-tabular text-ink text-base font-extrabold tracking-wider">
                  {league.inviteCode}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => void copyInvite()}>
                  <Copy size={16} weight="bold" aria-hidden="true" />
                  {t('league.copyLink')}
                </Button>
                <Button size="sm" variant="primary" onClick={() => void shareNative()}>
                  <ShareNetwork size={16} weight="bold" aria-hidden="true" />
                  {t('league.shareNative')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={shareWhatsApp}
                  aria-label="Share WhatsApp"
                  className="px-2.5"
                >
                  <WhatsappLogo size={18} weight="fill" className="text-[#25D366]" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Owner and Member management actions (Only for private leagues) */}
        {!isWorldLeague && (league.isOwner || league.isMember) && (
          <div className="border-border-subtle flex flex-wrap items-center gap-2 border-t pt-3">
            {league.isOwner && (
              <>
                <Button size="sm" variant="secondary" onClick={() => void handleRename()}>
                  {t('league.rename')}
                </Button>

                {isProLeague && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={actionLoading}
                      onClick={() => void handleRegenerateCode()}
                    >
                      <ArrowClockwise size={14} weight="bold" className="mr-1 inline" aria-hidden="true" />
                      {t('league.regenerateCode')}
                    </Button>

                    <label className="border-border-subtle bg-surface-2 text-ink flex cursor-pointer items-center gap-2 rounded-[10px] border px-2.5 py-1 text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={Boolean(league.privateApproval)}
                        onChange={() => void handleTogglePrivateApproval()}
                        className="h-4 w-4 rounded accent-[var(--rd-blue-strong)]"
                      />
                      <span>{t('league.privateApproval')}</span>
                    </label>
                  </>
                )}

                <Button size="sm" variant="danger" onClick={() => void handleDelete()}>
                  {t('league.delete')}
                </Button>
              </>
            )}

            {league.isMember && !league.isOwner && (
              <Button size="sm" variant="danger" onClick={() => void handleLeave()}>
                {t('league.leave')}
              </Button>
            )}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Link
            href={`/${locale}/regulament#ligi`}
            data-testid="league-rules-link"
            className="text-muted hover:text-duel-strong inline-flex min-h-11 items-center px-2 text-xs font-bold underline underline-offset-2"
          >
            {t('rules.leagueLink')}
          </Link>
        </div>
      </Card>

      {/* 5/5 Full Banner for free league owner */}
      {!isWorldLeague && league.isOwner && !isProLeague && league.memberCount >= 5 && (
        <Card variant="sticker" className="bg-volt text-ink border-2 border-border p-4 shadow-sm space-y-2">
          <p className="font-extrabold text-sm">
            Liga ta e plină (5/5). Cu Pro intră până la 200 de prieteni.
          </p>
          <Link href={`/${locale}/pro`}>
            <Button size="sm" variant="primary">
              Treci la Pro
            </Button>
          </Link>
        </Card>
      )}

      {/* Empty state when alone */}
      {!isWorldLeague && league.memberCount <= 1 && (
        <Card variant="sticker" className="space-y-2 p-4 text-center">
          <p className="font-display text-base font-extrabold">{t('league.aloneTitle')}</p>
          <p className="text-muted text-xs font-medium">
            Ești singur aici. Trimite linkul pe grup ca să înceapă duelul.
          </p>
          <Button size="sm" variant="volt" fullWidth onClick={() => void shareNative()}>
            <ShareNetwork size={16} weight="bold" aria-hidden="true" />
            {t('league.shareNative')}
          </Button>
        </Card>
      )}

      {toast && (
        <div className="flex justify-center">
          <Toast message={toast} tone="success" />
        </div>
      )}

      {/* Daily Round Status */}
      {league.viewerFinishedToday ? (
        <Card variant="subtle" className="border-2 border-border p-3.5 bg-surface-2 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0" aria-hidden="true">🎯</span>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                Runda de azi
              </span>
              <p className="text-sm font-extrabold text-ink truncate">
                Ai jucat azi: <span className="rd-tabular text-ron-strong">{league.viewerScoreToday != null ? `${league.viewerScoreToday.toLocaleString()} pct` : 'Finalizată'}</span>
                {league.viewerRankToday ? ` (Locul #${league.viewerRankToday})` : ''}
              </p>
            </div>
          </div>
          <Link href={`/${locale}/play`}>
            <Button size="sm" variant="secondary" className="shrink-0 text-xs font-bold">
              Vezi scor
            </Button>
          </Link>
        </Card>
      ) : (
        <Card variant="subtle" className="border-2 border-border p-3.5 bg-surface flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0" aria-hidden="true">⚡</span>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                Runda de azi
              </span>
              <p className="text-sm font-extrabold text-ink">
                Nu ai jucat runda de azi
              </p>
            </div>
          </div>
          <Link href={`/${locale}/play?returnTo=${encodeURIComponent(`/league/${league.id}`)}`}>
            <Button size="sm" variant="primary" className="shrink-0 font-bold">
              Joacă runda de azi
            </Button>
          </Link>
        </Card>
      )}

      {/* Search Input for Members */}
      <div className="relative">
        <MagnifyingGlass
          size={18}
          weight="bold"
          className="text-muted pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Caută după nume de utilizator…"
          aria-label="Caută jucător după nume"
          className="w-full rounded-xl border-2 border-border bg-surface pl-10 pr-9 py-2.5 text-sm font-bold text-ink placeholder:text-muted placeholder:font-normal focus:outline-none focus:border-volt-strong focus:ring-2 focus:ring-volt-strong/50 shadow-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted hover:text-ink px-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* Tabs */}
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
        <section aria-label="Clasament astăzi" className="space-y-2.5">
          {!league.viewerFinishedToday && (
            <div className="bg-surface-2 text-muted flex items-center gap-2 rounded-xl border-2 border-border p-3 text-xs font-bold">
              <Lock size={16} weight="bold" aria-hidden="true" />
              <span>{t('league.scoresHidden')}</span>
            </div>
          )}

          {filteredTodayScores.length === 0 ? (
            <Card variant="subtle" className="p-8 text-center">
              <p className="text-muted text-sm font-bold">
                {searchQuery ? `Niciun jucător găsit pentru „${searchQuery}”` : t('league.empty')}
              </p>
            </Card>
          ) : (
            filteredTodayScores.map((row, idx) => {
              const isMe = Boolean(row.isCurrentUser || (sessionUid && row.uid === sessionUid));
              const rank = row.rank ?? idx + 1;
              const podium = getPodiumStyle(rank, isMe);

              return (
                <div
                  key={row.uid}
                  id={`rank-row-${row.uid}`}
                  className={`rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all ${podium.cardStyle}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <RankBadge rank={rank} />
                    <Avatar nickname={row.nickname} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-base font-extrabold text-ink" title={row.nickname}>
                          {row.nickname}
                        </p>
                        {isMe && (
                          <Chip tone="volt" className="text-[10px] py-0 px-1 font-black">
                            Tu
                          </Chip>
                        )}
                      </div>
                      {row.emojiLine && <p className="text-xs tracking-tight">{row.emojiLine}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="rd-tabular text-lg font-black text-ink block">
                      {row.score !== null ? `${row.score.toLocaleString()} pct` : '—'}
                    </span>
                    {row.totalMs !== null && row.totalMs > 0 && (
                      <span className="text-muted text-[11px] font-bold block">
                        {(row.totalMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {tab === 'alltime' && (
        <section aria-label="Clasament all-time" className="space-y-2.5">
          {filteredAllTime.length === 0 ? (
            <Card variant="subtle" className="p-8 text-center">
              <p className="text-muted text-sm font-bold">
                {searchQuery ? `Niciun jucător găsit pentru „${searchQuery}”` : 'Niciun jucător'}
              </p>
            </Card>
          ) : (
            filteredAllTime.map((row, idx) => {
              const isMe = Boolean(row.isCurrentUser || (sessionUid && row.uid === sessionUid));
              const rank = row.rank ?? idx + 1;
              const podium = getPodiumStyle(rank, isMe);

              return (
                <div
                  key={row.uid}
                  id={`rank-row-${row.uid}`}
                  className={`rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all ${podium.cardStyle}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <RankBadge rank={rank} />
                    <Avatar nickname={row.nickname} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-base font-extrabold text-ink" title={row.nickname}>
                          {row.nickname}
                        </p>
                        {isMe && (
                          <Chip tone="volt" className="text-[10px] py-0 px-1 font-black">
                            Tu
                          </Chip>
                        )}
                      </div>
                      <p className="text-muted text-xs font-bold">
                        {row.roundsPlayed} {row.roundsPlayed === 1 ? 'rundă' : 'runde'}
                        {row.joinedAt && ` · ${t('league.joinedOn', { date: formatDate(row.joinedAt) })}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className="rd-tabular text-lg font-black text-ink block">
                        {row.allTimeScore.toLocaleString()}
                      </span>
                      <span className="text-muted text-[10px] font-extrabold uppercase tracking-wider block">
                        puncte
                      </span>
                    </div>

                    {league.isOwner && isProLeague && !league.isWorld && row.uid !== league.ownerUid && (
                      <button
                        type="button"
                        onClick={() => void handleRemoveMember(row.uid)}
                        title={t('league.removeMember')}
                        aria-label={`Elimină ${row.nickname}`}
                        className="text-wrong hover:opacity-80 p-1.5 cursor-pointer ml-1"
                      >
                        <Trash size={16} weight="bold" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {/* Sticky User Rank Bar */}
      <StickyUserRank
        myRank={tab === 'today' ? league.viewerRankToday : league.viewerRankAllTime}
        myScore={tab === 'today' ? league.viewerScoreToday : currentViewerAllTimeScore}
        myNickname={
          (tab === 'today' ? league.todayScores : league.allTime)?.find((m) => m.uid === sessionUid)
            ?.nickname || sessionNickname
        }
        myUid={sessionUid}
        label={isWorldLeague ? 'Locul tău mondial:' : 'Locul tău în ligă:'}
      />
    </main>
  );
}
