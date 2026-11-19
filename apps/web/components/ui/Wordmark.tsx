import { cn } from '@/lib/cn';

interface WordmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: 'text-xl',
  md: 'text-3xl',
  lg: 'text-5xl',
};

export function Wordmark({ className, size = 'md' }: WordmarkProps) {
  return (
    <span
      className={cn(
        'font-display group inline-flex select-none items-baseline font-extrabold tracking-tight',
        SIZE_MAP[size],
        className,
      )}
      role="img"
      aria-label="RonDuel"
    >
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
  );
}
