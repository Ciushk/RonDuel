'use client';

import { X } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

import { cn } from '@/lib/cn';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
  describedBy?: string;
  trapFocus?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeOnScrimClick?: boolean;
  closeOnEscape?: boolean;
  ariaBusy?: boolean;
  hideHeader?: boolean;
  animate?: boolean;
  closing?: boolean;
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
  labelledBy,
  describedBy,
  trapFocus = false,
  initialFocusRef,
  closeOnScrimClick = true,
  closeOnEscape = true,
  ariaBusy,
  hideHeader = false,
  animate = false,
  closing = false,
}: SheetProps) {
  const t = useTranslations('common');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.preventDefault();
        onClose();
        return;
      }

      if (trapFocus && e.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (focusables.length === 0) return;

        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (!active || active === first || !panelRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (!active || active === last || !panelRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, closeOnEscape, trapFocus]);

  useEffect(() => {
    if (!trapFocus) return;
    if (open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const focusTarget = () => {
        if (initialFocusRef?.current && !initialFocusRef.current.hasAttribute('disabled')) {
          initialFocusRef.current.focus();
          return;
        }
        const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        first?.focus();
      };
      const rafId = window.requestAnimationFrame(focusTarget);
      return () => {
        window.cancelAnimationFrame(rafId);
      };
    }

    if (previousFocusRef.current && previousFocusRef.current.isConnected) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
    return undefined;
  }, [open, trapFocus, initialFocusRef]);

  useEffect(() => {
    return () => {
      if (trapFocus && previousFocusRef.current && previousFocusRef.current.isConnected) {
        previousFocusRef.current.focus();
        previousFocusRef.current = null;
      }
    };
  }, [trapFocus]);

  if (!open) return null;

  return (
    <div
      data-testid="sheet-scrim"
      className={cn(
        'fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4',
        animate && (closing ? 'rd-gate-scrim-out' : 'rd-gate-scrim-in'),
      )}
      onClick={() => {
        if (closeOnScrimClick) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-busy={ariaBusy || undefined}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'border-border bg-surface text-ink w-full max-w-[480px] rounded-t-[28px] border-2 p-6 shadow-[var(--rd-shadow-sheet)] sm:rounded-[28px]',
          animate && (closing ? 'rd-gate-panel-out' : 'rd-gate-panel-in'),
          className,
        )}
      >
        {!hideHeader && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id={labelledBy} className="font-display text-2xl font-extrabold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={!closeOnEscape}
              aria-label={t('close')}
              className="border-border-subtle bg-surface-2 text-ink inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={20} weight="bold" aria-hidden="true" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
