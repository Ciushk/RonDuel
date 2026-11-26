import {
  isGroundWalkable,
  type GridCoord,
  type GroundTileType,
  type TownCatalogDoc,
} from '@ronduel/shared';
import { isoToScreen } from './iso';
import type { VillagerKind } from './sprites';

export type VillagerRole =
  'farmer' | 'homebody' | 'stroller' | 'runner' | 'shopkeeper' | 'worker' | 'visitor';

export type VillagerState =
  'idle' | 'walking' | 'tending' | 'inside' | 'exiting' | 'lookAround' | 'react' | 'harvesting';

export interface BehaviorTileInfo {
  x: number;
  y: number;
  itemId: string;
  rot?: 0 | 1 | 2 | 3;
  cropId?: string;
  parentTile?: string;
}

export interface TownReactionEvent {
  x: number;
  y: number;
  type: 'harvest' | 'build' | 'plant';
}

export type TargetArrivalAction =
  | { kind: 'idle'; minMs: number; maxMs: number; bubble?: string }
  | { kind: 'tending'; minMs: number; maxMs: number; bubble: string; faceTarget: GridCoord }
  | { kind: 'inside'; minMs: number; maxMs: number; faceTarget: GridCoord }
  | { kind: 'lookAround'; minMs: number; maxMs: number };

export interface PickedTarget {
  goal: GridCoord;
  arrival: TargetArrivalAction;
  decrementHomeWander?: boolean;
}

const CARDINAL_DIRS: readonly GridCoord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic PRNG seeded per villager so behaviour differs between villagers yet stays stable. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng: () => number, min: number, max: number): number {
  if (max <= min) return min;
  return min + rng() * (max - min);
}

export function getRoleForKind(kind: VillagerKind): VillagerRole {
  switch (kind) {
    case 'small-villager':
      return 'farmer';
    case 'woman-villager':
      return 'homebody';
    case 'granny-villager':
      return 'stroller';
    case 'child-villager':
      return 'runner';
    case 'baker-villager':
      return 'shopkeeper';
    case 'blacksmith-villager':
      return 'worker';
    case 'visitor':
      return 'visitor';
  }
}

export function getSpeedMultiplierForRole(role: VillagerRole): number {
  if (role === 'stroller') return 1.6;
  if (role === 'runner') return 0.7;
  return 1.0;
}

/** Seeded per-villager idle offset (±10px x, ±4px y) so two idle villagers on one cell separate visually. */
export function getIdleSeparationOffset(id: string): { x: number; y: number } {
  const rng = mulberry32(hashString(`${id}:sep`));
  const x = Math.round((rng() * 2 - 1) * 10);
  const y = Math.round((rng() * 2 - 1) * 4);
  return { x, y };
}

export function shuffleWithRng<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

export function getWalkableCells(
  land: Record<string, GroundTileType>,
  blockedKeys: ReadonlySet<string>,
): GridCoord[] {
  const cells: GridCoord[] = [];
  for (const [key, ground] of Object.entries(land)) {
    if (!isGroundWalkable(ground)) continue;
    if (blockedKeys.has(key)) continue;
    const [xs, ys] = key.split('_');
    const x = Number(xs);
    const y = Number(ys);
    if (Number.isInteger(x) && Number.isInteger(y)) {
      cells.push({ x, y });
    }
  }
  return cells;
}

export function facingToward(
  from: GridCoord,
  target: GridCoord,
  fallback: 'left' | 'right',
): 'left' | 'right' {
  const dx = isoToScreen(target.x, target.y).x - isoToScreen(from.x, from.y).x;
  if (dx === 0) return fallback;
  return dx < 0 ? 'left' : 'right';
}

/**
 * BFS with per-call shuffled direction order so villagers walking between similar
 * endpoints naturally take varied routes instead of forming a single-file conga line.
 */
export function findSeededWalkablePath(params: {
  start: GridCoord;
  goal: GridCoord;
  land: Record<string, GroundTileType>;
  blockedKeys: ReadonlySet<string>;
  rng: () => number;
  allowGoalBlocked?: boolean;
  maxSteps?: number;
}): GridCoord[] | null {
  const { start, goal, land, blockedKeys, rng, allowGoalBlocked = false, maxSteps = 256 } = params;
  const startKey = `${start.x}_${start.y}`;
  const goalKey = `${goal.x}_${goal.y}`;
  if (startKey === goalKey) return [{ x: start.x, y: start.y }];

  const isPassable = (key: string): boolean => {
    if (key === goalKey && allowGoalBlocked) {
      return Boolean(land[key]);
    }
    const g = land[key];
    if (!g || !isGroundWalkable(g)) return false;
    return !blockedKeys.has(key);
  };

  if (!isPassable(goalKey)) return null;

  const dirs = shuffleWithRng(CARDINAL_DIRS, rng);
  const visited = new Set<string>([startKey]);
  const parent = new Map<string, string>();
  const queue: GridCoord[] = [{ x: start.x, y: start.y }];
  let expanded = 0;

  while (queue.length > 0 && expanded < maxSteps) {
    const cur = queue.shift()!;
    expanded += 1;
    const curKey = `${cur.x}_${cur.y}`;

    for (const d of dirs) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      const nKey = `${nx}_${ny}`;
      if (visited.has(nKey)) continue;
      if (!isPassable(nKey)) continue;

      visited.add(nKey);
      parent.set(nKey, curKey);
      if (nKey === goalKey) {
        const path: GridCoord[] = [];
        let trace: string | undefined = goalKey;
        while (trace) {
          const [tx, ty] = trace.split('_').map(Number);
          path.push({ x: tx!, y: ty! });
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

/**
 * Picks spawn cells spread across the island using a deterministic shuffle instead of
 * consecutive key order.
 */
export function pickSpreadSpawnCells(
  walkableCells: readonly GridCoord[],
  count: number,
  seed = 1337,
): GridCoord[] {
  if (walkableCells.length === 0 || count <= 0) return [];
  const shuffled = shuffleWithRng(walkableCells, mulberry32(seed));
  const result: GridCoord[] = [];
  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length]!);
  }
  return result;
}

/**
 * Finds the nearest walkable, unblocked, unreserved cell to `origin` via BFS.
 * Falls back to nearest walkable cell if all reachable cells are reserved.
 */
export function findNearestFreeCell(params: {
  origin: GridCoord;
  land: Record<string, GroundTileType>;
  blockedKeys: ReadonlySet<string>;
  reservedTargets: ReadonlyMap<string, string>;
  villagerId: string;
  walkableCells: readonly GridCoord[];
}): GridCoord | null {
  const { origin, land, blockedKeys, reservedTargets, villagerId, walkableCells } = params;
  if (walkableCells.length === 0) return null;

  const isReservedByOther = (key: string): boolean => {
    const owner = reservedTargets.get(key);
    return Boolean(owner && owner !== villagerId);
  };

  const visited = new Set<string>([`${origin.x}_${origin.y}`]);
  const queue: GridCoord[] = [{ x: origin.x, y: origin.y }];
  let nearestWalkable: GridCoord | null = null;
  let steps = 0;

  while (queue.length > 0 && steps < 256) {
    const cur = queue.shift()!;
    steps += 1;
    const key = `${cur.x}_${cur.y}`;
    if (isGroundWalkable(land[key]) && !blockedKeys.has(key)) {
      if (!isReservedByOther(key)) {
        return cur;
      }
      if (!nearestWalkable) nearestWalkable = cur;
    }

    for (const d of CARDINAL_DIRS) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      const nKey = `${nx}_${ny}`;
      if (visited.has(nKey)) continue;
      // Traverse through owned land (even blocked) so a villager trapped on a new building escapes
      if (!land[nKey]) continue;
      visited.add(nKey);
      queue.push({ x: nx, y: ny });
    }
  }

  if (nearestWalkable) return nearestWalkable;

  // Fallback across disconnected islands: Manhattan-nearest unreserved walkable cell
  let best: GridCoord | null = null;
  let bestDist = Infinity;
  for (const c of walkableCells) {
    const key = `${c.x}_${c.y}`;
    const dist = Math.abs(c.x - origin.x) + Math.abs(c.y - origin.y);
    const penalty = isReservedByOther(key) ? 1000 : 0;
    if (dist + penalty < bestDist) {
      bestDist = dist + penalty;
      best = c;
    }
  }
  return best;
}

/**
 * Computes the front "door" cell for a placed building: tries (frontX, frontY+1), then (frontX+1, frontY),
 * or swaps the preference order when the building is horizontally flipped (`rot % 2 === 1`).
 * Only returns a walkable, unblocked cell.
 */
export function findBuildingDoorCell(
  tile: BehaviorTileInfo,
  footprintW: number,
  footprintH: number,
  land: Record<string, GroundTileType>,
  blockedKeys: ReadonlySet<string>,
): GridCoord | null {
  const frontX = tile.x + Math.max(1, footprintW) - 1;
  const frontY = tile.y + Math.max(1, footprintH) - 1;
  const flipped = (((tile.rot ?? 0) % 2) + 2) % 2 === 1;
  const preferred: GridCoord[] = flipped
    ? [
        { x: frontX + 1, y: frontY },
        { x: frontX, y: frontY + 1 },
      ]
    : [
        { x: frontX, y: frontY + 1 },
        { x: frontX + 1, y: frontY },
      ];

  for (const c of preferred) {
    const key = `${c.x}_${c.y}`;
    if (isGroundWalkable(land[key]) && !blockedKeys.has(key)) {
      return c;
    }
  }
  return null;
}

function minDistanceToOthers(cell: GridCoord, others: readonly GridCoord[]): number {
  if (others.length === 0) return Infinity;
  let best = Infinity;
  for (const o of others) {
    const d = Math.abs(cell.x - o.x) + Math.abs(cell.y - o.y);
    if (d < best) best = d;
  }
  return best;
}

function filterAvailableCells(
  candidates: readonly GridCoord[],
  from: GridCoord,
  reservedTargets: ReadonlyMap<string, string>,
  villagerId: string,
  otherIdlePositions: readonly GridCoord[],
): GridCoord[] {
  const notReserved = candidates.filter((c) => {
    const key = `${c.x}_${c.y}`;
    const owner = reservedTargets.get(key);
    return (!owner || owner === villagerId) && (c.x !== from.x || c.y !== from.y);
  });

  const wellSpaced = notReserved.filter((c) => minDistanceToOthers(c, otherIdlePositions) > 1);
  if (wellSpaced.length > 0) return wellSpaced;
  return notReserved;
}

function pickFarthestOfSample(
  pool: readonly GridCoord[],
  otherPositions: readonly GridCoord[],
  rng: () => number,
  sampleSize = 3,
): GridCoord | null {
  if (pool.length === 0) return null;
  const picks = Math.min(sampleSize, pool.length);
  let best: GridCoord | null = null;
  let bestDist = -1;
  for (let i = 0; i < picks; i++) {
    const c = pool[Math.floor(rng() * pool.length)]!;
    const d = minDistanceToOthers(c, otherPositions);
    if (d > bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

function pickWanderTarget(params: {
  from: GridCoord;
  radius: number;
  walkableCells: readonly GridCoord[];
  reservedTargets: ReadonlyMap<string, string>;
  villagerId: string;
  otherIdlePositions: readonly GridCoord[];
  rng: () => number;
  arrival: TargetArrivalAction;
  decrementHomeWander?: boolean;
}): PickedTarget | null {
  const {
    from,
    radius,
    walkableCells,
    reservedTargets,
    villagerId,
    otherIdlePositions,
    rng,
    arrival,
    decrementHomeWander,
  } = params;

  const withinRadius = walkableCells.filter(
    (c) => Math.abs(c.x - from.x) + Math.abs(c.y - from.y) <= radius,
  );
  const availRadius = filterAvailableCells(
    withinRadius,
    from,
    reservedTargets,
    villagerId,
    otherIdlePositions,
  );
  const pool =
    availRadius.length > 0
      ? availRadius
      : filterAvailableCells(walkableCells, from, reservedTargets, villagerId, otherIdlePositions);

  const goal = pickFarthestOfSample(pool, otherIdlePositions, rng, 3);
  if (!goal) return null;
  return { goal, arrival, decrementHomeWander };
}

function collectDoorsForFilter(
  tiles: Record<string, BehaviorTileInfo>,
  catalog: TownCatalogDoc,
  land: Record<string, GroundTileType>,
  blockedKeys: ReadonlySet<string>,
  predicate: (tile: BehaviorTileInfo, type: string | undefined) => boolean,
): Array<{ door: GridCoord; building: GridCoord }> {
  const doors: Array<{ door: GridCoord; building: GridCoord }> = [];
  for (const tile of Object.values(tiles)) {
    if (tile.parentTile || tile.itemId.startsWith('part:')) continue;
    const item = catalog.items[tile.itemId];
    if (!predicate(tile, item?.type)) continue;
    const door = findBuildingDoorCell(
      tile,
      item?.footprint.w ?? 1,
      item?.footprint.h ?? 1,
      land,
      blockedKeys,
    );
    if (door) {
      doors.push({ door, building: { x: tile.x, y: tile.y } });
    }
  }
  return doors;
}

/**
 * Picks the next role-appropriate target cell and arrival behaviour for a resident villager.
 * Guarantees returned targets are walkable, unblocked, and not reserved by another villager.
 */
export function pickNextTarget(params: {
  villagerId: string;
  role: VillagerRole;
  from: GridCoord;
  walkableCells: readonly GridCoord[];
  land: Record<string, GroundTileType>;
  blockedKeys: ReadonlySet<string>;
  tiles: Record<string, BehaviorTileInfo>;
  catalog: TownCatalogDoc;
  reservedTargets: ReadonlyMap<string, string>;
  otherIdlePositions: readonly GridCoord[];
  rng: () => number;
  homeWanderRemaining?: number;
}): PickedTarget | null {
  const {
    villagerId,
    role,
    from,
    walkableCells,
    land,
    blockedKeys,
    tiles,
    catalog,
    reservedTargets,
    otherIdlePositions,
    rng,
    homeWanderRemaining = 0,
  } = params;

  const isCellFree = (c: GridCoord): boolean => {
    const key = `${c.x}_${c.y}`;
    if (!isGroundWalkable(land[key]) || blockedKeys.has(key)) return false;
    const owner = reservedTargets.get(key);
    return !owner || owner === villagerId;
  };

  if (role === 'farmer') {
    const plantedPlots = Object.values(tiles).filter(
      (t) => t.itemId === 'plot' && Boolean(t.cropId) && !t.parentTile,
    );
    if (plantedPlots.length > 0) {
      const shuffledPlots = shuffleWithRng(plantedPlots, rng);
      for (const plot of shuffledPlots) {
        const neighbors = shuffleWithRng(CARDINAL_DIRS, rng)
          .map((d) => ({ x: plot.x + d.x, y: plot.y + d.y }))
          .filter(isCellFree);
        const spaced = neighbors.filter((c) => minDistanceToOthers(c, otherIdlePositions) > 1);
        const pick = spaced[0] ?? neighbors[0];
        if (pick) {
          return {
            goal: pick,
            arrival: {
              kind: 'tending',
              minMs: 2500,
              maxMs: 4000,
              bubble: rng() < 0.5 ? '🌱' : '💧',
              faceTarget: { x: plot.x, y: plot.y },
            },
          };
        }
      }
    }
    // No planted plots -> fall back to stroller loop
    return pickWanderTarget({
      from,
      radius: 3,
      walkableCells,
      reservedTargets,
      villagerId,
      otherIdlePositions,
      rng,
      arrival: { kind: 'lookAround', minMs: 4000, maxMs: 7000 },
    });
  }

  if (role === 'homebody' || role === 'shopkeeper') {
    if (homeWanderRemaining > 0) {
      return pickWanderTarget({
        from,
        radius: 3,
        walkableCells,
        reservedTargets,
        villagerId,
        otherIdlePositions,
        rng,
        arrival: { kind: 'idle', minMs: 2000, maxMs: 4000 },
        decrementHomeWander: true,
      });
    }

    let doors =
      role === 'shopkeeper'
        ? collectDoorsForFilter(tiles, catalog, land, blockedKeys, (_t, type) => type === 'service')
        : collectDoorsForFilter(
            tiles,
            catalog,
            land,
            blockedKeys,
            (_t, type) => type === 'housing',
          );

    // Shopkeeper falls back to housing doors if no shops/services are built yet
    if (role === 'shopkeeper' && doors.length === 0) {
      doors = collectDoorsForFilter(
        tiles,
        catalog,
        land,
        blockedKeys,
        (_t, type) => type === 'housing',
      );
    }

    const freeDoors = doors.filter((d) => isCellFree(d.door));
    if (freeDoors.length > 0) {
      const picked = freeDoors[Math.floor(rng() * freeDoors.length)]!;
      return {
        goal: picked.door,
        arrival: {
          kind: 'inside',
          minMs: 4000,
          maxMs: 8000,
          faceTarget: picked.building,
        },
      };
    }

    // Fallback to stroller loop
    return pickWanderTarget({
      from,
      radius: 3,
      walkableCells,
      reservedTargets,
      villagerId,
      otherIdlePositions,
      rng,
      arrival: { kind: 'lookAround', minMs: 4000, maxMs: 7000 },
    });
  }

  if (role === 'worker') {
    const doors = collectDoorsForFilter(
      tiles,
      catalog,
      land,
      blockedKeys,
      (_t, type) => type === 'housing' || type === 'service',
    ).filter((d) => isCellFree(d.door) && (d.door.x !== from.x || d.door.y !== from.y));

    if (doors.length > 0) {
      const picked = doors[Math.floor(rng() * doors.length)]!;
      return {
        goal: picked.door,
        arrival: {
          kind: 'tending',
          minMs: 2000,
          maxMs: 3000,
          bubble: '🔨',
          faceTarget: picked.building,
        },
      };
    }
    return pickWanderTarget({
      from,
      radius: 3,
      walkableCells,
      reservedTargets,
      villagerId,
      otherIdlePositions,
      rng,
      arrival: { kind: 'lookAround', minMs: 4000, maxMs: 7000 },
    });
  }

  if (role === 'runner') {
    const showBubble = rng() < 0.2;
    return pickWanderTarget({
      from,
      radius: 2,
      walkableCells,
      reservedTargets,
      villagerId,
      otherIdlePositions,
      rng,
      arrival: {
        kind: 'idle',
        minMs: 600,
        maxMs: 1500,
        bubble: showBubble ? (rng() < 0.5 ? '❗' : '😄') : undefined,
      },
    });
  }

  // Default / stroller
  return pickWanderTarget({
    from,
    radius: 3,
    walkableCells,
    reservedTargets,
    villagerId,
    otherIdlePositions,
    rng,
    arrival: { kind: 'lookAround', minMs: 4000, maxMs: 7000 },
  });
}
