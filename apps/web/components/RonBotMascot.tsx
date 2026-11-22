'use client';

import { PaperPlaneRight, Sparkle, X } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Button, Chip } from '@/components/ui';
import { getBrowserTimeZone, getLocalSession } from '@/lib/session';

const HISTORY_KEY = 'ronduel_ronbot_history_v1';
const HISTORY_LIMIT = 30;

function prepareBotMarkdown(text: string) {
  return text.replace(/^[•●]\s?/gm, '- ');
}

function BotMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em>{children}</em>,
        ul: ({ children }) => (
          <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li>{children}</li>,
        code: ({ children }) => <code className="rounded bg-black/5 px-1">{children}</code>,
        a: ({ href, children }) => (
          <a href={href} className="underline" target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
        hr: () => <hr className="my-2 opacity-20" />,
        br: () => <br />,
        h1: ({ children }) => <p className="mb-2 font-semibold last:mb-0">{children}</p>,
        h2: ({ children }) => <p className="mb-2 font-semibold last:mb-0">{children}</p>,
        h3: ({ children }) => <p className="mb-2 font-semibold last:mb-0">{children}</p>,
        pre: ({ children }) => <div className="mb-2 last:mb-0">{children}</div>,
      }}
    >
      {prepareBotMarkdown(text)}
    </ReactMarkdown>
  );
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  badge?: string;
  actionLink?: {
    label: string;
    href: string;
  };
}

export function RonBotMascot() {
  const t = useTranslations();
  const pathname = usePathname();
  const isOnAdminPage = pathname?.startsWith('/admin') ?? false;
  const isPlayPage = pathname?.includes('/play') ?? false;

  const botRef = useRef<HTMLButtonElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const latestAssistantRef = useRef<HTMLDivElement | null>(null);
  const scrollModeRef = useRef<'user' | 'assistant' | null>(null);
  const [historyReady, setHistoryReady] = useState(false);

  const [open, setOpen] = useState(false);
  const [eyeOffset, setEyeOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [blinking, setBlinking] = useState(false);
  const [bouncing, setBouncing] = useState(false);

  const [splashFinished, setSplashFinished] = useState(false);

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [interactionId, setInteractionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      text: t('ronbot.greeting'),
    },
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed.slice(-HISTORY_LIMIT));
        }
      }
    } catch {
      // Ignore a damaged history blob.
    }
    setHistoryReady(true);
  }, []);

  useEffect(() => {
    if (!historyReady || typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-HISTORY_LIMIT)));
    } catch {
      // sessionStorage can be full or blocked.
    }
  }, [messages, historyReady]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkStatus = () => {
      const isHome = !pathname || pathname === '/' || /^\/[a-z]{2}(\/)?$/.test(pathname);
      const splashSeen = window.sessionStorage.getItem('ronduel_splash_seen_v2') === '1';
      setSplashFinished(!isHome || splashSeen);
    };

    checkStatus();
    const handleSplashDismissed = () => setSplashFinished(true);
    window.addEventListener('ronduel_splash_dismissed', handleSplashDismissed);
    return () => window.removeEventListener('ronduel_splash_dismissed', handleSplashDismissed);
  }, [pathname]);

  // Eye tracking for desktop mousemove AND mobile button taps / pointerdown
  useEffect(() => {
    const lookAtPoint = (targetX: number, targetY: number, isTap = false) => {
      const el = botRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = targetX - centerX;
      const dy = targetY - centerY;
      const angle = Math.atan2(dy, dx);
      const dist = Math.min(4.8, Math.hypot(dx, dy) / 28);
      setEyeOffset({
        x: Number((Math.cos(angle) * dist).toFixed(2)),
        y: Number((Math.sin(angle) * dist).toFixed(2)),
      });

      if (isTap) {
        setBouncing(true);
        setBlinking(true);
        setTimeout(() => setBlinking(false), 140);
        setTimeout(() => setBouncing(false), 320);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      lookAtPoint(e.clientX, e.clientY, false);
    };

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      const buttonEl = target?.closest('button, a, input, select');
      if (buttonEl) {
        const r = buttonEl.getBoundingClientRect();
        lookAtPoint(r.left + r.width / 2, r.top + r.height / 2, true);
      } else {
        lookAtPoint(e.clientX, e.clientY, true);
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && typeof target.getBoundingClientRect === 'function') {
        const r = target.getBoundingClientRect();
        lookAtPoint(r.left + r.width / 2, r.top + r.height / 2, true);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('focusin', handleFocusIn, { passive: true });

    const blinkInterval = setInterval(() => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 140);
    }, 4500);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('focusin', handleFocusIn);
      clearInterval(blinkInterval);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
    if (scrollModeRef.current === 'assistant' && latestAssistantRef.current) {
      latestAssistantRef.current.scrollIntoView({ block: 'start', behavior });
    } else if (scrollModeRef.current === 'user') {
      messagesEndRef.current?.scrollIntoView({ block: 'end', behavior });
    }
    scrollModeRef.current = null;
  }, [messages, open]);

  const sendMessage = async (textToSend?: string) => {
    const msg = (textToSend ?? input).trim();
    if (!msg || sending) return;
    if (!textToSend) setInput('');

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: msg,
    };
    scrollModeRef.current = 'user';
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const session = getLocalSession();
      const tz = getBrowserTimeZone();
      const localeSeg = window.location.pathname.split('/')[1] || 'ro';
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          locale: localeSeg,
          uid: session.uid,
          nickname: session.nickname || undefined,
          tz,
          isAdmin: isOnAdminPage,
          previousInteractionId: interactionId,
        }),
      });
      const data = await res.json();
      if (data.interactionId) {
        setInteractionId(data.interactionId);
      }
      scrollModeRef.current = 'assistant';
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: data.reply ?? data.error ?? t('ronbot.errorGeneric'),
          actionLink: data.actionLink,
          badge:
            data.mode === 'gemini-3.8-flash'
              ? 'Gemini 3.8 Flash'
              : data.adminActionResult
                ? t('ronbot.adminTitle')
                : undefined,
        },
      ]);
    } catch {
      scrollModeRef.current = 'assistant';
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          text: t('ronbot.errorNetwork'),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const suggestions = isOnAdminPage
    ? [
        t('ronbot.adminSuggestAstronomy'),
        t('ronbot.adminSuggestLogic'),
        t('ronbot.adminSuggestSchedule', { date: tomorrow }),
      ]
    : [
        t('ronbot.suggestHowToPlay'),
        t('ronbot.suggestMyStatus'),
        t('ronbot.suggestScoring'),
        t('ronbot.suggestEmojiMeaning'),
        t('ronbot.suggestCreateLeague'),
        t('ronbot.suggestCreateDuel'),
        t('ronbot.suggestPro'),
      ];

  const isAdminRoute = Boolean(pathname?.includes('/admin'));
  if (isPlayPage || isAdminRoute || !splashFinished) return null;

  const lastAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant')?.id;

  return (
    <div className="ronbot-anchor fixed right-4 z-40 flex max-h-[calc(100dvh-12px)] flex-col items-end gap-2">
      {open && (
        <section
          role="dialog"
          aria-label={t('ronbot.dialogLabel')}
          className="border-border bg-surface text-ink mb-1 flex w-[355px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[24px] border-2 shadow-[var(--rd-shadow-sheet)] sm:w-[385px]"
          style={{
            height: 'min(475px, calc(100dvh - 96px))',
            maxHeight: 'calc(100dvh - var(--bottom-stack, 80px) - 96px)',
          }}
        >
          {/* Header */}
          <header className="border-border bg-surface-2 flex shrink-0 items-center justify-between gap-2 border-b-2 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="border-border bg-volt font-display inline-flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-extrabold text-[#16131F]">
                ⚡
              </span>
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="font-display text-base font-extrabold">RonBot AI</h2>
                  {isOnAdminPage && (
                    <Chip tone="gold" className="px-1.5 py-0.5 text-[10px]">
                      {t('ronbot.adminTitle')}
                    </Chip>
                  )}
                </div>
                <p className="text-muted text-[11px]">
                  {isOnAdminPage ? t('ronbot.adminSubtitle') : t('ronbot.subtitle')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('ronbot.close')}
              className="border-border-subtle bg-surface text-ink inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border"
            >
              <X size={16} weight="bold" aria-hidden="true" />
            </button>
          </header>

          {/* Chat history */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-4">
            {messages.map((m) => (
              <div
                key={m.id}
                ref={m.id === lastAssistantId ? latestAssistantRef : undefined}
                className={`flex min-w-0 flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {m.badge && (
                  <span className="text-muted mb-1 inline-flex items-center gap-1 text-[10px] font-bold">
                    <Sparkle size={11} weight="fill" className="text-duel-strong" />
                    {m.badge}
                  </span>
                )}
                <div
                  className={[
                    'min-w-0 max-w-[88%] break-words rounded-[16px] px-3.5 py-2.5 text-xs leading-relaxed [overflow-wrap:anywhere]',
                    m.role === 'user'
                      ? 'border-border bg-ron border-2 font-bold text-[#16131F]'
                      : 'border-border-subtle bg-surface-2 text-ink border',
                  ].join(' ')}
                >
                  {m.role === 'assistant' ? <BotMarkdown text={m.text} /> : <div>{m.text}</div>}
                  {m.actionLink && (
                    <Link
                      href={m.actionLink.href}
                      onClick={() => setOpen(false)}
                      className="rd-sticker rd-sticker-pressable bg-volt mt-2.5 inline-flex min-h-9 w-full items-center justify-center rounded-[10px] px-3 py-1.5 text-xs font-extrabold text-[#16131F]"
                    >
                      {m.actionLink.label}
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {sending && <div className="text-muted text-xs font-bold">{t('ronbot.thinking')}</div>}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestion chips */}
          <div className="border-border-subtle bg-surface flex shrink-0 flex-wrap gap-2 border-t px-3 py-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void sendMessage(s)}
                className="border-border-subtle bg-surface-2 text-ink hover:bg-volt cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-bold hover:text-[#16131F]"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
            className="border-border bg-surface-2 flex shrink-0 items-center gap-2 border-t-2 p-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isOnAdminPage ? t('ronbot.adminPlaceholder') : t('ronbot.placeholder')}
              aria-label={t('ronbot.inputLabel')}
              className="border-border bg-surface text-ink min-h-11 flex-1 rounded-[12px] border-2 px-3 text-xs font-medium"
            />
            <Button
              type="submit"
              size="sm"
              variant="blue"
              disabled={sending || !input.trim()}
              aria-label={t('ronbot.send')}
            >
              <PaperPlaneRight size={18} weight="fill" aria-hidden="true" />
            </Button>
          </form>
        </section>
      )}

      {/* Cute Split Court Robot Button with eye-tracking */}
      <button
        ref={botRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('ronbot.open')}
        aria-expanded={open}
        className={[
          'rd-sticker rd-sticker-pressable bg-surface group relative flex h-16 w-16 cursor-pointer items-center justify-center rounded-[20px] p-1 transition-transform duration-200',
          bouncing ? '-translate-y-1.5 scale-105' : 'hover:scale-105',
        ].join(' ')}
      >
        <svg
          viewBox="0 0 64 64"
          width="54"
          height="54"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <line
            x1="32"
            y1="3"
            x2="32"
            y2="12"
            stroke="#16131F"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="32" cy="4.5" r="4" fill="#C6FF3D" stroke="#16131F" strokeWidth="2.5" />

          <rect
            x="4"
            y="27"
            width="6"
            height="12"
            rx="3"
            fill="#FF5A4E"
            stroke="#16131F"
            strokeWidth="2.5"
          />
          <rect
            x="54"
            y="27"
            width="6"
            height="12"
            rx="3"
            fill="#3D7BFF"
            stroke="#16131F"
            strokeWidth="2.5"
          />

          <clipPath id="ronbot-head-clip">
            <rect x="10" y="12" width="44" height="42" rx="13" />
          </clipPath>
          <g clipPath="url(#ronbot-head-clip)">
            <polygon points="10,12 54,12 10,54" fill="#FF5A4E" />
            <polygon points="54,12 54,54 10,54" fill="#3D7BFF" />
            <line x1="54" y1="12" x2="10" y2="54" stroke="#16131F" strokeWidth="2.5" />
          </g>
          <rect x="10" y="12" width="44" height="42" rx="13" stroke="#16131F" strokeWidth="3.2" />

          <rect x="15" y="21" width="34" height="19" rx="8" fill="#16131F" />

          <circle cx="24" cy="30.5" r="6" fill="#FFF7EC" />
          <circle cx="40" cy="30.5" r="6" fill="#FFF7EC" />

          {blinking ? (
            <>
              <line
                x1="19"
                y1="30.5"
                x2="29"
                y2="30.5"
                stroke="#16131F"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              <line
                x1="35"
                y1="30.5"
                x2="45"
                y2="30.5"
                stroke="#16131F"
                strokeWidth="2.8"
                strokeLinecap="round"
              />
            </>
          ) : (
            <g
              style={{
                transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
                transition: 'transform 70ms ease-out',
              }}
            >
              <circle cx="24" cy="30.5" r="3.3" fill="#16131F" />
              <circle cx="25.1" cy="29.3" r="1.2" fill="#C6FF3D" />
              <circle cx="40" cy="30.5" r="3.3" fill="#16131F" />
              <circle cx="41.1" cy="29.3" r="1.2" fill="#C6FF3D" />
            </g>
          )}

          <rect
            x="23"
            y="43.5"
            width="18"
            height="6"
            rx="3"
            fill="#FFF7EC"
            stroke="#16131F"
            strokeWidth="2"
          />
          <path
            d="M27 46.2C28.8 47.8 35.2 47.8 37 46.2"
            stroke="#16131F"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
