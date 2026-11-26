import { describe, expect, it } from 'vitest';
import { DEFAULT_TOWN_CATALOG, isGroundWalkable, type GroundTileType } from '@ronduel/shared';
import {
  findBuildingDoorCell,
  findNearestFreeCell,
  findSeededWalkablePath,
  getRoleForKind,
  getSpeedMultiplierForRole,
  getWalkableCells,
  hashString,
  mulberry32,
  pickNextTarget,
  pickReactionBubbleKind,
  pickSpreadSpawnCells,
  type BehaviorTileInfo,
} from './villagerBehavior';
import { BUBBLE_KINDS, type BubbleKind } from './sprites';

function makeGridLand(size: number): Record<string, GroundTileType> {
  const land: Record<string, GroundTileType> = {};
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      land[`${x}_${y}`] = 'basic-block';
    }
  }
  return land;
}

describe('villagerBehavior pure state machine helpers', () => {
  it('maps each resident kind to its intended role and speed multiplier', () => {
    expect(getRoleForKind('small-villager')).toBe('farmer');
    expect(getRoleForKind('woman-villager')).toBe('homebody');
    expect(getRoleForKind('granny-villager')).toBe('stroller');
    expect(getRoleForKind('child-villager')).toBe('runner');
    expect(getRoleForKind('baker-villager')).toBe('shopkeeper');
    expect(getRoleForKind('blacksmith-villager')).toBe('worker');
    expect(getRoleForKind('visitor')).toBe('visitor');

    expect(getSpeedMultiplierForRole('stroller')).toBe(1.6);
    expect(getSpeedMultiplierForRole('runner')).toBe(0.7);
    expect(getSpeedMultiplierForRole('farmer')).toBe(1.0);
  });

  it('target selection only returns walkable, unblocked cells', () => {
    const land = makeGridLand(6);
    land['1_1'] = 'basic-block-wather';
    land['2_2'] = 'basic-block-wather-grass-50-50';
    const blocked = new Set(['3_3', '4_4', '0_0']);
    const tiles: Record<string, BehaviorTileInfo> = {
      '3_3': { x: 3, y: 3, itemId: 'starter_house' },
      '4_4': { x: 4, y: 4, itemId: 'plot', cropId: 'wheat' },
    };
    const walkable = getWalkableCells(land, blocked);
    const reserved = new Map<string, string>();

    for (const role of [
      'farmer',
      'homebody',
      'stroller',
      'runner',
      'shopkeeper',
      'worker',
    ] as const) {
      const rng = mulberry32(hashString(`test_${role}`));
      for (let i = 0; i < 10; i++) {
        const picked = pickNextTarget({
          villagerId: `v_${role}`,
          role,
          from: { x: 2, y: 3 },
          walkableCells: walkable,
          land,
          blockedKeys: blocked,
          tiles,
          catalog: DEFAULT_TOWN_CATALOG,
          reservedTargets: reserved,
          otherIdlePositions: [],
          rng,
        });
        expect(picked).not.toBeNull();
        const key = `${picked!.goal.x}_${picked!.goal.y}`;
        expect(isGroundWalkable(land[key])).toBe(true);
        expect(blocked.has(key)).toBe(false);
      }
    }
  });

  it('door cells are always walkable and unblocked, preferring (frontX, frontY+1) then (frontX+1, frontY)', () => {
    const land = makeGridLand(6);
    const blocked = new Set(['2_2']);
    const house: BehaviorTileInfo = { x: 2, y: 2, itemId: 'starter_house' };

    // Preferred front door (2, 3) is walkable
    expect(findBuildingDoorCell(house, 1, 1, land, blocked)).toEqual({ x: 2, y: 3 });

    // If (2, 3) is blocked, falls back to (3, 2)
    blocked.add('2_3');
    expect(findBuildingDoorCell(house, 1, 1, land, blocked)).toEqual({ x: 3, y: 2 });

    // If both front cells are blocked/water, returns null
    land['3_2'] = 'basic-block-wather';
    expect(findBuildingDoorCell(house, 1, 1, land, blocked)).toBeNull();
  });

  it('two villagers never receive the same reserved target', () => {
    const land = makeGridLand(5);
    const blocked = new Set(['2_2']);
    const tiles: Record<string, BehaviorTileInfo> = {
      '2_2': { x: 2, y: 2, itemId: 'starter_house' },
    };
    const walkable = getWalkableCells(land, blocked);
    const reserved = new Map<string, string>();
    const chosenKeys = new Set<string>();

    for (let i = 0; i < 6; i++) {
      const id = `resident_${i}`;
      const picked = pickNextTarget({
        villagerId: id,
        role: i % 2 === 0 ? 'stroller' : 'runner',
        from: { x: 0, y: 0 },
        walkableCells: walkable,
        land,
        blockedKeys: blocked,
        tiles,
        catalog: DEFAULT_TOWN_CATALOG,
        reservedTargets: reserved,
        otherIdlePositions: [],
        rng: mulberry32(hashString(id)),
      });
      expect(picked).not.toBeNull();
      const key = `${picked!.goal.x}_${picked!.goal.y}`;
      expect(chosenKeys.has(key)).toBe(false);
      chosenKeys.add(key);
      reserved.set(key, id);
    }
  });

  it('relocation picks the nearest free unreserved cell instead of stacking everyone on cell 0', () => {
    const land = makeGridLand(6);
    const blocked = new Set(['3_3']);
    const walkable = getWalkableCells(land, blocked);
    const reserved = new Map<string, string>();

    const first = findNearestFreeCell({
      origin: { x: 3, y: 3 },
      land,
      blockedKeys: blocked,
      reservedTargets: reserved,
      villagerId: 'resident_0',
      walkableCells: walkable,
    });
    expect(first).not.toBeNull();
    expect(Math.abs(first!.x - 3) + Math.abs(first!.y - 3)).toBe(1);
    reserved.set(`${first!.x}_${first!.y}`, 'resident_0');

    const second = findNearestFreeCell({
      origin: { x: 3, y: 3 },
      land,
      blockedKeys: blocked,
      reservedTargets: reserved,
      villagerId: 'resident_1',
      walkableCells: walkable,
    });
    expect(second).not.toBeNull();
    expect(Math.abs(second!.x - 3) + Math.abs(second!.y - 3)).toBe(1);
    expect(`${second!.x}_${second!.y}`).not.toBe(`${first!.x}_${first!.y}`);
  });

  it('seeded RNG spreads spawns and yields different first targets for different villager ids', () => {
    const land = makeGridLand(6);
    const blocked = new Set<string>();
    const walkable = getWalkableCells(land, blocked);

    const spawns = pickSpreadSpawnCells(walkable, 6);
    const uniqueSpawns = new Set(spawns.map((c) => `${c.x}_${c.y}`));
    expect(uniqueSpawns.size).toBe(6);

    const firstTargets = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const id = `resident_${i}`;
      const picked = pickNextTarget({
        villagerId: id,
        role: 'stroller',
        from: { x: 3, y: 3 },
        walkableCells: walkable,
        land,
        blockedKeys: blocked,
        tiles: {},
        catalog: DEFAULT_TOWN_CATALOG,
        reservedTargets: new Map(),
        otherIdlePositions: [],
        rng: mulberry32(hashString(id)),
      });
      expect(picked).not.toBeNull();
      firstTargets.add(`${picked!.goal.x}_${picked!.goal.y}`);
    }
    expect(firstTargets.size).toBeGreaterThanOrEqual(4);

    // Seeded BFS produces valid connected walkable paths
    const path = findSeededWalkablePath({
      start: { x: 0, y: 0 },
      goal: { x: 4, y: 4 },
      land,
      blockedKeys: blocked,
      rng: mulberry32(hashString('path_test')),
    });
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 0, y: 0 });
    expect(path![path!.length - 1]).toEqual({ x: 4, y: 4 });
  });

  it('findBuildingDoorCell swaps preferred door side when a building is horizontally flipped (rot === 1)', () => {
    const land = makeGridLand(6);
    const blocked = new Set(['2_2']);
    const unflipped: BehaviorTileInfo = { x: 2, y: 2, itemId: 'starter_house', rot: 0 };
    const flipped: BehaviorTileInfo = { x: 2, y: 2, itemId: 'starter_house', rot: 1 };

    const door0 = findBuildingDoorCell(unflipped, 1, 1, land, blocked);
    const door1 = findBuildingDoorCell(flipped, 1, 1, land, blocked);

    expect(door0).toEqual({ x: 2, y: 3 });
    expect(door1).toEqual({ x: 3, y: 2 });
  });

  it('pickReactionBubbleKind returns typed BubbleKind values and picks distinct icons for adjacent villagers', () => {
    const valid = new Set<string>(BUBBLE_KINDS);
    const rng = mulberry32(hashString('bubbles_test'));
    const used = new Set<BubbleKind>();

    for (let i = 0; i < 4; i++) {
      const k = pickReactionBubbleKind('harvest', rng, used);
      expect(valid.has(k)).toBe(true);
      expect(['heart', 'smile', 'star', 'wheat']).toContain(k);
      expect(used.has(k)).toBe(false);
      used.add(k);
    }

    const buildKind = pickReactionBubbleKind('build', rng);
    expect(['star', 'exclaim']).toContain(buildKind);

    const plantKind = pickReactionBubbleKind('plant', rng);
    expect(['wheat', 'smile']).toContain(plantKind);
  });
});
