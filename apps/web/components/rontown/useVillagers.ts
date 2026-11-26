'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isGroundWalkable,
  type GridCoord,
  type GroundTileType,
  type TownCatalogDoc,
} from '@ronduel/shared';
import { getVillagerFeetPoint, isoToScreen, objectZ, Z_LAYER } from './iso';
import { RESIDENT_VILLAGER_KINDS, VILLAGER_SPRITES, type VillagerKind } from './sprites';
import {
  facingToward,
  findNearestFreeCell,
  findSeededWalkablePath,
  getIdleSeparationOffset,
  getRoleForKind,
  getSpeedMultiplierForRole,
  getWalkableCells,
  hashString,
  mulberry32,
  pickNextTarget,
  pickSpreadSpawnCells,
  randRange,
  type BehaviorTileInfo,
  type TargetArrivalAction,
  type TownReactionEvent,
  type VillagerRole,
  type VillagerState,
} from './villagerBehavior';

/** Configurable villager movement & animation constants. */
export const VILLAGER_CONFIG = {
  /** Base walking speed: ~1 tile per 600ms. */
  msPerTile: 600,
  /** Walk cycle frame interval: 160ms across _f1.._f4. */
  frameIntervalMs: 160,
  /** Default idle wander delay range (ms). */
  wanderMinMs: 2000,
  wanderMaxMs: 4500,
  /** Harvest pause at target plot before completing harvest (ms). */
  harvestWaitMs: 1000,
  /** Maximum resident villagers rendered simultaneously on the map. */
  maxVisibleResidents: 16,
  /** How long a newly arrived visitor stays visible on population increase (ms). */
  visitorDurationMs: 8000,
  /** Reduced-motion relocation interval range (ms). */
  reducedRelocateMinMs: 20000,
  reducedRelocateMaxMs: 30000,
  /** Inside/exiting opacity fade duration (ms). */
  doorFadeMs: 300,
} as const;

export interface VillagerRenderItem {
  id: string;
  kind: VillagerKind;
  isArrivalVisitor?: boolean;
  initialX: number;
  initialY: number;
}

interface VillagerRuntime {
  id: string;
  kind: VillagerKind;
  role: VillagerRole;
  isArrivalVisitor: boolean;
  rng: () => number;
  idleSepX: number;
  idleSepY: number;
  col: number;
  row: number;
  gridX: number;
  gridY: number;
  facing: 'right' | 'left';
  behavior: VillagerState;
  stateUntilMs: number;
  stateStartedAtMs: number;
  path: GridCoord[];
  pathIndex: number;
  stepElapsedMs: number;
  frameElapsedMs: number;
  frameIndex: number;
  stepWaitUntilMs: number;
  reservedKey: string | null;
  pendingArrival: TargetArrivalAction | null;
  homeWanderRemaining: number;
  lookFlipsRemaining: number;
  nextLookFlipAtMs: number;
  bubbleText: string;
  bubbleUntilMs: number;
  onHarvestComplete?: () => void;
  expiresAtMs?: number;
  fadeUntilMs?: number;
  // Cached DOM writes so we never force layout reflows or write redundant styles
  lastTransform: string;
  lastZIndex: string;
  lastOpacity: string;
  lastSrc: string;
  lastWidth: number;
  lastHeight: number;
  lastFacing: string;
  lastBubbleText: string;
  lastBubbleVisible: boolean;
}

export interface VillagerDomHandles {
  wrap: HTMLDivElement | null;
  img: HTMLImageElement | null;
  bubble: HTMLDivElement | null;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return reduced;
}

interface UseVillagersParams {
  population: number;
  land: Record<string, GroundTileType>;
  tiles: Record<string, BehaviorTileInfo>;
  catalog: TownCatalogDoc;
  blockedKeys: ReadonlySet<string>;
  boundsMinX: number;
  boundsMinY: number;
  scale: number;
  reducedMotion: boolean;
}

function getInitialIdleDelay(
  role: VillagerRole,
  rng: () => number,
  reducedMotion: boolean,
): number {
  if (reducedMotion) {
    return randRange(
      rng,
      VILLAGER_CONFIG.reducedRelocateMinMs,
      VILLAGER_CONFIG.reducedRelocateMaxMs,
    );
  }
  if (role === 'runner') return randRange(rng, 400, 1200);
  if (role === 'stroller') return randRange(rng, 1200, 3200);
  return randRange(rng, 600, 2600);
}

export function useVillagers({
  population,
  land,
  tiles,
  catalog,
  blockedKeys,
  boundsMinX,
  boundsMinY,
  scale,
  reducedMotion,
}: UseVillagersParams) {
  const [villagerList, setVillagerList] = useState<VillagerRenderItem[]>(() => {
    const walkable = getWalkableCells(land, blockedKeys);
    const cells =
      walkable.length > 0
        ? walkable
        : Object.keys(land).map((k) => {
            const [x, y] = k.split('_').map(Number);
            return { x: x ?? 3, y: y ?? 3 };
          });
    if (cells.length === 0) return [];
    const count = Math.max(1, Math.min(population, VILLAGER_CONFIG.maxVisibleResidents));
    const spawns = pickSpreadSpawnCells(cells, count);
    return Array.from({ length: count }, (_, i) => {
      const spawn = spawns[i]!;
      return {
        id: `resident_${i}`,
        kind: RESIDENT_VILLAGER_KINDS[i % RESIDENT_VILLAGER_KINDS.length]!,
        isArrivalVisitor: false,
        initialX: spawn.x,
        initialY: spawn.y,
      };
    });
  });

  const runtimesRef = useRef<Map<string, VillagerRuntime>>(new Map());
  const reservedTargetsRef = useRef<Map<string, string>>(new Map());
  const walkableCellsRef = useRef<GridCoord[]>(getWalkableCells(land, blockedKeys));
  const domRefs = useRef<Map<string, VillagerDomHandles>>(new Map());
  const landRef = useRef(land);
  const tilesRef = useRef(tiles);
  const catalogRef = useRef(catalog);
  const blockedRef = useRef(blockedKeys);
  const layoutRef = useRef({ boundsMinX, boundsMinY, scale });
  const reducedMotionRef = useRef(reducedMotion);
  const prevPopRef = useRef<number | null>(null);
  const visitorCounterRef = useRef(0);
  const wakeLoopRef = useRef<(() => void) | null>(null);

  landRef.current = land;
  tilesRef.current = tiles;
  catalogRef.current = catalog;
  blockedRef.current = blockedKeys;
  layoutRef.current = { boundsMinX, boundsMinY, scale };
  reducedMotionRef.current = reducedMotion;

  const releaseReservation = useCallback((v: VillagerRuntime) => {
    if (v.reservedKey) {
      if (reservedTargetsRef.current.get(v.reservedKey) === v.id) {
        reservedTargetsRef.current.delete(v.reservedKey);
      }
      v.reservedKey = null;
    }
  }, []);

  const reserveCell = useCallback(
    (v: VillagerRuntime, coord: GridCoord) => {
      releaseReservation(v);
      const key = `${coord.x}_${coord.y}`;
      reservedTargetsRef.current.set(key, v.id);
      v.reservedKey = key;
    },
    [releaseReservation],
  );

  const registerDom = useCallback(
    (id: string, part: 'wrap' | 'img' | 'bubble', el: HTMLDivElement | HTMLImageElement | null) => {
      const existing = domRefs.current.get(id) ?? { wrap: null, img: null, bubble: null };
      if (part === 'wrap') existing.wrap = el as HTMLDivElement | null;
      if (part === 'img') existing.img = el as HTMLImageElement | null;
      if (part === 'bubble') existing.bubble = el as HTMLDivElement | null;
      if (!existing.wrap && !existing.img && !existing.bubble) {
        domRefs.current.delete(id);
      } else {
        domRefs.current.set(id, existing);
      }
    },
    [],
  );

  const tryShowBubble = useCallback((v: VillagerRuntime, text: string, nowMs: number) => {
    const map = runtimesRef.current;
    let residentCount = 0;
    let activeBubbles = 0;
    for (const other of map.values()) {
      if (other.isArrivalVisitor) continue;
      residentCount += 1;
      if (other.id !== v.id && other.bubbleUntilMs > nowMs && other.bubbleText) {
        activeBubbles += 1;
      }
    }
    const maxBubbles = Math.max(1, Math.floor(residentCount / 2));
    if (activeBubbles >= maxBubbles && v.behavior !== 'react') {
      return;
    }
    v.bubbleText = text;
    v.bubbleUntilMs = nowMs + randRange(v.rng, 1200, 1800);
  }, []);

  /**
   * Pure write-only DOM sync using cached values — zero layout reads, zero forced reflows.
   */
  const syncDomForVillager = useCallback(
    (v: VillagerRuntime, nowMs: number, sharedCellCounts: ReadonlyMap<string, number>) => {
      const handles = domRefs.current.get(v.id);
      if (!handles?.wrap || !handles?.img) return;

      const { boundsMinX: minX, boundsMinY: minY, scale: s } = layoutRef.current;
      const specSet = VILLAGER_SPRITES[v.kind];
      const reduced = reducedMotionRef.current;
      const isStepping = v.behavior === 'walking' && !reduced && nowMs >= v.stepWaitUntilMs;
      const activeSprite =
        isStepping && specSet.walkFrames
          ? specSet.walkFrames[v.frameIndex % specSet.walkFrames.length]!
          : specSet.idle;

      const feet = getVillagerFeetPoint(v.col, v.row);
      const cellKey = `${v.gridX}_${v.gridY}`;
      const applySep =
        v.behavior !== 'walking' &&
        v.behavior !== 'inside' &&
        (sharedCellCounts.get(cellKey) ?? 0) > 1;
      const sepX = applySep ? v.idleSepX : 0;
      const sepY = applySep ? v.idleSepY : 0;

      const pxX = Math.round((feet.x - minX - activeSprite.width / 2 + sepX) * s);
      const pxY = Math.round((feet.y - minY - activeSprite.height + sepY) * s);

      let motionOffsetY = 0;
      if (!reduced) {
        if (!specSet.walkFrames && (isStepping || v.isArrivalVisitor)) {
          motionOffsetY = Math.round(Math.sin(nowMs / 180) * 6 * s);
        } else if (v.behavior === 'tending') {
          // 2px up/down bob every 400ms via transform
          const phase = Math.floor((nowMs - v.stateStartedAtMs) / 400) % 2;
          motionOffsetY = phase === 0 ? 0 : Math.round(-2 * s);
        } else if (v.behavior === 'react') {
          // 4px celebratory hop during the first 360ms of reaction
          const elapsed = nowMs - v.stateStartedAtMs;
          if (elapsed < 360) {
            motionOffsetY = Math.round(-Math.sin((elapsed / 360) * Math.PI) * 4 * s);
          }
        }
      }

      const nextTransform = `translate3d(${pxX}px, ${pxY + motionOffsetY}px, 0)`;
      if (v.lastTransform !== nextTransform) {
        handles.wrap.style.transform = nextTransform;
        v.lastTransform = nextTransform;
      }

      const nextZ = String(objectZ(v.col + v.row, Z_LAYER.villager));
      if (v.lastZIndex !== nextZ) {
        handles.wrap.style.zIndex = nextZ;
        v.lastZIndex = nextZ;
      }

      let opacityNum = 1;
      if (v.behavior === 'inside') {
        if (reduced) {
          opacityNum = 0;
        } else {
          const fadeElapsed = nowMs - v.stateStartedAtMs;
          opacityNum =
            fadeElapsed < VILLAGER_CONFIG.doorFadeMs
              ? Math.max(0, 1 - fadeElapsed / VILLAGER_CONFIG.doorFadeMs)
              : 0;
        }
      } else if (v.behavior === 'exiting') {
        if (reduced) {
          opacityNum = 1;
        } else {
          const fadeElapsed = nowMs - v.stateStartedAtMs;
          opacityNum = Math.min(1, Math.max(0, fadeElapsed / VILLAGER_CONFIG.doorFadeMs));
        }
      } else if (v.fadeUntilMs && nowMs < v.fadeUntilMs) {
        opacityNum = 0.55;
      }

      const nextOpacity = opacityNum === 0 ? '0' : opacityNum === 1 ? '1' : opacityNum.toFixed(2);
      if (v.lastOpacity !== nextOpacity) {
        handles.wrap.style.opacity = nextOpacity;
        v.lastOpacity = nextOpacity;
      }

      if (v.lastSrc !== activeSprite.src) {
        handles.img.setAttribute('src', activeSprite.src);
        v.lastSrc = activeSprite.src;
      }

      const desiredW = activeSprite.width * s;
      const desiredH = activeSprite.height * s;
      if (v.lastWidth !== desiredW) {
        handles.img.setAttribute('width', String(desiredW));
        v.lastWidth = desiredW;
      }
      if (v.lastHeight !== desiredH) {
        handles.img.setAttribute('height', String(desiredH));
        v.lastHeight = desiredH;
      }

      const nextFacing = v.facing === 'left' ? 'scaleX(-1)' : 'scaleX(1)';
      if (v.lastFacing !== nextFacing) {
        handles.img.style.transform = nextFacing;
        v.lastFacing = nextFacing;
      }

      // Sync emote/action bubble via cached opacity + transform writes only
      if (handles.bubble && !v.isArrivalVisitor) {
        const bubbleVisible =
          Boolean(v.bubbleText) && v.bubbleUntilMs > nowMs && v.behavior !== 'inside';
        if (bubbleVisible && v.lastBubbleText !== v.bubbleText) {
          handles.bubble.textContent = v.bubbleText;
          v.lastBubbleText = v.bubbleText;
        }
        if (v.lastBubbleVisible !== bubbleVisible) {
          handles.bubble.style.opacity = bubbleVisible ? '1' : '0';
          handles.bubble.style.transform = bubbleVisible
            ? 'translate3d(-50%, 0, 0) scale(1)'
            : 'translate3d(-50%, 4px, 0) scale(0.85)';
          v.lastBubbleVisible = bubbleVisible;
        }
      }
    },
    [],
  );

  // Rebuild cached walkable-cell list and reconcile residents/visitors when population, land, or blockedKeys change
  useEffect(() => {
    const walkable = getWalkableCells(land, blockedKeys);
    walkableCellsRef.current = walkable;

    const fallbackCells =
      walkable.length > 0
        ? walkable
        : Object.keys(land).map((k) => {
            const [x, y] = k.split('_').map(Number);
            return { x: x ?? 3, y: y ?? 3 };
          });

    if (fallbackCells.length === 0) return;

    const desiredCount = Math.max(1, Math.min(population, VILLAGER_CONFIG.maxVisibleResidents));
    const map = runtimesRef.current;
    const now = performance.now();
    let changed = false;

    const spreadSpawns = pickSpreadSpawnCells(fallbackCells, desiredCount);

    for (let i = 0; i < desiredCount; i++) {
      const id = `resident_${i}`;
      if (!map.has(id)) {
        const kind = RESIDENT_VILLAGER_KINDS[i % RESIDENT_VILLAGER_KINDS.length]!;
        const role = getRoleForKind(kind);
        const rng = mulberry32(hashString(id));
        const sep = getIdleSeparationOffset(id);
        const preferred = spreadSpawns[i]!;
        const spawn =
          findNearestFreeCell({
            origin: preferred,
            land,
            blockedKeys,
            reservedTargets: reservedTargetsRef.current,
            villagerId: id,
            walkableCells: fallbackCells,
          }) ?? preferred;

        const runtime: VillagerRuntime = {
          id,
          kind,
          role,
          isArrivalVisitor: false,
          rng,
          idleSepX: sep.x,
          idleSepY: sep.y,
          col: spawn.x,
          row: spawn.y,
          gridX: spawn.x,
          gridY: spawn.y,
          facing: rng() < 0.5 ? 'right' : 'left',
          behavior: 'idle',
          stateStartedAtMs: now,
          stateUntilMs: now + getInitialIdleDelay(role, rng, reducedMotionRef.current),
          path: [],
          pathIndex: 0,
          stepElapsedMs: 0,
          frameElapsedMs: 0,
          frameIndex: 0,
          stepWaitUntilMs: 0,
          reservedKey: null,
          pendingArrival: null,
          homeWanderRemaining: role === 'homebody' || role === 'shopkeeper' ? 1 : 0,
          lookFlipsRemaining: 0,
          nextLookFlipAtMs: Infinity,
          bubbleText: '',
          bubbleUntilMs: 0,
          lastTransform: '',
          lastZIndex: '',
          lastOpacity: '',
          lastSrc: '',
          lastWidth: 0,
          lastHeight: 0,
          lastFacing: '',
          lastBubbleText: '',
          lastBubbleVisible: false,
        };
        reserveCell(runtime, spawn);
        map.set(id, runtime);
        changed = true;
      }
    }

    for (const [id, v] of Array.from(map.entries())) {
      if (!v.isArrivalVisitor) {
        const idx = Number(id.replace('resident_', ''));
        if (idx >= desiredCount) {
          releaseReservation(v);
          map.delete(id);
          changed = true;
        }
      }
    }

    // Spawn arrival visitor when population increases
    if (prevPopRef.current !== null && population > prevPopRef.current) {
      visitorCounterRef.current += 1;
      const vid = `visitor_${visitorCounterRef.current}`;
      const rng = mulberry32(hashString(vid));
      const spawn = fallbackCells[Math.floor(rng() * fallbackCells.length)]!;
      const sep = getIdleSeparationOffset(vid);
      map.set(vid, {
        id: vid,
        kind: 'visitor',
        role: 'visitor',
        isArrivalVisitor: true,
        rng,
        idleSepX: sep.x,
        idleSepY: sep.y,
        col: spawn.x,
        row: spawn.y,
        gridX: spawn.x,
        gridY: spawn.y,
        facing: 'right',
        behavior: 'idle',
        stateStartedAtMs: now,
        stateUntilMs: Infinity,
        path: [],
        pathIndex: 0,
        stepElapsedMs: 0,
        frameElapsedMs: 0,
        frameIndex: 0,
        stepWaitUntilMs: 0,
        reservedKey: null,
        pendingArrival: null,
        homeWanderRemaining: 0,
        lookFlipsRemaining: 0,
        nextLookFlipAtMs: Infinity,
        bubbleText: '',
        bubbleUntilMs: 0,
        expiresAtMs: now + VILLAGER_CONFIG.visitorDurationMs,
        lastTransform: '',
        lastZIndex: '',
        lastOpacity: '',
        lastSrc: '',
        lastWidth: 0,
        lastHeight: 0,
        lastFacing: '',
        lastBubbleText: '',
        lastBubbleVisible: false,
      });
      changed = true;
    }
    prevPopRef.current = population;

    // Relocate any non-walking villager stranded on a newly blocked cell to the NEAREST free cell
    for (const v of map.values()) {
      const key = `${Math.round(v.col)}_${Math.round(v.row)}`;
      if (
        v.behavior !== 'walking' &&
        v.behavior !== 'harvesting' &&
        (!isGroundWalkable(land[key]) || blockedKeys.has(key))
      ) {
        const nearest = findNearestFreeCell({
          origin: { x: Math.round(v.col), y: Math.round(v.row) },
          land,
          blockedKeys,
          reservedTargets: reservedTargetsRef.current,
          villagerId: v.id,
          walkableCells: fallbackCells,
        });
        if (nearest) {
          v.col = nearest.x;
          v.row = nearest.y;
          v.gridX = nearest.x;
          v.gridY = nearest.y;
          if (!v.isArrivalVisitor) {
            reserveCell(v, nearest);
          }
        }
      }
    }

    if (changed) {
      const nextList = Array.from(map.values()).map((v) => ({
        id: v.id,
        kind: v.kind,
        isArrivalVisitor: v.isArrivalVisitor,
        initialX: v.gridX,
        initialY: v.gridY,
      }));
      setVillagerList((prev) => {
        if (
          prev.length === nextList.length &&
          prev.every(
            (item, idx) => item.id === nextList[idx]?.id && item.kind === nextList[idx]?.kind,
          )
        ) {
          return prev;
        }
        return nextList;
      });
      wakeLoopRef.current?.();
    }
  }, [population, land, blockedKeys, reserveCell, releaseReservation]);

  // Reposition immediately when bounds/scale/list/reducedMotion change
  useEffect(() => {
    const now = performance.now();
    const sharedCounts = new Map<string, number>();
    for (const v of runtimesRef.current.values()) {
      if (v.behavior !== 'walking' && v.behavior !== 'inside') {
        const k = `${v.gridX}_${v.gridY}`;
        sharedCounts.set(k, (sharedCounts.get(k) ?? 0) + 1);
      }
    }
    for (const v of runtimesRef.current.values()) {
      v.lastTransform = '';
      v.lastWidth = 0;
      v.lastHeight = 0;
      syncDomForVillager(v, now, sharedCounts);
    }
    wakeLoopRef.current?.();
  }, [villagerList, boundsMinX, boundsMinY, scale, reducedMotion, syncDomForVillager]);

  // Single requestAnimationFrame loop that sleeps on earliest stateUntilMs when idle
  // and pauses completely when document.hidden is true.
  useEffect(() => {
    let rafId: number | null = null;
    let wakeTimeoutId: number | null = null;
    let lastTime = performance.now();

    const clearTimers = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (wakeTimeoutId !== null) {
        window.clearTimeout(wakeTimeoutId);
        wakeTimeoutId = null;
      }
    };

    const tick = (now: number) => {
      rafId = null;
      if (document.hidden) return;

      const dt = Math.min(100, Math.max(0, now - lastTime));
      lastTime = now;

      const map = runtimesRef.current;
      const reduced = reducedMotionRef.current;
      let removedAnyVisitor = false;
      let needsContinuousFrame = false;
      let earliestWakeMs = Infinity;

      const registerWake = (targetMs: number) => {
        if (Number.isFinite(targetMs) && targetMs > now) {
          earliestWakeMs = Math.min(earliestWakeMs, targetMs - now);
        }
      };

      // Track cells currently being entered by earlier walkers this frame for collision waiting
      const claimedStepCells = new Set<string>();

      for (const [id, v] of Array.from(map.entries())) {
        if (v.isArrivalVisitor && v.expiresAtMs) {
          if (now >= v.expiresAtMs) {
            releaseReservation(v);
            map.delete(id);
            removedAnyVisitor = true;
            continue;
          }
          if (!reduced) {
            needsContinuousFrame = true;
          } else {
            registerWake(v.expiresAtMs);
          }
        }

        if (v.fadeUntilMs && now < v.fadeUntilMs) {
          needsContinuousFrame = true;
        }

        if (v.bubbleUntilMs > now) {
          registerWake(v.bubbleUntilMs);
        } else if (v.bubbleText) {
          v.bubbleText = '';
          v.bubbleUntilMs = 0;
        }

        if (v.behavior === 'walking') {
          if (v.pathIndex >= v.path.length - 1) {
            v.col = v.gridX;
            v.row = v.gridY;
            if (v.onHarvestComplete) {
              v.behavior = 'harvesting';
              v.stateStartedAtMs = now;
              v.stateUntilMs = now + (reduced ? 150 : VILLAGER_CONFIG.harvestWaitMs);
              needsContinuousFrame = true;
            } else if (v.pendingArrival) {
              const arrival = v.pendingArrival;
              v.pendingArrival = null;
              v.stateStartedAtMs = now;
              if (arrival.kind === 'tending') {
                v.behavior = 'tending';
                v.facing = facingToward({ x: v.gridX, y: v.gridY }, arrival.faceTarget, v.facing);
                v.stateUntilMs = now + randRange(v.rng, arrival.minMs, arrival.maxMs);
                tryShowBubble(v, arrival.bubble, now);
                if (!reduced) needsContinuousFrame = true;
                else registerWake(v.stateUntilMs);
              } else if (arrival.kind === 'inside') {
                v.behavior = 'inside';
                v.facing = facingToward({ x: v.gridX, y: v.gridY }, arrival.faceTarget, v.facing);
                v.stateUntilMs = now + randRange(v.rng, arrival.minMs, arrival.maxMs);
                if (!reduced) needsContinuousFrame = true;
                else registerWake(v.stateUntilMs);
              } else if (arrival.kind === 'lookAround') {
                v.behavior = reduced ? 'idle' : 'lookAround';
                v.stateUntilMs = now + randRange(v.rng, arrival.minMs, arrival.maxMs);
                if (!reduced) {
                  v.lookFlipsRemaining = v.rng() < 0.5 ? 1 : 2;
                  v.nextLookFlipAtMs = now + randRange(v.rng, 700, 1200);
                  registerWake(v.nextLookFlipAtMs);
                }
                registerWake(v.stateUntilMs);
              } else {
                v.behavior = 'idle';
                v.stateUntilMs = now + randRange(v.rng, arrival.minMs, arrival.maxMs);
                if (arrival.bubble) {
                  tryShowBubble(v, arrival.bubble, now);
                }
                registerWake(v.stateUntilMs);
              }
            } else {
              v.behavior = 'idle';
              v.stateStartedAtMs = now;
              v.stateUntilMs =
                now + randRange(v.rng, VILLAGER_CONFIG.wanderMinMs, VILLAGER_CONFIG.wanderMaxMs);
              registerWake(v.stateUntilMs);
            }
          } else {
            const from = v.path[v.pathIndex]!;
            const to = v.path[v.pathIndex + 1]!;
            const toKey = `${to.x}_${to.y}`;
            v.facing = facingToward(from, to, v.facing);

            if (reduced) {
              const dest = v.path[v.path.length - 1]!;
              v.col = dest.x;
              v.row = dest.y;
              v.gridX = dest.x;
              v.gridY = dest.y;
              v.pathIndex = v.path.length - 1;
              v.fadeUntilMs = now + 220;
              needsContinuousFrame = true;
            } else if (now < v.stepWaitUntilMs) {
              // Waiting briefly to let another walker clear the shared step cell
              needsContinuousFrame = true;
            } else if (v.stepElapsedMs === 0 && claimedStepCells.has(toKey)) {
              // Later walker yields for 300-600ms instead of stacking onto the same cell
              v.stepWaitUntilMs = now + randRange(v.rng, 300, 600);
              needsContinuousFrame = true;
            } else {
              claimedStepCells.add(toKey);
              needsContinuousFrame = true;
              const roleMsPerTile = VILLAGER_CONFIG.msPerTile * getSpeedMultiplierForRole(v.role);
              v.stepElapsedMs += dt;
              v.frameElapsedMs += dt;
              const roleFrameInterval =
                VILLAGER_CONFIG.frameIntervalMs * Math.min(1.3, getSpeedMultiplierForRole(v.role));
              if (v.frameElapsedMs >= roleFrameInterval) {
                v.frameElapsedMs %= roleFrameInterval;
                v.frameIndex = (v.frameIndex + 1) % 4;
              }
              const progress = Math.min(1, v.stepElapsedMs / roleMsPerTile);
              v.col = from.x + (to.x - from.x) * progress;
              v.row = from.y + (to.y - from.y) * progress;

              if (progress >= 1) {
                v.stepElapsedMs = 0;
                v.pathIndex += 1;
                v.gridX = to.x;
                v.gridY = to.y;
                v.col = to.x;
                v.row = to.y;
              }
            }
          }
        } else if (v.behavior === 'harvesting') {
          if (now >= v.stateUntilMs) {
            const cb = v.onHarvestComplete;
            v.onHarvestComplete = undefined;
            v.behavior = 'idle';
            v.stateStartedAtMs = now;
            v.stateUntilMs =
              now +
              (reduced
                ? randRange(
                    v.rng,
                    VILLAGER_CONFIG.reducedRelocateMinMs,
                    VILLAGER_CONFIG.reducedRelocateMaxMs,
                  )
                : randRange(v.rng, 1500, 3000));
            registerWake(v.stateUntilMs);
            if (cb) cb();
          } else {
            registerWake(v.stateUntilMs);
          }
        } else if (v.behavior === 'tending') {
          if (now >= v.stateUntilMs) {
            v.behavior = 'idle';
            v.stateStartedAtMs = now;
            v.stateUntilMs = now + randRange(v.rng, 1500, 3000);
            registerWake(v.stateUntilMs);
          } else if (!reduced) {
            needsContinuousFrame = true;
          } else {
            registerWake(v.stateUntilMs);
          }
        } else if (v.behavior === 'inside') {
          if (now >= v.stateUntilMs) {
            v.behavior = 'exiting';
            v.stateStartedAtMs = now;
            v.stateUntilMs = now + (reduced ? 0 : VILLAGER_CONFIG.doorFadeMs);
            if (!reduced) needsContinuousFrame = true;
          } else if (!reduced && now - v.stateStartedAtMs < VILLAGER_CONFIG.doorFadeMs) {
            needsContinuousFrame = true;
          } else {
            registerWake(v.stateUntilMs);
          }
        } else if (v.behavior === 'exiting') {
          if (now >= v.stateUntilMs) {
            v.behavior = 'idle';
            v.stateStartedAtMs = now;
            v.homeWanderRemaining = v.rng() < 0.5 ? 1 : 2;
            v.stateUntilMs = now + randRange(v.rng, 2000, 4000);
            registerWake(v.stateUntilMs);
          } else if (!reduced) {
            needsContinuousFrame = true;
          }
        } else if (v.behavior === 'lookAround') {
          if (now >= v.stateUntilMs) {
            v.behavior = 'idle';
            v.stateStartedAtMs = now;
            v.stateUntilMs = now;
          } else {
            if (!reduced && v.lookFlipsRemaining > 0 && now >= v.nextLookFlipAtMs) {
              v.facing = v.facing === 'left' ? 'right' : 'left';
              v.lookFlipsRemaining -= 1;
              v.nextLookFlipAtMs =
                v.lookFlipsRemaining > 0 ? now + randRange(v.rng, 700, 1200) : Infinity;
            }
            registerWake(v.nextLookFlipAtMs);
            registerWake(v.stateUntilMs);
          }
        } else if (v.behavior === 'react') {
          if (now >= v.stateUntilMs) {
            v.behavior = 'idle';
            v.stateStartedAtMs = now;
            v.stateUntilMs =
              now +
              (reduced
                ? randRange(
                    v.rng,
                    VILLAGER_CONFIG.reducedRelocateMinMs,
                    VILLAGER_CONFIG.reducedRelocateMaxMs,
                  )
                : randRange(v.rng, 1200, 2600));
            registerWake(v.stateUntilMs);
          } else if (!reduced && now - v.stateStartedAtMs < 380) {
            needsContinuousFrame = true;
          } else {
            registerWake(v.stateUntilMs);
          }
        } else if (v.behavior === 'idle' && !v.isArrivalVisitor) {
          if (now >= v.stateUntilMs) {
            const walkable = walkableCellsRef.current;
            const otherIdlePositions: GridCoord[] = [];
            for (const other of map.values()) {
              if (other.id !== v.id && other.behavior !== 'inside') {
                otherIdlePositions.push({ x: other.gridX, y: other.gridY });
              }
            }

            if (reduced) {
              // Reduced motion: at most one crossfade teleport every 20-30s, no wandering
              const picked = pickNextTarget({
                villagerId: v.id,
                role: 'stroller',
                from: { x: v.gridX, y: v.gridY },
                walkableCells: walkable,
                land: landRef.current,
                blockedKeys: blockedRef.current,
                tiles: tilesRef.current,
                catalog: catalogRef.current,
                reservedTargets: reservedTargetsRef.current,
                otherIdlePositions,
                rng: v.rng,
              });
              if (picked) {
                reserveCell(v, picked.goal);
                v.col = picked.goal.x;
                v.row = picked.goal.y;
                v.gridX = picked.goal.x;
                v.gridY = picked.goal.y;
                v.fadeUntilMs = now + 220;
                needsContinuousFrame = true;
              }
              v.stateStartedAtMs = now;
              v.stateUntilMs =
                now +
                randRange(
                  v.rng,
                  VILLAGER_CONFIG.reducedRelocateMinMs,
                  VILLAGER_CONFIG.reducedRelocateMaxMs,
                );
              registerWake(v.stateUntilMs);
            } else {
              const picked = pickNextTarget({
                villagerId: v.id,
                role: v.role,
                from: { x: v.gridX, y: v.gridY },
                walkableCells: walkable,
                land: landRef.current,
                blockedKeys: blockedRef.current,
                tiles: tilesRef.current,
                catalog: catalogRef.current,
                reservedTargets: reservedTargetsRef.current,
                otherIdlePositions,
                rng: v.rng,
                homeWanderRemaining: v.homeWanderRemaining,
              });

              if (picked) {
                const path = findSeededWalkablePath({
                  start: { x: v.gridX, y: v.gridY },
                  goal: picked.goal,
                  land: landRef.current,
                  blockedKeys: blockedRef.current,
                  rng: v.rng,
                });
                if (path && path.length > 1) {
                  reserveCell(v, picked.goal);
                  if (picked.decrementHomeWander) {
                    v.homeWanderRemaining = Math.max(0, v.homeWanderRemaining - 1);
                  }
                  v.path = path;
                  v.pathIndex = 0;
                  v.stepElapsedMs = 0;
                  v.frameElapsedMs = 0;
                  v.stepWaitUntilMs = 0;
                  v.pendingArrival = picked.arrival;
                  v.behavior = 'walking';
                  v.stateStartedAtMs = now;
                  needsContinuousFrame = true;
                } else if (path && path.length === 1 && picked.arrival.kind === 'inside') {
                  // Already standing on door cell
                  v.behavior = 'inside';
                  v.facing = facingToward(
                    { x: v.gridX, y: v.gridY },
                    picked.arrival.faceTarget,
                    v.facing,
                  );
                  v.stateStartedAtMs = now;
                  v.stateUntilMs =
                    now + randRange(v.rng, picked.arrival.minMs, picked.arrival.maxMs);
                  needsContinuousFrame = true;
                } else {
                  v.stateUntilMs =
                    now +
                    randRange(v.rng, VILLAGER_CONFIG.wanderMinMs, VILLAGER_CONFIG.wanderMaxMs);
                  registerWake(v.stateUntilMs);
                }
              } else {
                v.stateUntilMs =
                  now + randRange(v.rng, VILLAGER_CONFIG.wanderMinMs, VILLAGER_CONFIG.wanderMaxMs);
                registerWake(v.stateUntilMs);
              }
            }
          } else {
            registerWake(v.stateUntilMs);
          }
        }
      }

      // Compute idle cell sharing counts once per tick for seeded visual separation
      const sharedCellCounts = new Map<string, number>();
      for (const v of map.values()) {
        if (v.behavior !== 'walking' && v.behavior !== 'inside') {
          const k = `${v.gridX}_${v.gridY}`;
          sharedCellCounts.set(k, (sharedCellCounts.get(k) ?? 0) + 1);
        }
      }

      for (const v of map.values()) {
        syncDomForVillager(v, now, sharedCellCounts);
      }

      if (removedAnyVisitor) {
        setVillagerList(
          Array.from(map.values()).map((v) => ({
            id: v.id,
            kind: v.kind,
            isArrivalVisitor: v.isArrivalVisitor,
            initialX: v.gridX,
            initialY: v.gridY,
          })),
        );
      }

      if (needsContinuousFrame) {
        rafId = window.requestAnimationFrame(tick);
      } else if (Number.isFinite(earliestWakeMs) && earliestWakeMs < Infinity) {
        wakeTimeoutId = window.setTimeout(
          () => {
            wakeTimeoutId = null;
            if (!document.hidden && rafId === null) {
              lastTime = performance.now();
              rafId = window.requestAnimationFrame(tick);
            }
          },
          Math.max(50, Math.round(earliestWakeMs)),
        );
      }
    };

    const wake = () => {
      if (document.hidden) return;
      clearTimers();
      lastTime = performance.now();
      rafId = window.requestAnimationFrame(tick);
    };

    wakeLoopRef.current = wake;

    const handleVisibility = () => {
      if (document.hidden) {
        clearTimers();
      } else {
        wake();
      }
    };

    wake();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      wakeLoopRef.current = null;
      clearTimers();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [syncDomForVillager, reserveCell, releaseReservation, tryShowBubble]);

  const notifyTownEvent = useCallback((event: TownReactionEvent) => {
    const now = performance.now();
    let reactedAny = false;
    for (const v of runtimesRef.current.values()) {
      if (v.isArrivalVisitor) continue;
      if (v.behavior === 'walking' || v.behavior === 'harvesting' || v.behavior === 'inside') {
        continue;
      }
      const dist = Math.abs(v.gridX - event.x) + Math.abs(v.gridY - event.y);
      if (dist > 3) continue;

      v.behavior = 'react';
      v.stateStartedAtMs = now;
      v.stateUntilMs = now + randRange(v.rng, 900, 1400);
      v.facing = facingToward({ x: v.gridX, y: v.gridY }, { x: event.x, y: event.y }, v.facing);
      v.bubbleText = event.type === 'harvest' ? '✨' : v.rng() < 0.5 ? '✨' : '👏';
      v.bubbleUntilMs = now + randRange(v.rng, 1200, 1800);
      reactedAny = true;
    }
    if (reactedAny) {
      wakeLoopRef.current?.();
    }
  }, []);

  const dispatchHarvest = useCallback(
    (target: GridCoord, onHarvestComplete: () => void) => {
      const residents = Array.from(runtimesRef.current.values()).filter(
        (v) => !v.isArrivalVisitor && !v.onHarvestComplete,
      );

      let bestVillager: VillagerRuntime | null = null;
      let bestPath: GridCoord[] | null = null;

      for (const v of residents) {
        const path = findSeededWalkablePath({
          start: { x: Math.round(v.col), y: Math.round(v.row) },
          goal: target,
          land: landRef.current,
          blockedKeys: blockedRef.current,
          rng: v.rng,
          allowGoalBlocked: true,
        });
        if (path && (!bestPath || path.length < bestPath.length)) {
          bestPath = path;
          bestVillager = v;
        }
      }

      if (!bestVillager || !bestPath) {
        onHarvestComplete();
        return;
      }

      const now = performance.now();
      bestVillager.onHarvestComplete = onHarvestComplete;
      bestVillager.pendingArrival = null;
      bestVillager.stepWaitUntilMs = 0;

      // Interrupt any state (including inside -> immediately restore visibility)
      if (bestVillager.behavior === 'inside') {
        bestVillager.fadeUntilMs = now + 150;
      }

      reserveCell(bestVillager, target);

      if (reducedMotionRef.current || bestPath.length <= 1) {
        bestVillager.col = target.x;
        bestVillager.row = target.y;
        bestVillager.gridX = target.x;
        bestVillager.gridY = target.y;
        bestVillager.path = [target];
        bestVillager.pathIndex = 0;
        bestVillager.fadeUntilMs = now + 220;
        bestVillager.behavior = 'harvesting';
        bestVillager.stateStartedAtMs = now;
        bestVillager.stateUntilMs =
          now + (reducedMotionRef.current ? 150 : VILLAGER_CONFIG.harvestWaitMs);
        wakeLoopRef.current?.();
        return;
      }

      bestVillager.path = bestPath;
      bestVillager.pathIndex = 0;
      bestVillager.stepElapsedMs = 0;
      bestVillager.frameElapsedMs = 0;
      bestVillager.behavior = 'walking';
      bestVillager.stateStartedAtMs = now;
      wakeLoopRef.current?.();
    },
    [reserveCell],
  );

  // Test-only hook behind NEXT_PUBLIC_E2E for deterministic Playwright path checks
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E !== '1' || typeof window === 'undefined') return;
    const win = window as Window & {
      __rontownVillagers?: {
        walkVillagerTo: (target: GridCoord, villagerId?: string) => boolean;
        getVillagerStates: () => Array<{
          id: string;
          col: number;
          row: number;
          gridX: number;
          gridY: number;
          behavior: VillagerState;
          role: VillagerRole;
        }>;
      };
    };
    win.__rontownVillagers = {
      walkVillagerTo: (target: GridCoord, villagerId = 'resident_0') => {
        const v = runtimesRef.current.get(villagerId);
        if (!v) return false;
        const path = findSeededWalkablePath({
          start: { x: Math.round(v.col), y: Math.round(v.row) },
          goal: target,
          land: landRef.current,
          blockedKeys: blockedRef.current,
          rng: v.rng,
        });
        if (!path || path.length <= 1) return false;
        reserveCell(v, target);
        v.path = path;
        v.pathIndex = 0;
        v.stepElapsedMs = 0;
        v.frameElapsedMs = 0;
        v.stepWaitUntilMs = 0;
        v.pendingArrival = null;
        v.behavior = 'walking';
        v.stateStartedAtMs = performance.now();
        wakeLoopRef.current?.();
        return true;
      },
      getVillagerStates: () =>
        Array.from(runtimesRef.current.values()).map((v) => ({
          id: v.id,
          col: v.col,
          row: v.row,
          gridX: v.gridX,
          gridY: v.gridY,
          behavior: v.behavior,
          role: v.role,
        })),
    };
    return () => {
      delete win.__rontownVillagers;
    };
  }, [reserveCell]);

  return {
    villagerList,
    registerDom,
    dispatchHarvest,
    notifyTownEvent,
  };
}
