'use client';

import { trackEvent } from '@/lib/analytics';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms?: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export interface InstallPromptState {
  shownCount: number;
  laterCount: number;
  snoozeUntil: number | null;
  done: boolean;
  installed: boolean;
  lastShownDate: string | null;
  /** True after an iOS "Got it" so we allow one more reminder 7 days later if still not standalone. */
  iosReminderPending?: boolean;
}

export const INSTALL_STATE_STORAGE_KEY = 'rd_install_state';
export const INSTALL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
export const INSTALL_MAX_LATERS = 2;

const DEFAULT_STATE: InstallPromptState = {
  shownCount: 0,
  laterCount: 0,
  snoozeUntil: null,
  done: false,
  installed: false,
  lastShownDate: null,
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listenersInitialized = false;
const subscribers = new Set<() => void>();

function notify(): void {
  for (const cb of subscribers) {
    try {
      cb();
    } catch {
      // Ignore subscriber errors
    }
  }
}

export function getTodayDateString(now: number = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function readInstallState(): InstallPromptState {
  if (typeof window === 'undefined') return { ...DEFAULT_STATE };
  try {
    const raw = window.localStorage.getItem(INSTALL_STATE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<InstallPromptState>;
    return {
      shownCount: typeof parsed.shownCount === 'number' ? parsed.shownCount : 0,
      laterCount: typeof parsed.laterCount === 'number' ? parsed.laterCount : 0,
      snoozeUntil: typeof parsed.snoozeUntil === 'number' ? parsed.snoozeUntil : null,
      done: Boolean(parsed.done),
      installed: Boolean(parsed.installed),
      lastShownDate: typeof parsed.lastShownDate === 'string' ? parsed.lastShownDate : null,
      iosReminderPending: Boolean(parsed.iosReminderPending),
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function hasStoredInstallState(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(INSTALL_STATE_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function writeInstallState(state: InstallPromptState): InstallPromptState {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(INSTALL_STATE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage write errors
    }
  }
  return state;
}

export function markPwaInstalled(): InstallPromptState {
  const cur = readInstallState();
  const next: InstallPromptState = {
    ...cur,
    installed: true,
    done: true,
    iosReminderPending: false,
  };
  writeInstallState(next);
  return next;
}

export function recordInstallPromptShown(now: number = Date.now()): InstallPromptState {
  const cur = readInstallState();
  const isIosFollowupReminder = cur.done && Boolean(cur.iosReminderPending);
  const next: InstallPromptState = {
    ...cur,
    shownCount: cur.shownCount + 1,
    lastShownDate: getTodayDateString(now),
    // For iOS, the single 7-day follow-up reminder after "Got it" counts as a later.
    laterCount: isIosFollowupReminder ? cur.laterCount + 1 : cur.laterCount,
    iosReminderPending: isIosFollowupReminder ? false : cur.iosReminderPending,
  };
  writeInstallState(next);
  return next;
}

export function recordInstallLater(now: number = Date.now()): InstallPromptState {
  const cur = readInstallState();
  const nextLaterCount = cur.laterCount + 1;
  const next: InstallPromptState = {
    ...cur,
    laterCount: nextLaterCount,
    snoozeUntil: now + INSTALL_SNOOZE_MS,
    done: nextLaterCount >= INSTALL_MAX_LATERS ? true : cur.done,
    iosReminderPending: false,
  };
  writeInstallState(next);
  return next;
}

export function recordInstallAccepted(): InstallPromptState {
  const cur = readInstallState();
  const next: InstallPromptState = {
    ...cur,
    done: true,
    installed: true,
    snoozeUntil: null,
    iosReminderPending: false,
  };
  writeInstallState(next);
  return next;
}

export function recordInstallIosGotIt(now: number = Date.now()): InstallPromptState {
  const cur = readInstallState();
  // First "Got it": mark done, but allow ONE follow-up reminder 7 days later if still not standalone.
  const canScheduleOneReminder = !cur.done && cur.laterCount < INSTALL_MAX_LATERS;
  const next: InstallPromptState = {
    ...cur,
    done: true,
    snoozeUntil: canScheduleOneReminder ? now + INSTALL_SNOOZE_MS : null,
    iosReminderPending: canScheduleOneReminder,
  };
  writeInstallState(next);
  return next;
}

export interface InstallEligibilityOptions {
  /** Number of completed daily rounds (from result payload). */
  finishedPlaysCount?: number;
  /** True when the player has just completed a match (e.g. a finished duel). */
  hasFinishedMatch?: boolean;
  /** Current timestamp in ms (defaults to Date.now()). */
  now?: number;
  /** Override platform detection (defaults to runtime). */
  platform: 'chromium-prompt' | 'ios-howto' | 'none';
  /** Override standalone check (defaults to false). */
  standalone: boolean;
  /** Optional explicit state override for unit testing. */
  state?: InstallPromptState;
  /** Whether a stored rd_install_state already exists. */
  hasPriorState?: boolean;
}

export function shouldShowInstallPrompt(opts: InstallEligibilityOptions): boolean {
  const {
    finishedPlaysCount,
    hasFinishedMatch = false,
    now = Date.now(),
    platform,
    standalone,
  } = opts;

  if (standalone) return false;
  if (platform === 'none') return false;

  const state = opts.state ?? readInstallState();
  if (state.installed) return false;

  const hasCompletedAtLeastOne =
    hasFinishedMatch || (typeof finishedPlaysCount === 'number' && finishedPlaysCount >= 1);
  if (!hasCompletedAtLeastOne) return false;

  // Never show twice on the same calendar day
  const today = getTodayDateString(now);
  if (state.lastShownDate === today) return false;

  // After 2 "Later" clicks, never show again
  if (state.laterCount >= INSTALL_MAX_LATERS) return false;

  // Respect active 7-day snooze
  if (state.snoozeUntil !== null && now < state.snoozeUntil) return false;

  // If done: only allow the single iOS 7-day follow-up reminder when still not standalone
  if (state.done) {
    if (
      platform === 'ios-howto' &&
      Boolean(state.iosReminderPending) &&
      state.snoozeUntil !== null &&
      now >= state.snoozeUntil
    ) {
      return true;
    }
    return false;
  }

  // First-trigger check: first completed round OR first result seen after feature ships
  // (no stored state yet, or already snoozed and snooze has now expired).
  const priorStateExists = opts.hasPriorState ?? hasStoredInstallState();
  if (!priorStateExists) {
    return true;
  }

  // Prior state exists, not done, not snoozed, not shown today, laterCount < 2 -> eligible
  return true;
}

function handleBeforeInstallPrompt(event: Event): void {
  event.preventDefault();
  deferredPrompt = event as BeforeInstallPromptEvent;
  notify();
}

function handleAppInstalled(): void {
  deferredPrompt = null;
  markPwaInstalled();
  trackEvent('pwa_installed');
  notify();
}

/**
 * Registers global `beforeinstallprompt` and `appinstalled` listeners once per session.
 * Call from the top-level client shell so Chromium's one-shot event is never missed.
 */
export function initInstallPromptCapture(): void {
  if (typeof window === 'undefined' || listenersInitialized) return;
  listenersInitialized = true;
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const prompt = deferredPrompt;
  if (!prompt) return 'unavailable';
  deferredPrompt = null;
  notify();
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    return choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch {
    return 'dismissed';
  }
}

export function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

/** Test-only helper to reset singleton module state between test cases. */
export function __resetInstallPromptForTests(): void {
  if (typeof window !== 'undefined' && listenersInitialized) {
    window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.removeEventListener('appinstalled', handleAppInstalled);
  }
  listenersInitialized = false;
  deferredPrompt = null;
  subscribers.clear();
}

/** Test-only helper to inject a mock BeforeInstallPromptEvent directly. */
export function __setDeferredPromptForTests(prompt: BeforeInstallPromptEvent | null): void {
  deferredPrompt = prompt;
  notify();
}
