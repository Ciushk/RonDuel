'use client';

import { useTranslations } from 'next-intl';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GridCoord, GroundTileType, TownCatalogDoc } from '@ronduel/shared';
import {
  applyRubberBand,
  clampPanPosition,
  computeDisplayZoomRange,
  computeMapBounds,
  DIAMOND_H,
  floorZ,
  formatDurationShort,
  getBuildingPlacement,
  getCropGrowthInfo,
  getCropPlacement,
  getCursorPlacement,
  getPanAxisLimits,
  getVillagerFeetPoint,
  isoToScreen,
  objectZ,
  TILE_H,
  TILE_W,
  Z_LAYER,
  Z_UI,
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

const DRAG_THRESHOLD_PX = 6;
const KEYBOARD_PAN_STEP_PX = 48;
const ZOOM_BUTTON_FACTOR = 1.25;

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
      {/* 1. Owned ground slabs (128x76 source pixels, smoothly scaled by camera transform) */}
      {ownedCells.map(({ x, y, key, ground }) => {
        const origin = isoToScreen(x, y);
        const left = origin.x - boundsMinX;
        const top = origin.y - boundsMinY;
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
              width: TILE_W,
              height: TILE_H,
              zIndex: floorZ(x, y),
            }}
          >
            <img
              src={spec.src}
              alt=""
              width={spec.width}
              height={spec.height}
              decoding="async"
              className="pointer-events-none block select-none"
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
              className="focus-visible:outline-3 pointer-events-auto absolute left-0 top-0 cursor-pointer bg-transparent focus-visible:outline-offset-[-2px] focus-visible:outline-[#C6FF3D]"
              style={{
                width: TILE_W,
                height: DIAMOND_H,
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
          const left = origin.x - boundsMinX;
          const top = origin.y - boundsMinY;
          return (
            <div
              key={`expand_${x}_${y}`}
              className="pointer-events-none absolute"
              style={{
                left,
                top,
                width: TILE_W,
                height: TILE_H,
                zIndex: floorZ(x, y),
              }}
            >
              <img
                src={UI_SPRITES.expand.src}
                alt=""
                width={UI_SPRITES.expand.width}
                height={UI_SPRITES.expand.height}
                decoding="async"
                className="pointer-events-none block select-none"
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
                className="focus-visible:outline-3 pointer-events-auto absolute left-0 top-0 cursor-pointer bg-transparent focus-visible:outline-offset-[-2px] focus-visible:outline-[#C6FF3D]"
                style={{
                  width: TILE_W,
                  height: DIAMOND_H,
                  clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
                }}
              />
            </div>
          );
        })}

      {/* 3. Crops, roads, buildings, and decor */}
      {objectItems.map(({ key, tile, w, h, sortKey }) => {
        // Road decor auto-picks street / curve / intersection (floor band, sits over its ground slab)
        if (tile.itemId === 'road') {
          const spec = resolveRoadSprite(tile.x, tile.y, isRoadAt);
          const origin = isoToScreen(tile.x, tile.y);
          return (
            <img
              key={`obj_${key}`}
              src={spec.src}
              alt=""
              width={spec.width}
              height={spec.height}
              loading="lazy"
              decoding="async"
              className="pointer-events-none absolute block select-none"
              style={{
                left: origin.x - boundsMinX,
                top: origin.y - boundsMinY,
                zIndex: floorZ(tile.x, tile.y, 1),
                transform: spec.flipX ? 'scaleX(-1)' : undefined,
              }}
              draggable={false}
            />
          );
        }

        // Farm plot (empty dirt placeholder in floor band, or growing/ready crop in object band)
        if (tile.itemId === 'plot') {
          if (!tile.cropId) {
            const origin = isoToScreen(tile.x, tile.y);
            const spec = GROUND_SPRITES['basic-block-dirt'];
            return (
              <img
                key={`obj_${key}`}
                src={spec.src}
                alt=""
                width={spec.width}
                height={spec.height}
                decoding="async"
                className="pointer-events-none absolute block select-none"
                style={{
                  left: origin.x - boundsMinX,
                  top: origin.y - boundsMinY,
                  zIndex: floorZ(tile.x, tile.y, 1),
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
          const pos = getCropPlacement(tile.x, tile.y, cropSpec.height, cropSpec.groundOffsetY);
          const badgeOrigin = isoToScreen(tile.x, tile.y);
          const badgeCenterX = badgeOrigin.x + TILE_W / 2 - boundsMinX;
          const badgeTopY = badgeOrigin.y - 34 - boundsMinY;

          return (
            <div key={`obj_${key}`}>
              <img
                src={cropSpec.src}
                alt=""
                width={cropSpec.width}
                height={cropSpec.height}
                loading="lazy"
                decoding="async"
                className="pointer-events-none absolute block select-none"
                style={{
                  left: pos.x - boundsMinX,
                  top: pos.y - boundsMinY,
                  zIndex: objectZ(sortKey, Z_LAYER.crop),
                }}
                draggable={false}
              />

              {/* Harvest / Growth badge above plot: 56px source -> >= 28px on screen, >= 44px hit area */}
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
                    zIndex: objectZ(sortKey, Z_LAYER.badge),
                    transform: 'translate(-50%, -35%)',
                  }}
                  className="focus-visible:outline-3 absolute flex min-h-[88px] min-w-[88px] cursor-pointer flex-col items-center justify-center gap-1 bg-transparent focus-visible:outline-offset-2 focus-visible:outline-[#C6FF3D] disabled:cursor-default"
                >
                  <img
                    src={UI_SPRITES.farmReady.src}
                    alt=""
                    width={UI_SPRITES.farmReady.width}
                    height={UI_SPRITES.farmReady.height}
                    decoding="async"
                    className={`block select-none ${reducedMotion ? '' : 'rt-harvest-pulse'}`}
                    draggable={false}
                  />
                  <span className="rt-pixel-bubble rt-pixel-bubble--volt rt-pixel-bubble--tail whitespace-nowrap px-2 py-0.5 text-[15px] font-black leading-tight">
                    {t('town.map.readyShort')} +{cropMeta?.yieldCount ?? 2}
                  </span>
                </button>
              ) : (
                <div
                  style={{
                    left: badgeCenterX,
                    top: badgeTopY,
                    zIndex: objectZ(sortKey, Z_LAYER.badge),
                    transform: 'translate(-50%, -25%)',
                  }}
                  className="pointer-events-none absolute flex flex-col items-center gap-1"
                >
                  <img
                    src={UI_SPRITES.farmGrowing.src}
                    alt=""
                    width={UI_SPRITES.farmGrowing.width}
                    height={UI_SPRITES.farmGrowing.height}
                    loading="lazy"
                    decoding="async"
                    className="block select-none"
                    draggable={false}
                  />
                  <span className="rt-pixel-bubble rt-pixel-bubble--tail whitespace-nowrap px-1.5 py-0.5 text-[14px] font-bold leading-tight">
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
          const anchor = getBuildingPlacement(tile.x, tile.y, w, h, 96, 96);
          return (
            <div
              key={`obj_${key}`}
              aria-hidden="true"
              className="rt-pixel-bubble pointer-events-none absolute flex items-center justify-center px-2 text-sm font-black uppercase"
              style={{
                left: anchor.x - boundsMinX,
                top: anchor.y - boundsMinY,
                width: 96,
                height: 96,
                zIndex: objectZ(anchor.sortKey, Z_LAYER.building),
              }}
            >
              {tile.itemId.slice(0, 3)}
            </div>
          );
        }

        const placement = getBuildingPlacement(tile.x, tile.y, w, h, spec.width, spec.height);
        const isStarter = tile.itemId === 'starter_house';
        return (
          <img
            key={`obj_${key}`}
            src={spec.src}
            alt=""
            width={spec.width}
            height={spec.height}
            loading={isStarter ? 'eager' : 'lazy'}
            decoding="async"
            className="pointer-events-none absolute block select-none"
            style={{
              left: placement.x - boundsMinX,
              top: placement.y - boundsMinY,
              zIndex: objectZ(placement.sortKey, Z_LAYER.building),
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
  const [hoveredCell, setHoveredCell] = useState<GridCoord | null>(null);
  const [nowMs, setNowMs] = useState<number>(0);
  const [tabHidden, setTabHidden] = useState<boolean>(false);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 390, h: 660 });
  const [zoomLimitsState, setZoomLimitsState] = useState<{
    zoom: number;
    minZoom: number;
    maxZoom: number;
  }>({ zoom: 0.5, minZoom: 0.5, maxZoom: 1.0 });

  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Compute source-pixel content bounds around owned land + expand ring (~1 tile padding)
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

  const stageW = Math.ceil(bounds.width);
  const stageH = Math.ceil(bounds.height);

  // Compute fit-to-view scale & zoom range whenever viewport or map bounds change
  const zoomRange = useMemo(
    () => computeDisplayZoomRange(viewportSize.w, viewportSize.h, stageW, stageH),
    [viewportSize.w, viewportSize.h, stageW, stageH],
  );

  // Camera state stored in ref for zero-re-render rAF transforms
  const cameraRef = useRef<{
    panX: number;
    panY: number;
    zoom: number;
    initialized: boolean;
  }>({
    panX: 0,
    panY: 0,
    zoom: zoomRange.fitScale,
    initialized: false,
  });

  const rafWriteRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const viewportSizeRef = useRef(viewportSize);
  viewportSizeRef.current = viewportSize;

  const stageSizeRef = useRef({ w: stageW, h: stageH });
  stageSizeRef.current = { w: stageW, h: stageH };

  const zoomRangeRef = useRef(zoomRange);
  zoomRangeRef.current = zoomRange;

  // Active pointers for 1-finger pan & 2-finger pinch
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const panGestureRef = useRef<{
    pointerId: number | null;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
    exceededThreshold: boolean;
  }>({
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    startPanX: 0,
    startPanY: 0,
    exceededThreshold: false,
  });
  const pinchGestureRef = useRef<{
    active: boolean;
    startDist: number;
    startZoom: number;
    worldX: number;
    worldY: number;
  }>({
    active: false,
    startDist: 0,
    startZoom: 1,
    worldX: 0,
    worldY: 0,
  });
  const suppressClickUntilRef = useRef<number>(0);

  const flushTransformNow = useCallback((transitionCss?: string) => {
    const el = stageRef.current;
    if (!el) return;
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (transitionCss && !reducedMotionRef.current) {
      el.style.transition = transitionCss;
      const ms = transitionCss.includes('200ms') ? 210 : 160;
      transitionTimerRef.current = window.setTimeout(() => {
        if (stageRef.current) stageRef.current.style.transition = '';
        transitionTimerRef.current = null;
      }, ms);
    } else {
      el.style.transition = '';
    }
    const { panX, panY, zoom } = cameraRef.current;
    el.style.transform = `translate3d(${panX.toFixed(2)}px, ${panY.toFixed(2)}px, 0) scale(${zoom.toFixed(4)})`;
  }, []);

  const scheduleTransformWrite = useCallback(() => {
    if (rafWriteRef.current !== null) return;
    rafWriteRef.current = window.requestAnimationFrame(() => {
      rafWriteRef.current = null;
      flushTransformNow();
    });
  }, [flushTransformNow]);

  const syncZoomButtons = useCallback(() => {
    const zr = zoomRangeRef.current;
    const z = cameraRef.current.zoom;
    setZoomLimitsState((prev) => {
      if (
        Math.abs(prev.zoom - z) < 0.002 &&
        Math.abs(prev.minZoom - zr.minZoom) < 0.002 &&
        Math.abs(prev.maxZoom - zr.maxZoom) < 0.002
      ) {
        return prev;
      }
      return { zoom: z, minZoom: zr.minZoom, maxZoom: zr.maxZoom };
    });
  }, []);

  // Measure viewport via ResizeObserver (zero forced reflow during render)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize((prev) =>
          Math.abs(prev.w - rect.width) < 1 && Math.abs(prev.h - rect.height) < 1
            ? prev
            : { w: rect.width, h: rect.height },
        );
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Initialize / re-clamp camera when viewport size or map bounds change
  useEffect(() => {
    const cam = cameraRef.current;
    if (!cam.initialized) {
      cam.zoom = zoomRange.fitScale;
      const centeredX = (viewportSize.w - stageW * cam.zoom) / 2;
      const centeredY = (viewportSize.h - stageH * cam.zoom) / 2;
      const clamped = clampPanPosition(
        centeredX,
        centeredY,
        viewportSize.w,
        viewportSize.h,
        stageW,
        stageH,
        cam.zoom,
      );
      cam.panX = clamped.x;
      cam.panY = clamped.y;
      cam.initialized = true;
    } else {
      cam.zoom = Math.max(zoomRange.minZoom, Math.min(zoomRange.maxZoom, cam.zoom));
      const clamped = clampPanPosition(
        cam.panX,
        cam.panY,
        viewportSize.w,
        viewportSize.h,
        stageW,
        stageH,
        cam.zoom,
      );
      cam.panX = clamped.x;
      cam.panY = clamped.y;
    }
    flushTransformNow();
    syncZoomButtons();
  }, [
    viewportSize.w,
    viewportSize.h,
    stageW,
    stageH,
    zoomRange,
    flushTransformNow,
    syncZoomButtons,
  ]);

  // Cleanup rAF & transition timers on unmount
  useEffect(() => {
    return () => {
      if (rafWriteRef.current !== null) window.cancelAnimationFrame(rafWriteRef.current);
      if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    };
  }, []);

  // Preload first-paint sprites during idle time so they never block LCP
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

  // Apply zoom anchored at a viewport-local point (anchorX, anchorY)
  const applyZoomAtPoint = useCallback(
    (targetZoom: number, anchorX: number, anchorY: number, animate: boolean) => {
      const zr = zoomRangeRef.current;
      const vp = viewportSizeRef.current;
      const st = stageSizeRef.current;
      const cam = cameraRef.current;

      const clampedZoom = Math.max(zr.minZoom, Math.min(zr.maxZoom, targetZoom));
      if (Math.abs(clampedZoom - cam.zoom) < 0.0005) return;

      const worldX = (anchorX - cam.panX) / cam.zoom;
      const worldY = (anchorY - cam.panY) / cam.zoom;
      const nextPanX = anchorX - worldX * clampedZoom;
      const nextPanY = anchorY - worldY * clampedZoom;
      const clampedPan = clampPanPosition(nextPanX, nextPanY, vp.w, vp.h, st.w, st.h, clampedZoom);

      cam.zoom = clampedZoom;
      cam.panX = clampedPan.x;
      cam.panY = clampedPan.y;

      if (animate) {
        flushTransformNow('transform 150ms ease-out');
      } else {
        scheduleTransformWrite();
      }
      syncZoomButtons();
    },
    [flushTransformNow, scheduleTransformWrite, syncZoomButtons],
  );

  // Desktop ctrl/cmd + wheel & Safari gesture zoom disabled inside map container only
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchorX = e.clientX - rect.left;
      const anchorY = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0025);
      applyZoomAtPoint(cameraRef.current.zoom * factor, anchorX, anchorY, false);
    };

    const onGesture = (e: Event) => {
      e.preventDefault();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGesture, { passive: false });
    el.addEventListener('gesturechange', onGesture, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGesture);
      el.removeEventListener('gesturechange', onGesture);
    };
  }, [applyZoomAtPoint]);

  // Villagers operate in 1:1 source pixels inside the scaled world stage (zero DOM rewrite on zoom)
  const { villagerList, registerDom, dispatchHarvest } = useVillagers({
    population,
    land,
    blockedKeys,
    boundsMinX: bounds.minX,
    boundsMinY: bounds.minY,
    scale: 1,
    reducedMotion,
  });

  const handleHarvestTap = useCallback(
    (x: number, y: number) => {
      if (isVisitMode) return;
      dispatchHarvest({ x, y }, () => onHarvestComplete(x, y));
    },
    [isVisitMode, dispatchHarvest, onHarvestComplete],
  );

  // Pointer handlers for 1-pointer drag + 2-pointer pinch
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore clicks on zoom controls
    if ((e.target as HTMLElement).closest('[data-zoom-control="true"]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      const cam = cameraRef.current;
      panGestureRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: cam.panX,
        startPanY: cam.panY,
        exceededThreshold: false,
      };
      pinchGestureRef.current.active = false;
    } else if (pointersRef.current.size === 2) {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const [p1, p2] = Array.from(pointersRef.current.values());
      if (!p1 || !p2) return;
      const midX = (p1.x + p2.x) / 2 - rect.left;
      const midY = (p1.y + p2.y) / 2 - rect.top;
      const dist = Math.max(10, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const cam = cameraRef.current;
      pinchGestureRef.current = {
        active: true,
        startDist: dist,
        startZoom: cam.zoom,
        worldX: (midX - cam.panX) / cam.zoom,
        worldY: (midY - cam.panY) / cam.zoom,
      };
      panGestureRef.current.pointerId = null;
      panGestureRef.current.exceededThreshold = true;
      suppressClickUntilRef.current = performance.now() + 300;
    }
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointersRef.current.has(e.pointerId)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Two-pointer pinch-to-zoom anchored at midpoint
      if (pinchGestureRef.current.active && pointersRef.current.size >= 2) {
        const el = viewportRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const [p1, p2] = Array.from(pointersRef.current.values());
        if (!p1 || !p2) return;
        const midX = (p1.x + p2.x) / 2 - rect.left;
        const midY = (p1.y + p2.y) / 2 - rect.top;
        const dist = Math.max(10, Math.hypot(p2.x - p1.x, p2.y - p1.y));
        const zr = zoomRangeRef.current;
        const vp = viewportSizeRef.current;
        const st = stageSizeRef.current;
        const pinch = pinchGestureRef.current;

        const nextZoom = Math.max(
          zr.minZoom,
          Math.min(zr.maxZoom, pinch.startZoom * (dist / pinch.startDist)),
        );
        const rawPanX = midX - pinch.worldX * nextZoom;
        const rawPanY = midY - pinch.worldY * nextZoom;
        const clamped = clampPanPosition(rawPanX, rawPanY, vp.w, vp.h, st.w, st.h, nextZoom);

        cameraRef.current.zoom = nextZoom;
        cameraRef.current.panX = clamped.x;
        cameraRef.current.panY = clamped.y;
        scheduleTransformWrite();
        syncZoomButtons();
        return;
      }

      // Single-pointer drag pan with 6px tap threshold + 24px rubber-band resistance
      const drag = panGestureRef.current;
      if (drag.pointerId !== e.pointerId) return;

      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      if (!drag.exceededThreshold) {
        if (Math.hypot(dx, dy) <= DRAG_THRESHOLD_PX) return;
        drag.exceededThreshold = true;
        suppressClickUntilRef.current = performance.now() + 300;
        try {
          viewportRef.current?.setPointerCapture(e.pointerId);
        } catch {
          // Ignore pointer capture error on synthetic/mouse events
        }
      }

      const vp = viewportSizeRef.current;
      const st = stageSizeRef.current;
      const cam = cameraRef.current;
      const limX = getPanAxisLimits(vp.w, st.w, cam.zoom);
      const limY = getPanAxisLimits(vp.h, st.h, cam.zoom);

      cam.panX = applyRubberBand(drag.startPanX + dx, limX.min, limX.max, reducedMotionRef.current);
      cam.panY = applyRubberBand(drag.startPanY + dy, limY.min, limY.max, reducedMotionRef.current);
      scheduleTransformWrite();
    },
    [scheduleTransformWrite, syncZoomButtons],
  );

  const finishPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      pointersRef.current.delete(e.pointerId);

      if (pinchGestureRef.current.active && pointersRef.current.size < 2) {
        pinchGestureRef.current.active = false;
        suppressClickUntilRef.current = performance.now() + 250;
      }

      const drag = panGestureRef.current;
      if (drag.pointerId === e.pointerId) {
        const wasDragged = drag.exceededThreshold;
        drag.pointerId = null;
        drag.exceededThreshold = false;

        if (wasDragged) {
          suppressClickUntilRef.current = performance.now() + 250;
          try {
            if (viewportRef.current?.hasPointerCapture(e.pointerId)) {
              viewportRef.current.releasePointerCapture(e.pointerId);
            }
          } catch {
            // Ignore
          }

          // Spring back into clamped content bounds (200ms ease-out, instant under reduced motion)
          const vp = viewportSizeRef.current;
          const st = stageSizeRef.current;
          const cam = cameraRef.current;
          const clamped = clampPanPosition(cam.panX, cam.panY, vp.w, vp.h, st.w, st.h, cam.zoom);
          if (Math.abs(clamped.x - cam.panX) > 0.5 || Math.abs(clamped.y - cam.panY) > 0.5) {
            cam.panX = clamped.x;
            cam.panY = clamped.y;
            flushTransformNow('transform 200ms ease-out');
          }
        }
      }
    },
    [flushTransformNow],
  );

  // Suppress tile/button clicks immediately after a >6px drag or pinch
  const handleClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-zoom-control="true"]')) return;
    if (performance.now() < suppressClickUntilRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickUntilRef.current = 0;
    }
  }, []);

  // Keyboard panning (Arrow keys) & zooming (+ / -) when map has focus
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const vp = viewportSizeRef.current;
      const st = stageSizeRef.current;
      const cam = cameraRef.current;

      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft') dx = KEYBOARD_PAN_STEP_PX;
      else if (e.key === 'ArrowRight') dx = -KEYBOARD_PAN_STEP_PX;
      else if (e.key === 'ArrowUp') dy = KEYBOARD_PAN_STEP_PX;
      else if (e.key === 'ArrowDown') dy = -KEYBOARD_PAN_STEP_PX;
      else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        applyZoomAtPoint(cam.zoom * ZOOM_BUTTON_FACTOR, vp.w / 2, vp.h / 2, true);
        return;
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        applyZoomAtPoint(cam.zoom / ZOOM_BUTTON_FACTOR, vp.w / 2, vp.h / 2, true);
        return;
      } else {
        return;
      }

      e.preventDefault();
      const clamped = clampPanPosition(
        cam.panX + dx,
        cam.panY + dy,
        vp.w,
        vp.h,
        st.w,
        st.h,
        cam.zoom,
      );
      cam.panX = clamped.x;
      cam.panY = clamped.y;
      flushTransformNow('transform 150ms ease-out');
    },
    [applyZoomAtPoint, flushTransformNow],
  );

  // Evaluate placement / move / plant cursor validity for hovered/focused cell
  const cursorOverlay = useMemo(() => {
    if (isVisitMode || !hoveredCell) return null;
    const { x, y } = hoveredCell;
    const isInteractiveMode = Boolean(
      placingItemId || movingTile || moveModeActive || selectedSeed,
    );
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
      left: pos.x - bounds.minX,
      top: pos.y - bounds.minY,
      width: spec.width,
      height: spec.height,
      src: spec.src,
      zIndex: objectZ(x + y, 90),
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
  ]);

  // Pixel-art tile info tooltip on hover/focus in explore mode (placed buildings/crops)
  const hoverTooltip = useMemo(() => {
    if (!hoveredCell) return null;
    const isInteractiveMode = Boolean(
      placingItemId || movingTile || moveModeActive || selectedSeed,
    );
    if (isInteractiveMode) return null;

    const raw = tiles[`${hoveredCell.x}_${hoveredCell.y}`];
    const tile = raw?.parentTile ? tiles[raw.parentTile] : raw;
    if (!tile) return null;

    const item = catalog.items[tile.itemId];
    const label = tile.cropId
      ? t(`town.crops.${tile.cropId}.name`)
      : item?.nameKey
        ? t(item.nameKey)
        : tile.itemId;

    const origin = isoToScreen(tile.x, tile.y);
    return {
      left: origin.x + TILE_W / 2 - bounds.minX,
      top: origin.y - 26 - bounds.minY,
      label,
    };
  }, [
    hoveredCell,
    placingItemId,
    movingTile,
    moveModeActive,
    selectedSeed,
    tiles,
    catalog,
    bounds.minX,
    bounds.minY,
    t,
  ]);

  const canZoomIn = zoomLimitsState.zoom < zoomLimitsState.maxZoom - 0.005;
  const canZoomOut = zoomLimitsState.zoom > zoomLimitsState.minZoom + 0.005;

  // Compute deterministic initial transform for SSR / pre-hydration frame (zero layout shift)
  const initialCam = useMemo(() => {
    const z = zoomRange.fitScale;
    const clamped = clampPanPosition(
      (viewportSize.w - stageW * z) / 2,
      (viewportSize.h - stageH * z) / 2,
      viewportSize.w,
      viewportSize.h,
      stageW,
      stageH,
      z,
    );
    return { x: clamped.x, y: clamped.y, z };
  }, [viewportSize.w, viewportSize.h, stageW, stageH, zoomRange.fitScale]);

  return (
    <div
      ref={viewportRef}
      role="region"
      tabIndex={0}
      aria-label={t('town.map.regionAria')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onClickCapture={handleClickCapture}
      onKeyDown={handleKeyDown}
      className={`focus-visible:outline-3 relative h-full w-full flex-1 touch-none select-none overflow-hidden overscroll-none bg-[#132013] focus-visible:outline-offset-[-3px] focus-visible:outline-[#C6FF3D] ${
        tabHidden ? 'rt-paused' : ''
      }`}
    >
      {/* Scaled world stage (1:1 128px source coordinates, single GPU transform) */}
      <div
        ref={stageRef}
        data-rontown-stage="true"
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{
          width: stageW,
          height: stageH,
          transform: `translate3d(${initialCam.x.toFixed(2)}px, ${initialCam.y.toFixed(2)}px, 0) scale(${initialCam.z.toFixed(4)})`,
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
          const initX = Math.round(feet.x - bounds.minX - spec.width / 2);
          const initY = Math.round(feet.y - bounds.minY - spec.height);
          return (
            <div
              key={v.id}
              data-villager-id={v.id}
              ref={(el) => registerDom(v.id, 'wrap', el)}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 will-change-transform"
              style={{
                transform: `translate3d(${initX}px, ${initY}px, 0)`,
                zIndex: objectZ(v.initialX + v.initialY, Z_LAYER.villager),
                transition: reducedMotion ? 'opacity 180ms linear' : undefined,
              }}
            >
              {v.isArrivalVisitor && (
                <div className="rt-pixel-bubble rt-pixel-bubble--tail absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 text-[14px] font-black">
                  +1!
                </div>
              )}
              <img
                ref={(el) => registerDom(v.id, 'img', el)}
                data-villager-img={v.id}
                src={spec.src}
                alt=""
                width={spec.width}
                height={spec.height}
                decoding="async"
                className="block select-none"
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
            decoding="async"
            className="pointer-events-none absolute block select-none"
            style={{
              left: cursorOverlay.left,
              top: cursorOverlay.top,
              zIndex: cursorOverlay.zIndex,
            }}
            draggable={false}
          />
        )}

        {/* Pixel-art tile info tooltip on hover/focus */}
        {hoverTooltip && (
          <div
            role="tooltip"
            className="rt-pixel-bubble rt-pixel-bubble--tail pointer-events-none absolute whitespace-nowrap px-2.5 py-1 text-[16px] font-black"
            style={{
              left: hoverTooltip.left,
              top: hoverTooltip.top,
              transform: 'translate(-50%, -100%)',
              zIndex: Z_UI,
            }}
          >
            {hoverTooltip.label}
          </div>
        )}

        {/* Floating +N harvest feedback pixel-art speech bubbles (600ms transform + opacity) */}
        {floatingRewards.map((reward) => {
          const origin = isoToScreen(reward.x, reward.y);
          return (
            <div
              key={reward.id}
              role="status"
              className="rt-pixel-bubble rt-pixel-bubble--volt rt-pixel-bubble--tail rt-float-reward pointer-events-none absolute whitespace-nowrap px-2.5 py-1 text-[18px] font-black"
              style={{
                left: origin.x + TILE_W / 2 - bounds.minX,
                top: origin.y - 36 - bounds.minY,
                zIndex: Z_UI + 10,
              }}
            >
              {reward.text}
            </div>
          );
        })}
      </div>

      {/* Corner pixel-art Zoom + / - controls */}
      <div
        data-zoom-control="true"
        role="group"
        aria-label={t('town.map.zoomControls')}
        className="absolute bottom-3 start-3 z-20 flex flex-col gap-1.5"
      >
        <button
          type="button"
          data-zoom-control="true"
          disabled={!canZoomIn}
          onClick={() =>
            applyZoomAtPoint(
              cameraRef.current.zoom * ZOOM_BUTTON_FACTOR,
              viewportSizeRef.current.w / 2,
              viewportSizeRef.current.h / 2,
              true,
            )
          }
          aria-label={t('town.map.zoomIn')}
          title={t('town.map.zoomIn')}
          className="focus-visible:outline-3 flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center border-2 border-[#0E0D15] bg-[#FFF7EC] font-mono text-xl font-black leading-none text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15] transition-transform hover:scale-105 focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF] active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100 motion-reduce:transition-none"
        >
          +
        </button>
        <button
          type="button"
          data-zoom-control="true"
          disabled={!canZoomOut}
          onClick={() =>
            applyZoomAtPoint(
              cameraRef.current.zoom / ZOOM_BUTTON_FACTOR,
              viewportSizeRef.current.w / 2,
              viewportSizeRef.current.h / 2,
              true,
            )
          }
          aria-label={t('town.map.zoomOut')}
          title={t('town.map.zoomOut')}
          className="focus-visible:outline-3 flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center border-2 border-[#0E0D15] bg-[#FFF7EC] font-mono text-xl font-black leading-none text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15] transition-transform hover:scale-105 focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF] active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100 motion-reduce:transition-none"
        >
          −
        </button>
      </div>
    </div>
  );
}
