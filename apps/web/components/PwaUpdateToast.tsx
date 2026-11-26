'use client';

import { ArrowsClockwise, X } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useBottomStack } from '@/lib/bottom-stack';
import {
  DISMISSED_BUILD_KEY,
  isNewerBuildId,
  isPlayFocusPath,
  RELOAD_GUARD_KEY,
  SEEN_BUILD_KEY,
  shouldSuppressForReloadGuard,
  SW_SCRIPT_URL,
  UPDATE_POLL_INTERVAL_MS,
  VERSION_URL,
  type VersionManifest,
} from '@/lib/pwa-update';

const CURRENT_BUILD_ID = (process.env.NEXT_PUBLIC_BUILD_ID ?? '').trim();

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage errors in private/restricted browsers
  }
}

function removeSession(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage errors in private/restricted browsers
  }
}

export interface PwaUpdateToastProps {
  hasConsentBanner?: boolean;
  hideBottomNav?: boolean;
}

export function PwaUpdateToast({
  hasConsentBanner = false,
  hideBottomNav = false,
}: PwaUpdateToastProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const isPlayRoute = isPlayFocusPath(pathname);

  const [updateTargetId, setUpdateTargetId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [reloading, setReloading] = useState(false);

  const toastRef = useRef<HTMLDivElement>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const isPlayRouteRef = useRef(isPlayRoute);
  const userRequestedReloadRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const hasReloadedRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);

  isPlayRouteRef.current = isPlayRoute;

  const visible = Boolean(updateTargetId) && !dismissed && !isPlayRoute;
  useBottomStack('pwa-update-toast', toastRef, visible);

  const performReloadOnce = useCallback(() => {
    if (hasReloadedRef.current) return;
    if (isPlayRouteRef.current) {
      pendingReloadRef.current = true;
      return;
    }
    hasReloadedRef.current = true;
    pendingReloadRef.current = false;
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    window.location.reload();
  }, []);

  // Flush any queued reload as soon as the player leaves /play
  useEffect(() => {
    if (!isPlayRoute && pendingReloadRef.current) {
      performReloadOnce();
    }
  }, [isPlayRoute, performReloadOnce]);

  const markUpdateAvailable = useCallback(
    (targetId: string, waitingWorker: ServiceWorker | null) => {
      if (waitingWorker) {
        waitingWorkerRef.current = waitingWorker;
      }

      const reloadingId = readSession(RELOAD_GUARD_KEY);
      if (!waitingWorker && shouldSuppressForReloadGuard(targetId, reloadingId)) {
        return;
      }

      const dismissedId = readSession(DISMISSED_BUILD_KEY);
      setUpdateTargetId(targetId);
      setDismissed(dismissedId === targetId);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    const swCleanupFns: Array<() => void> = [];

    if (CURRENT_BUILD_ID && readSession(RELOAD_GUARD_KEY) === CURRENT_BUILD_ID) {
      removeSession(RELOAD_GUARD_KEY);
    }

    const inspectWaiting = (reg: ServiceWorkerRegistration) => {
      if (!active) return;
      if (reg.waiting && navigator.serviceWorker.controller) {
        markUpdateAvailable('waiting', reg.waiting);
      }
    };

    const checkVersionManifest = async () => {
      try {
        const res = await fetch(VERSION_URL, { cache: 'no-store' });
        if (!res.ok || !active) return;
        const data = (await res.json()) as Partial<VersionManifest>;
        const remoteBuildId = typeof data?.buildId === 'string' ? data.buildId.trim() : '';
        if (!remoteBuildId || !active) return;

        if (CURRENT_BUILD_ID) {
          if (isNewerBuildId(remoteBuildId, CURRENT_BUILD_ID)) {
            markUpdateAvailable(remoteBuildId, registrationRef.current?.waiting ?? null);
          } else if (readSession(RELOAD_GUARD_KEY) === remoteBuildId) {
            removeSession(RELOAD_GUARD_KEY);
          }
          return;
        }

        // Dev fallback when NEXT_PUBLIC_BUILD_ID is unset: track first-seen buildId
        const seen = readSession(SEEN_BUILD_KEY);
        if (!seen) {
          writeSession(SEEN_BUILD_KEY, remoteBuildId);
        } else if (seen !== remoteBuildId) {
          markUpdateAvailable(remoteBuildId, registrationRef.current?.waiting ?? null);
        }
      } catch {
        // Ignore network/404 errors (e.g. offline or local next dev without version.json)
      }
    };

    const checkForUpdates = () => {
      if (!active) return;
      const reg = registrationRef.current;
      if (reg) {
        reg.update().catch(() => {});
        inspectWaiting(reg);
      }
      void checkVersionManifest();
    };

    if ('serviceWorker' in navigator) {
      const handleControllerChange = () => {
        if (!active) return;
        if (!userRequestedReloadRef.current) return;
        if (isPlayRouteRef.current) {
          pendingReloadRef.current = true;
          return;
        }
        performReloadOnce();
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      swCleanupFns.push(() => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      });

      navigator.serviceWorker
        .register(SW_SCRIPT_URL, { scope: '/' })
        .then((reg) => {
          if (!active) return;
          registrationRef.current = reg;
          inspectWaiting(reg);

          const handleUpdateFound = () => {
            const installing = reg.installing;
            if (!installing) return;
            const handleStateChange = () => {
              if (!active) return;
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                markUpdateAvailable('waiting', installing);
              }
            };
            installing.addEventListener('statechange', handleStateChange);
            swCleanupFns.push(() => {
              installing.removeEventListener('statechange', handleStateChange);
            });
          };

          reg.addEventListener('updatefound', handleUpdateFound);
          swCleanupFns.push(() => {
            reg.removeEventListener('updatefound', handleUpdateFound);
          });

          // Trigger an initial update check once registered
          reg.update().catch(() => {});
        })
        .catch(() => {});
    }

    // Initial version.json check on mount
    void checkVersionManifest();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = window.setInterval(checkForUpdates, UPDATE_POLL_INTERVAL_MS);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      for (const cleanup of swCleanupFns) {
        cleanup();
      }
    };
  }, [markUpdateAvailable, performReloadOnce]);

  const handleReload = () => {
    if (isPlayRouteRef.current) {
      pendingReloadRef.current = true;
      return;
    }
    if (reloading) return;

    setReloading(true);
    userRequestedReloadRef.current = true;

    const targetId = updateTargetId ?? 'waiting';
    writeSession(RELOAD_GUARD_KEY, targetId);
    if (!CURRENT_BUILD_ID && targetId !== 'waiting') {
      writeSession(SEEN_BUILD_KEY, targetId);
    }

    const waiting = waitingWorkerRef.current ?? registrationRef.current?.waiting ?? null;
    if (waiting) {
      try {
        waiting.postMessage('SKIP_WAITING');
      } catch {
        performReloadOnce();
        return;
      }
      fallbackTimerRef.current = window.setTimeout(() => {
        performReloadOnce();
      }, 1500);
    } else {
      performReloadOnce();
    }
  };

  const handleDismiss = () => {
    const targetId = updateTargetId ?? 'waiting';
    writeSession(DISMISSED_BUILD_KEY, targetId);
    setDismissed(true);
  };

  if (!visible) return null;

  const bottomPositionClass = hideBottomNav
    ? hasConsentBanner
      ? 'bottom-[calc(80px+env(safe-area-inset-bottom,0px)+12px)] lg:bottom-[92px]'
      : 'bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] lg:bottom-5'
    : hasConsentBanner
      ? 'bottom-[calc(4rem+80px+env(safe-area-inset-bottom,0px)+16px)] lg:bottom-[92px]'
      : 'bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+20px)] lg:bottom-5';

  return (
    <div
      className={`pointer-events-none fixed inset-x-3 z-50 flex justify-center ${
        !hideBottomNav ? 'lg:left-60 lg:right-0' : ''
      } ${bottomPositionClass}`}
    >
      <div
        ref={toastRef}
        role="status"
        aria-live="polite"
        data-testid="pwa-update-toast"
        className="rd-sticker rd-update-toast bg-bg text-ink pointer-events-auto flex w-full max-w-[448px] items-center justify-between gap-2.5 rounded-[16px] px-3.5 py-2.5"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="border-border bg-surface-2 text-ink inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border-2"
          >
            <ArrowsClockwise size={17} weight="bold" />
          </span>
          <span className="truncate text-sm font-extrabold tracking-tight">
            {t('pwa.updateAvailable')}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={handleReload}
            disabled={reloading}
            className="border-border bg-volt inline-flex min-h-[40px] cursor-pointer items-center justify-center rounded-[10px] border-2 px-3.5 text-sm font-extrabold tracking-tight text-[#16131F] shadow-[2px_2px_0px_0px_var(--rd-border)] transition-transform duration-100 active:translate-y-[2px] disabled:cursor-wait disabled:opacity-75"
          >
            {t('pwa.reload')}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label={t('pwa.dismiss')}
            className="text-muted hover:bg-surface-2 hover:text-ink inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px]"
          >
            <X size={18} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
