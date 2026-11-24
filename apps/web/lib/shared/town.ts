import { z } from 'zod';

export interface TownEconomyConfig {
  enabled: boolean;
  purchasesEnabled: boolean;
  transfersEnabled: boolean;
  helpEnabled: boolean;
  earnRate: {
    pro: number;
    free: number;
  };
  starterCoins: number;
  baseServiceCapacity: number;
  arrivalIntervalSeconds: number;
  levelThresholds: number[];
  levelGates: Record<string, string[]>;
  dailyOrders: {
    free: number;
    pro: number;
  };
  transfer: {
    proSenderOnly: boolean;
    sourceBucket: 'trivia';
    dailyCapSender: number;
    monthlyCapReceiver: number;
    sameLeagueOnly: boolean;
    minAccountAgeDays: number;
  };
  purchase: {
    monthlyCapEUR: number;
    packs: Array<{
      id: string;
      coins: number;
      eur: number;
    }>;
    referenceEurPerCoin: number;
  };
  help: {
    actionsPerFriendPerDay: number;
    waterReducesSeconds: number;
    helperRewardCoins: number;
    helperDailyCap: number;
  };
  removeRefundRate: number;
}

export const DEFAULT_TOWN_ECONOMY: TownEconomyConfig = {
  enabled: false,
  purchasesEnabled: false,
  transfersEnabled: false,
  helpEnabled: false,
  earnRate: {
    pro: 10,
    free: 2,
  },
  starterCoins: 100,
  baseServiceCapacity: 4,
  arrivalIntervalSeconds: 7200,
  levelThresholds: [0, 10, 25, 50, 100, 200],
  levelGates: {
    '2': ['town_hall'],
    '4': ['hospital'],
    '5': ['police_station', 'fire_station'],
  },
  dailyOrders: {
    free: 3,
    pro: 5,
  },
  transfer: {
    proSenderOnly: true,
    sourceBucket: 'trivia',
    dailyCapSender: 50,
    monthlyCapReceiver: 500,
    sameLeagueOnly: true,
    minAccountAgeDays: 7,
  },
  purchase: {
    monthlyCapEUR: 20,
    packs: [
      { id: 'pack_1000', coins: 1000, eur: 1.99 },
      { id: 'pack_2800', coins: 2800, eur: 4.99 },
      { id: 'pack_6000', coins: 6000, eur: 9.99 },
      { id: 'pack_13000', coins: 13000, eur: 19.99 },
    ],
    referenceEurPerCoin: 0.00199,
  },
  help: {
    actionsPerFriendPerDay: 3,
    waterReducesSeconds: 1800,
    helperRewardCoins: 1,
    helperDailyCap: 5,
  },
  removeRefundRate: 0.5,
};

export type CoinBucket = 'trivia' | 'town' | 'purchased' | 'gift';

export interface WalletDoc {
  balance: number;
  buckets: {
    trivia: number;
    town: number;
    purchased: number;
    gift: number;
  };
  monthPurchasedEUR: number;
  monthKey: string;
  locked: boolean;
  updatedAt?: unknown;
}

export type LedgerReason =
  | 'trivia_award'
  | 'starter'
  | 'order'
  | 'spend'
  | 'remove_refund'
  | 'purchase'
  | 'refund'
  | 'transfer_in'
  | 'transfer_out'
  | 'help_reward'
  | 'admin';

export interface LedgerEntry {
  id?: string;
  uid: string;
  delta: number;
  bucket: CoinBucket;
  reason: LedgerReason;
  refId: string;
  idempotencyKey: string;
  balanceAfter: number;
  createdAt?: unknown;
}

export interface TownDoc {
  createdAt?: unknown;
  gridSize: number;
  population: number;
  housingCapacity: number;
  serviceCapacity: number;
  populationCap: number;
  lastArrivalAt?: unknown;
  level: number;
  maxLevelReached: number;
  tutorialStep: number;
  likesCount: number;
  plotsOwned: number;
  updatedAt?: unknown;
}

export interface TownTileDoc {
  id?: string;
  itemId: string;
  x: number;
  y: number;
  placedAt?: unknown;
  plantedAt?: unknown;
  readyAt?: unknown;
  cropId?: string;
  waterCount?: number;
}

export interface TownInventoryDoc {
  crops: Record<string, number>;
}

export interface TownOrderItem {
  id: string;
  templateKey: string;
  items: Record<string, number>;
  rewardCoins: number;
  rewardXp: number;
  done: boolean;
}

export interface TownOrdersDoc {
  unlocked: boolean;
  orders: TownOrderItem[];
}

export interface TownSnapshotDoc {
  uid: string;
  displayName: string;
  level: number;
  population: number;
  likesCount: number;
  leagueIds: string[];
  tiles: Array<{
    itemId: string;
    x: number;
    y: number;
    cropId?: string;
    ready?: boolean;
  }>;
  updatedAt?: unknown;
}

export const WalletDocSchema = z.object({
  balance: z.number().int().min(0),
  buckets: z.object({
    trivia: z.number().int().min(0),
    town: z.number().int().min(0),
    purchased: z.number().int().min(0),
    gift: z.number().int().min(0),
  }),
  monthPurchasedEUR: z.number().min(0),
  monthKey: z.string(),
  locked: z.boolean(),
});

export const LedgerEntrySchema = z.object({
  uid: z.string().min(1),
  delta: z.number().int(),
  bucket: z.enum(['trivia', 'town', 'purchased', 'gift']),
  reason: z.enum([
    'trivia_award',
    'starter',
    'order',
    'spend',
    'remove_refund',
    'purchase',
    'refund',
    'transfer_in',
    'transfer_out',
    'help_reward',
    'admin',
  ]),
  refId: z.string(),
  idempotencyKey: z.string().min(1),
  balanceAfter: z.number().int().min(0),
});

/**
 * Calculates trivia coins to award based on verified daily score and Pro entitlement.
 * Enforces floor(points / 100) * earnRate.
 */
export function calculateTriviaCoins(
  points: number,
  isPro: boolean,
  economy: TownEconomyConfig = DEFAULT_TOWN_ECONOMY,
): number {
  if (points <= 0) return 0;
  const clampedPoints = Math.min(1200, points);
  const blocks = Math.floor(clampedPoints / 100);
  const rate = isPro ? economy.earnRate.pro : economy.earnRate.free;
  return blocks * rate;
}

export type CatalogItemType = 'housing' | 'service' | 'crop' | 'plot' | 'decor' | 'special';

export interface CatalogItem {
  id: string;
  type: CatalogItemType;
  nameKey: string;
  descKey: string;
  priceCoins: number;
  housing?: number;
  supports?: number;
  maxCount?: number;
  unlockLevel: number;
  gateFor?: number;
  proOnly?: boolean;
  streakUnlock?: number;
  footprint: { w: number; h: number };
  spriteKey: string;
  growTimeSeconds?: number;
  yieldCount?: number;
  orderValue?: number;
}

export interface TownCatalogDoc {
  version: number;
  items: Record<string, CatalogItem>;
}

export const DEFAULT_TOWN_CATALOG: TownCatalogDoc = {
  version: 1,
  items: {
    // Housing
    starter_house: {
      id: 'starter_house',
      type: 'housing',
      nameKey: 'town.catalog.starter_house.name',
      descKey: 'town.catalog.starter_house.desc',
      priceCoins: 0,
      housing: 2,
      unlockLevel: 1,
      footprint: { w: 1, h: 1 },
      spriteKey: 'starter_house',
    },
    cottage: {
      id: 'cottage',
      type: 'housing',
      nameKey: 'town.catalog.cottage.name',
      descKey: 'town.catalog.cottage.desc',
      priceCoins: 120,
      housing: 2,
      unlockLevel: 1,
      footprint: { w: 1, h: 1 },
      spriteKey: 'cottage',
    },
    house: {
      id: 'house',
      type: 'housing',
      nameKey: 'town.catalog.house.name',
      descKey: 'town.catalog.house.desc',
      priceCoins: 300,
      housing: 4,
      unlockLevel: 2,
      footprint: { w: 1, h: 1 },
      spriteKey: 'house',
    },
    apartment: {
      id: 'apartment',
      type: 'housing',
      nameKey: 'town.catalog.apartment.name',
      descKey: 'town.catalog.apartment.desc',
      priceCoins: 900,
      housing: 10,
      unlockLevel: 3,
      footprint: { w: 2, h: 2 },
      spriteKey: 'apartment',
    },
    villa: {
      id: 'villa',
      type: 'housing',
      nameKey: 'town.catalog.villa.name',
      descKey: 'town.catalog.villa.desc',
      priceCoins: 1500,
      housing: 6,
      unlockLevel: 4,
      footprint: { w: 2, h: 2 },
      spriteKey: 'villa',
    },

    // Services
    shop: {
      id: 'shop',
      type: 'service',
      nameKey: 'town.catalog.shop.name',
      descKey: 'town.catalog.shop.desc',
      priceCoins: 200,
      supports: 6,
      unlockLevel: 1,
      footprint: { w: 1, h: 1 },
      spriteKey: 'shop',
    },
    town_hall: {
      id: 'town_hall',
      type: 'service',
      nameKey: 'town.catalog.town_hall.name',
      descKey: 'town.catalog.town_hall.desc',
      priceCoins: 400,
      supports: 8,
      maxCount: 1,
      unlockLevel: 1,
      gateFor: 2,
      footprint: { w: 2, h: 2 },
      spriteKey: 'town_hall',
    },
    park: {
      id: 'park',
      type: 'service',
      nameKey: 'town.catalog.park.name',
      descKey: 'town.catalog.park.desc',
      priceCoins: 250,
      supports: 4,
      unlockLevel: 2,
      footprint: { w: 1, h: 1 },
      spriteKey: 'park',
    },
    bakery: {
      id: 'bakery',
      type: 'service',
      nameKey: 'town.catalog.bakery.name',
      descKey: 'town.catalog.bakery.desc',
      priceCoins: 350,
      supports: 6,
      unlockLevel: 2,
      footprint: { w: 1, h: 1 },
      spriteKey: 'bakery',
    },
    school: {
      id: 'school',
      type: 'service',
      nameKey: 'town.catalog.school.name',
      descKey: 'town.catalog.school.desc',
      priceCoins: 600,
      supports: 10,
      unlockLevel: 2,
      footprint: { w: 2, h: 2 },
      spriteKey: 'school',
    },
    police_station: {
      id: 'police_station',
      type: 'service',
      nameKey: 'town.catalog.police_station.name',
      descKey: 'town.catalog.police_station.desc',
      priceCoins: 700,
      supports: 10,
      unlockLevel: 3,
      footprint: { w: 1, h: 1 },
      spriteKey: 'police_station',
    },
    fire_station: {
      id: 'fire_station',
      type: 'service',
      nameKey: 'town.catalog.fire_station.name',
      descKey: 'town.catalog.fire_station.desc',
      priceCoins: 700,
      supports: 10,
      unlockLevel: 3,
      footprint: { w: 1, h: 1 },
      spriteKey: 'fire_station',
    },
    hospital: {
      id: 'hospital',
      type: 'service',
      nameKey: 'town.catalog.hospital.name',
      descKey: 'town.catalog.hospital.desc',
      priceCoins: 900,
      supports: 12,
      unlockLevel: 3,
      gateFor: 4,
      footprint: { w: 2, h: 2 },
      spriteKey: 'hospital',
    },

    // Farm Plots
    plot: {
      id: 'plot',
      type: 'plot',
      nameKey: 'town.catalog.farm_plot.name',
      descKey: 'town.catalog.farm_plot.desc',
      priceCoins: 50,
      unlockLevel: 1,
      footprint: { w: 1, h: 1 },
      spriteKey: 'plot',
    },

    // Crops
    oats: {
      id: 'oats',
      type: 'crop',
      nameKey: 'town.crops.oats.name',
      descKey: 'town.crops.oats.desc',
      priceCoins: 2,
      growTimeSeconds: 14400,
      yieldCount: 2,
      orderValue: 5,
      unlockLevel: 1,
      footprint: { w: 1, h: 1 },
      spriteKey: 'oats',
    },
    wheat: {
      id: 'wheat',
      type: 'crop',
      nameKey: 'town.crops.wheat.name',
      descKey: 'town.crops.wheat.desc',
      priceCoins: 4,
      growTimeSeconds: 28800,
      yieldCount: 2,
      orderValue: 10,
      unlockLevel: 1,
      footprint: { w: 1, h: 1 },
      spriteKey: 'wheat',
    },
    carrots: {
      id: 'carrots',
      type: 'crop',
      nameKey: 'town.crops.carrots.name',
      descKey: 'town.crops.carrots.desc',
      priceCoins: 6,
      growTimeSeconds: 43200,
      yieldCount: 2,
      orderValue: 15,
      unlockLevel: 2,
      footprint: { w: 1, h: 1 },
      spriteKey: 'carrots',
    },
    sunflower: {
      id: 'sunflower',
      type: 'crop',
      nameKey: 'town.crops.sunflower.name',
      descKey: 'town.crops.sunflower.desc',
      priceCoins: 10,
      growTimeSeconds: 86400,
      yieldCount: 2,
      orderValue: 25,
      unlockLevel: 3,
      footprint: { w: 1, h: 1 },
      spriteKey: 'sunflower',
    },
    pumpkin: {
      id: 'pumpkin',
      type: 'crop',
      nameKey: 'town.crops.pumpkin.name',
      descKey: 'town.crops.pumpkin.desc',
      priceCoins: 20,
      growTimeSeconds: 172800,
      yieldCount: 2,
      orderValue: 50,
      unlockLevel: 4,
      footprint: { w: 1, h: 1 },
      spriteKey: 'pumpkin',
    },

    // Decorations
    road: {
      id: 'road',
      type: 'decor',
      nameKey: 'town.catalog.road.name',
      descKey: 'town.catalog.road.desc',
      priceCoins: 10,
      unlockLevel: 1,
      footprint: { w: 1, h: 1 },
      spriteKey: 'road',
    },
    fence: {
      id: 'fence',
      type: 'decor',
      nameKey: 'town.catalog.fence.name',
      descKey: 'town.catalog.fence.desc',
      priceCoins: 15,
      unlockLevel: 1,
      footprint: { w: 1, h: 1 },
      spriteKey: 'fence',
    },
    tree: {
      id: 'tree',
      type: 'decor',
      nameKey: 'town.catalog.tree.name',
      descKey: 'town.catalog.tree.desc',
      priceCoins: 30,
      unlockLevel: 1,
      footprint: { w: 1, h: 1 },
      spriteKey: 'tree',
    },
    bench: {
      id: 'bench',
      type: 'decor',
      nameKey: 'town.catalog.bench.name',
      descKey: 'town.catalog.bench.desc',
      priceCoins: 40,
      unlockLevel: 1,
      footprint: { w: 1, h: 1 },
      spriteKey: 'bench',
    },
    fountain: {
      id: 'fountain',
      type: 'decor',
      nameKey: 'town.catalog.fountain.name',
      descKey: 'town.catalog.fountain.desc',
      priceCoins: 150,
      unlockLevel: 2,
      footprint: { w: 1, h: 1 },
      spriteKey: 'fountain',
    },
    golden_fountain: {
      id: 'golden_fountain',
      type: 'decor',
      nameKey: 'town.catalog.golden_fountain.name',
      descKey: 'town.catalog.golden_fountain.desc',
      priceCoins: 500,
      proOnly: true,
      unlockLevel: 2,
      footprint: { w: 1, h: 1 },
      spriteKey: 'golden_fountain',
    },
    windmill: {
      id: 'windmill',
      type: 'decor',
      nameKey: 'town.catalog.windmill.name',
      descKey: 'town.catalog.windmill.desc',
      priceCoins: 600,
      streakUnlock: 7,
      unlockLevel: 1,
      footprint: { w: 1, h: 1 },
      spriteKey: 'windmill',
    },
    clock_tower: {
      id: 'clock_tower',
      type: 'decor',
      nameKey: 'town.catalog.clock_tower.name',
      descKey: 'town.catalog.clock_tower.desc',
      priceCoins: 1200,
      streakUnlock: 30,
      unlockLevel: 1,
      footprint: { w: 1, h: 1 },
      spriteKey: 'clock_tower',
    },
    ronduel_statue: {
      id: 'ronduel_statue',
      type: 'decor',
      nameKey: 'town.catalog.ronduel_statue.name',
      descKey: 'town.catalog.ronduel_statue.desc',
      priceCoins: 3000,
      streakUnlock: 100,
      unlockLevel: 1,
      footprint: { w: 1, h: 1 },
      spriteKey: 'ronduel_statue',
    },
  },
};

/** Escalating farm plot price formula (plots 1-2 free at start, plots 3..12 escalate) */
export function getPlotPrice(currentPlotsOwned: number): number {
  if (currentPlotsOwned < 2) return 0;
  if (currentPlotsOwned === 2) return 50;
  if (currentPlotsOwned === 3) return 100;
  if (currentPlotsOwned === 4) return 200;
  if (currentPlotsOwned === 5) return 400;
  return 600;
}

/** Determines town level based on villager count */
export function calculateTownLevel(population: number): number {
  if (population >= 200) return 6;
  if (population >= 100) return 5;
  if (population >= 50) return 4;
  if (population >= 25) return 3;
  if (population >= 10) return 2;
  return 1;
}

/** Determines map grid size based on level */
export function getGridSizeForLevel(level: number): number {
  if (level >= 5) return 12;
  if (level >= 3) return 10;
  return 8;
}

/**
 * Calculates housingCapacity, serviceCapacity, and effective populationCap
 * considering building requirements and gates:
 * - Town Hall required for Lv2 (cap at 9 if missing)
 * - Hospital required for Lv4 (cap at 49 if missing)
 * - Police Station + Fire Station required for Lv5 (cap at 99 if missing)
 */
export function calculateTownCapacities(
  tiles: Array<{ itemId: string }>,
  catalog: TownCatalogDoc = DEFAULT_TOWN_CATALOG,
  baseServiceCapacity = 4,
): {
  housingCapacity: number;
  serviceCapacity: number;
  populationCap: number;
  hasTownHall: boolean;
  hasHospital: boolean;
  hasPolice: boolean;
  hasFireStation: boolean;
} {
  let housingCapacity = 0;
  let serviceCapacity = baseServiceCapacity;
  let hasTownHall = false;
  let hasHospital = false;
  let hasPolice = false;
  let hasFireStation = false;

  for (const t of tiles) {
    const item = catalog.items[t.itemId];
    if (!item) continue;
    if (item.housing) housingCapacity += item.housing;
    if (item.supports) serviceCapacity += item.supports;
    if (t.itemId === 'town_hall') hasTownHall = true;
    if (t.itemId === 'hospital') hasHospital = true;
    if (t.itemId === 'police_station') hasPolice = true;
    if (t.itemId === 'fire_station') hasFireStation = true;
  }

  let cap = Math.min(housingCapacity, serviceCapacity);

  // Apply milestone gates
  if (!hasTownHall && cap > 9) {
    cap = 9;
  }
  if (!hasHospital && cap > 49) {
    cap = 49;
  }
  if ((!hasPolice || !hasFireStation) && cap > 99) {
    cap = 99;
  }

  return {
    housingCapacity,
    serviceCapacity,
    populationCap: cap,
    hasTownHall,
    hasHospital,
    hasPolice,
    hasFireStation,
  };
}

/**
 * Calculates lazy villager arrivals based on server timestamps.
 */
export function calculateLazyArrivals(params: {
  population: number;
  populationCap: number;
  lastArrivalSeconds: number;
  nowSeconds: number;
  arrivalIntervalSeconds?: number;
}): {
  newPopulation: number;
  arrivals: number;
  newLastArrivalSeconds: number;
} {
  const {
    population,
    populationCap,
    lastArrivalSeconds,
    nowSeconds,
    arrivalIntervalSeconds = 7200,
  } = params;

  if (population >= populationCap) {
    return {
      newPopulation: Math.min(population, populationCap),
      arrivals: 0,
      newLastArrivalSeconds: nowSeconds,
    };
  }

  const elapsed = Math.max(0, nowSeconds - lastArrivalSeconds);
  const rawArrivals = Math.floor(elapsed / arrivalIntervalSeconds);
  const possibleArrivals = Math.max(0, populationCap - population);
  const arrivals = Math.min(rawArrivals, possibleArrivals);

  const newPopulation = population + arrivals;
  const newLastArrivalSeconds =
    arrivals > 0 ? lastArrivalSeconds + arrivals * arrivalIntervalSeconds : lastArrivalSeconds;

  return {
    newPopulation,
    arrivals,
    newLastArrivalSeconds,
  };
}
