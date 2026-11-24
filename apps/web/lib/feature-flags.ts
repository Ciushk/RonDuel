'use client';

import { useEffect, useState } from 'react';
import { isPostHogFeatureEnabled, onPostHogFeatureFlags } from './analytics';

export type TownFeatureFlag =
  'town_enabled' | 'coins_purchase_enabled' | 'coins_transfer_enabled' | 'town_help_enabled';

/**
 * Returns whether a feature flag is enabled.
 * Checks localStorage override (e.g. ff_town_enabled = 'true') then PostHog.
 * Defaults strictly to false (dark launch).
 */
export function getFeatureFlag(flag: TownFeatureFlag | string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const override = localStorage.getItem(`ff_${flag}`);
    if (override !== null) {
      return override === 'true' || override === '1';
    }
    return isPostHogFeatureEnabled(flag);
  } catch {
    return false;
  }
}

/**
 * React hook to reactively subscribe to a feature flag.
 * Default is always false.
 */
export function useFeatureFlag(flag: TownFeatureFlag | string): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => getFeatureFlag(flag));

  useEffect(() => {
    setEnabled(getFeatureFlag(flag));

    const unsubscribe = onPostHogFeatureFlags(() => {
      setEnabled(getFeatureFlag(flag));
    });

    const handleStorage = (e: StorageEvent) => {
      if (e.key === `ff_${flag}` || e.key === null) {
        setEnabled(getFeatureFlag(flag));
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
    };
  }, [flag]);

  return enabled;
}
