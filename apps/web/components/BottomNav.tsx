'use client';

import {
  Buildings,
  CalendarCheck,
  Lightning,
  Sword,
  User,
  UsersThree,
} from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { trackEvent } from '@/lib/analytics';
import { useFeatureFlag } from '@/lib/feature-flags';
import { getBrowserTimeZone, getLocalSession } from '@/lib/session';

interface BottomNavProps {
  desktopSidebar?: boolean;
}

export function BottomNav({ desktopSidebar = false }: BottomNavProps) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const townEnabled = useFeatureFlag('town_enabled');

  const [playedToday, setPlayedToday] = useState<boolean | null>(null);
  const [turnCount, setTurnCount] = useState<number>(0);

  // Check game status to populate badges:
  // - "Azi": dot if unplayed, "✓" if played
  // - "Dueluri": number of duels waiting for my turn
  useEffect(() => {
    let active = true;
    const session = getLocalSession();
    const tz = getBrowserTimeZone();

    fetch(`/api/game/status?uid=${encodeURIComponent(session.uid)}&tz=${encodeURIComponent(tz)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setPlayedToday(Boolean(data.played));
        if (Array.isArray(data.activeDuels)) {
          const myTurns = data.activeDuels.filter(
            (d: { myTurn: boolean; status: string }) =>
              d.myTurn && (d.status === 'active' || d.status === 'pending'),
          ).length;
          setTurnCount(myTurns);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [pathname]);

  // Determine active tab
  const isTodayActive = pathname === `/${locale}` || pathname === `/${locale}/`;
  const isLeaguesActive =
    pathname.startsWith(`/${locale}/leagues`) ||
    (pathname.startsWith(`/${locale}/league/`) && !pathname.endsWith('/admin'));
  const isTownActive = pathname.startsWith(`/${locale}/town`);
  const isDuelsActive =
    pathname.startsWith(`/${locale}/duels`) || pathname.startsWith(`/${locale}/duel/`);
  const isProfileActive =
    pathname.startsWith(`/${locale}/me`) ||
    pathname.startsWith(`/${locale}/profile`) ||
    pathname.startsWith(`/${locale}/settings`) ||
    pathname.startsWith(`/${locale}/pro`);

  const todayTab = {
    key: 'today' as const,
    label: t('nav.home'),
    href: `/${locale}`,
    isActive: isTodayActive,
    icon: (filled: boolean) => {
      const isPlayed = Boolean(playedToday);
      return (
        <div
          className={`relative flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 ${
            isPlayed
              ? 'bg-gradient-to-br from-[#34D399] via-[#10B981] to-[#047857] shadow-[0_0_12px_2px_rgba(16,185,129,0.55)] ring-2 ring-emerald-400/50'
              : 'animate-[pulse_2.2s_ease-in-out_infinite] bg-gradient-to-br from-[#FF7A70] via-[#FF3B30] to-[#DC2626] shadow-[0_0_12px_2px_rgba(255,59,48,0.6)] ring-2 ring-red-400/50'
          } ${filled ? 'scale-110 ring-2 ring-[#16131F] dark:ring-white' : 'hover:scale-105'}`}
          title={isPlayed ? t('a11y.roundDone') : t('a11y.roundAvailable')}
        >
          {/* Sparkle glossy highlight */}
          <span
            className="pointer-events-none absolute left-1.5 top-0.5 h-1.5 w-2 rounded-full bg-white/60 blur-[0.3px]"
            aria-hidden="true"
          />
          <Lightning
            size={16}
            weight="fill"
            className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
            aria-hidden="true"
          />
        </div>
      );
    },
    badge: null,
  };

  const leaguesTab = {
    key: 'leagues' as const,
    label: t('nav.leagues'),
    href: `/${locale}/leagues`,
    isActive: isLeaguesActive,
    icon: (filled: boolean) =>
      filled ? (
        <UsersThree size={24} weight="fill" className="text-duel-strong dark:text-duel" />
      ) : (
        <UsersThree size={24} weight="bold" />
      ),
    badge: null,
  };

  const townTab = {
    key: 'town' as const,
    label: t('nav.town'),
    href: `/${locale}/town`,
    isActive: isTownActive,
    icon: (filled: boolean) => (
      <div
        className={`relative flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-[#0E0D15] bg-[#C6FF3D] text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15] transition-all duration-200 ${
          filled
            ? 'scale-110 shadow-[3px_3px_0px_0px_#0E0D15]'
            : 'hover:scale-105 active:translate-y-0.5'
        }`}
      >
        <Buildings size={22} weight={filled ? 'fill' : 'bold'} />
      </div>
    ),
    badge: null,
  };

  const duelsTab = {
    key: 'duels' as const,
    label: t('nav.duels'),
    href: `/${locale}/duels`,
    isActive: isDuelsActive,
    icon: (filled: boolean) =>
      filled ? (
        <Sword size={24} weight="fill" className="text-volt dark:text-volt" />
      ) : (
        <Sword size={24} weight="bold" />
      ),
    badge:
      turnCount > 0 ? (
        <span
          aria-label={t('nav.duelsYourTurnBadge', { count: turnCount })}
          className="bg-ron-strong absolute -right-2 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black text-white shadow-sm"
        >
          {turnCount}
        </span>
      ) : null,
  };

  const profileTab = {
    key: 'profile' as const,
    label: t('nav.profile'),
    href: `/${locale}/me`,
    isActive: isProfileActive,
    icon: (filled: boolean) =>
      filled ? (
        <User size={24} weight="fill" className="text-ink" />
      ) : (
        <User size={24} weight="bold" />
      ),
    badge: null,
  };

  const tabs = townEnabled
    ? [todayTab, leaguesTab, townTab, duelsTab, profileTab]
    : [todayTab, leaguesTab, duelsTab, profileTab];

  const handleTabClick = (
    tabKey: 'today' | 'leagues' | 'town' | 'duels' | 'profile',
    isActive: boolean,
  ) => {
    trackEvent('nav_tab_clicked', { tab: tabKey });
    if (isActive && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (desktopSidebar) {
    return (
      <aside
        aria-label={t('a11y.mainNav')}
        className="border-border bg-surface fixed bottom-0 left-0 top-14 z-20 hidden w-60 flex-col gap-2 overflow-y-auto border-r-2 p-4 lg:flex"
      >
        <div className="flex flex-col gap-1.5">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.isActive ? 'page' : undefined}
              onClick={() => handleTabClick(tab.key, tab.isActive)}
              className={`relative flex min-h-12 items-center gap-3 rounded-xl border-2 px-3 py-2 text-sm font-bold transition-all ${
                tab.key === 'town'
                  ? tab.isActive
                    ? 'text-ink border-[#0E0D15] bg-[#C6FF3D]/20 font-black shadow-[2px_2px_0px_0px_#0E0D15]'
                    : 'text-ink hover:border-border-subtle hover:bg-surface-2 border-transparent'
                  : tab.isActive
                    ? 'border-border bg-surface-2 text-ink font-black shadow-[2px_2px_0px_0px_var(--border-color,#16131F)]'
                    : 'text-muted hover:border-border-subtle hover:bg-surface-2 hover:text-ink border-transparent'
              }`}
            >
              <div className="relative shrink-0">
                {tab.key === 'town' ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[#0E0D15] bg-[#C6FF3D] text-[#0E0D15] shadow-[1px_1px_0px_0px_#0E0D15]">
                    <Buildings size={16} weight={tab.isActive ? 'fill' : 'bold'} />
                  </div>
                ) : (
                  tab.icon(tab.isActive)
                )}
              </div>
              <span className="truncate">{tab.label}</span>
              {tab.key === 'duels' && turnCount > 0 && (
                <span className="bg-ron-strong ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-black text-white shadow-sm">
                  {turnCount}
                </span>
              )}
            </Link>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <nav
      aria-label={t('a11y.bottomNav')}
      className="border-border bg-surface/95 fixed inset-x-0 bottom-0 z-30 border-t-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-[480px] items-stretch justify-around px-2">
        {tabs.map((tab) => {
          if (tab.key === 'town') {
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={tab.isActive ? 'page' : undefined}
                onClick={() => handleTabClick(tab.key, tab.isActive)}
                className="group relative -mt-3.5 flex min-h-[48px] flex-1 select-none flex-col items-center justify-start gap-0.5"
              >
                <div className="relative flex items-center justify-center">
                  {tab.icon(tab.isActive)}
                </div>
                <span
                  className={`text-ink mt-0.5 text-[10px] leading-tight transition-transform ${
                    tab.isActive ? 'scale-105 font-black' : 'font-bold'
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.isActive ? 'page' : undefined}
              onClick={() => handleTabClick(tab.key, tab.isActive)}
              className={`group relative flex min-h-[48px] flex-1 select-none flex-col items-center justify-center gap-0.5 rounded-lg py-1 transition-colors ${
                tab.isActive ? 'text-ink font-extrabold' : 'text-muted hover:text-ink font-medium'
              }`}
            >
              <div className="relative flex items-center justify-center">
                {tab.icon(tab.isActive)}
                {tab.badge}
              </div>
              <span
                className={`text-[11px] leading-tight transition-transform ${
                  tab.isActive ? 'scale-105 font-black' : 'font-bold'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
