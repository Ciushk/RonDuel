'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { trackEvent } from '@/lib/analytics';
import { recordInstallPromptShown, shouldShowInstallPrompt, subscribe } from '@/lib/install-prompt';
import { getInstallPlatform, isStandalone, type InstallPlatform } from '@/lib/pwa-env';

export interface UseInstallPromptOptions {
  /** True once a finished match result is loaded and ready to consider showing the prompt. */
  ready: boolean;
  /** Number of finished daily rounds (for daily result screen). */
  finishedPlaysCount?: number;
  /** True for non-daily finished matches (e.g. a completed 1v1 duel). */
  hasFinishedMatch?: boolean;
  /** True while result reveal animations are still running. */
  animationsComplete: boolean;
  /** True when another sheet/modal (e.g. AccountLinkingSheet, Share picker, AuthModal) is open or scheduled. */
  blockedByOtherSheet: boolean;
  /** True if we are opening after the account linking sheet just closed (uses 600ms delay). */
  afterOtherSheetClosed?: boolean;
}

export function useInstallPrompt({
  ready,
  finishedPlaysCount,
  hasFinishedMatch = false,
  animationsComplete,
  blockedByOtherSheet,
  afterOtherSheetClosed = false,
}: UseInstallPromptOptions) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Exclude<InstallPlatform, 'none'> | null>(null);
  const [promptVersion, setPromptVersion] = useState(0);
  const openedForVisitRef = useRef(false);

  // Re-evaluate if Chromium fires beforeinstallprompt after mount
  useEffect(() => {
    return subscribe(() => {
      setPromptVersion((v) => v + 1);
    });
  }, []);

  useEffect(() => {
    if (!ready || blockedByOtherSheet || open || openedForVisitRef.current) return;
    if (typeof window === 'undefined') return;

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReduced && !animationsComplete && !afterOtherSheetClosed) return;

    const detected = getInstallPlatform();
    if (detected === 'none') return;

    const eligible = shouldShowInstallPrompt({
      finishedPlaysCount,
      hasFinishedMatch,
      platform: detected,
      standalone: isStandalone(),
    });
    if (!eligible) return;

    const delayMs = afterOtherSheetClosed ? 600 : prefersReduced ? 800 : 1800;

    const timer = setTimeout(() => {
      const freshPlatform = getInstallPlatform();
      if (freshPlatform === 'none') return;
      if (
        !shouldShowInstallPrompt({
          finishedPlaysCount,
          hasFinishedMatch,
          platform: freshPlatform,
          standalone: isStandalone(),
        })
      ) {
        return;
      }
      openedForVisitRef.current = true;
      recordInstallPromptShown();
      trackEvent('install_prompt_shown', { platform: freshPlatform });
      setPlatform(freshPlatform);
      setOpen(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [
    ready,
    finishedPlaysCount,
    hasFinishedMatch,
    animationsComplete,
    blockedByOtherSheet,
    afterOtherSheetClosed,
    open,
    promptVersion,
  ]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  return {
    isInstallOpen: open,
    installPlatform: platform,
    closeInstall: close,
  };
}
