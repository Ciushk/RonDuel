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
import { getLeagueTheme } from '@/lib/league-theme';
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
  description?: string;
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
      setError(t('league.errorInvalidId'));
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
            err?.name === 'AbortError' ? t('league.errorTimeout') : t('league.errorNotFound'),
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
      setToast(t('league.renamedToast'));
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
        setToast(t('league.codeRegeneratedToast'));
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
        setToast(nextVal ? t('league.privateApprovalOn') : t('league.privateApprovalOff'));
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
        setToast(t('league.memberRemovedToast'));
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
      <main className="text-muted mx-auto max-w-[480px] space-y-3 px-4 py-16 text-center font-bold">
        <div className="border-volt mx-auto h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
        <p>{t('league.loading')}</p>
      </main>
    );
  }

  if (error || !league) {
    return (
      <main className="mx-auto flex max-w-[480px] flex-col gap-4 px-4 py-12 text-center">
        <Card variant="sticker" className="space-y-4 p-6">
          <div className="bg-surface-2 border-border mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border-2 text-2xl shadow-sm">
            🏆
          </div>
          <div className="space-y-1">
            <h1 className="font-display text-ink text-xl font-extrabold">
              {t('league.errorNotFound')}
            </h1>
            <p className="text-muted mx-auto max-w-[280px] text-xs leading-relaxed">
              {error || t('league.errorNotFound')}
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Button variant="volt" fullWidth onClick={loadLeague}>
              {t('common.retry')}
            </Button>
            <Link href={`/${locale}/leagues`} className="block">
              <Button variant="secondary" fullWidth>
                {t('league.backToLeagues')}
              </Button>
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  const isProLeague = league.maxMembers > 5 && !league.isWorld;
  const isWorldLeague = Boolean(league.isWorld || league.id === 'lg_world');
  const theme = getLeagueTheme(league.themeColor);

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
    <main className="mx-auto flex min-w-0 max-w-[480px] flex-col gap-4 px-4 py-6 pb-28">
      <Card className="min-w-0 space-y-3">
        <div className="min-w-0 space-y-2">
          <div className="min-w-0 space-y-1">
            <span
              className="mb-1 block h-1.5 w-14 rounded-full"
              style={{ backgroundColor: theme.hex }}
              aria-hidden="true"
            />
            <h1 className="font-display text-ink flex items-start gap-2 text-2xl font-extrabold">
              <span
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-2xl"
                style={{ backgroundColor: `${theme.hex}22` }}
                aria-hidden="true"
              >
                {league.themeEmoji ?? (isWorldLeague ? '🌍' : '🏆')}
              </span>
              <span
                className="line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere]"
                title={league.name}
              >
                {league.name}
              </span>
            </h1>
            {league.intlRank != null && !isWorldLeague && (
              <p className="flex items-center gap-1 text-xs font-black text-amber-600 dark:text-amber-400">
                <Trophy size={13} weight="fill" />
                {t('league.worldRankInLeagues', { rank: league.intlRank })}
              </p>
            )}
            {league.description ? (
              <p className="text-muted min-w-0 break-words text-sm font-medium [overflow-wrap:anywhere]">
                {league.description}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={isWorldLeague ? 'volt' : isProLeague ? 'gold' : 'volt'}>
              <Trophy size={14} weight="fill" aria-hidden="true" />
              {isWorldLeague
                ? t('league.publicNoLimit')
                : t('league.membersCount', { count: league.memberCount })}
            </Chip>
            {league.isOwner && !isWorldLeague && (
              <Link href={`/${locale}/league/${league.id}/admin`}>
                <Button size="sm" variant="secondary" className="text-xs">
                  {t('league.manageShort')}
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Invite Code & Link Section (Only for private leagues) */}
        {!isWorldLeague && (
          <div className="border-border-subtle bg-surface-2 min-w-0 space-y-2 rounded-xl border p-3">
            <div className="min-w-0">
              <span className="text-muted block text-[10px] font-bold uppercase">
                {t('league.inviteCodeLabel')}
              </span>
              <span className="rd-tabular text-ink break-all text-base font-extrabold tracking-wider">
                {league.inviteCode}
              </span>
            </div>
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void copyInvite()}
                className="min-w-0 whitespace-normal px-2 text-center text-xs leading-tight"
              >
                <Copy size={16} weight="bold" className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{t('league.copyLink')}</span>
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => void shareNative()}
                className="min-w-0 whitespace-normal px-2 text-center text-xs leading-tight"
              >
                <ShareNetwork size={16} weight="bold" className="shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{t('league.shareNative')}</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={shareWhatsApp}
                aria-label={t('league.shareWhatsApp')}
                className="!h-11 !w-11 shrink-0 !px-0"
              >
                <WhatsappLogo
                  size={18}
                  weight="fill"
                  className="text-[#25D366]"
                  aria-hidden="true"
                />
              </Button>
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
                      <ArrowClockwise
                        size={14}
                        weight="bold"
                        className="mr-1 inline"
                        aria-hidden="true"
                      />
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
        <Card
          variant="sticker"
          className="bg-volt text-ink border-border space-y-2 border-2 p-4 shadow-sm"
        >
          <p className="text-sm font-extrabold">
            {t('league.fullBannerFree', { count: league.memberCount, max: 5, proMax: 200 })}
          </p>
          <Link href={`/${locale}/pro`}>
            <Button size="sm" variant="primary">
              {t('common.goPro')}
            </Button>
          </Link>
        </Card>
      )}

      {/* Empty state when alone */}
      {!isWorldLeague && league.memberCount <= 1 && (
        <Card variant="sticker" className="min-w-0 space-y-2 p-4 text-center">
          <p className="font-display break-words text-base font-extrabold [overflow-wrap:anywhere]">
            {t('league.aloneTitle')}
          </p>
          <p className="text-muted break-words text-xs font-medium [overflow-wrap:anywhere]">
            {t('league.aloneSubtitle')}
          </p>
          <Button
            size="sm"
            variant="volt"
            fullWidth
            className="min-w-0 whitespace-normal"
            onClick={() => void shareNative()}
          >
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
        <Card
          variant="subtle"
          className="border-border bg-surface-2 flex items-center justify-between gap-3 border-2 p-3.5 shadow-sm"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 text-2xl" aria-hidden="true">
              🎯
            </span>
            <div className="min-w-0">
              <span className="text-muted block text-[10px] font-bold uppercase tracking-wider">
                {t('common.todayRound')}
              </span>
              <p className="text-ink truncate text-sm font-extrabold">
                {league.viewerScoreToday != null
                  ? t('league.playedTodayScore', {
                      points: league.viewerScoreToday.toLocaleString(),
                    })
                  : t('league.roundFinished')}
                {league.viewerRankToday
                  ? ` ${t('league.rankSuffix', { rank: league.viewerRankToday })}`
                  : ''}
              </p>
            </div>
          </div>
          <Link href={`/${locale}/play`}>
            <Button size="sm" variant="secondary" className="shrink-0 text-xs font-bold">
              {t('league.viewScore')}
            </Button>
          </Link>
        </Card>
      ) : (
        <Card
          variant="subtle"
          className="border-border bg-surface flex items-center justify-between gap-3 border-2 p-3.5 shadow-md"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 text-2xl" aria-hidden="true">
              ⚡
            </span>
            <div className="min-w-0">
              <span className="text-muted block text-[10px] font-bold uppercase tracking-wider">
                {t('common.todayRound')}
              </span>
              <p className="text-ink text-sm font-extrabold">{t('league.notPlayedToday')}</p>
            </div>
          </div>
          <Link href={`/${locale}/play?returnTo=${encodeURIComponent(`/league/${league.id}`)}`}>
            <Button size="sm" variant="primary" className="shrink-0 font-bold">
              {t('brand.playToday')}
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
          placeholder={t('league.searchPlaceholder')}
          aria-label={t('a11y.searchPlayer')}
          className="border-border bg-surface text-ink placeholder:text-muted focus:border-volt-strong focus:ring-volt-strong/50 w-full rounded-xl border-2 py-2.5 pl-10 pr-9 text-sm font-bold shadow-sm placeholder:font-normal focus:outline-none focus:ring-2"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-muted hover:text-ink absolute right-3 top-1/2 -translate-y-1/2 px-1 text-xs font-bold"
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
        <section aria-label={t('a11y.leaderboardToday')} className="space-y-2.5">
          {!league.viewerFinishedToday && (
            <div className="bg-surface-2 text-muted border-border flex items-center gap-2 rounded-xl border-2 p-3 text-xs font-bold">
              <Lock size={16} weight="bold" aria-hidden="true" />
              <span>{t('league.scoresHidden')}</span>
            </div>
          )}

          {filteredTodayScores.length === 0 ? (
            <Card variant="subtle" className="p-8 text-center">
              <p className="text-muted text-sm font-bold">
                {searchQuery
                  ? t('league.searchNoResults', { query: searchQuery })
                  : t('league.empty')}
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
                  className={`flex items-center justify-between gap-3 rounded-2xl p-3.5 transition-all ${podium.cardStyle}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <RankBadge rank={rank} />
                    <Avatar nickname={row.nickname} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p
                          className="text-ink truncate text-base font-extrabold"
                          title={row.nickname}
                        >
                          {row.nickname}
                        </p>
                        {isMe && (
                          <Chip tone="volt" className="px-1 py-0 text-[10px] font-black">
                            {t('common.you')}
                          </Chip>
                        )}
                      </div>
                      {row.emojiLine && <p className="text-xs tracking-tight">{row.emojiLine}</p>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="rd-tabular text-ink block text-lg font-black">
                      {row.score !== null
                        ? t('common.points', { points: row.score.toLocaleString() })
                        : '—'}
                    </span>
                    {row.totalMs !== null && row.totalMs > 0 && (
                      <span className="text-muted block text-[11px] font-bold">
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
        <section aria-label={t('a11y.leaderboardAllTime')} className="space-y-2.5">
          {filteredAllTime.length === 0 ? (
            <Card variant="subtle" className="p-8 text-center">
              <p className="text-muted text-sm font-bold">
                {searchQuery
                  ? t('league.searchNoResults', { query: searchQuery })
                  : t('league.noPlayers')}
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
                  className={`flex items-center justify-between gap-3 rounded-2xl p-3.5 transition-all ${podium.cardStyle}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <RankBadge rank={rank} />
                    <Avatar nickname={row.nickname} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p
                          className="text-ink truncate text-base font-extrabold"
                          title={row.nickname}
                        >
                          {row.nickname}
                        </p>
                        {isMe && (
                          <Chip tone="volt" className="px-1 py-0 text-[10px] font-black">
                            {t('common.you')}
                          </Chip>
                        )}
                      </div>
                      <p className="text-muted text-xs font-bold">
                        {t('league.roundsCount', { count: row.roundsPlayed })}
                        {row.joinedAt &&
                          ` · ${t('league.joinedOn', { date: formatDate(row.joinedAt) })}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <span className="rd-tabular text-ink block text-lg font-black">
                        {t('common.points', { points: row.allTimeScore.toLocaleString() })}
                      </span>
                    </div>

                    {league.isOwner &&
                      isProLeague &&
                      !league.isWorld &&
                      row.uid !== league.ownerUid && (
                        <button
                          type="button"
                          onClick={() => void handleRemoveMember(row.uid)}
                          title={t('league.removeMember')}
                          aria-label={t('league.removeMemberAria', { name: row.nickname })}
                          className="text-wrong ml-1 cursor-pointer p-1.5 hover:opacity-80"
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
        label={isWorldLeague ? t('common.yourWorldRank') : t('league.yourLeagueRank')}
      />
    </main>
  );
}
