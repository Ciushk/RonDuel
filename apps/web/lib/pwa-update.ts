export const SW_SCRIPT_URL = '/sw.js?v=2';
export const VERSION_URL = '/version.json';
export const UPDATE_POLL_INTERVAL_MS = 30 * 60 * 1000;
export const RELOAD_GUARD_KEY = 'rd-sw-reloading';
export const DISMISSED_BUILD_KEY = 'rd-sw-dismissed';
export const SEEN_BUILD_KEY = 'rd-sw-seen-build';

export interface VersionManifest {
  buildId: string;
  builtAt?: string;
}

export function isPlayFocusPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname.endsWith('/play');
}

export function isNewerBuildId(
  remoteBuildId: string | null | undefined,
  currentBuildId: string | null | undefined,
): boolean {
  const remote = remoteBuildId?.trim() ?? '';
  const current = currentBuildId?.trim() ?? '';
  if (!remote || !current) return false;
  return remote !== current;
}

export function shouldSuppressForReloadGuard(
  targetId: string,
  reloadingId: string | null,
): boolean {
  if (!targetId || !reloadingId) return false;
  return reloadingId === targetId;
}

/**
 * Unregisters all service workers and deletes all Cache API buckets.
 * Intentionally does NOT touch localStorage, sessionStorage, cookies,
 * IndexedDB, or Firebase Auth state so the user stays signed in.
 */
export async function clearAppCachesAndUnregisterSw(): Promise<void> {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister().catch(() => false)));
    } catch {
      // Ignore SW API errors in restricted contexts
    }
  }

  if (typeof caches !== 'undefined') {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)));
    } catch {
      // Ignore Cache API errors in restricted contexts
    }
  }
}
