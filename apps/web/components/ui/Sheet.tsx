'use client';

import { X } from '@phosphor-icons/react';
import { useEffect, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'border-border bg-surface text-ink w-full max-w-[480px] rounded-t-[28px] border-2 p-6 shadow-[var(--rd-shadow-sheet)] sm:rounded-[28px]',
          className,
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-extrabold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="border-border-subtle bg-surface-2 text-ink inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border"
          >
            <X size={20} weight="bold" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
