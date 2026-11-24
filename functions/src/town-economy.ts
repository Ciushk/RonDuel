import { DEFAULT_TOWN_ECONOMY, type TownEconomyConfig } from '@ronduel/shared';
import type { Firestore } from 'firebase-admin/firestore';

let cachedConfig: { data: TownEconomyConfig; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute local in-memory cache

export async function getTownEconomyConfig(db: Firestore): Promise<TownEconomyConfig> {
  const now = Date.now();
  if (cachedConfig && now - cachedConfig.fetchedAt < CACHE_TTL_MS) {
    return cachedConfig.data;
  }

  try {
    const snap = await db.collection('config').doc('townEconomy').get();
    if (!snap.exists) {
      cachedConfig = { data: DEFAULT_TOWN_ECONOMY, fetchedAt: now };
      return DEFAULT_TOWN_ECONOMY;
    }
    const data = snap.data() as Partial<TownEconomyConfig>;
    const merged: TownEconomyConfig = {
      ...DEFAULT_TOWN_ECONOMY,
      ...data,
      earnRate: {
        ...DEFAULT_TOWN_ECONOMY.earnRate,
        ...(data.earnRate || {}),
      },
      transfer: {
        ...DEFAULT_TOWN_ECONOMY.transfer,
        ...(data.transfer || {}),
      },
      purchase: {
        ...DEFAULT_TOWN_ECONOMY.purchase,
        ...(data.purchase || {}),
      },
      help: {
        ...DEFAULT_TOWN_ECONOMY.help,
        ...(data.help || {}),
      },
    };
    cachedConfig = { data: merged, fetchedAt: now };
    return merged;
  } catch (err) {
    console.warn('[TownEconomy] Failed to fetch config/townEconomy, using defaults:', err);
    return DEFAULT_TOWN_ECONOMY;
  }
}

export function clearEconomyConfigCache(): void {
  cachedConfig = null;
}

/**
 * Asserts that the town economy (and optional sub-feature) is enabled via the Firestore config kill switch.
 * Throws an Error if disabled.
 */
export async function assertTownFeatureEnabled(
  db: Firestore,
  feature: 'enabled' | 'purchasesEnabled' | 'transfersEnabled' | 'helpEnabled' = 'enabled',
): Promise<TownEconomyConfig> {
  const config = await getTownEconomyConfig(db);
  if (!config.enabled) {
    throw new Error('RonTown is currently disabled by server configuration');
  }
  if (feature !== 'enabled' && !config[feature]) {
    throw new Error(`RonTown feature '${feature}' is currently disabled by server configuration`);
  }
  return config;
}
