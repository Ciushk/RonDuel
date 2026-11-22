'use client';

import { CalendarCheck, Lightning, Sword, User, UsersThree } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { trackEvent } from '@/lib/analytics';
import { getBrowserTimeZone, getLocalSession } from '@/lib/session';

interface BottomNavProps {
  desktopSidebar?: boolean;
}

export function BottomNav({ desktopSidebar = false }: BottomNavProps) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();

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
            (d: { myTurn: boolean; status: string }) => d.myTurn && (d.status === 'active' || d.status === 'pending')
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
  const isDuelsActive =
    pathname.startsWith(`/${locale}/duels`) || pathname.startsWith(`/${locale}/duel/`);
  const isProfileActive =
    pathname.startsWith(`/${locale}/me`) ||
    pathname.startsWith(`/${locale}/profile`) ||
    pathname.startsWith(`/${locale}/settings`) ||
    pathname.startsWith(`/${locale}/pro`);

  const tabs = [
    {
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
                : 'bg-gradient-to-br from-[#FF7A70] via-[#FF3B30] to-[#DC2626] shadow-[0_0_12px_2px_rgba(255,59,48,0.6)] ring-2 ring-red-400/50 animate-[pulse_2.2s_ease-in-out_infinite]'
            } ${filled ? 'scale-110 ring-2 ring-[#16131F] dark:ring-white' : 'hover:scale-105'}`}
            title={isPlayed ? 'Rundă finalizată' : 'Rundă disponibilă'}
          >
            {/* Sparkle glossy highlight */}
            <span
              className="pointer-events-none absolute top-0.5 left-1.5 h-1.5 w-2 rounded-full bg-white/60 blur-[0.3px]"
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
    },
    {
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
    },
    {
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
            aria-label={`${turnCount} dueluri la rândul tău`}
            className="absolute -top-1 -right-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-ron-strong px-1 text-[10px] font-black text-white shadow-sm"
          >
            {turnCount}
          </span>
        ) : null,
    },
    {
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
    },
  ];

  const handleTabClick = (tabKey: 'today' | 'leagues' | 'duels' | 'profile', isActive: boolean) => {
    trackEvent('nav_tab_clicked', { tab: tabKey });
    if (isActive && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (desktopSidebar) {
    return (
      <aside
        aria-label="Navigare principală"
        className="hidden lg:flex fixed left-0 top-14 bottom-0 w-60 z-20 flex-col gap-2 p-4 border-r-2 border-border bg-surface overflow-y-auto"
      >
        <div className="flex flex-col gap-1.5">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.isActive ? 'page' : undefined}
              onClick={() => handleTabClick(tab.key, tab.isActive)}
              className={`relative flex min-h-12 items-center gap-3 rounded-xl border-2 px-3 py-2 text-sm font-bold transition-all ${
                tab.isActive
                  ? 'border-border bg-surface-2 text-ink shadow-[2px_2px_0px_0px_var(--border-color,#16131F)] font-black'
                  : 'border-transparent text-muted hover:border-border-subtle hover:bg-surface-2 hover:text-ink'
              }`}
            >
              <div className="relative shrink-0">{tab.icon(tab.isActive)}</div>
              <span className="truncate">{tab.label}</span>
              {tab.key === 'duels' && turnCount > 0 && (
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ron-strong px-1.5 text-[11px] font-black text-white shadow-sm">
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
      aria-label="Navigare bară jos"
      className="fixed inset-x-0 bottom-0 z-30 lg:hidden border-t-2 border-border bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex h-16 max-w-[480px] items-stretch justify-around px-2">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.isActive ? 'page' : undefined}
            onClick={() => handleTabClick(tab.key, tab.isActive)}
            className={`group relative flex flex-1 min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-lg py-1 transition-colors select-none ${
              tab.isActive ? 'text-ink font-extrabold' : 'text-muted hover:text-ink font-medium'
            }`}
          >
            <div className="relative flex items-center justify-center">
              {tab.icon(tab.isActive)}
              {tab.badge}
            </div>
            <span
              className={`text-[11px] leading-tight transition-transform ${
                tab.isActive ? 'font-black scale-105' : 'font-bold'
              }`}
            >
              {tab.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
