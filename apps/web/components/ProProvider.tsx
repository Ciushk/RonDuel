'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { getLocalSession } from '../lib/session';

export interface ProState {
  isPro: boolean;
  loading: boolean;
}

const ProContext = createContext<ProState>({ isPro: false, loading: true });

function readCurrentUid(): string | null {
  try {
    const session = getLocalSession();
    const uid = session?.uid?.trim();
    if (!uid || uid === 'u_ssr' || uid === 'anon') return null;
    return uid;
  } catch {
    return null;
  }
}

/**
 * Shared client Pro entitlement provider backed by `GET /api/me/profile?uid=`.
 * Currently consumed by RonBot; other pages (Home, Me, Duels, league admin, result, town sheets)
 * may migrate to `usePro()` in a future follow-up.
 */
export function ProProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProState>({ isPro: false, loading: true });
  const cacheRef = useRef<{ uid: string | null; resolved: boolean; isPro: boolean }>({
    uid: null,
    resolved: false,
    isPro: false,
  });

  useEffect(() => {
    let active = true;
    let inFlight = false;

    const fetchProStatus = async (isBackgroundRevalidate: boolean) => {
      const uid = readCurrentUid();
      if (!uid) {
        cacheRef.current = { uid: null, resolved: true, isPro: false };
        if (active) setState({ isPro: false, loading: false });
        return;
      }

      const uidChanged = cacheRef.current.uid !== uid;
      if (uidChanged) {
        cacheRef.current = { uid, resolved: false, isPro: false };
        if (active) setState({ isPro: false, loading: true });
      } else if (!isBackgroundRevalidate && cacheRef.current.resolved) {
        return;
      }

      if (inFlight) return;
      inFlight = true;

      try {
        const res = await fetch(`/api/me/profile?uid=${encodeURIComponent(uid)}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { pro?: { active?: boolean } | null };
        const nextIsPro = data?.pro?.active === true;

        // Ignore stale response if uid changed mid-flight
        if (!active || cacheRef.current.uid !== uid) return;

        cacheRef.current = { uid, resolved: true, isPro: nextIsPro };
        setState({ isPro: nextIsPro, loading: false });
      } catch {
        if (!active || cacheRef.current.uid !== uid) return;
        // Fail closed on initial load; keep last known value on background revalidation failure
        if (!cacheRef.current.resolved) {
          cacheRef.current = { uid, resolved: true, isPro: false };
          setState({ isPro: false, loading: false });
        }
      } finally {
        inFlight = false;
      }
    };

    void fetchProStatus(false);

    const onFocus = () => {
      void fetchProStatus(true);
    };
    const onVisibilityChange = () => {
      if (!document.hidden) {
        void fetchProStatus(true);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ronduel_session_v1' || e.key === null) {
        void fetchProStatus(true);
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('storage', onStorage);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return <ProContext.Provider value={state}>{children}</ProContext.Provider>;
}

export function usePro(): ProState {
  return useContext(ProContext);
}
