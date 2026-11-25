'use client';

import { Trophy } from '@phosphor-icons/react';
import { sanitizeDisplayName } from '@ronduel/shared';
import { useTranslations } from 'next-intl';
import React, { useEffect, useRef, useState } from 'react';

import { Avatar, Button, Chip } from '@/components/ui';
import { useBottomStack } from '@/lib/bottom-stack';

export interface PodiumStyle {
  isPodium: boolean;
  cupColor: string;
  badgeBg: string;
  cardStyle: string;
}

export function getPodiumStyle(rank: number, isCurrentUser = false): PodiumStyle {
  if (rank === 1) {
    return {
      isPodium: true,
      cupColor: 'text-amber-500',
      badgeBg:
        'bg-gradient-to-r from-amber-400 to-yellow-300 text-black border-2 border-amber-500 shadow-sm',
      cardStyle:
        'border-2 border-amber-400 bg-gradient-to-r from-amber-500/[0.12] via-yellow-400/[0.08] to-amber-500/[0.12] shadow-[2px_2px_0px_0px_rgba(245,158,11,0.85)] dark:border-amber-400 dark:bg-amber-950/25',
    };
  }
  if (rank === 2) {
    return {
      isPodium: true,
      cupColor: 'text-slate-400',
      badgeBg:
        'bg-gradient-to-r from-slate-200 to-slate-300 text-slate-800 border-2 border-slate-400 shadow-sm',
      cardStyle:
        'border-2 border-slate-300 bg-gradient-to-r from-slate-300/[0.12] via-slate-200/[0.08] to-slate-300/[0.12] shadow-[2px_2px_0px_0px_rgba(148,163,184,0.75)] dark:border-slate-400 dark:bg-slate-900/30',
    };
  }
  if (rank === 3) {
    return {
      isPodium: true,
      cupColor: 'text-amber-700',
      badgeBg:
        'bg-gradient-to-r from-amber-700 to-amber-600 text-amber-50 border-2 border-amber-700 shadow-sm',
      cardStyle:
        'border-2 border-amber-700/60 bg-gradient-to-r from-amber-700/[0.12] via-amber-600/[0.08] to-amber-700/[0.12] shadow-[2px_2px_0px_0px_rgba(180,83,9,0.75)] dark:border-amber-700 dark:bg-amber-950/20',
    };
  }
  if (isCurrentUser) {
    return {
      isPodium: false,
      cupColor: '',
      badgeBg: 'bg-volt text-ink border-2 border-border font-black',
      cardStyle:
        'border-2 border-border bg-volt/10 text-ink shadow-[2px_2px_0px_0px_var(--border-color,#16131F)] ring-2 ring-volt-strong/70',
    };
  }
  return {
    isPodium: false,
    cupColor: '',
    badgeBg: 'bg-surface-2 text-ink border-2 border-border font-black',
    cardStyle:
      'border-2 border-border bg-surface text-ink hover:border-border-subtle active:translate-x-[2px] active:translate-y-[2px] shadow-[var(--rd-shadow-key)]',
  };
}

export function RankBadge({ rank }: { rank: number }) {
  const podium = getPodiumStyle(rank);
  if (rank === 1) {
    return (
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${podium.badgeBg}`}
      >
        <Trophy size={20} weight="fill" className="text-amber-600 drop-shadow-sm" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${podium.badgeBg}`}
      >
        <Trophy size={19} weight="fill" className="text-slate-600 drop-shadow-sm" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${podium.badgeBg}`}
      >
        <Trophy size={18} weight="fill" className="text-amber-900 drop-shadow-sm" />
      </div>
    );
  }
  return (
    <div className="border-border bg-surface-2 text-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 text-xs font-black shadow-sm">
      #{rank}
    </div>
  );
}

interface StickyUserRankProps {
  myRank?: number | null;
  myScore?: number | null;
  myNickname?: string;
  myUid?: string;
  label?: string;
}

export function StickyUserRank({ myRank, myScore, myNickname, myUid, label }: StickyUserRankProps) {
  const t = useTranslations();
  const rankLabel = label ?? t('common.yourRank');
  const [isInViewport, setIsInViewport] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const isCardVisible = Boolean(myRank || myScore != null) && !isInViewport;
  useBottomStack('sticky-user-rank', barRef, isCardVisible);

  useEffect(() => {
    if (!myUid || typeof window === 'undefined') return;
    let observer: IntersectionObserver | null = null;

    const findAndObserve = () => {
      const target = document.getElementById(`rank-row-${myUid}`);
      if (!target) {
        setIsInViewport(false);
        return;
      }
      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          setIsInViewport(Boolean(entry?.isIntersecting));
        },
        { threshold: 0.1 },
      );
      observer.observe(target);
    };

    findAndObserve();
    const timer1 = setTimeout(findAndObserve, 200);
    const timer2 = setTimeout(findAndObserve, 800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      observer?.disconnect();
    };
  }, [myUid, myRank, myScore]);

  if (!isCardVisible) return null;

  const handleScrollToMe = () => {
    if (!myUid || typeof window === 'undefined') return;
    const target = document.getElementById(`rank-row-${myUid}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('ring-4', 'ring-volt-strong', 'scale-[1.02]');
      setTimeout(() => {
        target.classList.remove('ring-4', 'ring-volt-strong', 'scale-[1.02]');
      }, 2000);
    }
  };

  const displayName = sanitizeDisplayName(myNickname, myUid);

  return (
    <aside
      ref={barRef}
      aria-label={t('a11y.yourPosition')}
      className="pointer-events-none fixed bottom-20 left-0 right-0 z-30 px-4 sm:bottom-6"
    >
      <div className="pointer-events-auto mx-auto max-w-[480px]">
        <div
          role="button"
          tabIndex={0}
          onClick={handleScrollToMe}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleScrollToMe();
            }
          }}
          className={`border-border bg-surface text-ink flex cursor-pointer select-none items-center justify-between gap-3 rounded-2xl border-2 p-3 shadow-[0_6px_20px_rgba(0,0,0,0.18),var(--rd-shadow-key)] transition-all hover:scale-[1.01] active:scale-[0.99] ${
            isInViewport
              ? 'from-surface via-surface-2 to-surface border-border bg-gradient-to-r'
              : 'from-volt/25 via-surface to-surface border-volt-strong ring-volt-strong/50 bg-gradient-to-r ring-2'
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="border-border bg-volt flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 text-sm font-black text-[#16131F] shadow-sm">
              #{myRank ?? '—'}
            </div>
            <Avatar nickname={displayName} size="sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-extrabold">{displayName}</span>
                <Chip tone="volt" className="px-1 py-0 text-[10px] font-black">
                  {t('common.you')}
                </Chip>
              </div>
              <p className="text-muted truncate text-xs font-bold">
                {rankLabel} <span className="text-ink">#{myRank ?? '—'}</span>
                {myScore != null && (
                  <span className="rd-tabular text-ron-strong ml-1.5 font-extrabold">
                    · {t('common.points', { points: myScore.toLocaleString() })}
                  </span>
                )}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant={isInViewport ? 'secondary' : 'volt'}
            className="h-8 shrink-0 px-2.5 text-xs font-black shadow-sm"
          >
            {isInViewport ? t('common.youAreHere') : t('common.jumpToMyRank')}
          </Button>
        </div>
      </div>
    </aside>
  );
}
