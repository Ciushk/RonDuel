'use client';

import { useTranslations } from 'next-intl';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GridCoord, GroundTileType, TownCatalogDoc } from '@ronduel/shared';
import {
  computeMapBounds,
  DIAMOND_H,
  formatDurationShort,
  getBuildingPlacement,
  getCropGrowthInfo,
  getCropPlacement,
  getCursorPlacement,
  getVillagerFeetPoint,
  isoToScreen,
  TILE_H,
  TILE_W,
} from './iso';
import {
  CATALOG_SPRITES,
  GROUND_SPRITES,
  preloadInitialSprites,
  resolveCropSprite,
  resolveRoadSprite,
  UI_SPRITES,
  VILLAGER_SPRITES,
} from './sprites';
import type { FloatingReward, TileInfo } from './useTownState';
import { useReducedMotion, useVillagers } from './useVillagers';

interface IsoMapProps {
  land: Record<string, GroundTileType>;
  tiles: Record<string, TileInfo>;
  expandRing: GridCoord[];
  blockedKeys: ReadonlySet<string>;
  catalog: TownCatalogDoc;
  population: number;
  isVisitMode: boolean;
  placingItemId: string | null;
  moveModeActive: boolean;
  movingTile: TileInfo | null;
  selectedSeed: string | null;
  floatingRewards: FloatingReward[];
  canPlaceAt: (
    x: number,
    y: number,
    w: number,
    h: number,
    ignoreSelf?: { x: number; y: number; w: number; h: number },
  ) => boolean;
  canPlantAt: (x: number, y: number) => boolean;
  onTileTap: (x: number, y: number) => void;
  onExpandTap: (x: number, y: number) => void;
  onHarvestComplete: (x: number, y: number) => void;
}

interface StaticWorldProps {
  land: Record<string, GroundTileType>;
  tiles: Record<string, TileInfo>;
  expandRing: GridCoord[];
  catalog: TownCatalogDoc;
  boundsMinX: number;
  boundsMinY: number;
  scale: number;
  isVisitMode: boolean;
  nowMs: number;
  reducedMotion: boolean;
  onHoverCell: (cell: GridCoord | null) => void;
  onTileTap: (x: number, y: number) => void;
  onExpandTap: (x: number, y: number) => void;
  onHarvestTap: (x: number, y: number) => void;
}

const StaticWorldLayer = memo(function StaticWorldLayer({
  land,
  tiles,
  expandRing,
  catalog,
  boundsMinX,
  boundsMinY,
  scale,
  isVisitMode,
  nowMs,
  reducedMotion,
  onHoverCell,
  onTileTap,
  onExpandTap,
  onHarvestTap,
}: StaticWorldProps) {
  const t = useTranslations();

  // Collect all owned cells sorted back-to-front by col + row
  const ownedCells = useMemo(() => {
    const list: Array<{ x: number; y: number; key: string; ground: GroundTileType }> = [];
    for (const [key, ground] of Object.entries(land)) {
      const [xs, ys] = key.split('_');
      const x = Number(xs);
      const y = Number(ys);
      if (Number.isInteger(x) && Number.isInteger(y)) {
        list.push({ x, y, key, ground });
      }
    }
    list.sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x || a.y - b.y);
    return list;
  }, [land]);

  const isRoadAt = useCallback(
    (nx: number, ny: number) => {
      const k = `${nx}_${ny}`;
      if (tiles[k]?.itemId === 'road') return true;
      const g = land[k];
      return (
        g === 'basic-block-street' ||
        g === 'basic-block-street-curve' ||
        g === 'basic-block-intersection'
      );
    },
    [tiles, land],
  );

  // Main buildings / decor / plots sorted by their front footprint cell (largest col + row)
  const objectItems = useMemo(() => {
    const items: Array<{
      key: string;
      tile: TileInfo;
      w: number;
      h: number;
      sortKey: number;
    }> = [];
    for (const [key, tile] of Object.entries(tiles)) {
      if (tile.parentTile || tile.itemId.startsWith('part:')) continue;
      const item = catalog.items[tile.itemId];
      const w = item?.footprint.w ?? 1;
      const h = item?.footprint.h ?? 1;
      items.push({
        key,
        tile,
        w,
        h,
        sortKey: tile.x + w - 1 + (tile.y + h - 1),
      });
    }
    items.sort((a, b) => a.sortKey - b.sortKey || a.tile.x - b.tile.x || a.tile.y - b.tile.y);
    return items;
  }, [tiles, catalog]);

  return (
    <>
      {/* 1. Owned ground slabs */}
      {ownedCells.map(({ x, y, key, ground }) => {
        const origin = isoToScreen(x, y);
        const left = (origin.x - boundsMinX) * scale;
        const top = (origin.y - boundsMinY) * scale;
        const spec = GROUND_SPRITES[ground] ?? GROUND_SPRITES['basic-block'];
        const tile = tiles[key];
        const cellLabel = tile
          ? `${tile.cropId ? `${tile.cropId} ` : ''}${tile.itemId} (${x}, ${y})`
          : `${t('town.map.groundCell', { x, y })}`;

        return (
          <div
            key={`ground_${key}`}
            className="pointer-events-none absolute"
            style={{
              left,
              top,
              width: TILE_W * scale,
              height: TILE_H * scale,
              zIndex: (x + y) * 10,
            }}
          >
            <img
              src={spec.src}
              alt=""
              width={spec.width * scale}
              height={spec.height * scale}
              className="rt-pixelated pointer-events-none block select-none"
              draggable={false}
            />
            <button
              type="button"
              onClick={() => onTileTap(x, y)}
              onMouseEnter={() => onHoverCell({ x, y })}
              onMouseLeave={() => onHoverCell(null)}
              onFocus={() => onHoverCell({ x, y })}
              onBlur={() => onHoverCell(null)}
              aria-label={cellLabel}
              className="pointer-events-auto absolute left-0 top-0 cursor-pointer bg-transparent focus-visible:outline-3 focus-visible:outline-offset-[-2px] focus-visible:outline-[#C6FF3D]"
              style={{
                width: TILE_W * scale,
                height: DIAMOND_H * scale,
                clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
              }}
            />
          </div>
        );
      })}

      {/* 2. Expand ring (muted olive slab with Volt X) */}
      {!isVisitMode &&
        expandRing.map(({ x, y }) => {
          const origin = isoToScreen(x, y);
          const left = (origin.x - boundsMinX) * scale;
          const top = (origin.y - boundsMinY) * scale;
          return (
            <div
              key={`expand_${x}_${y}`}
              className="pointer-events-none absolute"
              style={{
                left,
                top,
                width: TILE_W * scale,
                height: TILE_H * scale,
                zIndex: (x + y) * 10,
              }}
            >
              <img
                src={UI_SPRITES.expand.src}
                alt=""
                width={UI_SPRITES.expand.width * scale}
                height={UI_SPRITES.expand.height * scale}
                className="rt-pixelated pointer-events-none block select-none"
                draggable={false}
              />
              <button
                type="button"
                onClick={() => onExpandTap(x, y)}
                onMouseEnter={() => onHoverCell({ x, y })}
                onMouseLeave={() => onHoverCell(null)}
                onFocus={() => onHoverCell({ x, y })}
                onBlur={() => onHoverCell(null)}
                aria-label={t('town.land.expandAria', { x, y })}
                className="pointer-events-auto absolute left-0 top-0 cursor-pointer bg-transparent focus-visible:outline-3 focus-visible:outline-offset-[-2px] focus-visible:outline-[#C6FF3D]"
                style={{
                  width: TILE_W * scale,
                  height: DIAMOND_H * scale,
                  clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                }}
              />
            </div>
          );
        })}

      {/* 3. Crops, roads, buildings, and decor */}
      {objectItems.map(({ key, tile, w, h, sortKey }) => {
        // Road decor auto-picks street / curve / intersection
        if (tile.itemId === 'road') {
          const spec = resolveRoadSprite(tile.x, tile.y, isRoadAt);
          const origin = isoToScreen(tile.x, tile.y);
          return (
            <img
              key={`obj_${key}`}
              src={spec.src}
              alt=""
              width={spec.width * scale}
              height={spec.height * scale}
              className="rt-pixelated pointer-events-none absolute block select-none"
              style={{
                left: (origin.x - boundsMinX) * scale,
                top: (origin.y - boundsMinY) * scale,
                zIndex: sortKey * 10 + 2,
                transform: spec.flipX ? 'scaleX(-1)' : undefined,
              }}
              draggable={false}
            />
          );
        }

        // Farm plot (empty dirt placeholder or growing/ready crop)
        if (tile.itemId === 'plot') {
          if (!tile.cropId) {
            const origin = isoToScreen(tile.x, tile.y);
            const spec = GROUND_SPRITES['basic-block-dirt'];
            return (
              <img
                key={`obj_${key}`}
                src={spec.src}
                alt=""
                width={spec.width * scale}
                height={spec.height * scale}
                className="rt-pixelated pointer-events-none absolute block select-none"
                style={{
                  left: (origin.x - boundsMinX) * scale,
                  top: (origin.y - boundsMinY) * scale,
                  zIndex: sortKey * 10 + 2,
                }}
                draggable={false}
              />
            );
          }

          const cropMeta = catalog.items[tile.cropId];
          const growth = getCropGrowthInfo({
            plantedAt: tile.plantedAt,
            readyAt: tile.readyAt,
            growTimeSeconds: cropMeta?.growTimeSeconds,
            nowMs,
          });
          const cropSpec = resolveCropSprite(tile.cropId, growth.stage);
          const pos = getCropPlacement(tile.x, tile.y, cropSpec.height);
          const badgeOrigin = isoToScreen(tile.x, tile.y);
          const badgeCenterX = (badgeOrigin.x + TILE_W / 2 - boundsMinX) * scale;
          const badgeTopY = (badgeOrigin.y - 12 - boundsMinY) * scale;

          return (
            <div key={`obj_${key}`}>
              <img
                src={cropSpec.src}
                alt=""
                width={cropSpec.width * scale}
                height={cropSpec.height * scale}
                className="rt-pixelated pointer-events-none absolute block select-none"
                style={{
                  left: (pos.x - boundsMinX) * scale,
                  top: (pos.y - boundsMinY) * scale,
                  zIndex: sortKey * 10 + 2,
                }}
                draggable={false}
              />

              {/* Harvest / Growth badge above plot — shape + text (never colour alone) */}
              {growth.isReady ? (
                <button
                  type="button"
                  disabled={isVisitMode}
                  onClick={() => onHarvestTap(tile.x, tile.y)}
                  aria-label={t('town.map.harvestBadgeAria', {
                    crop: tile.cropId,
                    x: tile.x,
                    y: tile.y,
                  })}
                  style={{
                    left: badgeCenterX,
                    top: badgeTopY,
                    zIndex: sortKey * 10 + 8,
                    transform: 'translate(-50%, -40%)',
                  }}
                  className="absolute flex min-h-[44px] min-w-[44px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl bg-transparent focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#C6FF3D] disabled:cursor-default"
                >
                  <img
                    src={UI_SPRITES.farmReady.src}
                    alt=""
                    width={UI_SPRITES.farmReady.width * 2}
                    height={UI_SPRITES.farmReady.height * 2}
                    className={`rt-pixelated block select-none ${
                      reducedMotion ? '' : 'rt-harvest-pulse'
                    }`}
                    draggable={false}
                  />
                  <span className="rounded-md border border-[#0E0D15] bg-[#C6FF3D] px-1.5 py-0.5 font-mono text-[10px] font-black leading-none text-[#0E0D15] shadow-[1px_1px_0px_0px_#0E0D15]">
                    {t('town.map.readyShort')} +{cropMeta?.yieldCount ?? 2}
                  </span>
                </button>
              ) : (
                <div
                  style={{
                    left: badgeCenterX,
                    top: badgeTopY,
                    zIndex: sortKey * 10 + 8,
                    transform: 'translate(-50%, -25%)',
                  }}
                  className="pointer-events-none absolute flex flex-col items-center gap-0.5"
                >
                  <img
                    src={UI_SPRITES.farmGrowing.src}
                    alt=""
                    width={UI_SPRITES.farmGrowing.width * 2}
                    height={UI_SPRITES.farmGrowing.height * 2}
                    className="rt-pixelated block select-none"
                    draggable={false}
                  />
                  <span className="rounded border border-[#0E0D15] bg-[#FFF7EC]/95 px-1 py-0.5 font-mono text-[9px] font-bold leading-none text-[#0E0D15]">
                    {formatDurationShort(growth.remainingSeconds)}
                  </span>
                </div>
              )}
            </div>
          );
        }

        // Buildings & other decor
        const spec = CATALOG_SPRITES[tile.itemId];
        if (!spec || spec.isPlaceholder) {
          const anchor = getBuildingPlacement(tile.x, tile.y, w, h, 24, 24);
          return (
            <div
              key={`obj_${key}`}
              aria-hidden="true"
              className="pointer-events-none absolute flex items-center justify-center rounded-lg border-2 border-[#0E0D15] bg-[#FFF7EC]/90 px-1 text-[9px] font-black uppercase text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15]"
              style={{
                left: (anchor.x - boundsMinX) * scale,
                top: (anchor.y - boundsMinY) * scale,
                width: 24 * scale,
                height: 24 * scale,
                zIndex: anchor.sortKey * 10 + 4,
              }}
            >
              {tile.itemId.slice(0, 3)}
            </div>
          );
        }

        const placement = getBuildingPlacement(tile.x, tile.y, w, h, spec.width, spec.height);
        return (
          <img
            key={`obj_${key}`}
            src={spec.src}
            alt=""
            width={spec.width * scale}
            height={spec.height * scale}
            className="rt-pixelated pointer-events-none absolute block select-none"
            style={{
              left: (placement.x - boundsMinX) * scale,
              top: (placement.y - boundsMinY) * scale,
              zIndex: placement.sortKey * 10 + 4,
            }}
            draggable={false}
          />
        );
      })}
    </>
  );
});

export function IsoMap({
  land,
  tiles,
  expandRing,
  blockedKeys,
  catalog,
  population,
  isVisitMode,
  placingItemId,
  moveModeActive,
  movingTile,
  selectedSeed,
  floatingRewards,
  canPlaceAt,
  canPlantAt,
  onTileTap,
  onExpandTap,
  onHarvestComplete,
}: IsoMapProps) {
  const t = useTranslations();
  const reducedMotion = useReducedMotion();
  const [scale, setScale] = useState<number>(2);
  const [hoveredCell, setHoveredCell] = useState<GridCoord | null>(null);
  const [nowMs, setNowMs] = useState<number>(0);
  const [tabHidden, setTabHidden] = useState<boolean>(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; scrollLeft: number; scrollTop: number }>({
    active: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  // Strict integer scale: 2x on mobile/standard, 3x on wide desktop screens
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setScale(mq.matches ? 3 : 2);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Preload initial sprites during idle time so they never block first paint / LCP
  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof win.requestIdleCallback === 'function') {
      const id = win.requestIdleCallback(() => preloadInitialSprites(), { timeout: 1500 });
      return () => win.cancelIdleCallback?.(id);
    }
    const tid = window.setTimeout(() => preloadInitialSprites(), 300);
    return () => window.clearTimeout(tid);
  }, []);

  const hasPlantedCrops = useMemo(
    () => Object.values(tiles).some((tile) => Boolean(tile.cropId)),
    [tiles],
  );

  // Refresh crop growth timers every 10s (only when crops exist) & pause CSS animations when tab is hidden
  useEffect(() => {
    let timerId: number | null = null;
    const start = () => {
      if (!hasPlantedCrops || timerId !== null || document.hidden) return;
      setNowMs(Date.now());
      timerId = window.setInterval(() => {
        if (!document.hidden) setNowMs(Date.now());
      }, 10000);
    };
    const stop = () => {
      if (timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
      }
    };
    const onVis = () => {
      const hidden = Boolean(document.hidden);
      setTabHidden(hidden);
      if (hidden) stop();
      else start();
    };
    if (document.hidden) setTabHidden(true);
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [hasPlantedCrops]);

  // Compute tight map bounds around owned land + expand ring
  const bounds = useMemo(() => {
    const coords: GridCoord[] = [];
    for (const key of Object.keys(land)) {
      const [xs, ys] = key.split('_');
      const x = Number(xs);
      const y = Number(ys);
      if (Number.isInteger(x) && Number.isInteger(y)) coords.push({ x, y });
    }
    for (const cell of expandRing) {
      coords.push(cell);
    }
    return computeMapBounds(coords);
  }, [land, expandRing]);

  const { villagerList, registerDom, dispatchHarvest } = useVillagers({
    population,
    land,
    blockedKeys,
    boundsMinX: bounds.minX,
    boundsMinY: bounds.minY,
    scale,
    reducedMotion,
  });

  const handleHarvestTap = useCallback(
    (x: number, y: number) => {
      if (isVisitMode) return;
      dispatchHarvest({ x, y }, () => onHarvestComplete(x, y));
    },
    [isVisitMode, dispatchHarvest, onHarvestComplete],
  );

  // Center map scroll position asynchronously on next frame to avoid forced layout reflow during hydration
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const el = viewportRef.current;
      if (!el) return;
      const targetLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
      const targetTop = Math.max(0, (el.scrollHeight - el.clientHeight) / 2);
      if (targetLeft > 0 || targetTop > 0) {
        el.scrollTo({ left: targetLeft, top: targetTop });
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [scale]);

  // Evaluate placement / move / plant cursor validity for hovered/focused cell
  const cursorOverlay = useMemo(() => {
    if (isVisitMode || !hoveredCell) return null;
    const { x, y } = hoveredCell;
    const isInteractiveMode = Boolean(placingItemId || movingTile || moveModeActive || selectedSeed);
    if (!isInteractiveMode) return null;

    let isValid = false;
    if (placingItemId) {
      const item = catalog.items[placingItemId];
      isValid = canPlaceAt(x, y, item?.footprint.w ?? 1, item?.footprint.h ?? 1);
    } else if (movingTile) {
      const item = catalog.items[movingTile.itemId];
      const w = item?.footprint.w ?? 1;
      const h = item?.footprint.h ?? 1;
      isValid = canPlaceAt(x, y, w, h, { x: movingTile.x, y: movingTile.y, w, h });
    } else if (moveModeActive) {
      const tile = tiles[`${x}_${y}`];
      isValid = Boolean(tile && !tile.parentTile);
    } else if (selectedSeed) {
      isValid = canPlantAt(x, y);
    }

    const pos = getCursorPlacement(x, y);
    const spec = isValid ? UI_SPRITES.freeSpot : UI_SPRITES.takenSpot;
    return {
      left: (pos.x - bounds.minX) * scale,
      top: (pos.y - bounds.minY) * scale,
      width: spec.width * scale,
      height: spec.height * scale,
      src: spec.src,
      zIndex: (x + y) * 10 + 9,
    };
  }, [
    isVisitMode,
    hoveredCell,
    placingItemId,
    movingTile,
    moveModeActive,
    selectedSeed,
    catalog,
    canPlaceAt,
    canPlantAt,
    tiles,
    bounds.minX,
    bounds.minY,
    scale,
  ]);

  const stageW = Math.ceil(bounds.width * scale);
  const stageH = Math.ceil(bounds.height * scale);

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-label={t('town.map.regionAria')}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        const el = viewportRef.current;
        if (!el) return;
        dragRef.current = {
          active: true,
          startX: e.clientX,
          startY: e.clientY,
          scrollLeft: el.scrollLeft,
          scrollTop: el.scrollTop,
        };
      }}
      onPointerMove={(e) => {
        if (!dragRef.current.active || !viewportRef.current) return;
        viewportRef.current.scrollLeft = dragRef.current.scrollLeft - (e.clientX - dragRef.current.startX);
        viewportRef.current.scrollTop = dragRef.current.scrollTop - (e.clientY - dragRef.current.startY);
      }}
      onPointerUp={() => {
        dragRef.current.active = false;
      }}
      onPointerCancel={() => {
        dragRef.current.active = false;
      }}
      className={`relative flex flex-1 touch-pan-x touch-pan-y select-none items-center justify-center overflow-auto bg-[#132013] p-6 ${
        tabHidden ? 'rt-paused' : ''
      }`}
    >
      <div
        className="relative shrink-0"
        style={{
          width: stageW,
          height: stageH,
        }}
      >
        {/* Memoized static world layer (ground, expand ring, crops, buildings, badges) */}
        <StaticWorldLayer
          land={land}
          tiles={tiles}
          expandRing={expandRing}
          catalog={catalog}
          boundsMinX={bounds.minX}
          boundsMinY={bounds.minY}
          scale={scale}
          isVisitMode={isVisitMode}
          nowMs={nowMs}
          reducedMotion={reducedMotion}
          onHoverCell={setHoveredCell}
          onTileTap={onTileTap}
          onExpandTap={onExpandTap}
          onHarvestTap={handleHarvestTap}
        />

        {/* Animated villager layer (transform-only GPU updates via single rAF loop) */}
        {villagerList.map((v) => {
          const spec = VILLAGER_SPRITES[v.kind].idle;
          const feet = getVillagerFeetPoint(v.initialX, v.initialY);
          const initX = Math.round((feet.x - bounds.minX - spec.width / 2) * scale);
          const initY = Math.round((feet.y - bounds.minY - spec.height) * scale);
          return (
            <div
              key={v.id}
              ref={(el) => registerDom(v.id, 'wrap', el)}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 will-change-transform"
              style={{
                transform: `translate3d(${initX}px, ${initY}px, 0)`,
                zIndex: Math.round((v.initialX + v.initialY) * 10) + 6,
                transition: reducedMotion ? 'opacity 180ms linear' : undefined,
              }}
            >
              <img
                ref={(el) => registerDom(v.id, 'img', el)}
                src={spec.src}
                alt=""
                width={spec.width * scale}
                height={spec.height * scale}
                className="rt-pixelated block select-none"
                draggable={false}
              />
            </div>
          );
        })}

        {/* Placement / Move / Plant cursor */}
        {cursorOverlay && (
          <img
            src={cursorOverlay.src}
            alt=""
            width={cursorOverlay.width}
            height={cursorOverlay.height}
            className="rt-pixelated pointer-events-none absolute block select-none"
            style={{
              left: cursorOverlay.left,
              top: cursorOverlay.top,
              zIndex: cursorOverlay.zIndex,
            }}
            draggable={false}
          />
        )}

        {/* Floating +N harvest feedback labels (600ms transform + opacity) */}
        {floatingRewards.map((reward) => {
          const origin = isoToScreen(reward.x, reward.y);
          return (
            <div
              key={reward.id}
              role="status"
              className="rt-float-reward pointer-events-none absolute rounded-full border-2 border-[#0E0D15] bg-[#C6FF3D] px-2 py-0.5 font-mono text-xs font-black text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15]"
              style={{
                left: (origin.x + TILE_W / 2 - bounds.minX) * scale,
                top: (origin.y - 10 - bounds.minY) * scale,
                zIndex: 999,
              }}
            >
              {reward.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
