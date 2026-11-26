'use client';

import {
  Crown,
  GlobeHemisphereWest,
  MagnifyingGlass,
  Plus,
  Trophy,
  Users,
} from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { CreateLeagueDialog } from '@/components/CreateLeagueDialog';
import { JoinByCodeDialog } from '@/components/JoinByCodeDialog';
import { getPodiumStyle, RankBadge, StickyUserRank } from '@/components/LeaderboardPodium';
import { Avatar, Button, Card, Chip } from '@/components/ui';
import { getLeagueTheme } from '@/lib/league-theme';
import { getBrowserTimeZone, getLocalSession } from '@/lib/session';

interface GlobalPlayerItem {
  rank: number;
  uid: string;
  nickname: string;
  score?: number | null;
  allTimeScore?: number | null;
  totalMs?: number | null;
  emojiLine?: string | null;
  roundsPlayed?: number;
  isCurrentUser?: boolean;
}

interface GlobalPlayersLeaderboard {
  today: GlobalPlayerItem[];
  allTime: GlobalPlayerItem[];
  viewerToday?: GlobalPlayerItem | null;
  viewerAllTime?: GlobalPlayerItem | null;
  totalPlayers: number;
}

interface LeagueItem {
  id: string;
  name: string;
  inviteCode?: string;
  isOwner?: boolean;
  memberCount: number;
  maxMembers?: number;
  isFull?: boolean;
  playedTodayCount: number;
  myRankToday?: number | null;
  myScore?: number | null;
  myNickname?: string;
  intlRank?: number | null;
  intlTotalPoints?: number;
  initials?: string[];
}

interface LeagueLeaderboardItem {
  rank?: number;
  id: string;
  name: string;
  themeEmoji?: string;
  themeColor?: string;
  memberCount: number;
  maxMembers?: number;
  playedTodayCount: number;
  totalPoints: number;
  allTimePoints: number;
  avgScore: number;
  isMember?: boolean;
}

interface LeaguesStatus {
  worldLeague?: LeagueItem | null;
  privateLeagues?: LeagueItem[];
  leaguesLeaderboard?: LeagueLeaderboardItem[];
  globalPlayersLeaderboard?: GlobalPlayersLeaderboard;
  hasFullFreeLeague?: boolean;
  isPro?: boolean;
}

export default function LeaguesPage() {
  const t = useTranslations();
  const locale = useLocale();

  const [status, setStatus] = useState<LeaguesStatus | null>(null);
  const [tab, setTab] = useState<'my' | 'leaderboard'>('my');
  const [leaderboardSubTab, setLeaderboardSubTab] = useState<'global' | 'leagues'>('global');
  const [globalScope, setGlobalScope] = useState<'today' | 'alltime'>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [sessionUid, setSessionUid] = useState('');
  const [myNickname, setMyNickname] = useState('');

  const loadData = () => {
    const session = getLocalSession();
    setSessionUid(session.uid);
    setMyNickname(session.nickname || t('common.you'));
    const tz = getBrowserTimeZone();
    const leaguesParam = (session.leagueIds || []).join(',');
    fetch(
      `/api/game/status?uid=${encodeURIComponent(session.uid)}&tz=${encodeURIComponent(tz)}&leagues=${encodeURIComponent(leaguesParam)}`,
      { cache: 'no-store' },
    )
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('tab') === 'leaderboard') {
        setTab('leaderboard');
      }
      if (urlParams.get('sub') === 'leagues') {
        setLeaderboardSubTab('leagues');
      }
    }
    loadData();
    const onRefocus = () => {
      if (!document.hidden) loadData();
    };
    window.addEventListener('focus', onRefocus);
    window.addEventListener('pageshow', onRefocus);
    document.addEventListener('visibilitychange', onRefocus);
    return () => {
      window.removeEventListener('focus', onRefocus);
      window.removeEventListener('pageshow', onRefocus);
      document.removeEventListener('visibilitychange', onRefocus);
    };
  }, []);

  const worldLeague = status?.worldLeague;
  const privateLeagues = status?.privateLeagues ?? [];
  const leaguesLeaderboard = status?.leaguesLeaderboard ?? [];
  const globalPlayers = status?.globalPlayersLeaderboard;

  // Filtered lists based on search
  const query = searchQuery.trim().toLowerCase();

  const rawGlobalList =
    globalScope === 'today' ? (globalPlayers?.today ?? []) : (globalPlayers?.allTime ?? []);
  const filteredGlobalList = query
    ? rawGlobalList.filter((p) => p.nickname.toLowerCase().includes(query))
    : rawGlobalList;

  const filteredLeaguesList = query
    ? leaguesLeaderboard.filter((l) => l.name.toLowerCase().includes(query))
    : leaguesLeaderboard;

  // Active user ranking in global leaderboard
  const myGlobalItem =
    globalScope === 'today' ? globalPlayers?.viewerToday : globalPlayers?.viewerAllTime;

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6 pb-28">
      {/* Page Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-ink text-2xl font-extrabold">{t('nav.leagues')}</h1>
          <p className="text-muted text-xs font-bold">
            {tab === 'my'
              ? t('leagues.myCount', { count: privateLeagues.length + 1 })
              : leaderboardSubTab === 'global'
                ? t('leagues.worldPlayersCount', {
                    count: globalPlayers?.totalPlayers ?? filteredGlobalList.length,
                  })
                : t('leagues.registeredCount', { count: leaguesLeaderboard.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="volt"
            className="h-10 px-3 text-xs font-black shadow-[2px_2px_0px_0px_var(--border-color,#16131F)]"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} weight="bold" />
            <span>{t('leagues.createShort')}</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-10 px-3 text-xs font-black shadow-[2px_2px_0px_0px_var(--border-color,#16131F)]"
            onClick={() => setJoinOpen(true)}
          >
            {t('leagues.joinByCodeShort')}
          </Button>
        </div>
      </div>

      {/* Main Segmented Tab Switcher: My leagues vs Leaderboards */}
      <div className="border-border bg-surface-2 grid grid-cols-2 gap-1 rounded-xl border-2 p-1">
        <button
          type="button"
          onClick={() => {
            setTab('my');
            setSearchQuery('');
          }}
          className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-black transition-all ${
            tab === 'my'
              ? 'border-border bg-surface text-ink border-2 shadow-[2px_2px_0px_0px_var(--border-color,#16131F)]'
              : 'text-muted hover:text-ink border-2 border-transparent'
          }`}
        >
          <Users size={16} weight="bold" />
          <span>{t('leagues.tabMine')}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('leaderboard');
            setSearchQuery('');
          }}
          className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-black transition-all ${
            tab === 'leaderboard'
              ? 'border-border bg-surface text-ink border-2 shadow-[2px_2px_0px_0px_var(--border-color,#16131F)]'
              : 'text-muted hover:text-ink border-2 border-transparent'
          }`}
        >
          <Trophy size={16} weight="fill" className="text-volt-strong" />
          <span>{t('leagues.tabLeaderboard')}</span>
        </button>
      </div>

      {/* SUB-TABS when Leaderboards is active: Global Leaderboard vs Leagues Leaderboard */}
      {tab === 'leaderboard' && (
        <div className="flex flex-col gap-3">
          <div className="border-border bg-surface grid grid-cols-2 gap-1.5 rounded-xl border-2 p-1">
            <button
              type="button"
              onClick={() => {
                setLeaderboardSubTab('global');
                setSearchQuery('');
              }}
              className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black transition-all ${
                leaderboardSubTab === 'global'
                  ? 'border-border bg-volt border-2 text-[#16131F] shadow-[2px_2px_0px_0px_var(--border-color,#16131F)]'
                  : 'text-muted hover:text-ink border-2 border-transparent'
              }`}
            >
              <GlobeHemisphereWest size={15} weight="bold" />
              <span>{t('leagues.globalLeaderboard')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLeaderboardSubTab('leagues');
                setSearchQuery('');
              }}
              className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-black transition-all ${
                leaderboardSubTab === 'leagues'
                  ? 'border-border bg-volt border-2 text-[#16131F] shadow-[2px_2px_0px_0px_var(--border-color,#16131F)]'
                  : 'text-muted hover:text-ink border-2 border-transparent'
              }`}
            >
              <Trophy size={15} weight="bold" />
              <span>{t('leagues.tabRanking')}</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <MagnifyingGlass
              size={18}
              weight="bold"
              className="text-muted absolute left-3.5 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              placeholder={
                leaderboardSubTab === 'global'
                  ? t('leagues.searchPlayerPlaceholder')
                  : t('leagues.searchLeaguePlaceholder')
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-border bg-surface text-ink placeholder:text-muted focus:ring-volt-strong w-full rounded-xl border-2 py-2.5 pl-10 pr-4 text-xs font-bold shadow-sm focus:outline-none focus:ring-2"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-muted hover:text-ink absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: LIGILE MELE */}
      {/* ========================================================================= */}
      {tab === 'my' && (
        <>
          {/* Full Free League Notice */}
          {status?.hasFullFreeLeague && (
            <Card
              variant="sticker"
              className="bg-volt text-ink border-border space-y-2 border-2 p-4 shadow-sm"
            >
              <div className="flex items-start gap-2.5">
                <Crown size={22} weight="fill" className="text-ron-strong mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-extrabold leading-snug">
                    {t('leagues.leagueFullCount', { count: 5, max: 5 })}
                  </p>
                  <p className="text-ink/80 text-xs font-medium">
                    {t('common.leagueFullBannerBody')}
                  </p>
                </div>
              </div>
              <Link href={`/${locale}/pro`} className="block pt-1">
                <Button size="sm" variant="primary" fullWidth>
                  {t('common.goPro')}
                </Button>
              </Link>
            </Card>
          )}

          {/* 1. PUBLIC LEAGUE (RonDuel World) */}
          <section className="space-y-2">
            <h2 className="text-muted text-xs font-bold uppercase tracking-wider">
              {t('leagues.publicLeague')}
            </h2>
            <Link
              href={`/${locale}/league/lg_world`}
              className="border-border bg-surface text-ink hover:border-border-subtle flex min-w-0 select-none flex-col gap-3 rounded-2xl border-2 p-4 shadow-[var(--rd-shadow-key)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="bg-volt/40 border-border flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 text-2xl font-black">
                    <GlobeHemisphereWest
                      size={26}
                      weight="duotone"
                      className="text-duel-strong dark:text-duel"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display line-clamp-2 break-words text-base font-black [overflow-wrap:anywhere]">
                        RonDuel World
                      </span>
                      <Chip tone="blue" className="px-1.5 py-0 text-[10px] font-black">
                        {t('leagues.globalBadge')}
                      </Chip>
                    </div>
                    <p className="text-muted break-words text-xs font-medium [overflow-wrap:anywhere]">
                      {t('league.membersCount', { count: worldLeague?.memberCount ?? 1 })}{' '}
                      {t('leagues.publicNoLimitSuffix')}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {worldLeague?.myRankToday ? (
                    <Chip tone="volt" className="text-xs font-black">
                      #{worldLeague.myRankToday} {t('league.tabToday').toLowerCase()}
                    </Chip>
                  ) : (
                    <span className="text-muted text-xs font-bold">{t('leagues.open')}</span>
                  )}
                </div>
              </div>

              {/* User position banner inside the World League card */}
              <div className="border-border-subtle bg-surface-2/60 -mx-4 -mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-b-2xl border-t px-4 py-2.5 pt-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar nickname={worldLeague?.myNickname || myNickname} size="sm" />
                  <span className="truncate text-xs font-extrabold">
                    {worldLeague?.myNickname || myNickname}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-ink text-xs font-black">
                    {worldLeague?.myRankToday
                      ? t('leagues.worldRank', { rank: worldLeague.myRankToday })
                      : t('leagues.leaderboardAvailable')}
                  </span>
                  {worldLeague?.myScore != null && (
                    <span className="text-muted block text-[11px] font-bold">
                      {t('common.points', { points: worldLeague.myScore.toLocaleString() })}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </section>

          {/* 2. LIGILE MELE (Private Leagues) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-muted text-xs font-bold uppercase tracking-wider">
                {t('leagues.tabMine')}
              </h2>
              <span className="text-muted text-xs font-bold">
                {t('leagues.privateCountMax', {
                  count: privateLeagues.length,
                  max: status?.isPro ? '∞' : '10',
                })}
              </span>
            </div>

            {privateLeagues.length === 0 ? (
              <Card className="border-border bg-surface-2/60 space-y-3 border-2 border-dashed p-6 text-center">
                <div className="bg-surface border-border mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border-2 text-2xl shadow-sm">
                  <Users size={24} weight="bold" className="text-ron-strong" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-ink text-base font-black">
                    {t('leagues.emptyTitle')}
                  </h3>
                  <p className="text-muted mx-auto max-w-[280px] text-xs">
                    {t('leagues.emptyBodyJoinLimit', { max: 10 })}
                  </p>
                </div>
                <div className="flex flex-col justify-center gap-2 pt-2 sm:flex-row">
                  <Button size="sm" variant="primary" onClick={() => setCreateOpen(true)}>
                    {t('leagues.createFirst')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setJoinOpen(true)}>
                    {t('leagues.joinWithCode')}
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {privateLeagues.map((league) => (
                  <Link
                    key={league.id}
                    href={`/${locale}/league/${league.id}`}
                    className="border-border bg-surface text-ink hover:border-border-subtle flex min-w-0 select-none flex-col gap-3 rounded-2xl border-2 p-4 shadow-[var(--rd-shadow-key)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                  >
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        {/* Initials avatars */}
                        <div className="flex shrink-0 -space-x-2">
                          {(league.initials && league.initials.length > 0 ? league.initials : ['L'])
                            .slice(0, 3)
                            .map((init, i) => (
                              <div
                                key={i}
                                className="border-border bg-surface-2 flex h-9 w-9 items-center justify-center rounded-xl border-2 text-xs font-black shadow-sm"
                              >
                                {init}
                              </div>
                            ))}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-display line-clamp-2 break-words text-sm font-extrabold [overflow-wrap:anywhere]">
                              {league.name}
                            </span>
                            {league.isOwner && (
                              <Chip tone="neutral" className="px-1 py-0 text-[10px] font-bold">
                                {t('leagues.adminBadge')}
                              </Chip>
                            )}
                          </div>
                          <p className="text-muted break-words text-xs [overflow-wrap:anywhere]">
                            {t('league.membersCount', { count: league.memberCount })} /{' '}
                            {league.maxMembers ?? 5} ·{' '}
                            {t('common.playedTodayCount', { count: league.playedTodayCount })}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {league.intlRank ? (
                          <Chip tone="volt" className="text-xs font-black">
                            🏆 {t('leagues.worldRank', { rank: league.intlRank })}
                          </Chip>
                        ) : (
                          <span className="text-muted text-xs font-bold">{t('leagues.open')}</span>
                        )}
                      </div>
                    </div>

                    {/* International rank of the league & user ranking in this league */}
                    <div className="border-border-subtle bg-surface-2/60 -mx-4 -mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-b-2xl border-t px-4 py-2.5 pt-2.5 text-xs">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Avatar nickname={league.myNickname || myNickname} size="sm" />
                        <span className="truncate font-extrabold">
                          {league.myNickname || myNickname}
                        </span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-ink font-black">
                          {league.myRankToday
                            ? t('leagues.rankInLeague', { rank: league.myRankToday })
                            : t('leagues.notPlayedToday')}
                        </span>
                        {league.myScore != null && (
                          <span className="text-muted block text-[11px] font-bold">
                            {t('common.points', { points: league.myScore.toLocaleString() })}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CLASAMENT (GLOBAL & LEAGUES) */}
      {/* ========================================================================= */}
      {tab === 'leaderboard' && (
        <section className="space-y-3">
          {/* SUB-TAB A: CLASAMENT GLOBAL (Players Worldwide) */}
          {leaderboardSubTab === 'global' && (
            <div className="space-y-3">
              {/* Scope Switcher: Azi vs All-Time */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-ink text-lg font-black">
                    {t('leagues.worldPlayersTitle')}
                  </h2>
                  <p className="text-muted text-xs font-medium">
                    {globalScope === 'today'
                      ? t('leagues.todayRoundLeaderboard')
                      : t('leagues.allTimeLeaderboard')}
                  </p>
                </div>
                <div className="border-border bg-surface-2 flex items-center rounded-lg border-2 p-0.5 text-xs font-black">
                  <button
                    type="button"
                    onClick={() => setGlobalScope('today')}
                    className={`cursor-pointer rounded-md px-2.5 py-1 transition-all ${
                      globalScope === 'today'
                        ? 'border-border bg-surface text-ink border shadow-sm'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {t('league.tabToday')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlobalScope('alltime')}
                    className={`cursor-pointer rounded-md px-2.5 py-1 transition-all ${
                      globalScope === 'alltime'
                        ? 'border-border bg-surface text-ink border shadow-sm'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {t('league.tabAllTime')}
                  </button>
                </div>
              </div>

              {filteredGlobalList.length === 0 ? (
                <Card className="border-border bg-surface-2/60 space-y-2 border-2 border-dashed p-6 text-center">
                  <Trophy size={32} weight="fill" className="text-muted mx-auto" />
                  <p className="text-ink text-sm font-bold">{t('leagues.noPlayersFound')}</p>
                  <p className="text-muted text-xs">
                    {searchQuery ? t('leagues.tryAnotherSearch') : t('leagues.playToTop')}
                  </p>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {filteredGlobalList.map((player) => {
                    const podium = getPodiumStyle(player.rank, player.isCurrentUser);
                    return (
                      <div
                        id={`rank-row-${player.uid}`}
                        key={player.uid}
                        className={`flex select-none items-center justify-between gap-3 rounded-2xl p-3.5 transition-all ${podium.cardStyle}`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <RankBadge rank={player.rank} />
                          <Avatar nickname={player.nickname} size="md" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-display truncate text-sm font-black">
                                {player.nickname}
                              </span>
                              {player.isCurrentUser && (
                                <Chip tone="volt" className="px-1.5 py-0 text-[10px] font-black">
                                  {t('common.you')}
                                </Chip>
                              )}
                            </div>
                            <p className="text-muted text-xs font-medium">
                              {globalScope === 'today'
                                ? player.emojiLine || t('league.roundFinished')
                                : t('leagues.roundsPlayed', { count: player.roundsPlayed ?? 1 })}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="rd-tabular font-display text-ink block text-base font-black">
                            {t('common.points', {
                              points:
                                (globalScope === 'today'
                                  ? player.score
                                  : player.allTimeScore
                                )?.toLocaleString() ?? '—',
                            })}
                          </span>
                          <span className="text-muted text-[10px] font-bold">
                            {t('common.rankPlace', { rank: player.rank })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sticky bottom user rank bar */}
              <StickyUserRank
                myRank={myGlobalItem?.rank}
                myScore={globalScope === 'today' ? myGlobalItem?.score : myGlobalItem?.allTimeScore}
                myNickname={myGlobalItem?.nickname || myNickname}
                myUid={sessionUid}
                label={t('common.yourWorldRank')}
              />
            </div>
          )}

          {/* SUB-TAB B: CLASAMENTUL LIGILOR (Leagues Leaderboard) */}
          {leaderboardSubTab === 'leagues' && (
            <div className="space-y-3">
              <div>
                <h2 className="font-display text-ink text-lg font-black">
                  {t('leagues.rankingTitle')}
                </h2>
                <p className="text-muted text-xs font-medium">
                  {t('leagues.rankingSubtitleTotal')}
                </p>
              </div>

              {filteredLeaguesList.length === 0 ? (
                <Card className="border-border bg-surface-2/60 space-y-2 border-2 border-dashed p-6 text-center">
                  <Trophy size={32} weight="fill" className="text-muted mx-auto" />
                  <p className="text-ink text-sm font-bold">{t('leagues.noLeaguesFound')}</p>
                  <p className="text-muted text-xs">{t('leagues.rankingEmptyCta')}</p>
                  <div className="pt-2">
                    <Button size="sm" variant="volt" onClick={() => setCreateOpen(true)}>
                      {t('splash.createLeague')}
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {filteredLeaguesList.map((item, index) => {
                    const rankNum = item.rank ?? index + 1;
                    const podium = getPodiumStyle(rankNum, item.isMember);
                    return (
                      <Link
                        key={item.id}
                        href={`/${locale}/league/${item.id}`}
                        className={`flex select-none items-center justify-between gap-3 rounded-2xl p-3.5 transition-all ${podium.cardStyle}`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <RankBadge rank={rankNum} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg"
                                style={{
                                  backgroundColor: `${getLeagueTheme(item.themeColor).hex}22`,
                                }}
                                aria-hidden="true"
                              >
                                {item.themeEmoji || '🏆'}
                              </span>
                              <span className="font-display truncate text-sm font-black">
                                {item.name}
                              </span>
                              {item.isMember && (
                                <Chip tone="volt" className="px-1 py-0 text-[10px] font-black">
                                  {t('leagues.yourLeagueBadge')}
                                </Chip>
                              )}
                            </div>
                            <p className="text-muted text-xs font-medium">
                              {t('league.membersCount', { count: item.memberCount })} ·{' '}
                              {t('leagues.rankingAverage', { avg: item.avgScore })}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="rd-tabular font-display text-ink block text-sm font-black">
                            {t('common.points', { points: item.allTimePoints.toLocaleString() })}
                          </span>
                          <span className="text-muted text-[10px] font-bold">
                            {item.totalPoints > 0
                              ? `+${t('leagues.todayCount', { count: item.totalPoints })}`
                              : t('leagues.todayCount', { count: 0 })}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Dialogs */}
      <CreateLeagueDialog
        open={createOpen}
        uid={sessionUid}
        onClose={() => {
          setCreateOpen(false);
          loadData();
        }}
        onCreated={() => loadData()}
      />
      <JoinByCodeDialog
        open={joinOpen}
        onClose={() => {
          setJoinOpen(false);
          loadData();
        }}
      />
    </main>
  );
}
