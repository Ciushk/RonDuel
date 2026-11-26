'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  calculateTownCapacities,
  calculateTownLevel,
  computeExpandRing,
  DEFAULT_TOWN_CATALOG,
  generateStarterLand,
  getGridSizeForLevel,
  getPlotPrice,
  isGroundPlantable,
  isGroundWalkable,
  LAND_PRICES,
  type GridCoord,
  type GroundTileType,
  type TownCatalogDoc,
  type TownDoc,
  type TownOrderItem,
  type TownTileDoc,
} from '@ronduel/shared';
import { trackEvent } from '@/lib/analytics';
import { getLocalSession } from '@/lib/session';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface TileInfo extends TownTileDoc {
  x: number;
  y: number;
  parentTile?: string;
}

export interface FloatingReward {
  id: string;
  x: number;
  y: number;
  text: string;
}

export interface HostVisitInfo {
  displayName: string;
  likesCount: number;
  hasLiked: boolean;
}

export interface TransferStatusInfo {
  isPro: boolean;
  triviaBalance: number;
  dailyRemaining: number;
  dailyCap: number;
}

export type TownConnectionStatus = 'connecting' | 'connected' | 'offline';

export const TOWN_INIT_RETRY_DELAYS_MS = [1000, 3000, 7000] as const;

interface LocalPersistedTown {
  town: TownDoc;
  tiles: Record<string, TileInfo>;
  walletBalance: number;
  inventory: Record<string, number>;
}

export interface ServerTownCache extends LocalPersistedTown {
  savedAt: number;
  source: 'server';
}

interface LocalTutorialState {
  step: number;
  done: boolean;
}

const LOCAL_STORAGE_PREFIX = 'rt_local_town_v2_';
const SERVER_CACHE_PREFIX = 'rt_town_cache_v3_';
const TUTORIAL_KEY = (uid: string) => `rt_tutorial_v1_${uid}`;

function readServerTownCache(uid: string): ServerTownCache | null {
  if (typeof window === 'undefined' || !uid || uid === 'u_ssr' || uid === 'anon') return null;
  try {
    const raw = window.localStorage.getItem(`${SERVER_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ServerTownCache>;
    if (
      parsed.source !== 'server' ||
      !parsed.town ||
      typeof parsed.town !== 'object' ||
      !parsed.tiles ||
      typeof parsed.tiles !== 'object'
    ) {
      return null;
    }
    return {
      town: parsed.town,
      tiles: parsed.tiles,
      walletBalance: typeof parsed.walletBalance === 'number' ? parsed.walletBalance : 100,
      inventory: parsed.inventory ?? {},
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
      source: 'server',
    };
  } catch {
    return null;
  }
}

function writeServerTownCache(uid: string, payload: LocalPersistedTown): void {
  if (typeof window === 'undefined' || !uid || uid === 'u_ssr' || uid === 'anon') return;
  try {
    const entry: ServerTownCache = {
      ...payload,
      savedAt: Date.now(),
      source: 'server',
    };
    window.localStorage.setItem(`${SERVER_CACHE_PREFIX}${uid}`, JSON.stringify(entry));
  } catch {
    // Ignore storage quota errors
  }
}

function readLocalTutorial(uid: string): LocalTutorialState | null {
  if (typeof window === 'undefined' || !uid || uid === 'u_ssr' || uid === 'anon') return null;
  try {
    const raw = window.localStorage.getItem(TUTORIAL_KEY(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalTutorialState>;
    const rawStep =
      typeof parsed.step === 'number' && Number.isFinite(parsed.step) ? parsed.step : 0;
    const done = Boolean(parsed.done) || rawStep >= 3;
    const step = done ? 3 : Math.min(3, Math.max(0, Math.floor(rawStep)));
    return { step, done };
  } catch {
    return null;
  }
}

function writeLocalTutorial(uid: string, state: LocalTutorialState): void {
  if (typeof window === 'undefined' || !uid || uid === 'u_ssr' || uid === 'anon') return;
  try {
    window.localStorage.setItem(TUTORIAL_KEY(uid), JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

function postTutorialStep(uid: string, step: number): void {
  if (typeof window === 'undefined' || !uid || uid === 'u_ssr' || uid === 'anon') return;
  fetch('/api/town/tutorial', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, step }),
  }).catch(() => {});
}

function createDefaultStarterState(): LocalPersistedTown {
  const starterTiles: Record<string, TileInfo> = {
    '3_3': { x: 3, y: 3, itemId: 'starter_house' },
    '3_4': { x: 3, y: 4, itemId: 'plot' },
    '4_4': { x: 4, y: 4, itemId: 'plot' },
  };
  const starterLand = generateStarterLand(
    [
      { x: 3, y: 3 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ],
    8,
  );
  // Show starter farm plots on dirt base until a dedicated tilled-plot PNG exists
  starterLand['3_4'] = 'basic-block-dirt';
  starterLand['4_4'] = 'basic-block-dirt';

  return {
    town: {
      gridSize: 8,
      population: 2,
      housingCapacity: 2,
      serviceCapacity: 4,
      populationCap: 2,
      level: 1,
      maxLevelReached: 1,
      tutorialStep: 0,
      likesCount: 0,
      plotsOwned: 2,
      land: starterLand,
    },
    tiles: starterTiles,
    walletBalance: 100,
    inventory: {},
  };
}

function ensureLandCoversTiles(
  existingLand: Record<string, GroundTileType> | undefined,
  tiles: Record<string, TileInfo>,
  gridSize: number,
): Record<string, GroundTileType> {
  if (existingLand && Object.keys(existingLand).length > 0) {
    const next = { ...existingLand };
    for (const tile of Object.values(tiles)) {
      const k = `${tile.x}_${tile.y}`;
      if (!next[k]) {
        next[k] = tile.itemId === 'plot' ? 'basic-block-dirt' : 'basic-block';
      }
    }
    return next;
  }

  const seeds = Object.values(tiles).map((t) => ({ x: t.x, y: t.y }));
  const land = generateStarterLand(
    seeds.length > 0
      ? seeds
      : [
          { x: 3, y: 3 },
          { x: 3, y: 4 },
          { x: 4, y: 4 },
        ],
    gridSize,
  );
  for (const tile of Object.values(tiles)) {
    if (tile.itemId === 'plot') {
      land[`${tile.x}_${tile.y}`] = 'basic-block-dirt';
    }
  }
  return land;
}

export function useTownState(params: {
  townEnabled: boolean;
  isVisitMode: boolean;
  visitHostUid: string | null;
}) {
  const { townEnabled, isVisitMode, visitHostUid } = params;

  const [catalog] = useState<TownCatalogDoc>(DEFAULT_TOWN_CATALOG);
  const [loading, setLoading] = useState<boolean>(true);
  const [townReady, setTownReady] = useState<boolean>(false);
  const [hydratedFromCache, setHydratedFromCache] = useState<boolean>(false);
  const [town, setTown] = useState<TownDoc | null>(null);
  const [tiles, setTiles] = useState<Record<string, TileInfo>>({});
  const [walletBalance, setWalletBalance] = useState<number>(100);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<TownOrderItem[]>([]);
  const [ordersUnlocked, setOrdersUnlocked] = useState<boolean>(true);
  const [tutorialStep, setTutorialStepState] = useState<number>(3);
  const [tutorialDone, setTutorialDone] = useState<boolean>(true);
  const tutorialStepRef = useRef<number>(3);
  const tutorialDoneRef = useRef<boolean>(true);

  const [hostInfo, setHostInfo] = useState<HostVisitInfo | null>(null);
  const [likeLoading, setLikeLoading] = useState(false);
  const [waterLoading, setWaterLoading] = useState(false);
  const [transferStatus, setTransferStatus] = useState<TransferStatusInfo | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [landPurchasing, setLandPurchasing] = useState(false);

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [floatingRewards, setFloatingRewards] = useState<FloatingReward[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<TownConnectionStatus>(
    isVisitMode ? 'connected' : 'connecting',
  );
  const [initEpoch, setInitEpoch] = useState(0);
  const usingLocalFallbackRef = useRef(false);
  const hasServerTownRef = useRef(false);
  const townReadyRef = useRef(false);
  const serverReadyRef = useRef<boolean>(isVisitMode);
  serverReadyRef.current = isVisitMode || connectionStatus === 'connected';
  townReadyRef.current = townReady;

  const applyTutorialProgress = useCallback((nextStep: number, markDone: boolean) => {
    const clamped = Math.min(3, Math.max(tutorialStepRef.current, Math.floor(nextStep)));
    const done = tutorialDoneRef.current || markDone || clamped >= 3;
    const effective = done ? 3 : clamped;
    tutorialStepRef.current = effective;
    tutorialDoneRef.current = done;
    setTutorialStepState(effective);
    setTutorialDone(done);

    const session = getLocalSession();
    if (session?.uid) {
      writeLocalTutorial(session.uid, { step: effective, done });
      postTutorialStep(session.uid, effective);
    }
  }, []);

  const advanceTutorial = useCallback(
    (nextStep: number) => {
      applyTutorialProgress(nextStep, nextStep >= 3);
    },
    [applyTutorialProgress],
  );

  const skipTutorial = useCallback(() => {
    applyTutorialProgress(3, true);
  }, [applyTutorialProgress]);

  const retryInit = useCallback(() => {
    setConnectionStatus('connecting');
    setInitEpoch((prev) => prev + 1);
  }, []);

  const showToast = useCallback((msg: string) => {
    setActionMessage(msg);
    window.setTimeout(() => {
      setActionMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  const pushFloatingReward = useCallback((x: number, y: number, text: string) => {
    const id = `${x}_${y}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setFloatingRewards((prev) => [...prev, { id, x, y, text }]);
    window.setTimeout(() => {
      setFloatingRewards((prev) => prev.filter((item) => item.id !== id));
    }, 650);
  }, []);

  // Restore last-known server town cache BEFORE first paint (zero starter flash on repeat visits)
  useIsomorphicLayoutEffect(() => {
    if (!townEnabled || isVisitMode) return;
    const session = getLocalSession();
    if (!session?.uid || session.uid === 'u_ssr' || session.uid === 'anon') return;

    const cached = readServerTownCache(session.uid);
    const localTut = readLocalTutorial(session.uid);
    if (cached) {
      const restoredLand = ensureLandCoversTiles(
        cached.town.land,
        cached.tiles,
        cached.town.gridSize ?? 8,
      );
      setTown({ ...cached.town, land: restoredLand });
      setTiles(cached.tiles);
      setWalletBalance(cached.walletBalance);
      setInventory(cached.inventory ?? {});
      const cachedStep = Number(cached.town.tutorialStep ?? 3);
      const localStep = localTut ? (localTut.done ? 3 : localTut.step) : 0;
      const merged = Math.min(3, Math.max(localStep, cachedStep));
      const mergedDone = Boolean(localTut?.done) || merged >= 3;
      tutorialStepRef.current = mergedDone ? 3 : merged;
      tutorialDoneRef.current = mergedDone;
      setTutorialStepState(tutorialStepRef.current);
      setTutorialDone(mergedDone);
      hasServerTownRef.current = true;
      townReadyRef.current = true;
      setHydratedFromCache(true);
      setTownReady(true);
      setLoading(false);
    } else if (localTut) {
      const eff = localTut.done ? 3 : localTut.step;
      tutorialStepRef.current = eff;
      tutorialDoneRef.current = localTut.done || eff >= 3;
      setTutorialStepState(eff);
      setTutorialDone(tutorialDoneRef.current);
    }
  }, [townEnabled, isVisitMode]);

  // Persist server cache (rt_town_cache_v3_) after every real server update,
  // or local offline fallback (rt_local_town_v2_) when explicitly offline.
  useEffect(() => {
    if (isVisitMode || !town || !townReady) return;
    const session = getLocalSession();
    if (!session?.uid || session.uid === 'u_ssr' || session.uid === 'anon') return;
    const payload: LocalPersistedTown = { town, tiles, walletBalance, inventory };
    if (hasServerTownRef.current && !usingLocalFallbackRef.current) {
      writeServerTownCache(session.uid, payload);
      return;
    }
    if (usingLocalFallbackRef.current) {
      try {
        window.localStorage.setItem(
          `${LOCAL_STORAGE_PREFIX}${session.uid}`,
          JSON.stringify(payload),
        );
      } catch {
        // ignore storage quota errors
      }
    }
  }, [isVisitMode, town, tiles, walletBalance, inventory, townReady]);

  // Initialize town (or visit snapshot) on mount with automatic retry/backoff
  useEffect(() => {
    if (!townEnabled) {
      setLoading(false);
      return;
    }

    let active = true;
    let retryTimer: number | null = null;
    const controller = new AbortController();
    const session = getLocalSession();
    if (!session?.uid || session.uid === 'u_ssr' || session.uid === 'anon') {
      setLoading(false);
      return;
    }

    if (isVisitMode && visitHostUid) {
      setConnectionStatus('connected');
      serverReadyRef.current = true;
      fetch(
        `/api/town/visit?hostUid=${encodeURIComponent(visitHostUid)}&viewerUid=${encodeURIComponent(session.uid)}`,
        { signal: controller.signal },
      )
        .then((res) => {
          if (!res.ok) throw new Error('Visit fetch failed');
          return res.json();
        })
        .then((data) => {
          if (!active) return;
          const snap = data.snapshot;
          setHostInfo({
            displayName: snap.displayName,
            likesCount: snap.likesCount ?? 0,
            hasLiked: Boolean(data.hasLiked),
          });
          const snapGridSize = getGridSizeForLevel(snap.level ?? 1);
          const visitTiles: Record<string, TileInfo> = {};
          if (Array.isArray(snap.tiles)) {
            for (const item of snap.tiles) {
              visitTiles[`${item.x}_${item.y}`] = {
                x: item.x,
                y: item.y,
                itemId: item.itemId,
                ...(item.rot ? { rot: item.rot } : {}),
                cropId: item.cropId,
                readyAt: item.ready ? 1 : undefined,
              };
            }
          }
          const land = ensureLandCoversTiles(snap.land, visitTiles, snapGridSize);
          setTown({
            gridSize: snapGridSize,
            population: snap.population ?? 2,
            housingCapacity: snap.population ?? 2,
            serviceCapacity: 4,
            populationCap: snap.population ?? 2,
            level: snap.level ?? 1,
            maxLevelReached: snap.level ?? 1,
            tutorialStep: 3,
            likesCount: snap.likesCount ?? 0,
            plotsOwned: 2,
            land,
            ...(snap.landRot ? { landRot: snap.landRot } : {}),
          });
          setTiles(visitTiles);
          townReadyRef.current = true;
          setTownReady(true);
          setLoading(false);
        })
        .catch(() => {
          if (!active) return;
          // Graceful read-only demo fallback when visiting locally without Functions running
          const demo = createDefaultStarterState();
          setHostInfo({
            displayName: visitHostUid.slice(0, 12),
            likesCount: 0,
            hasLiked: false,
          });
          setTown({ ...demo.town, tutorialStep: 3 });
          setTiles(demo.tiles);
          townReadyRef.current = true;
          setTownReady(true);
          setLoading(false);
        });
      return () => {
        active = false;
        controller.abort();
      };
    }

    setConnectionStatus('connecting');
    serverReadyRef.current = false;

    const runInitAttempt = (retryIndex: number) => {
      if (!active) return;
      fetch(`/api/town/init?uid=${encodeURIComponent(session.uid)}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`Init failed (${res.status})`);
          return res.json();
        })
        .then((data) => {
          if (!active) return;
          if (!data?.town || typeof data.town !== 'object') {
            throw new Error('Missing town payload in init response');
          }
          const serverTiles: Record<string, TileInfo> =
            data.tiles && typeof data.tiles === 'object' ? data.tiles : {};
          const serverTown: TownDoc = data.town as TownDoc;
          const land = ensureLandCoversTiles(
            serverTown.land,
            serverTiles,
            serverTown.gridSize ?? 8,
          );
          const resolvedTown: TownDoc = { ...serverTown, land };
          const nextBalance =
            typeof data.walletBalance === 'number' ? data.walletBalance : walletBalance;

          setTown(resolvedTown);
          setTiles(serverTiles);

          const serverStep = Math.min(3, Math.max(0, Number(serverTown.tutorialStep ?? 0)));
          const localTut = readLocalTutorial(session.uid);
          const localStep = localTut ? (localTut.done ? 3 : localTut.step) : 0;
          const effective = Math.min(3, Math.max(localStep, serverStep));
          const effectiveDone = Boolean(localTut?.done) || effective >= 3;
          tutorialStepRef.current = effectiveDone ? 3 : effective;
          tutorialDoneRef.current = effectiveDone;
          setTutorialStepState(tutorialStepRef.current);
          setTutorialDone(effectiveDone);
          writeLocalTutorial(session.uid, {
            step: tutorialStepRef.current,
            done: effectiveDone,
          });
          if (tutorialStepRef.current > serverStep) {
            postTutorialStep(session.uid, tutorialStepRef.current);
          }

          if (typeof data.walletBalance === 'number') {
            setWalletBalance(data.walletBalance);
          }
          usingLocalFallbackRef.current = false;
          hasServerTownRef.current = true;
          serverReadyRef.current = true;
          townReadyRef.current = true;
          setTownReady(true);
          setConnectionStatus('connected');
          setLoading(false);

          writeServerTownCache(session.uid, {
            town: resolvedTown,
            tiles: serverTiles,
            walletBalance: nextBalance,
            inventory: {},
          });

          // Fetch inventory & daily orders only when town API is reachable
          fetch(`/api/town/inventory?uid=${encodeURIComponent(session.uid)}`, {
            signal: controller.signal,
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (active && d?.crops) setInventory(d.crops);
            })
            .catch(() => {});

          fetch(`/api/town/orders?uid=${encodeURIComponent(session.uid)}`, {
            signal: controller.signal,
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (active && d?.orders) {
                setOrders(d.orders);
                setOrdersUnlocked(Boolean(d.unlocked));
              }
            })
            .catch(() => {});
        })
        .catch(() => {
          if (!active || controller.signal.aborted) return;
          if (retryIndex < TOWN_INIT_RETRY_DELAYS_MS.length) {
            const delayMs = TOWN_INIT_RETRY_DELAYS_MS[retryIndex]!;
            retryTimer = window.setTimeout(() => {
              if (active) runInitAttempt(retryIndex + 1);
            }, delayMs);
            return;
          }

          // Explicit offline fallback after all retries failed
          usingLocalFallbackRef.current = true;
          serverReadyRef.current = false;
          if (!townReadyRef.current) {
            let restoredOffline: LocalPersistedTown | null = null;
            try {
              const raw = window.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${session.uid}`);
              if (raw) {
                restoredOffline = JSON.parse(raw) as LocalPersistedTown;
              }
            } catch {
              // Ignore corrupt offline fallback
            }
            const offlineTown = restoredOffline ?? createDefaultStarterState();
            const offlineLand = ensureLandCoversTiles(
              offlineTown.town.land,
              offlineTown.tiles,
              offlineTown.town.gridSize ?? 8,
            );
            setTown({ ...offlineTown.town, land: offlineLand });
            setTiles(offlineTown.tiles);
            setWalletBalance(offlineTown.walletBalance);
            setInventory(offlineTown.inventory ?? {});
            townReadyRef.current = true;
            setTownReady(true);
          }
          setConnectionStatus('offline');
          setLoading(false);
        });
    };

    runInitAttempt(0);

    return () => {
      active = false;
      controller.abort();
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [townEnabled, isVisitMode, visitHostUid, initEpoch]);

  const gridSize = town?.gridSize ?? 8;
  const land = useMemo<Record<string, GroundTileType>>(() => town?.land ?? {}, [town?.land]);
  const landRot = useMemo<Record<string, 1 | 2 | 3>>(() => town?.landRot ?? {}, [town?.landRot]);

  const expandRing = useMemo<GridCoord[]>(
    () => (isVisitMode ? [] : computeExpandRing(land, gridSize)),
    [land, gridSize, isVisitMode],
  );

  // Blocked cells for villager BFS (buildings, decor except roads, non-walkable ground)
  const blockedKeys = useMemo<ReadonlySet<string>>(() => {
    const blocked = new Set<string>();
    for (const [key, tile] of Object.entries(tiles)) {
      // Roads and empty farm plots are walkable; buildings, decor, and growing crops block walking
      if (tile.itemId === 'road') continue;
      if (tile.itemId === 'plot' && !tile.cropId) continue;
      blocked.add(key);
      const item = catalog.items[tile.itemId];
      if (item && (item.footprint.w > 1 || item.footprint.h > 1)) {
        for (let dx = 0; dx < item.footprint.w; dx++) {
          for (let dy = 0; dy < item.footprint.h; dy++) {
            blocked.add(`${tile.x + dx}_${tile.y + dy}`);
          }
        }
      }
    }
    return blocked;
  }, [tiles, catalog]);

  const canPlaceAt = useCallback(
    (
      x: number,
      y: number,
      w: number,
      h: number,
      ignoreSelf?: { x: number; y: number; w: number; h: number },
    ): boolean => {
      for (let dx = 0; dx < w; dx++) {
        for (let dy = 0; dy < h; dy++) {
          const cx = x + dx;
          const cy = y + dy;
          if (cx < 0 || cy < 0 || cx >= gridSize || cy >= gridSize) return false;
          const key = `${cx}_${cy}`;
          const ground = land[key];
          if (!ground || !isGroundWalkable(ground)) return false;

          const isSelf =
            ignoreSelf &&
            cx >= ignoreSelf.x &&
            cx < ignoreSelf.x + ignoreSelf.w &&
            cy >= ignoreSelf.y &&
            cy < ignoreSelf.y + ignoreSelf.h;
          if (!isSelf && tiles[key]) return false;
        }
      }
      return true;
    },
    [gridSize, land, tiles],
  );

  const canPlantAt = useCallback(
    (x: number, y: number): boolean => {
      const key = `${x}_${y}`;
      const tile = tiles[key];
      if (tile) {
        return tile.itemId === 'plot' && !tile.cropId;
      }
      return isGroundPlantable(land[key]);
    },
    [land, tiles],
  );

  // Recalculate capacities locally when operating in fallback mode
  const recomputeLocalTownStats = useCallback(
    (nextTiles: Record<string, TileInfo>, prevTown: TownDoc): TownDoc => {
      const mainTiles = Object.values(nextTiles).filter((t) => !t.parentTile);
      const caps = calculateTownCapacities(mainTiles, catalog, 4);
      const nextPop = Math.min(
        Math.max(prevTown.population, Math.min(caps.populationCap, prevTown.population + 1)),
        caps.populationCap,
      );
      const level = calculateTownLevel(nextPop);
      const maxLevelReached = Math.max(prevTown.maxLevelReached, level);
      return {
        ...prevTown,
        housingCapacity: caps.housingCapacity,
        serviceCapacity: caps.serviceCapacity,
        populationCap: caps.populationCap,
        population: nextPop,
        level,
        maxLevelReached,
        gridSize: getGridSizeForLevel(maxLevelReached),
      };
    },
    [catalog],
  );

  const executeBuyLand = useCallback(
    async (x: number, y: number, groundType: GroundTileType): Promise<boolean> => {
      if (!serverReadyRef.current) return false;
      const cost = LAND_PRICES[groundType];
      if (walletBalance < cost) {
        return false;
      }
      const session = getLocalSession();
      setLandPurchasing(true);
      try {
        const res = await fetch('/api/town/buy-land', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: session.uid, x, y, groundType }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Land purchase failed');
          return false;
        }
        setWalletBalance((prev) => Math.max(0, prev - (data.cost ?? cost)));
        setTown((prev) =>
          prev
            ? { ...prev, land: data.land ?? { ...(prev.land ?? {}), [`${x}_${y}`]: groundType } }
            : prev,
        );
        return true;
      } catch {
        // Local fallback
        setWalletBalance((prev) => Math.max(0, prev - cost));
        setTown((prev) =>
          prev ? { ...prev, land: { ...(prev.land ?? {}), [`${x}_${y}`]: groundType } } : prev,
        );
        return true;
      } finally {
        setLandPurchasing(false);
      }
    },
    [walletBalance, showToast],
  );

  const executeBuild = useCallback(
    async (itemId: string, x: number, y: number, opts?: { rot?: 0 | 1 }): Promise<boolean> => {
      if (!serverReadyRef.current) return false;
      const item = catalog.items[itemId];
      if (!item) return false;
      if (!canPlaceAt(x, y, item.footprint.w, item.footprint.h)) {
        showToast('Cannot place here');
        return false;
      }

      const roadRot: 1 | undefined = itemId === 'road' && opts?.rot === 1 ? 1 : undefined;
      const session = getLocalSession();
      const applyLocal = (serverTown?: TownDoc, serverTile?: { rot?: 0 | 1 }) => {
        const nextTiles: Record<string, TileInfo> = { ...tiles };
        const effectiveRot = serverTile?.rot === 1 || roadRot === 1 ? (1 as const) : undefined;
        nextTiles[`${x}_${y}`] = {
          x,
          y,
          itemId,
          ...(effectiveRot === 1 ? { rot: 1 as const } : {}),
        };
        for (let dx = 0; dx < item.footprint.w; dx++) {
          for (let dy = 0; dy < item.footprint.h; dy++) {
            if (dx === 0 && dy === 0) continue;
            nextTiles[`${x + dx}_${y + dy}`] = {
              x: x + dx,
              y: y + dy,
              itemId: `part:${itemId}`,
              parentTile: `${x}_${y}`,
            };
          }
        }
        setTiles(nextTiles);
        if (item.priceCoins > 0) {
          setWalletBalance((prev) => Math.max(0, prev - item.priceCoins));
        }
        if (serverTown) {
          setTown((prev) => ({ ...serverTown, land: serverTown.land ?? prev?.land }));
        } else if (town) {
          setTown(recomputeLocalTownStats(nextTiles, town));
        }
      };

      try {
        const res = await fetch('/api/town/build', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: session.uid,
            itemId,
            x,
            y,
            ...(roadRot === 1 ? { rot: 1 } : {}),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Build failed');
          return false;
        }
        applyLocal(data.town, data.tile);
        trackEvent('nav_tab_clicked', { action: 'town_build', itemId });
        return true;
      } catch {
        applyLocal();
        return true;
      }
    },
    [catalog, canPlaceAt, tiles, town, recomputeLocalTownStats, showToast],
  );

  const executeMove = useCallback(
    async (fromX: number, fromY: number, toX: number, toY: number): Promise<boolean> => {
      if (!serverReadyRef.current) return false;
      const fromKey = `${fromX}_${fromY}`;
      const current = tiles[fromKey];
      if (!current || current.parentTile) return false;
      const item = catalog.items[current.itemId];
      const w = item?.footprint.w ?? 1;
      const h = item?.footprint.h ?? 1;

      if (!canPlaceAt(toX, toY, w, h, { x: fromX, y: fromY, w, h })) {
        showToast('Destination tile is occupied or invalid');
        return false;
      }

      const session = getLocalSession();
      try {
        const res = await fetch('/api/town/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: session.uid, fromX, fromY, toX, toY }),
        });
        if (!res.ok) {
          const err = await res.json();
          showToast(err.error || 'Move failed');
          return false;
        }
      } catch {
        // local fallback
      }

      setTiles((prev) => {
        const next = { ...prev };
        for (let dx = 0; dx < w; dx++) {
          for (let dy = 0; dy < h; dy++) {
            delete next[`${fromX + dx}_${fromY + dy}`];
          }
        }
        next[`${toX}_${toY}`] = { ...current, x: toX, y: toY };
        for (let dx = 0; dx < w; dx++) {
          for (let dy = 0; dy < h; dy++) {
            if (dx === 0 && dy === 0) continue;
            next[`${toX + dx}_${toY + dy}`] = {
              x: toX + dx,
              y: toY + dy,
              itemId: `part:${current.itemId}`,
              parentTile: `${toX}_${toY}`,
            };
          }
        }
        return next;
      });
      return true;
    },
    [tiles, catalog, canPlaceAt, showToast],
  );

  const executeRotate = useCallback(
    async (
      x: number,
      y: number,
      layer: 'ground' | 'item',
      nextRot: 0 | 1 | 2 | 3,
    ): Promise<boolean> => {
      if (!serverReadyRef.current) return false;
      const key = `${x}_${y}`;
      const prevTile = tiles[key];
      const prevLandRotVal = town?.landRot?.[key];

      if (layer === 'ground') {
        setTown((prev) => {
          if (!prev) return prev;
          const nextMap: Record<string, 1 | 2 | 3> = { ...(prev.landRot ?? {}) };
          if (nextRot === 0) {
            delete nextMap[key];
          } else {
            nextMap[key] = nextRot;
          }
          return { ...prev, landRot: nextMap };
        });
      } else {
        setTiles((prev) => {
          const cur = prev[key];
          if (!cur) return prev;
          const updated: TileInfo = { ...cur };
          if (nextRot === 0) {
            delete updated.rot;
          } else {
            updated.rot = nextRot;
          }
          return { ...prev, [key]: updated };
        });
      }

      const session = getLocalSession();
      try {
        const res = await fetch('/api/town/rotate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: session.uid, x, y, layer, rot: nextRot }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (layer === 'ground') {
            setTown((prev) => {
              if (!prev) return prev;
              const nextMap: Record<string, 1 | 2 | 3> = { ...(prev.landRot ?? {}) };
              if (prevLandRotVal === undefined) {
                delete nextMap[key];
              } else {
                nextMap[key] = prevLandRotVal;
              }
              return { ...prev, landRot: nextMap };
            });
          } else if (prevTile) {
            setTiles((prev) => ({ ...prev, [key]: prevTile }));
          }
          showToast(err.error || 'Rotate failed');
          return false;
        }
        return true;
      } catch {
        // local fallback keeps optimistic update
        return true;
      }
    },
    [tiles, town, showToast],
  );

  const executeRemove = useCallback(
    async (x: number, y: number): Promise<boolean> => {
      if (!serverReadyRef.current) return false;
      const key = `${x}_${y}`;
      const tile = tiles[key];
      if (!tile || tile.itemId === 'starter_house' || tile.parentTile) return false;
      const item = catalog.items[tile.itemId];
      const w = item?.footprint.w ?? 1;
      const h = item?.footprint.h ?? 1;

      const session = getLocalSession();
      let refund = item ? Math.floor(item.priceCoins * 0.5) : 0;
      try {
        const res = await fetch('/api/town/remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: session.uid, x, y }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Remove failed');
          return false;
        }
        if (typeof data.refundCoins === 'number') {
          refund = data.refundCoins;
        }
      } catch {
        // local fallback
      }

      if (refund > 0) {
        setWalletBalance((prev) => prev + refund);
      }
      setTiles((prev) => {
        const next = { ...prev };
        for (let dx = 0; dx < w; dx++) {
          for (let dy = 0; dy < h; dy++) {
            delete next[`${x + dx}_${y + dy}`];
          }
        }
        return next;
      });
      return true;
    },
    [tiles, catalog, showToast],
  );

  const executePlantCrop = useCallback(
    async (x: number, y: number, cropId: string): Promise<boolean> => {
      if (!serverReadyRef.current) return false;
      const cropItem = catalog.items[cropId];
      if (!cropItem || !canPlantAt(x, y)) return false;
      if (walletBalance < cropItem.priceCoins) {
        showToast('Not enough RonCoins');
        return false;
      }

      const session = getLocalSession();
      const applyPlanted = (plantedAtIso: string, readyAtIso: string) => {
        if (cropItem.priceCoins > 0) {
          setWalletBalance((prev) => Math.max(0, prev - cropItem.priceCoins));
        }
        setTiles((prev) => ({
          ...prev,
          [`${x}_${y}`]: {
            x,
            y,
            itemId: 'plot',
            cropId,
            plantedAt: plantedAtIso,
            readyAt: readyAtIso,
          },
        }));
        setTown((prev) =>
          prev
            ? { ...prev, land: { ...(prev.land ?? {}), [`${x}_${y}`]: 'basic-block-dirt' } }
            : prev,
        );
      };

      const now = Date.now();
      const growMs = (cropItem.growTimeSeconds ?? 14400) * 1000;
      const plantedIso = new Date(now).toISOString();
      const readyIso = new Date(now + growMs).toISOString();

      try {
        const res = await fetch('/api/town/plant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: session.uid, x, y, cropId }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Planting failed');
          return false;
        }
        applyPlanted(plantedIso, readyIso);
        return true;
      } catch {
        applyPlanted(plantedIso, readyIso);
        return true;
      }
    },
    [catalog, canPlantAt, walletBalance, showToast],
  );

  const executeHarvestCrop = useCallback(
    async (x: number, y: number): Promise<boolean> => {
      if (!serverReadyRef.current) return false;
      const key = `${x}_${y}`;
      const tile = tiles[key];
      if (!tile?.cropId) return false;
      const cropId = tile.cropId;
      const cropItem = catalog.items[cropId];
      const expectedYield = cropItem?.yieldCount ?? 2;

      const session = getLocalSession();
      let yieldCount = expectedYield;

      try {
        const res = await fetch('/api/town/harvest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: session.uid, x, y }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Harvest failed');
          return false;
        }
        yieldCount = data.yieldCount ?? expectedYield;
      } catch {
        // local fallback
      }

      setInventory((prev) => ({
        ...prev,
        [cropId]: (prev[cropId] || 0) + yieldCount,
      }));
      // Plot resets to tilled/dirt placeholder
      setTiles((prev) => ({
        ...prev,
        [key]: { x, y, itemId: 'plot' },
      }));
      setTown((prev) =>
        prev ? { ...prev, land: { ...(prev.land ?? {}), [key]: 'basic-block-dirt' } } : prev,
      );
      pushFloatingReward(x, y, `+${yieldCount} ${cropId}`);
      return true;
    },
    [tiles, catalog, showToast, pushFloatingReward],
  );

  const executeBuyPlot = useCallback(
    async (x: number, y: number): Promise<boolean> => {
      if (!serverReadyRef.current) return false;
      if (!canPlaceAt(x, y, 1, 1)) {
        showToast('Cannot place plot here');
        return false;
      }
      const session = getLocalSession();
      const localCost = getPlotPrice(town?.plotsOwned ?? 2);
      try {
        const res = await fetch('/api/town/buy-plot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: session.uid, x, y }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Failed to buy plot');
          return false;
        }
        if (data.cost) setWalletBalance((prev) => Math.max(0, prev - data.cost));
        if (town) setTown({ ...town, plotsOwned: data.plotsOwned });
      } catch {
        if (localCost > 0) setWalletBalance((prev) => Math.max(0, prev - localCost));
        if (town) setTown({ ...town, plotsOwned: (town.plotsOwned ?? 2) + 1 });
      }
      setTiles((prev) => ({ ...prev, [`${x}_${y}`]: { x, y, itemId: 'plot' } }));
      setTown((prev) =>
        prev
          ? { ...prev, land: { ...(prev.land ?? {}), [`${x}_${y}`]: 'basic-block-dirt' } }
          : prev,
      );
      return true;
    },
    [canPlaceAt, town, showToast],
  );

  const executeDeliverOrder = useCallback(
    async (orderId: string) => {
      if (!serverReadyRef.current) return;
      const session = getLocalSession();
      try {
        const res = await fetch('/api/town/deliver-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: session.uid, orderId }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Delivery failed');
          return;
        }
        if (data.rewardCoins) {
          setWalletBalance((prev) => prev + data.rewardCoins);
        }
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, done: true } : o)));
        fetch(`/api/town/inventory?uid=${encodeURIComponent(session.uid)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.crops) setInventory(d.crops);
          })
          .catch(() => {});
      } catch {
        // ignore offline
      }
    },
    [showToast],
  );

  const executeLike = useCallback(async () => {
    if (!visitHostUid || likeLoading || hostInfo?.hasLiked) return;
    const session = getLocalSession();
    if (!session?.uid) return;
    setLikeLoading(true);
    try {
      const res = await fetch('/api/town/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostUid: visitHostUid, viewerUid: session.uid }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setHostInfo((prev) =>
          prev
            ? { ...prev, hasLiked: true, likesCount: data.likesCount ?? prev.likesCount + 1 }
            : null,
        );
      } else {
        showToast(data.error || 'Failed to like town');
      }
    } catch {
      // ignore
    } finally {
      setLikeLoading(false);
    }
  }, [visitHostUid, likeLoading, hostInfo?.hasLiked, showToast]);

  const executeWaterCrop = useCallback(
    async (x: number, y: number, successLabel: string): Promise<boolean> => {
      if (!visitHostUid || waterLoading) return false;
      const session = getLocalSession();
      if (!session?.uid) return false;
      setWaterLoading(true);
      try {
        const res = await fetch('/api/town/water', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            helperUid: session.uid,
            hostUid: visitHostUid,
            tileX: x,
            tileY: y,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast(successLabel);
          return true;
        }
        showToast(data.error || 'Failed to water crop');
        return false;
      } catch {
        showToast('Failed to water crop');
        return false;
      } finally {
        setWaterLoading(false);
      }
    },
    [visitHostUid, waterLoading, showToast],
  );

  const executeCoinCheckout = useCallback(
    async (packId: string) => {
      const session = getLocalSession();
      if (!session?.uid || session.uid === 'anon' || session.uid === 'u_ssr') {
        showToast('Please sign in or link your account before purchasing coins');
        return;
      }
      try {
        const res = await fetch('/api/town/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: session.uid,
            packId,
            simulateImmediately: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Checkout failed');
          return;
        }
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        }
      } catch {
        showToast('Checkout request failed');
      }
    },
    [showToast],
  );

  const loadTransferStatus = useCallback(async () => {
    const session = getLocalSession();
    if (!session?.uid) return;
    try {
      const res = await fetch(`/api/town/transfer-status?uid=${encodeURIComponent(session.uid)}`);
      const data = await res.json();
      if (res.ok) setTransferStatus(data);
    } catch {
      // ignore
    }
  }, []);

  const executeTransfer = useCallback(
    async (recipientUid: string, amount: number): Promise<boolean> => {
      const session = getLocalSession();
      if (!session?.uid || !recipientUid || amount <= 0) return false;
      setTransferLoading(true);
      try {
        const res = await fetch('/api/town/transfer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderUid: session.uid,
            receiverUid: recipientUid,
            amount,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Transfer failed');
          return false;
        }
        if (data.senderBalanceAfter !== undefined) {
          setWalletBalance(data.senderBalanceAfter);
        }
        showToast(`Transferred ${amount} RonCoins!`);
        return true;
      } catch {
        showToast('Transfer failed');
        return false;
      } finally {
        setTransferLoading(false);
      }
    },
    [showToast],
  );

  return {
    catalog,
    loading,
    townReady,
    hydratedFromCache,
    connectionStatus,
    retryInit,
    town,
    tiles,
    land,
    landRot,
    expandRing,
    blockedKeys,
    walletBalance,
    inventory,
    orders,
    ordersUnlocked,
    tutorialStep,
    tutorialDone,
    advanceTutorial,
    skipTutorial,
    hostInfo,
    likeLoading,
    waterLoading,
    transferStatus,
    transferLoading,
    landPurchasing,
    actionMessage,
    showToast,
    floatingRewards,
    canPlaceAt,
    canPlantAt,
    executeBuyLand,
    executeBuild,
    executeMove,
    executeRotate,
    executeRemove,
    executePlantCrop,
    executeHarvestCrop,
    executeBuyPlot,
    executeDeliverOrder,
    executeLike,
    executeWaterCrop,
    executeCoinCheckout,
    loadTransferStatus,
    executeTransfer,
  };
}
