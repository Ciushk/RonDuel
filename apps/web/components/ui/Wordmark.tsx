import { cn } from '@/lib/cn';

interface WordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  iconSize?: number;
}

const SIZE_MAP = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-5xl',
};

const ICON_SIZE_MAP = {
  sm: 24,
  md: 36,
  lg: 56,
};

export function Wordmark({ className, size = 'md', showIcon = true, iconSize }: WordmarkProps) {
  const iconPx = iconSize ?? ICON_SIZE_MAP[size];

  return (
    <span
      className={cn(
        'font-display group inline-flex select-none items-center gap-2 font-extrabold tracking-tight',
        SIZE_MAP[size],
        className,
      )}
      role="img"
      aria-label="RonDuel"
    >
      {showIcon && (
        <img
          src="/brand/icon-192.png"
          alt=""
          width={iconPx}
          height={iconPx}
          className="shrink-0 rounded-full object-contain shadow-sm transition-transform duration-200 group-hover:scale-105"
        />
      )}
      <span className="inline-flex items-baseline">
        <span className="text-ron-strong dark:text-ron" aria-hidden="true">
          Ron
        </span>
        <span
          aria-hidden="true"
          className="bg-ink mx-0.5 inline-block h-[0.95em] w-[3px] -rotate-[24deg] self-center rounded-full transition-transform duration-200 group-hover:scale-y-110"
        />
        <span className="text-duel-strong dark:text-duel" aria-hidden="true">
          Duel
        </span>
      </span>
    </span>
  );
}
