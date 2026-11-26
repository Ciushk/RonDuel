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

export const GROUND_TILE_TYPES = [
  'basic-block',
  'basic-block-flowers',
  'basic-block-flowers-two',
  'basic-block-dirt',
  'basic-block-street',
  'basic-block-street-curve',
  'basic-block-intersection',
  'basic-block-wather',
  'basic-block-wather-two',
  'basic-block-wather-grass-50-50',
  'basic-block-water-grass-20-80',
  'basic-block-water-grass-80-20',
] as const;

export type GroundTileType = (typeof GROUND_TILE_TYPES)[number];

/**
 * Placeholder configurable prices (in RonCoins) for buying land expansion tiles.
 * Adjust here once final land economy pricing is locked.
 */
export const LAND_PRICES: Record<GroundTileType, number> = {
  'basic-block': 20,
  'basic-block-flowers': 25,
  'basic-block-flowers-two': 25,
  'basic-block-dirt': 20,
  'basic-block-street': 30,
  'basic-block-street-curve': 30,
  'basic-block-intersection': 35,
  'basic-block-wather': 40,
  'basic-block-wather-two': 40,
  'basic-block-wather-grass-50-50': 35,
  'basic-block-water-grass-20-80': 35,
  'basic-block-water-grass-80-20': 35,
};

export const WALKABLE_GROUND_TYPES: ReadonlySet<GroundTileType> = new Set<GroundTileType>([
  'basic-block',
  'basic-block-flowers',
  'basic-block-flowers-two',
  'basic-block-dirt',
  'basic-block-street',
  'basic-block-street-curve',
  'basic-block-intersection',
]);

export const PLANTABLE_GROUND_TYPES: ReadonlySet<GroundTileType> = new Set<GroundTileType>([
  'basic-block',
  'basic-block-flowers',
  'basic-block-flowers-two',
  'basic-block-dirt',
]);

export function isGroundTileType(value: string): value is GroundTileType {
  return (GROUND_TILE_TYPES as readonly string[]).includes(value);
}

export function isGroundWalkable(ground: GroundTileType | undefined): boolean {
  return ground !== undefined && WALKABLE_GROUND_TYPES.has(ground);
}

export function isGroundPlantable(ground: GroundTileType | undefined): boolean {
  return ground !== undefined && PLANTABLE_GROUND_TYPES.has(ground);
}

export type RotationKind = 'none' | 'flip2' | 'rot4';

export const ROTATION_RULES: {
  ground: Record<GroundTileType, RotationKind>;
  item: Record<string, RotationKind>;
} = {
  ground: {
    'basic-block': 'none',
    'basic-block-flowers': 'none',
    'basic-block-flowers-two': 'none',
    'basic-block-dirt': 'none',
    'basic-block-street': 'flip2',
    'basic-block-street-curve': 'rot4',
    'basic-block-intersection': 'none',
    'basic-block-wather': 'none',
    'basic-block-wather-two': 'none',
    'basic-block-wather-grass-50-50': 'rot4',
    'basic-block-water-grass-20-80': 'rot4',
    'basic-block-water-grass-80-20': 'rot4',
  },
  item: {
    starter_house: 'flip2',
    cottage: 'flip2',
    house: 'flip2',
    apartment: 'flip2',
    villa: 'flip2',
    shop: 'flip2',
    town_hall: 'flip2',
    park: 'flip2',
    bakery: 'flip2',
    school: 'flip2',
    police_station: 'flip2',
    fire_station: 'flip2',
    hospital: 'flip2',
    road: 'flip2',
    fence: 'flip2',
    tree: 'flip2',
    lantern: 'flip2',
    bench: 'flip2',
    fountain: 'flip2',
    golden_fountain: 'flip2',
    windmill: 'flip2',
    clock_tower: 'flip2',
    ronduel_statue: 'flip2',
    plot: 'none',
    oats: 'none',
    wheat: 'none',
    cabbage: 'none',
    carrots: 'none',
    sunflower: 'none',
    pumpkin: 'none',
  },
};

export function getRotationKind(layer: 'ground' | 'item', id: string): RotationKind {
  if (!id) return 'none';
  if (layer === 'ground') {
    return (ROTATION_RULES.ground as Record<string, RotationKind>)[id] ?? 'none';
  }
  if (id.startsWith('part:')) return 'none';
  const explicit = ROTATION_RULES.item[id];
  if (explicit) return explicit;
  const item = DEFAULT_TOWN_CATALOG.items[id];
  if (!item) return 'none';
  if (item.type === 'plot' || item.type === 'crop') return 'none';
  return item.footprint.w === item.footprint.h ? 'flip2' : 'none';
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
  /** Owned isometric ground cells keyed by `${x}_${y}`. */
  land?: Record<string, GroundTileType>;
  /** Non-zero ground tile rotations keyed by `${x}_${y}` (missing = 0). */
  landRot?: Record<string, 1 | 2 | 3>;
  updatedAt?: unknown;
}

export interface TownTileDoc {
  id?: string;
  itemId: string;
  x: number;
  y: number;
  rot?: 0 | 1 | 2 | 3;
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
    rot?: 0 | 1 | 2 | 3;
    cropId?: string;
    ready?: boolean;
  }>;
  land?: Record<string, GroundTileType>;
  landRot?: Record<string, 1 | 2 | 3>;
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
    cabbage: {
      id: 'cabbage',
      type: 'crop',
      nameKey: 'town.crops.cabbage.name',
      descKey: 'town.crops.cabbage.desc',
      priceCoins: 5,
      growTimeSeconds: 21600,
      yieldCount: 2,
      orderValue: 12,
      unlockLevel: 1,
      footprint: { w: 1, h: 1 },
      spriteKey: 'cabbage',
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
    lantern: {
      id: 'lantern',
      type: 'decor',
      nameKey: 'town.catalog.lantern.name',
      descKey: 'town.catalog.lantern.desc',
      priceCoins: 25,
      unlockLevel: 1,
      footprint: { w: 1, h: 1 },
      spriteKey: 'lantern',
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

export interface GridCoord {
  x: number;
  y: number;
}

const CARDINAL_DIRS: readonly GridCoord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/**
 * Generates 5–8 random, 4-neighbour edge-connected grass tiles covering all seed tiles.
 * Ensures every starting building/plot sits on owned land.
 */
export function generateStarterLand(
  seedTiles: GridCoord[] = [
    { x: 3, y: 3 },
    { x: 3, y: 4 },
    { x: 4, y: 4 },
  ],
  gridSize = 8,
  targetCount?: number,
  rng: () => number = Math.random,
): Record<string, GroundTileType> {
  const land: Record<string, GroundTileType> = {};
  const clampedTarget =
    targetCount !== undefined
      ? Math.max(seedTiles.length, Math.min(gridSize * gridSize, targetCount))
      : Math.max(seedTiles.length, 5 + Math.floor(rng() * 4)); // 5..8 tiles

  const validSeeds = seedTiles.filter(
    (c) => c.x >= 0 && c.y >= 0 && c.x < gridSize && c.y < gridSize,
  );
  if (validSeeds.length === 0) {
    const center = Math.floor(gridSize / 2);
    validSeeds.push({ x: center, y: center });
  }

  for (const seed of validSeeds) {
    land[`${seed.x}_${seed.y}`] = 'basic-block';
  }

  // Ensure all seeds are connected in one 4-neighbour component via simple L-path bridges
  for (let i = 1; i < validSeeds.length; i++) {
    let cx = validSeeds[i - 1]!.x;
    let cy = validSeeds[i - 1]!.y;
    const tx = validSeeds[i]!.x;
    const ty = validSeeds[i]!.y;
    while (cx !== tx) {
      cx += cx < tx ? 1 : -1;
      land[`${cx}_${cy}`] = 'basic-block';
    }
    while (cy !== ty) {
      cy += cy < ty ? 1 : -1;
      land[`${cx}_${cy}`] = 'basic-block';
    }
  }

  // Expand by adding random 4-neighbours until we reach clampedTarget
  while (Object.keys(land).length < clampedTarget) {
    const frontier = computeExpandRing(land, gridSize);
    if (frontier.length === 0) break;
    const pick = frontier[Math.floor(rng() * frontier.length)]!;
    land[`${pick.x}_${pick.y}`] = 'basic-block';
  }

  return land;
}

/**
 * Computes every empty 4-neighbour cell adjacent to owned land within [0, gridSize).
 */
export function computeExpandRing(
  land: Record<string, GroundTileType>,
  gridSize: number,
): GridCoord[] {
  const seen = new Set<string>();
  const ring: GridCoord[] = [];

  for (const key of Object.keys(land)) {
    const [xs, ys] = key.split('_');
    const x = Number(xs);
    const y = Number(ys);
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;

    for (const dir of CARDINAL_DIRS) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      if (nx < 0 || ny < 0 || nx >= gridSize || ny >= gridSize) continue;
      const nKey = `${nx}_${ny}`;
      if (land[nKey] || seen.has(nKey)) continue;
      seen.add(nKey);
      ring.push({ x: nx, y: ny });
    }
  }

  ring.sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x || a.y - b.y);
  return ring;
}

/**
 * Checks whether (x, y) is an unowned cell 4-adjacent to at least one owned cell.
 */
export function isCellInExpandRing(
  land: Record<string, GroundTileType>,
  gridSize: number,
  x: number,
  y: number,
): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (x < 0 || y < 0 || x >= gridSize || y >= gridSize) return false;
  if (land[`${x}_${y}`]) return false;

  for (const dir of CARDINAL_DIRS) {
    if (land[`${x + dir.x}_${y + dir.y}`]) {
      return true;
    }
  }
  return false;
}

/**
 * Breadth-first search pathfinder on owned walkable ground tiles, avoiding blocked cells
 * (water, shores, buildings, decor). Returns the path including start and goal, or null if unreachable.
 */
export function findWalkablePath(params: {
  start: GridCoord;
  goal: GridCoord;
  land: Record<string, GroundTileType>;
  blockedKeys: ReadonlySet<string>;
  allowGoalBlocked?: boolean;
}): GridCoord[] | null {
  const { start, goal, land, blockedKeys, allowGoalBlocked = false } = params;
  const startKey = `${start.x}_${start.y}`;
  const goalKey = `${goal.x}_${goal.y}`;

  if (startKey === goalKey) return [{ ...start }];

  const goalGround = land[goalKey];
  if (!isGroundWalkable(goalGround)) return null;
  if (!allowGoalBlocked && blockedKeys.has(goalKey)) return null;

  const visited = new Set<string>([startKey]);
  const parent = new Map<string, string>();
  const coords = new Map<string, GridCoord>([[startKey, { ...start }]]);
  const queue: GridCoord[] = [{ ...start }];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currKey = `${curr.x}_${curr.y}`;

    for (const dir of CARDINAL_DIRS) {
      const nx = curr.x + dir.x;
      const ny = curr.y + dir.y;
      const nKey = `${nx}_${ny}`;
      if (visited.has(nKey)) continue;

      const ground = land[nKey];
      if (!isGroundWalkable(ground)) continue;

      const isGoal = nKey === goalKey;
      if (!isGoal && blockedKeys.has(nKey)) continue;

      visited.add(nKey);
      parent.set(nKey, currKey);
      coords.set(nKey, { x: nx, y: ny });

      if (isGoal) {
        const path: GridCoord[] = [];
        let trace: string | undefined = goalKey;
        while (trace) {
          path.push(coords.get(trace)!);
          trace = parent.get(trace);
        }
        path.reverse();
        return path;
      }

      queue.push({ x: nx, y: ny });
    }
  }

  return null;
}
