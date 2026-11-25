'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  findWalkablePath,
  isGroundWalkable,
  type GridCoord,
  type GroundTileType,
} from '@ronduel/shared';
import { getVillagerFeetPoint, isoToScreen } from './iso';
import { RESIDENT_VILLAGER_KINDS, VILLAGER_SPRITES, type VillagerKind } from './sprites';

/** Configurable villager movement & animation constants. */
export const VILLAGER_CONFIG = {
  /** Walking speed: ~1 tile per 600ms. */
  msPerTile: 600,
  /** Walk cycle frame interval: 160ms across _f1.._f4. */
  frameIntervalMs: 160,
  /** Idle wander delay range (ms). */
  wanderMinMs: 3000,
  wanderMaxMs: 6000,
  /** Harvest pause at target plot before completing harvest (ms). */
  harvestWaitMs: 1000,
  /** Maximum resident villagers rendered simultaneously on the map. */
  maxVisibleResidents: 16,
  /** How long a newly arrived visitor stays visible on population increase (ms). */
  visitorDurationMs: 8000,
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
  isArrivalVisitor: boolean;
  col: number;
  row: number;
  gridX: number;
  gridY: number;
  facing: 'right' | 'left';
  state: 'idle' | 'walking' | 'harvesting';
  path: GridCoord[];
  pathIndex: number;
  stepElapsedMs: number;
  frameElapsedMs: number;
  frameIndex: number;
  nextWanderAtMs: number;
  harvestWaitRemainingMs: number;
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
}

export interface VillagerDomHandles {
  wrap: HTMLDivElement | null;
  img: HTMLImageElement | null;
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

function randomIdleDelay(): number {
  const span = VILLAGER_CONFIG.wanderMaxMs - VILLAGER_CONFIG.wanderMinMs;
  return VILLAGER_CONFIG.wanderMinMs + Math.random() * span;
}

function getWalkableCells(
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

interface UseVillagersParams {
  population: number;
  land: Record<string, GroundTileType>;
  blockedKeys: ReadonlySet<string>;
  boundsMinX: number;
  boundsMinY: number;
  scale: number;
  reducedMotion: boolean;
}

export function useVillagers({
  population,
  land,
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
    return Array.from({ length: count }, (_, i) => {
      const spawn = cells[i % cells.length]!;
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
  const domRefs = useRef<Map<string, VillagerDomHandles>>(new Map());
  const landRef = useRef(land);
  const blockedRef = useRef(blockedKeys);
  const layoutRef = useRef({ boundsMinX, boundsMinY, scale });
  const reducedMotionRef = useRef(reducedMotion);
  const prevPopRef = useRef<number | null>(null);
  const visitorCounterRef = useRef(0);
  const wakeLoopRef = useRef<(() => void) | null>(null);

  landRef.current = land;
  blockedRef.current = blockedKeys;
  layoutRef.current = { boundsMinX, boundsMinY, scale };
  reducedMotionRef.current = reducedMotion;

  const registerDom = useCallback(
    (id: string, part: 'wrap' | 'img', el: HTMLDivElement | HTMLImageElement | null) => {
      const existing = domRefs.current.get(id) ?? { wrap: null, img: null };
      if (part === 'wrap') existing.wrap = el as HTMLDivElement | null;
      if (part === 'img') existing.img = el as HTMLImageElement | null;
      if (!existing.wrap && !existing.img) {
        domRefs.current.delete(id);
      } else {
        domRefs.current.set(id, existing);
      }
    },
    [],
  );

  /**
   * Pure write-only DOM sync using cached values — zero layout reads, zero forced reflows.
   */
  const syncDomForVillager = useCallback((v: VillagerRuntime, nowMs: number) => {
    const handles = domRefs.current.get(v.id);
    if (!handles?.wrap || !handles?.img) return;

    const { boundsMinX: minX, boundsMinY: minY, scale: s } = layoutRef.current;
    const specSet = VILLAGER_SPRITES[v.kind];
    const isMoving = v.state === 'walking' && !reducedMotionRef.current;
    const activeSprite =
      isMoving && specSet.walkFrames
        ? specSet.walkFrames[v.frameIndex % specSet.walkFrames.length]!
        : specSet.idle;

    const feet = getVillagerFeetPoint(v.col, v.row);
    const pxX = Math.round((feet.x - minX - activeSprite.width / 2) * s);
    const pxY = Math.round((feet.y - minY - activeSprite.height) * s);
    const bobPx =
      !reducedMotionRef.current &&
      !specSet.walkFrames &&
      (v.state === 'walking' || v.isArrivalVisitor)
        ? Math.round(Math.sin(nowMs / 180) * 2) * s
        : 0;

    const nextTransform = `translate3d(${pxX}px, ${pxY + bobPx}px, 0)`;
    if (v.lastTransform !== nextTransform) {
      handles.wrap.style.transform = nextTransform;
      v.lastTransform = nextTransform;
    }

    const nextZ = String(Math.round((v.col + v.row) * 10) + 6);
    if (v.lastZIndex !== nextZ) {
      handles.wrap.style.zIndex = nextZ;
      v.lastZIndex = nextZ;
    }

    const nextOpacity = v.fadeUntilMs && nowMs < v.fadeUntilMs ? '0.55' : '1';
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
  }, []);

  // Reconcile resident villager count & arrival visitor when population or walkable tiles change
  useEffect(() => {
    const walkable = getWalkableCells(land, blockedKeys);
    const fallbackCells =
      walkable.length > 0
        ? walkable
        : Object.keys(land).map((k) => {
            const [x, y] = k.split('_').map(Number);
            return { x: x ?? 3, y: y ?? 3 };
          });

    if (fallbackCells.length === 0) return;

    const desiredCount = Math.max(
      1,
      Math.min(population, VILLAGER_CONFIG.maxVisibleResidents),
    );
    const map = runtimesRef.current;
    const now = performance.now();
    let changed = false;

    for (let i = 0; i < desiredCount; i++) {
      const id = `resident_${i}`;
      if (!map.has(id)) {
        const spawn = fallbackCells[i % fallbackCells.length]!;
        map.set(id, {
          id,
          kind: RESIDENT_VILLAGER_KINDS[i % RESIDENT_VILLAGER_KINDS.length]!,
          isArrivalVisitor: false,
          col: spawn.x,
          row: spawn.y,
          gridX: spawn.x,
          gridY: spawn.y,
          facing: i % 2 === 0 ? 'right' : 'left',
          state: 'idle',
          path: [],
          pathIndex: 0,
          stepElapsedMs: 0,
          frameElapsedMs: 0,
          frameIndex: 0,
          nextWanderAtMs: now + randomIdleDelay(),
          harvestWaitRemainingMs: 0,
          lastTransform: '',
          lastZIndex: '',
          lastOpacity: '',
          lastSrc: '',
          lastWidth: 0,
          lastHeight: 0,
          lastFacing: '',
        });
        changed = true;
      }
    }

    for (const [id, v] of Array.from(map.entries())) {
      if (!v.isArrivalVisitor) {
        const idx = Number(id.replace('resident_', ''));
        if (idx >= desiredCount) {
          map.delete(id);
          changed = true;
        }
      }
    }

    // Spawn arrival visitor when population increases
    if (prevPopRef.current !== null && population > prevPopRef.current) {
      visitorCounterRef.current += 1;
      const vid = `visitor_${visitorCounterRef.current}`;
      const spawn = fallbackCells[Math.floor(Math.random() * fallbackCells.length)]!;
      map.set(vid, {
        id: vid,
        kind: 'visitor',
        isArrivalVisitor: true,
        col: spawn.x,
        row: spawn.y,
        gridX: spawn.x,
        gridY: spawn.y,
        facing: 'right',
        state: 'idle',
        path: [],
        pathIndex: 0,
        stepElapsedMs: 0,
        frameElapsedMs: 0,
        frameIndex: 0,
        nextWanderAtMs: Infinity,
        harvestWaitRemainingMs: 0,
        expiresAtMs: now + VILLAGER_CONFIG.visitorDurationMs,
        lastTransform: '',
        lastZIndex: '',
        lastOpacity: '',
        lastSrc: '',
        lastWidth: 0,
        lastHeight: 0,
        lastFacing: '',
      });
      changed = true;
    }
    prevPopRef.current = population;

    for (const v of map.values()) {
      const key = `${Math.round(v.col)}_${Math.round(v.row)}`;
      if (v.state === 'idle' && (!isGroundWalkable(land[key]) || blockedKeys.has(key))) {
        const safe = fallbackCells[0]!;
        v.col = safe.x;
        v.row = safe.y;
        v.gridX = safe.x;
        v.gridY = safe.y;
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
          prev.every((item, idx) => item.id === nextList[idx]?.id && item.kind === nextList[idx]?.kind)
        ) {
          return prev;
        }
        return nextList;
      });
      wakeLoopRef.current?.();
    }
  }, [population, land, blockedKeys]);

  // Reposition immediately when bounds/scale/list/reducedMotion change
  useEffect(() => {
    const now = performance.now();
    for (const v of runtimesRef.current.values()) {
      // Invalidate cache so new layout/scale writes cleanly once
      v.lastTransform = '';
      v.lastWidth = 0;
      v.lastHeight = 0;
      syncDomForVillager(v, now);
    }
    wakeLoopRef.current?.();
  }, [villagerList, boundsMinX, boundsMinY, scale, reducedMotion, syncDomForVillager]);

  // Single requestAnimationFrame loop that sleeps when all villagers are idle (zero idle CPU!)
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
      let removedAnyVisitor = false;
      let needsContinuousFrame = false;
      let earliestWakeMs = Infinity;

      for (const [id, v] of Array.from(map.entries())) {
        if (v.isArrivalVisitor && v.expiresAtMs) {
          if (now >= v.expiresAtMs) {
            map.delete(id);
            removedAnyVisitor = true;
            continue;
          }
          if (!reducedMotionRef.current) {
            needsContinuousFrame = true;
          } else {
            earliestWakeMs = Math.min(earliestWakeMs, v.expiresAtMs - now);
          }
        }

        if (v.fadeUntilMs && now < v.fadeUntilMs) {
          needsContinuousFrame = true;
        }

        if (v.state === 'walking') {
          needsContinuousFrame = true;
          if (v.pathIndex >= v.path.length - 1) {
            v.col = v.gridX;
            v.row = v.gridY;
            if (v.onHarvestComplete) {
              v.state = 'harvesting';
              v.harvestWaitRemainingMs = reducedMotionRef.current
                ? 150
                : VILLAGER_CONFIG.harvestWaitMs;
            } else {
              v.state = 'idle';
              v.nextWanderAtMs = now + randomIdleDelay();
            }
          } else {
            const from = v.path[v.pathIndex]!;
            const to = v.path[v.pathIndex + 1]!;
            const screenDeltaX = isoToScreen(to.x, to.y).x - isoToScreen(from.x, from.y).x;
            if (screenDeltaX !== 0) {
              v.facing = screenDeltaX < 0 ? 'left' : 'right';
            }

            if (reducedMotionRef.current) {
              const dest = v.path[v.path.length - 1]!;
              v.col = dest.x;
              v.row = dest.y;
              v.gridX = dest.x;
              v.gridY = dest.y;
              v.pathIndex = v.path.length - 1;
              v.fadeUntilMs = now + 220;
            } else {
              v.stepElapsedMs += dt;
              v.frameElapsedMs += dt;
              if (v.frameElapsedMs >= VILLAGER_CONFIG.frameIntervalMs) {
                v.frameElapsedMs %= VILLAGER_CONFIG.frameIntervalMs;
                v.frameIndex = (v.frameIndex + 1) % 4;
              }
              const progress = Math.min(1, v.stepElapsedMs / VILLAGER_CONFIG.msPerTile);
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
        } else if (v.state === 'harvesting') {
          needsContinuousFrame = true;
          v.harvestWaitRemainingMs -= dt;
          if (v.harvestWaitRemainingMs <= 0) {
            const cb = v.onHarvestComplete;
            v.onHarvestComplete = undefined;
            v.state = 'idle';
            v.nextWanderAtMs = now + randomIdleDelay();
            if (cb) cb();
          }
        } else if (v.state === 'idle' && !v.isArrivalVisitor && !reducedMotionRef.current) {
          const remaining = v.nextWanderAtMs - now;
          if (remaining <= 0) {
            const walkable = getWalkableCells(landRef.current, blockedRef.current);
            const nearby = walkable.filter(
              (c) =>
                (c.x !== v.gridX || c.y !== v.gridY) &&
                Math.abs(c.x - v.gridX) + Math.abs(c.y - v.gridY) <= 4,
            );
            const candidates = nearby.length > 0 ? nearby : walkable;
            if (candidates.length > 0) {
              const goal = candidates[Math.floor(Math.random() * candidates.length)]!;
              const path = findWalkablePath({
                start: { x: v.gridX, y: v.gridY },
                goal,
                land: landRef.current,
                blockedKeys: blockedRef.current,
              });
              if (path && path.length > 1) {
                v.path = path;
                v.pathIndex = 0;
                v.stepElapsedMs = 0;
                v.frameElapsedMs = 0;
                v.state = 'walking';
                needsContinuousFrame = true;
              } else {
                v.nextWanderAtMs = now + randomIdleDelay();
                earliestWakeMs = Math.min(earliestWakeMs, v.nextWanderAtMs - now);
              }
            } else {
              v.nextWanderAtMs = now + randomIdleDelay();
              earliestWakeMs = Math.min(earliestWakeMs, v.nextWanderAtMs - now);
            }
          } else {
            earliestWakeMs = Math.min(earliestWakeMs, remaining);
          }
        }

        syncDomForVillager(v, now);
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
        wakeTimeoutId = window.setTimeout(() => {
          wakeTimeoutId = null;
          if (!document.hidden && rafId === null) {
            lastTime = performance.now();
            rafId = window.requestAnimationFrame(tick);
          }
        }, Math.max(50, Math.round(earliestWakeMs)));
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
  }, [syncDomForVillager]);

  const dispatchHarvest = useCallback((target: GridCoord, onHarvestComplete: () => void) => {
    const residents = Array.from(runtimesRef.current.values()).filter(
      (v) => !v.isArrivalVisitor && !v.onHarvestComplete,
    );

    let bestVillager: VillagerRuntime | null = null;
    let bestPath: GridCoord[] | null = null;

    for (const v of residents) {
      const path = findWalkablePath({
        start: { x: Math.round(v.col), y: Math.round(v.row) },
        goal: target,
        land: landRef.current,
        blockedKeys: blockedRef.current,
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

    bestVillager.onHarvestComplete = onHarvestComplete;

    if (reducedMotionRef.current || bestPath.length <= 1) {
      bestVillager.col = target.x;
      bestVillager.row = target.y;
      bestVillager.gridX = target.x;
      bestVillager.gridY = target.y;
      bestVillager.path = [target];
      bestVillager.pathIndex = 0;
      bestVillager.fadeUntilMs = performance.now() + 220;
      bestVillager.state = 'harvesting';
      bestVillager.harvestWaitRemainingMs = reducedMotionRef.current
        ? 150
        : VILLAGER_CONFIG.harvestWaitMs;
      wakeLoopRef.current?.();
      return;
    }

    bestVillager.path = bestPath;
    bestVillager.pathIndex = 0;
    bestVillager.stepElapsedMs = 0;
    bestVillager.frameElapsedMs = 0;
    bestVillager.state = 'walking';
    wakeLoopRef.current?.();
  }, []);

  return {
    villagerList,
    registerDom,
    dispatchHarvest,
  };
}
