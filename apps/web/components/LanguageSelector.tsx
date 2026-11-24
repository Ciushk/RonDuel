'use client';

import { CaretDown, Check, MagnifyingGlass } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { trackEvent } from '@/lib/analytics';
import { ALL_LOCALES } from '@/lib/locales';

interface LanguageSelectorProps {
  source?: 'header' | 'settings';
  className?: string;
  showFullLabel?: boolean;
}

export function LanguageSelector({
  source = 'header',
  className = '',
  showFullLabel = false,
}: LanguageSelectorProps) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const currentLang = ALL_LOCALES.find((l) => l.code === locale) || ALL_LOCALES[0];

  const filteredLanguages = ALL_LOCALES.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      item.suffix.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev < filteredLanguages.length - 1 ? prev + 1 : 0;
          optionsRef.current[next]?.focus();
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : filteredLanguages.length - 1;
          optionsRef.current[next]?.focus();
          return next;
        });
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, filteredLanguages.length]);

  const handleSelect = (nextLocale: string) => {
    if (nextLocale !== locale) {
      trackEvent('language_changed', { from: locale, to: nextLocale, source });
      try {
        localStorage.setItem('rd_locale', nextLocale);
        document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {}

      const segments = pathname.split('/');
      segments[1] = nextLocale;
      router.push(segments.join('/') || `/${nextLocale}`);
    }
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        id="rd-language-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((prev) => !prev);
          setFocusedIndex(filteredLanguages.findIndex((l) => l.code === locale));
        }}
        className={`border-border bg-surface-2 text-ink hover:bg-surface font-display inline-flex h-10 cursor-pointer select-none items-center justify-center gap-1.5 rounded-[10px] border-2 text-xs font-black shadow-[2px_2px_0px_0px_var(--border-color,#16131F)] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
          showFullLabel ? 'min-w-[120px] px-3' : 'w-10 min-w-10 px-1'
        }`}
      >
        <span>{currentLang.suffix}</span>
        <CaretDown
          size={12}
          weight="bold"
          aria-hidden="true"
          className={`shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-labelledby="rd-language-trigger"
          className="border-border bg-surface absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border-2 p-2 shadow-[4px_4px_0px_0px_var(--border-color,#16131F)] focus:outline-none"
        >
          {/* Search Input when > 8 languages */}
          <div className="relative mb-2">
            <MagnifyingGlass
              size={14}
              weight="bold"
              className="text-muted absolute left-2.5 top-1/2 -translate-y-1/2"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFocusedIndex(-1);
              }}
              placeholder={t('settings.languageSearchPlaceholder')}
              className="border-border bg-surface-2 text-ink placeholder:text-muted focus:border-volt w-full rounded-lg border-2 py-1.5 pl-8 pr-2 text-xs font-bold focus:outline-none"
            />
          </div>

          <div className="max-h-60 space-y-0.5 overflow-y-auto pr-1">
            {filteredLanguages.length === 0 ? (
              <p className="text-muted p-3 text-center text-xs font-bold">
                {t('settings.languageNoResults')}
              </p>
            ) : (
              filteredLanguages.map((item, idx) => {
                const isSelected = item.code === locale;
                return (
                  <button
                    key={item.code}
                    ref={(el) => {
                      optionsRef.current[idx] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={focusedIndex === idx ? 0 : -1}
                    onClick={() => handleSelect(item.code)}
                    className={`flex min-h-[40px] w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-volt/40 text-ink font-extrabold'
                        : 'text-ink hover:bg-surface-2 font-medium'
                    } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rd-blue-strong)]`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 text-base" aria-hidden="true">
                        {item.flag}
                      </span>
                      <span className="truncate">{item.name}</span>
                      <span className="text-muted shrink-0 text-[10px] font-bold uppercase">
                        {item.suffix}
                      </span>
                    </span>
                    {isSelected && (
                      <Check
                        size={14}
                        weight="bold"
                        className="text-ron-strong dark:text-ron ml-1.5 shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
