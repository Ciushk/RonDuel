'use client';

import { Lightning, X } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import {
  calculateSpeedupCost,
  isRonCoinPriceCutActive,
  PREVIOUS_RONCOIN_PRICES,
  type TownCatalogDoc,
} from '@ronduel/shared';
import { formatDurationShort, getCropGrowthInfo } from './iso';
import { RonCoinIcon } from './RonCoinIcon';
import type { TileInfo } from './useTownState';

interface SpeedupConfirmSheetProps {
  tile: TileInfo;
  catalog: TownCatalogDoc;
  walletBalance: number;
  loading: boolean;
  onConfirm: (x: number, y: number, expectedCost: number) => void;
  onClose: () => void;
}

export function SpeedupConfirmSheet({
  tile,
  catalog,
  walletBalance,
  loading,
  onConfirm,
  onClose,
}: SpeedupConfirmSheetProps) {
  const t = useTranslations();
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cropId = tile.cropId ?? 'wheat';
  const cropMeta = catalog.items[cropId];
  const growth = getCropGrowthInfo({
    plantedAt: tile.plantedAt,
    readyAt: tile.readyAt,
    growTimeSeconds: cropMeta?.growTimeSeconds,
    nowMs,
  });

  useEffect(() => {
    if (growth.isReady) {
      onClose();
    }
  }, [growth.isReady, onClose]);

  const cost = calculateSpeedupCost(growth.remainingSeconds, cropId);
  const prevCost = PREVIOUS_RONCOIN_PRICES.speedupTiers[cropId] ?? 0;
  const hasPriceCut = isRonCoinPriceCutActive(nowMs) && cost > 0 && prevCost > cost;
  const canAfford = walletBalance >= cost;
  const cropName = t(`town.crops.${cropId}.name`);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0E0D15]/60 p-3 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="speedup-sheet-title"
        data-testid="speedup-confirm-sheet"
        className="w-full max-w-sm rounded-2xl border-2 border-[#0E0D15] bg-[#FFF7EC] p-4 text-[#0E0D15] shadow-[4px_4px_0px_0px_#0E0D15]"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#0E0D15] bg-[#C6FF3D] shadow-[2px_2px_0px_0px_#0E0D15]">
              <Lightning size={22} weight="fill" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="speedup-sheet-title"
                className="font-display text-base font-black leading-tight"
              >
                {t('town.speedup.title')}
              </h2>
              <p className="text-xs font-semibold text-[#5B5668]">
                {t('town.speedup.subtitle', {
                  crop: cropName,
                  time: formatDurationShort(growth.remainingSeconds),
                })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('town.map.cancel')}
            className="focus-visible:outline-3 flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl border-2 border-[#0E0D15] bg-[#FFF7EC] text-[#0E0D15] focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF]"
          >
            <X size={18} weight="bold" aria-hidden="true" />
          </button>
        </div>

        <div
          aria-label={
            hasPriceCut ? t('town.shop.priceCutWasNow', { old: prevCost, new: cost }) : undefined
          }
          className="mt-3 flex items-center justify-between gap-2 rounded-xl border-2 border-[#0E0D15] bg-white px-3 py-2.5 text-sm font-black"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-[#5B5668]">{t('town.speedup.costLabel')}</span>
            {hasPriceCut && (
              <span
                data-testid="price-cut-badge"
                className="rt-price-cut-badge rounded border-2 border-[#0E0D15] bg-[#C6FF3D] px-1.5 py-0.5 text-[9px] font-black leading-none text-[#0E0D15] shadow-[1px_1px_0px_0px_#0E0D15]"
              >
                {t('town.shop.priceCutBadge')}
              </span>
            )}
          </div>
          <span className="flex items-center gap-1.5 font-mono text-base tabular-nums">
            <RonCoinIcon size={20} />
            {hasPriceCut && (
              <span className="text-xs tabular-nums text-[#0E0D15]/60 line-through">
                {prevCost}
              </span>
            )}
            <span data-testid="speedup-confirm-cost">{cost}</span>
          </span>
        </div>

        <p className="mt-2 text-xs font-semibold text-[#5B5668]">
          {canAfford
            ? t('town.speedup.balanceAfter', { balance: Math.max(0, walletBalance - cost) })
            : t('town.speedup.insufficient', { needed: cost, balance: walletBalance })}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="focus-visible:outline-3 min-h-[44px] flex-1 cursor-pointer rounded-xl border-2 border-[#0E0D15] bg-white px-3 text-sm font-black text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15] focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF]"
          >
            {t('town.map.cancel')}
          </button>
          <button
            type="button"
            data-testid="speedup-confirm-btn"
            disabled={!canAfford || loading || cost <= 0}
            onClick={() => onConfirm(tile.x, tile.y, cost)}
            className="focus-visible:outline-3 flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-[#0E0D15] bg-[#C6FF3D] px-3 text-sm font-black text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15] focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Lightning size={16} weight="fill" aria-hidden="true" />
            <span>{t('town.speedup.confirm', { cost })}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
