'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/cn';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  describedById?: string;
  testId?: string;
  onDisabledClick?: () => void;
  className?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  busy = false,
  busyLabel,
  disabled = false,
  describedById,
  testId,
  onDisabledClick,
  className,
}: SwitchProps) {
  const labelId = useId();
  const isDisabled = disabled || busy;
  const effectiveChecked = disabled ? false : checked;

  const prevCheckedRef = useRef(effectiveChecked);
  const [squashDir, setSquashDir] = useState<'none' | 'on' | 'off'>('none');

  useEffect(() => {
    if (prevCheckedRef.current !== effectiveChecked) {
      prevCheckedRef.current = effectiveChecked;
      setSquashDir(effectiveChecked ? 'on' : 'off');
    }
  }, [effectiveChecked]);

  const handleClick = () => {
    if (busy) return;
    if (disabled) {
      onDisabledClick?.();
      return;
    }
    onChange(!checked);
  };

  return (
    <div
      className={cn(
        'flex min-h-12 items-center justify-between gap-3 text-sm font-bold',
        className,
      )}
    >
      <span id={labelId} className="text-ink leading-snug">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={effectiveChecked}
        aria-busy={busy}
        aria-disabled={isDisabled}
        aria-labelledby={busy && busyLabel ? undefined : labelId}
        aria-label={busy && busyLabel ? `${label} — ${busyLabel}` : undefined}
        aria-describedby={describedById}
        data-testid={testId}
        onClick={handleClick}
        className={cn(
          'rd-switch-btn inline-flex min-h-[44px] min-w-[44px] shrink-0 select-none items-center justify-center rounded-full px-1 py-[7px] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF]',
          isDisabled ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        <span
          className={cn(
            'rd-switch-track relative inline-flex h-[30px] w-[52px] items-center rounded-full border-2 border-[#0E0D15] bg-[#FFF7EC] shadow-[2px_2px_0_#0E0D15]',
            disabled && 'border-dashed opacity-50',
          )}
        >
          {/* Active track color overlay (animates opacity only) */}
          <span
            aria-hidden="true"
            className={cn(
              'rd-switch-overlay pointer-events-none absolute inset-0 rounded-full bg-[#3D7BFF]',
              effectiveChecked ? 'opacity-100' : 'opacity-0',
            )}
          />

          {/* Sliding knob wrapper (animates translateX only) */}
          <span
            className={cn(
              'rd-switch-knob-slide pointer-events-none relative z-10 flex h-[22px] w-[22px] items-center justify-center',
              effectiveChecked ? 'translate-x-[24px]' : 'translate-x-[2px]',
            )}
          >
            {/* Inner knob visual (midpoint squash + volt overlay + glyphs/spinner) */}
            <span
              className={cn(
                'relative flex h-full w-full items-center justify-center rounded-full border-2 border-[#0E0D15] bg-white',
                squashDir === 'on' && 'rd-switch-knob-squash-on',
                squashDir === 'off' && 'rd-switch-knob-squash-off',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'rd-switch-overlay pointer-events-none absolute inset-0 rounded-full bg-[#C6FF3D]',
                  effectiveChecked ? 'opacity-100' : 'opacity-0',
                )}
              />

              {/* Cross-fading state glyphs (hidden while busy) */}
              <span
                aria-hidden="true"
                className={cn(
                  'rd-switch-glyph pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-[11px] font-black leading-none text-[#0E0D15]',
                  !busy && !disabled && effectiveChecked ? 'opacity-100' : 'opacity-0',
                )}
              >
                ✓
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'rd-switch-glyph pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-[11px] font-black leading-none text-[#0E0D15]',
                  !busy && !disabled && !effectiveChecked ? 'opacity-100' : 'opacity-0',
                )}
              >
                ✕
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'rd-switch-glyph pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-[9px] leading-none',
                  !busy && disabled ? 'opacity-100' : 'opacity-0',
                )}
              >
                🔒
              </span>

              {/* Busy indicator (rotating ring + reduced-motion static ellipsis) */}
              {busy && (
                <>
                  <span
                    aria-hidden="true"
                    className="rd-switch-spinner-ring relative z-10 block h-3 w-3 rounded-full border-2 border-[#0E0D15]/30 border-t-[#0E0D15]"
                  />
                  <span
                    aria-hidden="true"
                    className="rd-switch-spinner-static relative z-10 items-center justify-center text-[11px] font-black leading-none text-[#0E0D15]"
                  >
                    …
                  </span>
                </>
              )}
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}
