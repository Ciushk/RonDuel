'use client';

import { useTranslations } from 'next-intl';

import { ResultTile, tileKindFromEmoji } from './ResultTile';

export interface EmojiTilesProps {
  /** Stored result line made of ⚡ 🟩 🟥; it is only parsed here, never rendered as text. */
  emojiLine: string;
  animated?: boolean;
}

export function EmojiTiles({ emojiLine, animated = false }: EmojiTilesProps) {
  const t = useTranslations();

  const tiles = Array.from(emojiLine || '').filter((e) => e === '⚡' || e === '🟩' || e === '🟥');
  const correctCount = tiles.filter((e) => e !== '🟥').length;
  const totalCount = tiles.length;

  return (
    <div
      role="img"
      aria-label={t('result.tilesLabel', { correct: correctCount, total: totalCount })}
      className="flex flex-wrap items-center justify-center gap-2 py-1"
    >
      {tiles.map((emoji, idx) => (
        <ResultTile
          key={idx}
          kind={tileKindFromEmoji(emoji)}
          className={animated ? 'rd-tile-pop' : undefined}
          style={animated ? { animationDelay: `${idx * 80}ms` } : undefined}
        />
      ))}
    </div>
  );
}
