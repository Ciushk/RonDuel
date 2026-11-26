'use client';

import { X } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import {
  GROUND_TILE_TYPES,
  LAND_PRICES,
  type GridCoord,
  type GroundTileType,
} from '@ronduel/shared';
import { GROUND_LABEL_KEY, GROUND_SPRITES } from './sprites';
import { RonCoinIcon } from './RonCoinIcon';

interface BuyLandSheetProps {
  targetCell: GridCoord | null;
  walletBalance: number;
  purchasing: boolean;
  onConfirm: (x: number, y: number, groundType: GroundTileType) => Promise<void> | void;
  onClose: () => void;
}

export function BuyLandSheet({
  targetCell,
  walletBalance,
  purchasing,
  onConfirm,
  onClose,
}: BuyLandSheetProps) {
  const t = useTranslations();
  const [selectedGround, setSelectedGround] = useState<GroundTileType>('basic-block');
  const [entered, setEntered] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!targetCell) {
      setEntered(false);
      return;
    }
    const raf = window.requestAnimationFrame(() => setEntered(true));
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [targetCell, onClose]);

  if (!targetCell) return null;

  const selectedPrice = LAND_PRICES[selectedGround];
  const canAfford = walletBalance >= selectedPrice;
  const deficit = Math.max(0, selectedPrice - walletBalance);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="buy-land-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`border-border bg-surface w-full max-w-lg rounded-t-3xl border-x-2 border-t-2 p-5 pb-24 shadow-2xl transition-transform duration-[250ms] ease-out motion-reduce:transition-none lg:pb-6 ${
          entered ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b-2 pb-3">
          <div>
            <h2 id="buy-land-sheet-title" className="text-ink font-display text-lg font-black">
              {t('town.land.title')}
            </h2>
            <p className="text-muted text-xs font-semibold">
              {t('town.land.subtitle', { x: targetCell.x, y: targetCell.y })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="border-border bg-surface-2 flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 shadow-[2px_2px_0px_0px_#0E0D15]">
              <RonCoinIcon size={16} />
              <span className="text-ink font-mono text-xs font-black tabular-nums">
                {walletBalance}
              </span>
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              aria-label={t('town.land.close')}
              className="border-border bg-surface-2 text-ink hover:bg-surface focus-visible:outline-3 flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl border-2 shadow-[2px_2px_0px_0px_#0E0D15] focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF]"
            >
              <X size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Single horizontally scrolling row of all 12 buyable ground types */}
        <div
          role="radiogroup"
          aria-label={t('town.land.chooseGround')}
          className="mt-4 flex flex-nowrap gap-3 overflow-x-auto pb-3 pt-1"
        >
          {GROUND_TILE_TYPES.map((groundType) => {
            const spec = GROUND_SPRITES[groundType];
            const price = LAND_PRICES[groundType];
            const affordable = walletBalance >= price;
            const isSelected = selectedGround === groundType;
            const label = t(GROUND_LABEL_KEY[groundType]);

            return (
              <button
                key={groundType}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${label} — ${t('town.shop.priceCoins', { coins: price })}`}
                onClick={() => setSelectedGround(groundType)}
                className={`focus-visible:outline-3 flex min-h-[112px] w-28 shrink-0 cursor-pointer flex-col items-center justify-between rounded-2xl border-2 p-2.5 text-center transition-transform focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF] motion-reduce:transition-none ${
                  isSelected
                    ? 'border-[#0E0D15] bg-[#C6FF3D]/30 shadow-[2px_2px_0px_0px_#0E0D15]'
                    : 'border-border bg-surface-2 hover:bg-surface'
                }`}
              >
                <div className="flex h-14 items-center justify-center">
                  <img
                    src={spec.src}
                    alt=""
                    width={spec.width}
                    height={spec.height}
                    loading="lazy"
                    decoding="async"
                    className="block h-12 w-20 select-none object-contain"
                    draggable={false}
                  />
                </div>
                <span className="text-ink line-clamp-2 text-[11px] font-black leading-tight">
                  {label}
                </span>
                <span
                  className={`mt-1 inline-flex items-center gap-1 font-mono text-[11px] font-black tabular-nums ${
                    affordable ? 'text-ink' : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  <RonCoinIcon size={14} />
                  {price}
                </span>
              </button>
            );
          })}
        </div>

        {/* Affordability notice (text, not colour alone) */}
        {!canAfford && (
          <p
            role="status"
            className="mt-2 rounded-xl border-2 border-[#FF5A4E] bg-[#FF5A4E]/15 px-3 py-2 text-xs font-bold text-[#0E0D15] dark:text-[#FFF7EC]"
          >
            {t('town.land.shortCoins', { needed: deficit, price: selectedPrice })}
          </p>
        )}

        {/* Confirm Purchase Button */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={!canAfford || purchasing}
            onClick={() => void onConfirm(targetCell.x, targetCell.y, selectedGround)}
            className={`focus-visible:outline-3 flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-[#0E0D15] px-4 py-2.5 text-sm font-black transition-transform focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF] motion-reduce:transition-none ${
              !canAfford || purchasing
                ? 'bg-surface-2 text-muted cursor-not-allowed opacity-60'
                : 'cursor-pointer bg-[#C6FF3D] text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15] active:translate-y-0.5'
            }`}
          >
            <RonCoinIcon size={18} />
            <span>
              {purchasing
                ? t('town.land.buying')
                : t('town.land.buyButton', {
                    label: t(GROUND_LABEL_KEY[selectedGround]),
                    price: selectedPrice,
                  })}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
