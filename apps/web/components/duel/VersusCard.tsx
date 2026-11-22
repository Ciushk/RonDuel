'use client';

import { CheckCircle, Clock, Flame, Play, Sword, Trophy } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import React, { useEffect, useState } from 'react';

import { Avatar, Button, Chip } from '@/components/ui';
import { vibrate } from '@/lib/session';

export interface PlayerSide {
  uid: string;
  nickname: string;
  score?: number;
  finishedAt?: string;
  streak?: number;
}

export interface VersusCardProps {
  duelId: string;
  challenger: PlayerSide;
  opponent?: PlayerSide;
  myUid: string;
  winnerUid?: string | null;
  status: 'pending' | 'active' | 'complete' | 'expired';
  onPlay?: () => void;
  canPlayMyTurn?: boolean;
  headToHead?: { meWins: number; opponentWins: number } | null;
}

export function VersusCard({
  duelId,
  challenger,
  opponent,
  myUid,
  winnerUid,
  status,
  onPlay,
  canPlayMyTurn,
  headToHead,
}: VersusCardProps) {
  const t = useTranslations();
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storageKey = `rd-vs-seen-${duelId}`;
    const alreadySeen = sessionStorage.getItem(storageKey);
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!alreadySeen && !prefersReduced) {
      setAnimating(true);
      const clashTimer = setTimeout(() => {
        vibrate(15);
      }, 320);

      const endTimer = setTimeout(() => {
        setAnimating(false);
        sessionStorage.setItem(storageKey, '1');
      }, 620);

      return () => {
        clearTimeout(clashTimer);
        clearTimeout(endTimer);
      };
    }
  }, [duelId]);

  const handleSkip = () => {
    if (!animating) return;
    setAnimating(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(`rd-vs-seen-${duelId}`, '1');
    }
  };

  // Determine who is on the left half ("You" prioritized on left, in Ron Red)
  const isOpponentMe = Boolean(opponent?.uid && myUid && opponent.uid === myUid);
  const leftPlayer = isOpponentMe ? opponent! : challenger;
  const rightPlayer = isOpponentMe ? challenger : opponent;

  const isLeftMe = Boolean(leftPlayer.uid && myUid && leftPlayer.uid === myUid);
  const isRightMe = Boolean(rightPlayer?.uid && myUid && rightPlayer.uid === myUid);

  const isLeftWinner = Boolean(winnerUid && leftPlayer.uid === winnerUid);
  const isRightWinner = Boolean(winnerUid && rightPlayer?.uid === winnerUid);
  const isDuelComplete = status === 'complete';

  return (
    <div className="flex flex-col gap-3">
      {/* Versus Arena Card */}
      <div
        role="region"
        aria-label={t('duel.title')}
        onClick={handleSkip}
        className={[
          'relative h-[290px] w-full overflow-hidden rounded-[20px] border-2 border-border bg-surface rd-sticker select-none',
          animating ? 'cursor-pointer' : '',
        ].join(' ')}
      >
        {/* Left Half (Ron Red #FF5A4E) */}
        <div
          style={{ clipPath: 'polygon(0 0, 62% 0, 38% 100%, 0 100%)' }}
          className={[
            'absolute inset-y-0 left-0 w-full bg-[#FF5A4E] p-5 pr-20 flex flex-col justify-between items-start text-left transition-all duration-300',
            animating ? 'rd-vs-left' : '',
            isDuelComplete && isLeftWinner ? 'shadow-[inset_0_0_28px_rgba(198,255,61,0.7)]' : '',
            isDuelComplete && !isLeftWinner && winnerUid ? 'opacity-85 contrast-90' : '',
          ].join(' ')}
        >
          {/* Top meta: Avatar & Sub-line */}
          <div className="flex flex-col gap-2 items-start">
            <div className="relative">
              <Avatar
                nickname={leftPlayer.nickname}
                className="h-16 w-16 text-2xl border-2 border-[#16131F] shadow-[0_3px_0_#16131F]"
              />
              {isDuelComplete && isLeftWinner && (
                <span className="absolute -bottom-2 -right-2 inline-flex items-center gap-0.5 rounded-full border-2 border-[#16131F] bg-volt px-2 py-0.5 text-[11px] font-black text-[#16131F] shadow-[0_2px_0_#16131F]">
                  🏆
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-white">
              {isLeftMe && (
                <span className="rounded bg-[#16131F]/30 px-1 py-0.5 text-[10px] text-volt">
                  {t('duel.youLabel')}
                </span>
              )}
              <span className="inline-flex items-center gap-0.5">
                <Flame size={14} weight="fill" className="text-volt" aria-hidden="true" />
                {leftPlayer.streak ?? 0}
              </span>
            </div>
          </div>

          {/* Bottom info: Nickname & Score */}
          <div className="space-y-0.5">
            <p
              title={leftPlayer.nickname}
              className="font-display max-w-[140px] truncate text-[22px] font-extrabold leading-tight text-white drop-shadow-sm"
            >
              {leftPlayer.nickname}
            </p>
            <p className="font-mono text-2xl font-black text-white rd-tabular">
              {leftPlayer.finishedAt ? t('common.points', { points: leftPlayer.score ?? 0 }) : '—'}
            </p>
          </div>
        </div>

        {/* Right Half (Duel Blue #3D7BFF) */}
        <div
          style={{ clipPath: 'polygon(62% 0, 100% 0, 100% 100%, 38% 100%)' }}
          className={[
            'absolute inset-y-0 right-0 w-full bg-[#3D7BFF] p-5 pl-20 flex flex-col justify-between items-end text-right transition-all duration-300',
            animating ? 'rd-vs-right' : '',
            isDuelComplete && isRightWinner ? 'shadow-[inset_0_0_28px_rgba(198,255,61,0.7)]' : '',
            isDuelComplete && !isRightWinner && winnerUid ? 'opacity-85 contrast-90' : '',
          ].join(' ')}
        >
          {/* Top meta: Avatar & Sub-line */}
          <div className="flex flex-col gap-2 items-end">
            <div className="relative">
              <Avatar
                nickname={rightPlayer?.nickname ?? 'VS'}
                className="h-16 w-16 text-2xl border-2 border-[#16131F] shadow-[0_3px_0_#16131F]"
              />
              {isDuelComplete && isRightWinner && (
                <span className="absolute -bottom-2 -left-2 inline-flex items-center gap-0.5 rounded-full border-2 border-[#16131F] bg-volt px-2 py-0.5 text-[11px] font-black text-[#16131F] shadow-[0_2px_0_#16131F]">
                  🏆
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-wider text-white">
              {isRightMe && (
                <span className="rounded bg-[#16131F]/30 px-1 py-0.5 text-[10px] text-volt">
                  {t('duel.youLabel')}
                </span>
              )}
              {rightPlayer ? (
                <span className="inline-flex items-center gap-0.5">
                  <Flame size={14} weight="fill" className="text-volt" aria-hidden="true" />
                  {rightPlayer.streak ?? 0}
                </span>
              ) : (
                <span className="text-white/80">{t('duel.openOpponent')}</span>
              )}
            </div>
          </div>

          {/* Bottom info: Nickname & Score */}
          <div className="space-y-0.5 text-right">
            <p
              title={rightPlayer?.nickname ?? t('duel.openOpponent')}
              className="font-display max-w-[140px] truncate text-[22px] font-extrabold leading-tight text-white drop-shadow-sm"
            >
              {rightPlayer?.nickname ?? t('duel.openOpponent')}
            </p>
            <p className="font-mono text-2xl font-black text-white rd-tabular">
              {rightPlayer?.finishedAt ? t('common.points', { points: rightPlayer.score ?? 0 }) : '—'}
            </p>
          </div>
        </div>

        {/* Diagonal Ink Seam Line (6px centered at ~14deg) */}
        <div
          aria-hidden="true"
          className={[
            'pointer-events-none absolute left-1/2 top-1/2 h-[160%] w-[6px] -translate-x-1/2 -translate-y-1/2 rotate-[14deg] bg-[#16131F]',
            animating ? 'rd-vs-seam' : '',
          ].join(' ')}
        />

        {/* Center 76px Volt "VS" Stamp & Spark Rays */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
        >
          {/* Spark rays container */}
          {animating && (
            <div className="absolute inset-0 flex items-center justify-center">
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <span
                  key={deg}
                  className="rd-vs-spark absolute h-3.5 w-1.5 rounded-full border border-border bg-volt"
                  style={{ '--r': `${deg}deg` } as React.CSSProperties}
                />
              ))}
            </div>
          )}

          {/* Clash wrapper */}
          <div className={animating ? 'rd-vs-clash' : ''}>
            <div
              className={[
                'flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3px] border-border bg-volt font-display text-[28px] font-black text-[#16131F] shadow-[0_4px_0_var(--rd-border)]',
                animating ? 'rd-vs-stamp' : '',
              ].join(' ')}
            >
              VS
            </div>
          </div>
        </div>
      </div>

      {/* Status Card Below */}
      <div
        className={[
          'rounded-[16px] border-2 border-border bg-surface p-4 text-center rd-sticker space-y-3',
          animating ? 'rd-vs-status' : '',
        ].join(' ')}
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          {status === 'complete' ? (
            <Chip tone="gold">
              <Trophy size={14} weight="fill" aria-hidden="true" />
              {winnerUid
                ? t('duel.winnerBanner', {
                    name:
                      winnerUid === challenger.uid
                        ? challenger.nickname
                        : opponent?.nickname ?? t('duel.winnerBadge'),
                  })
                : t('duel.drawTitle')}
            </Chip>
          ) : status === 'expired' ? (
            <Chip tone="neutral">
              <Clock size={14} weight="bold" aria-hidden="true" />
              {t('duel.walkoverNote')}
            </Chip>
          ) : (
            <Chip tone="volt">
              <Clock size={14} weight="bold" aria-hidden="true" />
              {t('duel.waitingOpponent')}
            </Chip>
          )}

          {headToHead && (
            <span className="font-mono text-xs font-bold text-muted">
              {t('duel.headToHead')}: {headToHead.meWins} – {headToHead.opponentWins}
            </span>
          )}
        </div>

        {canPlayMyTurn && onPlay && (
          <Button fullWidth size="lg" variant="primary" onClick={onPlay}>
            <Play size={20} weight="fill" aria-hidden="true" />
            {t('duel.yourTurn')}
          </Button>
        )}
      </div>
    </div>
  );
}
