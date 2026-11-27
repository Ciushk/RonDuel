import { describe, expect, it } from 'vitest';
import {
  calculateLazyArrivals,
  calculateSpeedupCost,
  calculateTownCapacities,
  calculateTownLevel,
  calculateTriviaCoins,
  computeExpandRing,
  DEFAULT_TOWN_CATALOG,
  DEFAULT_TOWN_ECONOMY,
  findWalkablePath,
  generateStarterLand,
  getFamilyEventTriggerAt,
  getGridSizeForLevel,
  getPlotPrice,
  getPreviousPlotPrice,
  GROUND_TILE_TYPES,
  isCellInExpandRing,
  isGroundPlantable,
  isGroundWalkable,
  isRonCoinPriceCutActive,
  LAND_PRICES,
  LedgerEntrySchema,
  niceHalfCoins,
  PREVIOUS_RONCOIN_PRICES,
  RONCOIN_PRICE_CUT_DURATION_MS,
  RONCOIN_PRICE_CUT_STARTED_AT_MS,
  SPEEDUP_COST,
  WalletDocSchema,
  type GroundTileType,
} from './town.js';

describe('calculateTriviaCoins', () => {
  it('awards 0 coins for 0 or negative points', () => {
    expect(calculateTriviaCoins(0, false)).toBe(0);
    expect(calculateTriviaCoins(0, true)).toBe(0);
    expect(calculateTriviaCoins(-50, false)).toBe(0);
  });

  it('awards floor(points/100) * 2 for free players', () => {
    expect(calculateTriviaCoins(99, false)).toBe(0);
    expect(calculateTriviaCoins(100, false)).toBe(2);
    expect(calculateTriviaCoins(199, false)).toBe(2);
    expect(calculateTriviaCoins(200, false)).toBe(4);
    expect(calculateTriviaCoins(650, false)).toBe(12);
    expect(calculateTriviaCoins(1200, false)).toBe(24);
    // Clamped at 1200 max/day
    expect(calculateTriviaCoins(1300, false)).toBe(24);
  });

  it('awards floor(points/100) * 10 for Pro players', () => {
    expect(calculateTriviaCoins(99, true)).toBe(0);
    expect(calculateTriviaCoins(100, true)).toBe(10);
    expect(calculateTriviaCoins(199, true)).toBe(10);
    expect(calculateTriviaCoins(250, true)).toBe(20);
    expect(calculateTriviaCoins(600, true)).toBe(60);
    expect(calculateTriviaCoins(1200, true)).toBe(120);
    // Clamped at 1200 max/day
    expect(calculateTriviaCoins(1500, true)).toBe(120);
  });

  it('respects custom economy config earn rates', () => {
    const customConfig = {
      ...DEFAULT_TOWN_ECONOMY,
      earnRate: { pro: 20, free: 5 },
    };
    expect(calculateTriviaCoins(350, false, customConfig)).toBe(15);
    expect(calculateTriviaCoins(350, true, customConfig)).toBe(60);
  });
});

describe('WalletDocSchema and LedgerEntrySchema', () => {
  it('validates valid wallet document', () => {
    const wallet = {
      balance: 100,
      buckets: { trivia: 50, town: 50, purchased: 0, gift: 0 },
      monthPurchasedEUR: 0,
      monthKey: '2026-11',
      locked: false,
    };
    expect(WalletDocSchema.parse(wallet)).toEqual(wallet);
  });

  it('rejects negative balances or invalid buckets', () => {
    expect(() =>
      WalletDocSchema.parse({
        balance: -1,
        buckets: { trivia: 0, town: 0, purchased: 0, gift: 0 },
        monthPurchasedEUR: 0,
        monthKey: '2026-11',
        locked: false,
      }),
    ).toThrow();
  });

  it('validates ledger entry schema', () => {
    const entry = {
      uid: 'user_123',
      delta: 20,
      bucket: 'trivia' as const,
      reason: 'trivia_award' as const,
      refId: 'round_42',
      idempotencyKey: 'trivia:user_123:round_42',
      balanceAfter: 120,
    };
    expect(LedgerEntrySchema.parse(entry)).toEqual(entry);
  });
});

describe('DEFAULT_TOWN_CATALOG', () => {
  it('contains all required buildings, services, plots, crops and decor', () => {
    const items = DEFAULT_TOWN_CATALOG.items;
    expect(items.starter_house).toBeDefined();
    expect(items.cottage).toBeDefined();
    expect(items.house).toBeDefined();
    expect(items.apartment).toBeDefined();
    expect(items.villa).toBeDefined();
    expect(items.shop).toBeDefined();
    expect(items.town_hall).toBeDefined();
    expect(items.hospital).toBeDefined();
    expect(items.police_station).toBeDefined();
    expect(items.fire_station).toBeDefined();
    expect(items.plot).toBeDefined();
    expect(items.oats).toBeDefined();
    expect(items.wheat).toBeDefined();
    expect(items.carrots).toBeDefined();
    expect(items.sunflower).toBeDefined();
    expect(items.pumpkin).toBeDefined();
    expect(items.road).toBeDefined();
    expect(items.golden_fountain?.proOnly).toBe(true);
    expect(items.windmill?.streakUnlock).toBe(7);
  });
});

describe('calculateTownCapacities and milestone gates', () => {
  it('computes starter town with 1 starter house and base service capacity', () => {
    const caps = calculateTownCapacities([{ itemId: 'starter_house' }]);
    expect(caps.housingCapacity).toBe(2);
    expect(caps.serviceCapacity).toBe(4);
    expect(caps.populationCap).toBe(2);
  });

  it('caps population at 9 if Town Hall is missing when reaching Lv2', () => {
    // 5 houses (housing 20) + 3 shops (supports 18 + 4 = 22) -> without town hall: cap = 9
    const tiles = [
      { itemId: 'house' },
      { itemId: 'house' },
      { itemId: 'house' },
      { itemId: 'house' },
      { itemId: 'house' },
      { itemId: 'shop' },
      { itemId: 'shop' },
      { itemId: 'shop' },
    ];
    const capsWithoutHall = calculateTownCapacities(tiles);
    expect(capsWithoutHall.housingCapacity).toBe(20);
    expect(capsWithoutHall.populationCap).toBe(9);

    // Adding town hall lifts the gate!
    const capsWithHall = calculateTownCapacities([...tiles, { itemId: 'town_hall' }]);
    expect(capsWithHall.populationCap).toBe(20);
  });

  it('caps population at 49 if Hospital is missing when reaching Lv4', () => {
    const tiles = [
      { itemId: 'town_hall' },
      ...Array(6).fill({ itemId: 'apartment' }), // 60 housing
      ...Array(6).fill({ itemId: 'school' }), // 60 + 4 + 8 = 72 service
    ];
    const capsWithoutHospital = calculateTownCapacities(tiles);
    expect(capsWithoutHospital.populationCap).toBe(49);

    const capsWithHospital = calculateTownCapacities([...tiles, { itemId: 'hospital' }]);
    expect(capsWithHospital.populationCap).toBe(60);
  });

  it('caps population at 99 if Police or Fire Station is missing when reaching Lv5', () => {
    const tiles = [
      { itemId: 'town_hall' },
      { itemId: 'hospital' },
      ...Array(12).fill({ itemId: 'apartment' }), // 120 housing
      ...Array(10).fill({ itemId: 'school' }), // 100 + 4 + 8 + 12 = 124 service
    ];
    const capsMissingPolice = calculateTownCapacities([...tiles, { itemId: 'fire_station' }]);
    expect(capsMissingPolice.populationCap).toBe(99);

    const capsComplete = calculateTownCapacities([
      ...tiles,
      { itemId: 'fire_station' },
      { itemId: 'police_station' },
    ]);
    expect(capsComplete.populationCap).toBe(120);
  });
});

describe('calculateLazyArrivals', () => {
  it('awards no arrivals when less than 1 interval (7200s) has passed', () => {
    const res = calculateLazyArrivals({
      population: 2,
      populationCap: 10,
      lastArrivalSeconds: 1000,
      nowSeconds: 1000 + 3600, // 1h passed
    });
    expect(res.arrivals).toBe(0);
    expect(res.newPopulation).toBe(2);
  });

  it('awards 1 villager per 7200s interval and updates timestamp', () => {
    const res = calculateLazyArrivals({
      population: 2,
      populationCap: 10,
      lastArrivalSeconds: 1000,
      nowSeconds: 1000 + 15000, // ~4.16 hours -> 2 full intervals
    });
    expect(res.arrivals).toBe(2);
    expect(res.newPopulation).toBe(4);
    expect(res.newLastArrivalSeconds).toBe(1000 + 2 * 7200);
  });

  it('clamps arrivals strictly at populationCap', () => {
    const res = calculateLazyArrivals({
      population: 8,
      populationCap: 9,
      lastArrivalSeconds: 1000,
      nowSeconds: 1000 + 50000, // many intervals
    });
    expect(res.arrivals).toBe(1);
    expect(res.newPopulation).toBe(9);
  });

  it('immediately reduces population if cap drops below population', () => {
    const res = calculateLazyArrivals({
      population: 15,
      populationCap: 10, // building removed
      lastArrivalSeconds: 1000,
      nowSeconds: 2000,
    });
    expect(res.arrivals).toBe(0);
    expect(res.newPopulation).toBe(10);
  });
});

describe('calculateTownLevel and getGridSizeForLevel', () => {
  it('determines correct levels and grid sizes', () => {
    expect(calculateTownLevel(2)).toBe(1);
    expect(calculateTownLevel(9)).toBe(1);
    expect(getGridSizeForLevel(1)).toBe(8);

    expect(calculateTownLevel(10)).toBe(2);
    expect(calculateTownLevel(24)).toBe(2);
    expect(getGridSizeForLevel(2)).toBe(8);

    expect(calculateTownLevel(25)).toBe(3);
    expect(getGridSizeForLevel(3)).toBe(10);

    expect(calculateTownLevel(50)).toBe(4);
    expect(getGridSizeForLevel(4)).toBe(10);

    expect(calculateTownLevel(100)).toBe(5);
    expect(getGridSizeForLevel(5)).toBe(12);

    expect(calculateTownLevel(200)).toBe(6);
    expect(getGridSizeForLevel(6)).toBe(12);
  });

  it('calculates escalating plot prices', () => {
    expect(getPlotPrice(0)).toBe(0);
    expect(getPlotPrice(1)).toBe(0);
    expect(getPlotPrice(2)).toBe(25);
    expect(getPlotPrice(3)).toBe(50);
    expect(getPlotPrice(4)).toBe(100);
    expect(getPlotPrice(5)).toBe(200);
    expect(getPlotPrice(6)).toBe(300);
    expect(getPlotPrice(11)).toBe(300);
  });
});

describe('RonTown ground types, starter land, expand ring, and BFS pathfinding', () => {
  it('defines prices for all 12 ground types and classifies walkability/plantability', () => {
    expect(GROUND_TILE_TYPES).toHaveLength(12);
    for (const gt of GROUND_TILE_TYPES) {
      expect(LAND_PRICES[gt]).toBeGreaterThan(0);
    }
    expect(isGroundWalkable('basic-block')).toBe(true);
    expect(isGroundWalkable('basic-block-street')).toBe(true);
    expect(isGroundWalkable('basic-block-wather')).toBe(false);
    expect(isGroundWalkable('basic-block-wather-grass-50-50')).toBe(false);

    expect(isGroundPlantable('basic-block')).toBe(true);
    expect(isGroundPlantable('basic-block-dirt')).toBe(true);
    expect(isGroundPlantable('basic-block-street')).toBe(false);
    expect(isGroundPlantable('basic-block-wather')).toBe(false);

    expect(DEFAULT_TOWN_CATALOG.items.cabbage).toBeDefined();
    expect(DEFAULT_TOWN_CATALOG.items.cabbage?.type).toBe('crop');
    expect(DEFAULT_TOWN_CATALOG.items.lantern).toBeDefined();
    expect(DEFAULT_TOWN_CATALOG.items.lantern?.type).toBe('decor');
  });

  it('generates 5-8 edge-connected starter grass tiles covering starter house and plots', () => {
    const seeds = [
      { x: 3, y: 3 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ];
    let step = 0;
    const deterministicRng = () => {
      step = (step + 1) % 7;
      return step / 7;
    };
    const land = generateStarterLand(seeds, 8, undefined, deterministicRng);
    const keys = Object.keys(land);
    expect(keys.length).toBeGreaterThanOrEqual(5);
    expect(keys.length).toBeLessThanOrEqual(8);
    expect(land['3_3']).toBe('basic-block');
    expect(land['3_4']).toBe('basic-block');
    expect(land['4_4']).toBe('basic-block');

    // Verify single 4-connected component
    const visited = new Set<string>(['3_3']);
    const queue = [{ x: 3, y: 3 }];
    while (queue.length > 0) {
      const c = queue.shift()!;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nk = `${c.x + dx}_${c.y + dy}`;
        if (land[nk] && !visited.has(nk)) {
          visited.add(nk);
          queue.push({ x: c.x + dx, y: c.y + dy });
        }
      }
    }
    expect(visited.size).toBe(keys.length);
  });

  it('computes expand ring as all empty 4-neighbours within grid bounds', () => {
    const land: Record<string, GroundTileType> = {
      '0_0': 'basic-block',
      '1_0': 'basic-block',
    };
    const ring = computeExpandRing(land, 8);
    expect(ring).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 0 },
    ]);
    expect(isCellInExpandRing(land, 8, 2, 0)).toBe(true);
    expect(isCellInExpandRing(land, 8, 0, 0)).toBe(false);
    expect(isCellInExpandRing(land, 8, -1, 0)).toBe(false);
    expect(isCellInExpandRing(land, 8, 5, 5)).toBe(false);
  });

  it('finds shortest walkable path avoiding buildings and water', () => {
    const land: Record<string, GroundTileType> = {
      '0_0': 'basic-block',
      '1_0': 'basic-block-wather', // water blocks walking
      '2_0': 'basic-block',
      '0_1': 'basic-block',
      '1_1': 'basic-block',
      '2_1': 'basic-block',
    };
    const path = findWalkablePath({
      start: { x: 0, y: 0 },
      goal: { x: 2, y: 0 },
      land,
      blockedKeys: new Set(),
    });
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
    ]);

    // Blocked by building in the corridor -> unreachable
    const blockedPath = findWalkablePath({
      start: { x: 0, y: 0 },
      goal: { x: 2, y: 0 },
      land,
      blockedKeys: new Set(['1_1']),
    });
    expect(blockedPath).toBeNull();
  });
});

describe('calculateSpeedupCost', () => {
  it('defaults to Option C tier pricing with speedupEnabled=false in DEFAULT_TOWN_ECONOMY', () => {
    expect(DEFAULT_TOWN_ECONOMY.speedupEnabled).toBe(false);
    expect(SPEEDUP_COST.mode).toBe('tier');
    expect(calculateSpeedupCost(3600, 'oats')).toBe(3);
    expect(calculateSpeedupCost(3600, 'cabbage')).toBe(4);
    expect(calculateSpeedupCost(3600, 'wheat')).toBe(4);
    expect(calculateSpeedupCost(3600, 'carrots')).toBe(6);
    expect(calculateSpeedupCost(3600, 'sunflower')).toBe(10);
    expect(calculateSpeedupCost(3600, 'pumpkin')).toBe(15);
    expect(calculateSpeedupCost(0, 'wheat')).toBe(0);
    expect(calculateSpeedupCost(-10, 'wheat')).toBe(0);
    expect(calculateSpeedupCost(600, 'unknown_crop')).toBe(1);
  });

  it('supports perMinutes and perHour pricing modes', () => {
    expect(
      calculateSpeedupCost(3700, 'wheat', {
        ...SPEEDUP_COST,
        mode: 'perMinutes',
        minutesPerCoin: 30,
        min: 1,
      }),
    ).toBe(3); // ceil(3700 / 1800) = 3

    expect(
      calculateSpeedupCost(3700, 'wheat', {
        ...SPEEDUP_COST,
        mode: 'perHour',
        coinsPerHour: 2,
        min: 1,
      }),
    ).toBe(4); // ceil(3700 / 3600) * 2 = 4
  });
});

describe('RonCoin price cut (niceHalfCoins, exact catalog/land/plot/speedup table, 7-day badge window)', () => {
  it('rounds halved RonCoin prices via niceHalfCoins', () => {
    expect(niceHalfCoins(0)).toBe(0);
    expect(niceHalfCoins(-5)).toBe(0);
    expect(niceHalfCoins(2)).toBe(1);
    expect(niceHalfCoins(4)).toBe(2);
    expect(niceHalfCoins(5)).toBe(3);
    expect(niceHalfCoins(6)).toBe(3);
    expect(niceHalfCoins(10)).toBe(5);
    expect(niceHalfCoins(20)).toBe(10);
    expect(niceHalfCoins(25)).toBe(15);
    expect(niceHalfCoins(30)).toBe(15);
    expect(niceHalfCoins(40)).toBe(20);
    expect(niceHalfCoins(50)).toBe(25);
    expect(niceHalfCoins(120)).toBe(60);
    expect(niceHalfCoins(150)).toBe(75);
    expect(niceHalfCoins(200)).toBe(100);
    expect(niceHalfCoins(250)).toBe(130);
    expect(niceHalfCoins(300)).toBe(150);
    expect(niceHalfCoins(350)).toBe(180);
    expect(niceHalfCoins(400)).toBe(200);
    expect(niceHalfCoins(500)).toBe(250);
    expect(niceHalfCoins(600)).toBe(300);
    expect(niceHalfCoins(700)).toBe(350);
    expect(niceHalfCoins(900)).toBe(450);
    expect(niceHalfCoins(1200)).toBe(600);
    expect(niceHalfCoins(1500)).toBe(750);
    expect(niceHalfCoins(3000)).toBe(1500);
  });

  it('matches the exact halved catalog table (version 2) plus literal overrides (road=2, fence=10)', () => {
    expect(DEFAULT_TOWN_CATALOG.version).toBe(2);

    const expectedCatalog: Record<string, number> = {
      starter_house: 0,
      cottage: 60,
      house: 150,
      apartment: 450,
      villa: 750,
      shop: 100,
      town_hall: 200,
      park: 130,
      bakery: 180,
      school: 300,
      police_station: 350,
      fire_station: 350,
      hospital: 450,
      plot: 25,
      oats: 1,
      wheat: 2,
      cabbage: 3,
      carrots: 3,
      sunflower: 5,
      pumpkin: 10,
      road: 2,
      fence: 10,
      lantern: 15,
      tree: 15,
      bench: 20,
      fountain: 75,
      golden_fountain: 250,
      windmill: 300,
      clock_tower: 600,
      ronduel_statue: 1500,
    };

    const literalCatalogOverrides = new Set(['road', 'fence']);
    expect(Object.keys(DEFAULT_TOWN_CATALOG.items).sort()).toEqual(
      Object.keys(expectedCatalog).sort(),
    );

    for (const [id, item] of Object.entries(DEFAULT_TOWN_CATALOG.items)) {
      const expected = expectedCatalog[id]!;
      expect(item.priceCoins, `catalog.${id}`).toBe(expected);
      const prev = PREVIOUS_RONCOIN_PRICES.catalog[id];
      expect(prev, `previous catalog.${id}`).toBeDefined();
      if (!literalCatalogOverrides.has(id)) {
        expect(item.priceCoins, `niceHalfCoins(prev) for ${id}`).toBe(niceHalfCoins(prev!));
      }
    }
  });

  it('keeps land expansion unchanged (20/25) and sets all streets and water ground types to 2', () => {
    const expectedLand: Record<GroundTileType, number> = {
      'basic-block': 20,
      'basic-block-flowers': 25,
      'basic-block-flowers-two': 25,
      'basic-block-dirt': 20,
      'basic-block-street': 2,
      'basic-block-street-curve': 2,
      'basic-block-intersection': 2,
      'basic-block-wather': 2,
      'basic-block-wather-two': 2,
      'basic-block-wather-grass-50-50': 2,
      'basic-block-water-grass-20-80': 2,
      'basic-block-water-grass-80-20': 2,
    };

    for (const gt of GROUND_TILE_TYPES) {
      expect(LAND_PRICES[gt], `LAND_PRICES[${gt}]`).toBe(expectedLand[gt]);
    }
    // Expansion tiles have previous === current so they never show the "New price" badge
    expect(PREVIOUS_RONCOIN_PRICES.land['basic-block']).toBe(LAND_PRICES['basic-block']);
    expect(PREVIOUS_RONCOIN_PRICES.land['basic-block-flowers']).toBe(
      LAND_PRICES['basic-block-flowers'],
    );
    expect(PREVIOUS_RONCOIN_PRICES.land['basic-block-flowers-two']).toBe(
      LAND_PRICES['basic-block-flowers-two'],
    );
    expect(PREVIOUS_RONCOIN_PRICES.land['basic-block-dirt']).toBe(LAND_PRICES['basic-block-dirt']);
    // Streets and water dropped from 30/35/40 to 2
    expect(PREVIOUS_RONCOIN_PRICES.land['basic-block-street']).toBeGreaterThan(
      LAND_PRICES['basic-block-street'],
    );
    expect(PREVIOUS_RONCOIN_PRICES.land['basic-block-wather']).toBeGreaterThan(
      LAND_PRICES['basic-block-wather'],
    );
  });

  it('halves every getPlotPrice and SPEEDUP_COST tier via niceHalfCoins', () => {
    for (let owned = 0; owned <= 8; owned++) {
      const prev = getPreviousPlotPrice(owned);
      expect(getPlotPrice(owned), `getPlotPrice(${owned})`).toBe(niceHalfCoins(prev));
    }
    for (const [cropId, tier] of Object.entries(SPEEDUP_COST.tiers)) {
      const prev = PREVIOUS_RONCOIN_PRICES.speedupTiers[cropId];
      expect(prev, `previous speedup ${cropId}`).toBeDefined();
      expect(tier, `SPEEDUP_COST.tiers.${cropId}`).toBe(niceHalfCoins(prev!));
    }
  });

  it('activates the 7-day price-cut badge only within [start, start + 7d) and leaves EUR packs & earning untouched', () => {
    expect(isRonCoinPriceCutActive(RONCOIN_PRICE_CUT_STARTED_AT_MS - 1)).toBe(false);
    expect(isRonCoinPriceCutActive(RONCOIN_PRICE_CUT_STARTED_AT_MS)).toBe(true);
    expect(
      isRonCoinPriceCutActive(RONCOIN_PRICE_CUT_STARTED_AT_MS + RONCOIN_PRICE_CUT_DURATION_MS - 1),
    ).toBe(true);
    expect(
      isRonCoinPriceCutActive(RONCOIN_PRICE_CUT_STARTED_AT_MS + RONCOIN_PRICE_CUT_DURATION_MS),
    ).toBe(false);

    // Guard rails: EUR packs, earning rates, and refund rate must remain untouched
    expect(DEFAULT_TOWN_ECONOMY.purchase.packs).toEqual([
      { id: 'pack_1000', coins: 1000, eur: 1.99 },
      { id: 'pack_2800', coins: 2800, eur: 4.99 },
      { id: 'pack_6000', coins: 6000, eur: 9.99 },
      { id: 'pack_13000', coins: 13000, eur: 19.99 },
    ]);
    expect(DEFAULT_TOWN_ECONOMY.earnRate).toEqual({ pro: 10, free: 2 });
    expect(DEFAULT_TOWN_ECONOMY.starterCoins).toBe(100);
    expect(DEFAULT_TOWN_ECONOMY.removeRefundRate).toBe(0.5);
  });
});

describe('getFamilyEventTriggerAt', () => {
  it('deterministically schedules trigger between day 10 and day 14 inclusive', () => {
    const base = 1_700_000_000_000;
    const seenDays = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const uid = `u_family_${i}`;
      const t1 = getFamilyEventTriggerAt(uid, base);
      const t2 = getFamilyEventTriggerAt(uid, base);
      expect(t1).toBe(t2);
      const days = (t1 - base) / 86_400_000;
      expect(Number.isInteger(days)).toBe(true);
      expect(days).toBeGreaterThanOrEqual(10);
      expect(days).toBeLessThanOrEqual(14);
      seenDays.add(days);
    }
    expect(seenDays.size).toBe(5);
  });
});
