'use client';

import { Key, PaperPlaneRight, Sparkle, Wrench, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';

import { Button, Chip } from '@/components/ui';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  badge?: string;
}

const KEY_STORAGE = 'ronduel_gemini_api_key_v1';

export function RonBotMascot() {
  const botRef = useRef<HTMLButtonElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [eyeOffset, setEyeOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [blinking, setBlinking] = useState(false);
  const [bouncing, setBouncing] = useState(false);

  const [adminMode, setAdminMode] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [interactionId, setInteractionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Salut! Sunt RonBot ⚡! Mă uit după fiecare mișcare din arenă. Întreabă-mă orice despre joc, reguli, scor sau ligi — ori activează modul Admin ca să creăm întrebări noi și să programăm runde!',
    },
  ]);

  useEffect(() => {
    try {
      const savedKey = window.localStorage.getItem(KEY_STORAGE);
      if (savedKey) setApiKey(savedKey);
      if (window.location.pathname.startsWith('/admin')) {
        setAdminMode(true);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

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

    // Natural periodic blink
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const saveApiKey = (val: string) => {
    setApiKey(val);
    try {
      if (val.trim()) {
        window.localStorage.setItem(KEY_STORAGE, val.trim());
      } else {
        window.localStorage.removeItem(KEY_STORAGE);
      }
    } catch {
      // ignore
    }
  };

  const sendMessage = async (textToSend?: string) => {
    const msg = (textToSend ?? input).trim();
    if (!msg || sending) return;
    if (!textToSend) setInput('');

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: msg,
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey.trim()) {
        headers['x-gemini-api-key'] = apiKey.trim();
      }
      const localeSeg = window.location.pathname.split('/')[1] || 'ro';
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: msg,
          locale: localeSeg,
          isAdmin: adminMode,
          previousInteractionId: interactionId,
        }),
      });
      const data = await res.json();
      if (data.interactionId) {
        setInteractionId(data.interactionId);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: data.reply ?? data.error ?? 'Hmm, ceva nu a mers. Încearcă din nou!',
          badge:
            data.mode === 'gemini-3.8-flash'
              ? 'Gemini 3.8 Flash'
              : data.adminActionResult
                ? 'Admin Co-Pilot'
                : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          text: 'Nu am putut contacta serverul. Verifică conexiunea!',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const suggestions = adminMode
    ? [
        'Creează 2 întrebări despre Astronomie',
        'Generează 2 întrebări de logică',
        'Programează o rundă pentru 2026-12-18',
      ]
    : [
        'Cum se calculează scorul?',
        'Cum creez o ligă cu prietenii?',
        'Cum funcționează duelul 1v1?',
        'Ce oferă RonDuel Pro?',
      ];

  return (
    <>
      {/* Floating Split Court Robot Mascot Button (Bottom-Right) */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        {open && (
          <section
            role="dialog"
            aria-label="RonBot AI Chat"
            className="border-border bg-surface text-ink mb-1 flex h-[470px] w-[350px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[24px] border-2 shadow-[var(--rd-shadow-sheet)] sm:w-[380px]"
          >
            {/* Header */}
            <header className="border-border bg-surface-2 flex items-center justify-between gap-2 border-b-2 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="border-border bg-volt font-display inline-flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-extrabold text-[#16131F]">
                  ⚡
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-display text-base font-extrabold">RonBot AI</h2>
                    <Chip tone="volt" className="px-1.5 py-0.5 text-[10px]">
                      Gemini 3.8
                    </Chip>
                  </div>
                  <p className="text-muted text-[11px]">
                    {adminMode ? '🛠️ Admin Co-Pilot activ' : 'Ghidul tău Split Court'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAdminMode((v) => !v)}
                  title="Comută modul Admin Co-Pilot"
                  aria-label="Toggle Admin Co-Pilot mode"
                  className={[
                    'inline-flex h-9 cursor-pointer items-center gap-1 rounded-[10px] border px-2 text-xs font-bold',
                    adminMode
                      ? 'bg-gold border-[#16131F] text-[#16131F]'
                      : 'border-border-subtle bg-surface text-muted',
                  ].join(' ')}
                >
                  <Wrench size={14} weight="bold" aria-hidden="true" />
                  <span>Admin</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowKeyInput((v) => !v)}
                  title="Setează cheia GEMINI_API_KEY"
                  aria-label="Configure Gemini API key"
                  className="border-border-subtle bg-surface text-ink inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border"
                >
                  <Key size={16} weight="bold" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Închide chatul RonBot"
                  className="border-border-subtle bg-surface text-ink inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border"
                >
                  <X size={16} weight="bold" aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* Optional in-app Gemini API Key drawer */}
            {showKeyInput && (
              <div className="border-border-subtle bg-surface-2 border-b px-4 py-2.5 text-xs">
                <label htmlFor="ronbot-api-key" className="mb-1 block font-bold">
                  Cheie Gemini API (`GEMINI_API_KEY` din Google AI Studio):
                </label>
                <input
                  id="ronbot-api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => saveApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="border-border bg-surface text-ink min-h-9 w-full rounded-[10px] border px-3 text-xs font-medium"
                />
                <p className="text-muted mt-1 text-[11px]">
                  Se salvează local în browser sau pe server prin Secret Manager.
                </p>
              </div>
            )}

            {/* Chat history */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {m.badge && (
                    <span className="text-muted mb-1 inline-flex items-center gap-1 text-[10px] font-bold">
                      <Sparkle size={11} weight="fill" className="text-duel-strong" />
                      {m.badge}
                    </span>
                  )}
                  <div
                    className={[
                      'max-w-[85%] whitespace-pre-line rounded-[16px] px-3.5 py-2.5 text-xs leading-relaxed',
                      m.role === 'user'
                        ? 'border-border bg-ron border-2 font-bold text-[#16131F]'
                        : 'border-border-subtle bg-surface-2 text-ink border',
                    ].join(' ')}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {sending && <div className="text-muted text-xs font-bold">RonBot gândește ⚡…</div>}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestion chips */}
            <div className="border-border-subtle bg-surface flex gap-1.5 overflow-x-auto border-t px-3 py-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void sendMessage(s)}
                  className="border-border-subtle bg-surface-2 text-ink hover:bg-volt shrink-0 cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-bold hover:text-[#16131F]"
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
              className="border-border bg-surface-2 flex items-center gap-2 border-t-2 p-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  adminMode
                    ? 'Ex: Creează 2 întrebări despre Istorie...'
                    : 'Întreabă-l pe RonBot despre joc...'
                }
                aria-label="Mesaj pentru RonBot"
                className="border-border bg-surface text-ink min-h-11 flex-1 rounded-[12px] border-2 px-3 text-xs font-medium"
              />
              <Button
                type="submit"
                size="sm"
                variant="blue"
                disabled={sending || !input.trim()}
                aria-label="Trimite mesajul"
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
          aria-label="Deschide asistentul RonBot AI"
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
            {/* Antenna stem + Volt spark */}
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

            {/* Side ear bolts */}
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

            {/* Robot head split diagonally (Ron Red top-left, Duel Blue bottom-right) */}
            <clipPath id="ronbot-head-clip">
              <rect x="10" y="12" width="44" height="42" rx="13" />
            </clipPath>
            <g clipPath="url(#ronbot-head-clip)">
              <polygon points="10,12 54,12 10,54" fill="#FF5A4E" />
              <polygon points="54,12 54,54 10,54" fill="#3D7BFF" />
              <line x1="54" y1="12" x2="10" y2="54" stroke="#16131F" strokeWidth="2.5" />
            </g>
            <rect x="10" y="12" width="44" height="42" rx="13" stroke="#16131F" strokeWidth="3.2" />

            {/* Dark visor window */}
            <rect x="15" y="21" width="34" height="19" rx="8" fill="#16131F" />

            {/* Left & Right Eye Sockets */}
            <circle cx="24" cy="30.5" r="6" fill="#FFF7EC" />
            <circle cx="40" cy="30.5" r="6" fill="#FFF7EC" />

            {/* Moving Pupils (follow cursor on desktop & tapped buttons on mobile) */}
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

            {/* Friendly smile on cream badge */}
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
    </>
  );
}
