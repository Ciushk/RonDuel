'use client';

import { ArrowCounterClockwise, Crown, Snowflake, WarningCircle } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';

import { Button, Card, Chip, Sheet } from '@/components/ui';

interface MissedDayCardProps {
  uid: string;
  tz: string;
  streakCurrent: number;
  missedDays: number;
  freezes: number;
  canCoverMiss: boolean;
  weeklyShieldAvailable: boolean;
  isPro: boolean;
  onActionSuccess: (message?: string) => void;
  onActionError: (message: string) => void;
  onOpenFreezeSheet: () => void;
}

export function MissedDayCard({
  uid,
  tz,
  streakCurrent,
  missedDays,
  freezes,
  canCoverMiss,
  weeklyShieldAvailable,
  isPro,
  onActionSuccess,
  onActionError,
  onOpenFreezeSheet,
}: MissedDayCardProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [busy, setBusy] = useState<'freeze' | 'reset' | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  if (missedDays <= 0 || streakCurrent <= 0) {
    return null;
  }

  const isCaseA = missedDays === 1 && canCoverMiss;
  const isCaseB = missedDays === 1 && !canCoverMiss;
  const isCaseC = missedDays >= 2;
  const availableUnits = Math.max(0, freezes) + (weeklyShieldAvailable ? 1 : 0);

  const handleUseFreeze = async () => {
    if (busy) return;
    setBusy('freeze');
    try {
      const res = await fetch('/api/game/use-freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, tz }),
      });
      if (res.ok) {
        onActionSuccess(t('home.freezeAutoUsed', { days: streakCurrent }));
      } else {
        onActionError(t('common.networkError'));
      }
    } catch {
      onActionError(t('common.networkError'));
    } finally {
      setBusy(null);
    }
  };

  const handleConfirmReset = async () => {
    if (busy) return;
    setBusy('reset');
    try {
      const res = await fetch('/api/game/reset-streak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      });
      if (res.ok) {
        setConfirmResetOpen(false);
        onActionSuccess();
      } else {
        onActionError(t('common.networkError'));
      }
    } catch {
      onActionError(t('common.networkError'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Card
        variant="sticker"
        data-testid="missed-day-card"
        data-missed-case={isCaseA ? 'A' : isCaseB ? 'B' : 'C'}
        className="border-ron-strong bg-surface space-y-3 border-2 p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <Chip tone="red" className="gap-1 px-2.5 py-0.5 text-[11px] font-black uppercase">
            <WarningCircle size={14} weight="fill" aria-hidden="true" />
            <span>{t('home.missedKicker')}</span>
          </Chip>
          {isCaseA && (
            <span className="text-muted text-[11px] font-bold">{t('home.freezeCoversOne')}</span>
          )}
        </div>

        <div className="space-y-1">
          <h2 className="font-display text-ink text-lg font-extrabold leading-tight">
            {t('home.missedTitle', { missed: missedDays })}
          </h2>
          <p className="text-muted text-xs font-medium leading-relaxed">
            {isCaseA
              ? t('home.missedBody', { days: streakCurrent })
              : isCaseB
                ? t('home.missedBodyNone', { days: streakCurrent })
                : t('home.missedBodyTooMany', { days: streakCurrent })}
          </p>
        </div>

        <div className="space-y-2 pt-0.5">
          {isCaseA && (
            <>
              <Button
                fullWidth
                size="md"
                variant="blue"
                disabled={busy !== null}
                onClick={() => void handleUseFreeze()}
                data-testid="missed-use-freeze-btn"
              >
                <Snowflake size={18} weight="bold" aria-hidden="true" />
                {t('home.useFreeze', { count: Math.max(1, availableUnits) })}
              </Button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => setConfirmResetOpen(true)}
                data-testid="missed-reset-btn"
                className="text-muted hover:text-ink block w-full py-1 text-center text-xs font-bold underline-offset-2 hover:underline"
              >
                {t('home.resetStreak')}
              </button>
            </>
          )}

          {isCaseB && (
            <>
              <Button
                fullWidth
                size="md"
                variant="volt"
                disabled={busy !== null}
                onClick={onOpenFreezeSheet}
                data-testid="missed-buy-freeze-btn"
              >
                <Snowflake size={18} weight="bold" aria-hidden="true" />
                {t('home.buyFreeze')}
              </Button>
              {!isPro && (
                <Link href={`/${locale}/pro`} className="block" data-testid="missed-go-pro-btn">
                  <Button fullWidth size="sm" variant="primary">
                    <Crown size={16} weight="fill" aria-hidden="true" />
                    {t('home.goProForFreeze')}
                  </Button>
                </Link>
              )}
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => setConfirmResetOpen(true)}
                data-testid="missed-reset-btn"
                className="text-muted hover:text-ink block w-full py-1 text-center text-xs font-bold underline-offset-2 hover:underline"
              >
                {t('home.resetStreak')}
              </button>
            </>
          )}

          {isCaseC && (
            <>
              <Button
                fullWidth
                size="md"
                variant="primary"
                disabled={busy !== null}
                onClick={() => setConfirmResetOpen(true)}
                data-testid="missed-reset-btn"
              >
                <ArrowCounterClockwise size={18} weight="bold" aria-hidden="true" />
                {t('home.resetStreak')}
              </Button>
              {!isPro && (
                <Link
                  href={`/${locale}/pro`}
                  data-testid="missed-go-pro-btn"
                  className="text-duel-strong block py-1 text-center text-xs font-bold hover:underline"
                >
                  {t('home.goProForFreeze')}
                </Link>
              )}
            </>
          )}
        </div>
      </Card>

      <Sheet
        open={confirmResetOpen}
        onClose={() => {
          if (busy !== 'reset') setConfirmResetOpen(false);
        }}
        title={t('home.resetStreak')}
      >
        <div className="space-y-4">
          <p className="text-ink text-sm font-medium leading-relaxed">
            {t('home.resetStreakConfirm')}
          </p>
          <div className="flex gap-2">
            <Button
              fullWidth
              size="md"
              variant="ghost"
              disabled={busy === 'reset'}
              onClick={() => setConfirmResetOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              fullWidth
              size="md"
              variant="primary"
              disabled={busy === 'reset'}
              onClick={() => void handleConfirmReset()}
              data-testid="missed-reset-confirm-btn"
            >
              {t('home.resetStreak')}
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
