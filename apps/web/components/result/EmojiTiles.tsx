'use client';

import { useTranslations } from 'next-intl';

export interface EmojiTilesProps {
  emojiLine: string;
  animated?: boolean;
}

export function EmojiTiles({ emojiLine, animated = false }: EmojiTilesProps) {
  const t = useTranslations();

  // Split into emojis preserving unicode glyphs
  const tiles = Array.from(emojiLine || '');
  const correctCount = tiles.filter((e) => e === '🟩' || e === '⚡').length;
  const totalCount = tiles.length;

  return (
    <div
      role="img"
      aria-label={t('result.tilesLabel', { correct: correctCount, total: totalCount })}
      className="flex flex-wrap items-center justify-center gap-2 py-1"
    >
      {tiles.map((emoji, idx) => {
        const isLightning = emoji === '⚡';
        const isGreen = emoji === '🟩';
        const isRed = emoji === '🟥';

        return (
          <div
            key={idx}
            style={
              animated ? ({ animationDelay: `${idx * 80}ms` } as React.CSSProperties) : undefined
            }
            className={[
              'border-border rd-sticker relative flex h-[42px] w-[42px] select-none items-center justify-center rounded-[10px] border-2 text-xl font-bold',
              isGreen
                ? 'bg-correct text-[#16131F]'
                : isLightning
                  ? 'bg-volt text-[#16131F]'
                  : isRed
                    ? 'bg-wrong text-[var(--rd-on-wrong)]'
                    : 'bg-surface text-ink',
              animated ? 'rd-tile-pop' : '',
            ].join(' ')}
          >
            {emoji}
          </div>
        );
      })}
    </div>
  );
}
