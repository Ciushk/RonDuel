'use client';

import { uiSpriteUrl } from './sprites';

export type RonCoinSourceSize = 16 | 24 | 32 | 64 | 128;

export interface RonCoinIconProps {
  /** Requested CSS pixel size. First-class sizes: 16, 24, 32, 64 (other numbers snap up cleanly). */
  size?: 16 | 24 | 32 | 64 | number;
  /** Single official R-stamped coin (default) or 3-coin stack for large packs / reward piles. */
  variant?: 'single' | 'stack';
  /** Set true ONLY when rendered standalone with no adjacent "RonCoins" text and no parent aria-label. */
  standalone?: boolean;
  className?: string;
}

/**
 * Picks the nearest 1x source at or above the requested CSS size and its matching 2x file.
 * Pairs: 16->16/32, 24->24/48, 32->32/64, 64->64/128, 128->128/256.
 * For `stack`, minimum source size is 24 (roncoin-stack-16 is avoided for legibility).
 */
export function getRonCoinSources(
  size: number,
  variant: 'single' | 'stack' = 'single',
  buildId?: string,
): { src: string; srcSet: string; base: RonCoinSourceSize; retina: number } {
  let base: RonCoinSourceSize;
  if (size <= 16 && variant !== 'stack') {
    base = 16;
  } else if (size <= 24) {
    base = 24;
  } else if (size <= 32) {
    base = 32;
  } else if (size <= 64) {
    base = 64;
  } else {
    base = 128;
  }

  const retina = base * 2;
  const stem = variant === 'stack' ? 'roncoin-stack-' : 'roncoin-';
  const src = uiSpriteUrl(`${stem}${base}.png`, buildId);
  const src2x = uiSpriteUrl(`${stem}${retina}.png`, buildId);
  const srcSet = `${src} 1x, ${src2x} 2x`;
  return { src, srcSet, base, retina };
}

/**
 * Official RonCoin glyph (gold coin with embossed "R" and volt-green sparkle).
 */
export function RonCoinIcon({
  size = 20,
  variant = 'single',
  standalone = false,
  className = '',
}: RonCoinIconProps) {
  const { src, srcSet } = getRonCoinSources(size, variant);

  return (
    <img
      src={src}
      srcSet={srcSet}
      width={size}
      height={size}
      alt=""
      role={standalone ? 'img' : undefined}
      aria-label={standalone ? 'RonCoins' : undefined}
      aria-hidden={standalone ? undefined : true}
      decoding="async"
      draggable={false}
      style={{ imageRendering: 'auto' }}
      className={`inline-block shrink-0 select-none object-contain ${className}`}
    />
  );
}

/** Convenience wrapper for large coin piles / store packs (always uses 24px+ stack assets). */
export function RonCoinStack({
  size = 24,
  standalone = false,
  className = '',
}: Omit<RonCoinIconProps, 'variant'>) {
  return <RonCoinIcon size={size} variant="stack" standalone={standalone} className={className} />;
}
