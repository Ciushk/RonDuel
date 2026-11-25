'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

interface LocalPersistedTown {
  town: TownDoc;
  tiles: Record<string, TileInfo>;
  walletBalance: number;
  inventory: Record<string, number>;
}

const LOCAL_STORAGE_PREFIX = 'rt_local_town_v2_';

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

function createDeterministicSsrState(): LocalPersistedTown {
  const starterTiles: Record<string, TileInfo> = {
    '3_3': { x: 3, y: 3, itemId: 'starter_house' },
    '3_4': { x: 3, y: 4, itemId: 'plot' },
    '4_4': { x: 4, y: 4, itemId: 'plot' },
  };
  const starterLand: Record<string, GroundTileType> = {
    '3_3': 'basic-block',
    '3_4': 'basic-block-dirt',
    '4_4': 'basic-block-dirt',
    '2_3': 'basic-block',
    '4_3': 'basic-block',
    '3_2': 'basic-block',
  };
  return {
    town: {
      gridSize: 8,
      population: 2,
      housingCapacity: 2,
      serviceCapacity: 4,
      populationCap: 2,
      level: 1,
      maxLevelReached: 1,
      tutorialStep: 3,
      likesCount: 0,
      plotsOwned: 2,
      land: starterLand,
    },
    tiles: starterTiles,
    walletBalance: 100,
    inventory: {},
  };
}

export function useTownState(params: {
  townEnabled: boolean;
  isVisitMode: boolean;
  visitHostUid: string | null;
}) {
  const { townEnabled, isVisitMode, visitHostUid } = params;

  const [catalog] = useState<TownCatalogDoc>(DEFAULT_TOWN_CATALOG);
  const [loading, setLoading] = useState<boolean>(isVisitMode);
  const [town, setTown] = useState<TownDoc | null>(() =>
    isVisitMode ? null : createDeterministicSsrState().town,
  );
  const [tiles, setTiles] = useState<Record<string, TileInfo>>(() =>
    isVisitMode ? {} : createDeterministicSsrState().tiles,
  );
  const [walletBalance, setWalletBalance] = useState<number>(100);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<TownOrderItem[]>([]);
  const [ordersUnlocked, setOrdersUnlocked] = useState<boolean>(true);
  const [tutorialStep, setTutorialStep] = useState<number>(3);

  const [hostInfo, setHostInfo] = useState<HostVisitInfo | null>(null);
  const [likeLoading, setLikeLoading] = useState(false);
  const [waterLoading, setWaterLoading] = useState(false);
  const [transferStatus, setTransferStatus] = useState<TransferStatusInfo | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [landPurchasing, setLandPurchasing] = useState(false);

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [floatingRewards, setFloatingRewards] = useState<FloatingReward[]>([]);
  const usingLocalFallbackRef = useRef(false);

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

  // Persist local fallback state whenever town/tiles/wallet change in offline/local mode
  useEffect(() => {
    if (!usingLocalFallbackRef.current || isVisitMode || !town) return;
    const session = getLocalSession();
    if (!session?.uid || session.uid === 'u_ssr') return;
    try {
      const payload: LocalPersistedTown = { town, tiles, walletBalance, inventory };
      window.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${session.uid}`, JSON.stringify(payload));
    } catch {
      // ignore storage quota errors
    }
  }, [isVisitMode, town, tiles, walletBalance, inventory]);

  // Initialize town (or visit snapshot) on mount
  useEffect(() => {
    if (!townEnabled) {
      setLoading(false);
      return;
    }

    let active = true;
    const session = getLocalSession();
    if (!session?.uid || session.uid === 'u_ssr' || session.uid === 'anon') {
      setLoading(false);
      return;
    }

    if (isVisitMode && visitHostUid) {
      fetch(
        `/api/town/visit?hostUid=${encodeURIComponent(visitHostUid)}&viewerUid=${encodeURIComponent(session.uid)}`,
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
          });
          setTiles(visitTiles);
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
          setLoading(false);
        });
      return () => {
        active = false;
      };
    }

    if (!isVisitMode) {
      try {
        const raw = window.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${session.uid}`);
        if (raw) {
          const restored = JSON.parse(raw) as LocalPersistedTown;
          const restoredLand = ensureLandCoversTiles(
            restored.town.land,
            restored.tiles,
            restored.town.gridSize ?? 8,
          );
          setTown({ ...restored.town, land: restoredLand });
          setTiles(restored.tiles);
          setWalletBalance(restored.walletBalance);
          setInventory(restored.inventory ?? {});
          setTutorialStep(restored.town.tutorialStep ?? 3);
        }
      } catch {
        // Ignore corrupt local cache
      }
    }

    fetch(`/api/town/init?uid=${encodeURIComponent(session.uid)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Init failed');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        const serverTiles: Record<string, TileInfo> =
          data.tiles && Object.keys(data.tiles).length > 0
            ? data.tiles
            : {
                '3_3': { x: 3, y: 3, itemId: 'starter_house' },
                '3_4': { x: 3, y: 4, itemId: 'plot' },
                '4_4': { x: 4, y: 4, itemId: 'plot' },
              };
        const serverTown: TownDoc = data.town ?? createDefaultStarterState().town;
        const land = ensureLandCoversTiles(serverTown.land, serverTiles, serverTown.gridSize ?? 8);
        setTown({ ...serverTown, land });
        setTiles(serverTiles);
        setTutorialStep(serverTown.tutorialStep ?? 0);
        if (typeof data.walletBalance === 'number') {
          setWalletBalance(data.walletBalance);
        }
        usingLocalFallbackRef.current = false;
        setLoading(false);

        // Fetch inventory & daily orders only when town API is reachable
        fetch(`/api/town/inventory?uid=${encodeURIComponent(session.uid)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (active && d?.crops) setInventory(d.crops);
          })
          .catch(() => {});

        fetch(`/api/town/orders?uid=${encodeURIComponent(session.uid)}`)
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
        if (!active) return;
        usingLocalFallbackRef.current = true;
      });

    return () => {
      active = false;
    };
  }, [townEnabled, isVisitMode, visitHostUid]);

  const gridSize = town?.gridSize ?? 8;
  const land = useMemo<Record<string, GroundTileType>>(
    () => town?.land ?? {},
    [town?.land],
  );

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
      const nextPop = Math.min(Math.max(prevTown.population, Math.min(caps.populationCap, prevTown.population + 1)), caps.populationCap);
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
          prev
            ? { ...prev, land: { ...(prev.land ?? {}), [`${x}_${y}`]: groundType } }
            : prev,
        );
        return true;
      } finally {
        setLandPurchasing(false);
      }
    },
    [walletBalance, showToast],
  );

  const executeBuild = useCallback(
    async (itemId: string, x: number, y: number): Promise<boolean> => {
      const item = catalog.items[itemId];
      if (!item) return false;
      if (!canPlaceAt(x, y, item.footprint.w, item.footprint.h)) {
        showToast('Cannot place here');
        return false;
      }

      const session = getLocalSession();
      const applyLocal = (serverTown?: TownDoc) => {
        const nextTiles: Record<string, TileInfo> = { ...tiles };
        nextTiles[`${x}_${y}`] = { x, y, itemId };
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
          body: JSON.stringify({ uid: session.uid, itemId, x, y }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Build failed');
          return false;
        }
        applyLocal(data.town);
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

  const executeRemove = useCallback(
    async (x: number, y: number): Promise<boolean> => {
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
        prev ? { ...prev, land: { ...(prev.land ?? {}), [`${x}_${y}`]: 'basic-block-dirt' } } : prev,
      );
      return true;
    },
    [canPlaceAt, town, showToast],
  );

  const executeDeliverOrder = useCallback(
    async (orderId: string) => {
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
    town,
    tiles,
    land,
    expandRing,
    blockedKeys,
    walletBalance,
    inventory,
    orders,
    ordersUnlocked,
    tutorialStep,
    setTutorialStep,
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
