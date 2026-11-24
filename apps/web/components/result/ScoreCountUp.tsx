'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export interface ScoreCountUpProps {
  score: number;
  animated?: boolean;
  onComplete?: () => void;
}

export function ScoreCountUp({ score, animated = false, onComplete }: ScoreCountUpProps) {
  const t = useTranslations();
  const [displayValue, setDisplayValue] = useState(animated ? 0 : score);
  const [hasLanded, setHasLanded] = useState(!animated);

  useEffect(() => {
    if (!animated) {
      setDisplayValue(score);
      setHasLanded(true);
      return;
    }

    let startTime: number | null = null;
    let animId: number;
    const duration = 600;

    const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const current = Math.round(easeOutCubic(progress) * score);
      setDisplayValue(current);

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        setDisplayValue(score);
        setHasLanded(true);
        onComplete?.();
      }
    };

    animId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [score, animated, onComplete]);

  return (
    <div className="relative inline-block">
      {/* Screen reader full announcement from frame 0 */}
      <span className="sr-only">{t('result.srScore', { score: score.toLocaleString() })}</span>

      {/* Visual digits */}
      <span
        aria-hidden="true"
        className={[
          'rd-tabular font-display text-ink inline-block min-w-[3ch] text-6xl font-extrabold transition-transform',
          hasLanded && animated ? 'rd-land' : '',
        ].join(' ')}
      >
        {displayValue.toLocaleString()}
      </span>
    </div>
  );
}
