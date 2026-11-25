'use client';

interface RonCoinIconProps {
  size?: number;
  className?: string;
}

/**
 * Placeholder CSS gold RonCoin with a bold "R".
 * TODO(art): Swap to <img src="/rontown/icon-roncoin.png" ... /> when icon-roncoin.png is added.
 */
export function RonCoinIcon({ size = 20, className = '' }: RonCoinIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`inline-block shrink-0 select-none drop-shadow-[1px_1px_0px_#0E0D15] ${className}`}
    >
      <circle cx="12" cy="12" r="10.5" fill="#FFC53D" stroke="#0E0D15" strokeWidth="2.5" />
      <circle cx="12" cy="12" r="7.5" fill="#FFE066" opacity="0.55" />
      <path
        d="M8.5 17V7H13.2C14.9 7 16 7.95 16 9.6C16 10.9 15.25 11.75 14.1 12.1L16.3 17H13.75L11.85 12.45H10.85V17H8.5ZM10.85 10.6H12.85C13.45 10.6 13.75 10.25 13.75 9.65C13.75 9.05 13.45 8.75 12.85 8.75H10.85V10.6Z"
        fill="#0E0D15"
      />
    </svg>
  );
}
