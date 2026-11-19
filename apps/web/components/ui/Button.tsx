import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'blue' | 'volt' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Ink (#16131F) on Ron Red (#FF5A4E) = 6.0:1 contrast
  primary: 'bg-ron text-[#16131F] rd-sticker rd-sticker-pressable',
  // White on Duel Blue Strong in light mode, Ink on #6F98FF in dark mode
  blue: 'bg-duel-strong text-[var(--rd-on-blue)] rd-sticker rd-sticker-pressable',
  // Ink (#16131F) on Volt (#C6FF3D) = 15.5:1 contrast
  volt: 'bg-volt text-[#16131F] rd-sticker rd-sticker-pressable',
  secondary: 'bg-surface text-ink rd-sticker rd-sticker-pressable',
  ghost: 'bg-transparent text-ink hover:bg-surface-2',
  danger: 'bg-wrong text-[var(--rd-on-wrong)] rd-sticker rd-sticker-pressable',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3.5 text-sm',
  md: 'min-h-12 px-5 text-base',
  lg: 'min-h-14 px-6 text-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', fullWidth = false, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-[14px] font-bold tracking-tight disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    />
  );
});
