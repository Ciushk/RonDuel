import { describe, expect, it } from 'vitest';
import {
  calculateLazyArrivals,
  calculateTownCapacities,
  calculateTownLevel,
  calculateTriviaCoins,
  DEFAULT_TOWN_CATALOG,
  DEFAULT_TOWN_ECONOMY,
  getGridSizeForLevel,
  getPlotPrice,
  LedgerEntrySchema,
  WalletDocSchema,
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
    expect(getPlotPrice(1)).toBe(0);
    expect(getPlotPrice(2)).toBe(50);
    expect(getPlotPrice(3)).toBe(100);
    expect(getPlotPrice(4)).toBe(200);
    expect(getPlotPrice(5)).toBe(400);
    expect(getPlotPrice(6)).toBe(600);
    expect(getPlotPrice(11)).toBe(600);
  });
});
