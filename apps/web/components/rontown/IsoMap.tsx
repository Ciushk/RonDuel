'use client';

import { useTranslations } from 'next-intl';
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateSpeedupCost,
  getRotationKind,
  type GridCoord,
  type GroundTileType,
  type TownCatalogDoc,
} from '@ronduel/shared';
import {
  applyRubberBand,
  clampPanPosition,
  computeDisplayZoomRange,
  computeMapBounds,
  DIAMOND_H,
  floorZ,
  formatDurationShort,
  getBuildingPlacement,
  getCropFaceClipPath,
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
  BUBBLE_SPRITES,
  CATALOG_SPRITES,
  GROUND_LABEL_KEY,
  GROUND_SPRITES,
  HEART_FLOAT_SPRITE,
  preloadInitialSprites,
  resolveCropSprite,
  resolveGroundSprite,
  resolveRoadSprite,
  UI_SPRITES,
  VILLAGER_SPRITES,
} from './sprites';
import { pickDomAtPoint, TOUCH_TOLERANCE_PX } from './pick';
import type { FloatingReward, TileInfo } from './useTownState';
import { useReducedMotion, useVillagers } from './useVillagers';

const DRAG_THRESHOLD_PX = 6;
const KEYBOARD_PAN_STEP_PX = 48;
const ZOOM_BUTTON_FACTOR = 1.25;

export interface RotatingTarget {
  key: string;
  layer: 'ground' | 'item';
  kind: 'rot4' | 'flip2';
  toRot: 0 | 1 | 2 | 3;
  tick: number;
}

interface IsoMapProps {
  land: Record<string, GroundTileType>;
  landRot?: Record<string, 1 | 2 | 3>;
  tiles: Record<string, TileInfo>;
  expandRing: GridCoord[];
  blockedKeys: ReadonlySet<string>;
  catalog: TownCatalogDoc;
  population: number;
  isVisitMode: boolean;
  placingItemId: string | null;
  moveModeActive: boolean;
  rotateModeActive?: boolean;
  rotatingTarget?: RotatingTarget | null;
  movingTile: TileInfo | null;
  selectedSeed: string | null;
  floatingRewards: FloatingReward[];
  speedupEnabled?: boolean;
  speedupSparkleKey?: string | null;
  childBorn?: boolean;
  familyEventEligible?: boolean;
  canPlaceAt: (
    x: number,
    y: number,
    w: number,
    h: number,
    ignoreSelf?: { x: number; y: number; w: number; h: number },
  ) => boolean;
  canPlantAt: (x: number, y: number) => boolean;
  onTileTap: (x: number, y: number) => void;
  onRotateCell?: (x: number, y: number) => void;
  onExpandTap: (x: number, y: number) => void;
  onHarvestComplete: (x: number, y: number) => void;
  onSpeedupTap?: (tile: TileInfo) => void;
  onFamilyEventComplete?: () => void;
  lastTownEvent?: { id: number; x: number; y: number; type: 'harvest' | 'build' | 'plant' } | null;
  placingRoadRot?: 0 | 1;
  roadRotateTick?: number;
}

interface StaticWorldProps {
  land: Record<string, GroundTileType>;
  landRot: Record<string, 1 | 2 | 3>;
  tiles: Record<string, TileInfo>;
  expandRing: GridCoord[];
  catalog: TownCatalogDoc;
  boundsMinX: number;
  boundsMinY: number;
  isVisitMode: boolean;
  rotateModeActive: boolean;
  interactiveMode: boolean;
  rotatingTarget: RotatingTarget | null;
  speedupEnabled: boolean;
  speedupSparkleKey: string | null;
  nowMs: number;
  reducedMotion: boolean;
  previewRoadCell: GridCoord | null;
  placingRoadRot: 0 | 1;
  roadRotateTick: number;
  onHoverCell: (cell: GridCoord | null) => void;
  onFocusCell: (cell: GridCoord | null) => void;
  onTileTap: (x: number, y: number) => void;
  onExpandTap: (x: number, y: number) => void;
  onHarvestTap: (x: number, y: number) => void;
  onSpeedupTap?: (tile: TileInfo) => void;
}

const StaticWorldLayer = memo(function StaticWorldLayer({
  land,
  landRot,
  tiles,
  expandRing,
  catalog,
  boundsMinX,
  boundsMinY,
  isVisitMode,
  rotateModeActive,
  interactiveMode,
  rotatingTarget,
  speedupEnabled,
  speedupSparkleKey,
  nowMs,
  reducedMotion,
  previewRoadCell,
  placingRoadRot,
  roadRotateTick,
  onHoverCell,
  onFocusCell,
  onTileTap,
  onExpandTap,
  onHarvestTap,
  onSpeedupTap,
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

  const isRoadWithPreview = useCallback(
    (nx: number, ny: number) =>
      isRoadAt(nx, ny) ||
      (previewRoadCell !== null && nx === previewRoadCell.x && ny === previewRoadCell.y),
    [isRoadAt, previewRoadCell],
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
        const spec = resolveGroundSprite(ground, landRot[key]);
        const rawTile = tiles[key];
        const tile = rawTile?.parentTile ? tiles[rawTile.parentTile] : rawTile;
        const isGroundRotating = rotatingTarget?.key === key && rotatingTarget.layer === 'ground';
        const groundRot4Class =
          isGroundRotating && rotatingTarget.kind === 'rot4'
            ? rotatingTarget.tick % 2 === 1
              ? 'rt-rot4-anim-a'
              : 'rt-rot4-anim-b'
            : '';
        const groundFlip2Class =
          isGroundRotating && rotatingTarget.kind === 'flip2'
            ? rotatingTarget.toRot % 2 === 1
              ? 'rt-flip2-to1'
              : 'rt-flip2-to0'
            : '';

        let cellLabel: string;
        if (rotateModeActive) {
          const itemMeta = tile ? catalog.items[tile.itemId] : undefined;
          const itemLabel =
            tile && getRotationKind('item', tile.itemId) !== 'none'
              ? itemMeta?.nameKey
                ? t(itemMeta.nameKey)
                : tile.itemId
              : t(GROUND_LABEL_KEY[ground]);
          cellLabel = t('town.rotate.cellAria', { item: itemLabel, x, y });
        } else if (tile) {
          const itemMeta = catalog.items[tile.itemId];
          const itemLabel =
            tile.itemId === 'plot'
              ? tile.cropId
                ? `${t(`town.crops.${tile.cropId}.name`)} · ${t('town.catalog.farm_plot.name')}`
                : t('town.tiles.emptyPlot')
              : itemMeta?.nameKey
                ? t(itemMeta.nameKey)
                : t(GROUND_LABEL_KEY[ground]);
          cellLabel = t('town.map.cellItemAria', { item: itemLabel, x, y });
        } else {
          cellLabel = t('town.map.groundCell', { x, y });
        }

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
            <div className={`pointer-events-none ${groundRot4Class}`}>
              <img
                data-ground-tile={key}
                src={spec.src}
                alt=""
                width={spec.width}
                height={spec.height}
                decoding="async"
                className={`pointer-events-none block select-none ${groundFlip2Class}`}
                style={{
                  transform: spec.flipX ? 'scaleX(-1)' : undefined,
                }}
                draggable={false}
              />
            </div>
            <button
              type="button"
              data-rt-ground-btn="true"
              data-rt-x={x}
              data-rt-y={y}
              onClick={() => onTileTap(x, y)}
              onMouseEnter={() => onHoverCell({ x, y })}
              onMouseLeave={() => onHoverCell(null)}
              onFocus={() => onFocusCell({ x, y })}
              onBlur={(e) => {
                if (
                  e.relatedTarget instanceof HTMLElement &&
                  e.relatedTarget.dataset.testid === 'road-rotate-btn'
                ) {
                  return;
                }
                onFocusCell(null);
              }}
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
                data-rt-expand-btn="true"
                data-rt-x={x}
                data-rt-y={y}
                onClick={() => onExpandTap(x, y)}
                onMouseEnter={() => onHoverCell({ x, y })}
                onMouseLeave={() => onHoverCell(null)}
                onFocus={() => onFocusCell({ x, y })}
                onBlur={() => onFocusCell(null)}
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
        // Road decor auto-picks 16-way street/curve/T/end/intersection (floor band, sits over its ground slab)
        if (tile.itemId === 'road') {
          const spec = resolveRoadSprite(tile.x, tile.y, isRoadWithPreview, tile.rot);
          const origin = isoToScreen(tile.x, tile.y);
          const isItemRotating = rotatingTarget?.key === key && rotatingTarget.layer === 'item';
          const roadFlipClass = isItemRotating
            ? rotatingTarget.toRot % 2 === 1
              ? 'rt-flip2-to1'
              : 'rt-flip2-to0'
            : '';
          return (
            <img
              key={`obj_${key}`}
              data-road-tile={key}
              data-item-tile={key}
              src={spec.src}
              alt=""
              width={spec.width}
              height={spec.height}
              loading="lazy"
              decoding="async"
              className={`pointer-events-none absolute block select-none ${roadFlipClass}`}
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
          const soilOrigin = isoToScreen(tile.x, tile.y);
          const soilSpec = GROUND_SPRITES['basic-block-dirt'];
          const badgeCenterX = soilOrigin.x + TILE_W / 2 - boundsMinX;
          const badgeTopY = soilOrigin.y - 34 - boundsMinY;

          return (
            <Fragment key={`obj_${key}`}>
              <img
                src={soilSpec.src}
                alt=""
                width={soilSpec.width}
                height={soilSpec.height}
                decoding="async"
                className="pointer-events-none absolute block select-none"
                style={{
                  left: soilOrigin.x - boundsMinX,
                  top: soilOrigin.y - boundsMinY,
                  zIndex: floorZ(tile.x, tile.y, 1),
                }}
                draggable={false}
              />

              <img
                data-rt-pick="sprite"
                data-rt-key={key}
                data-rt-x={tile.x}
                data-rt-y={tile.y}
                data-rt-object-z={objectZ(sortKey, Z_LAYER.crop)}
                aria-hidden="true"
                src={cropSpec.src}
                alt=""
                width={cropSpec.width}
                height={cropSpec.height}
                loading="lazy"
                decoding="async"
                className="rt-pick-object pointer-events-auto absolute block select-none"
                style={{
                  left: pos.x - boundsMinX,
                  top: pos.y - boundsMinY,
                  zIndex: objectZ(sortKey, Z_LAYER.crop),
                  clipPath: getCropFaceClipPath(cropSpec.height, cropSpec.groundOffsetY),
                }}
                draggable={false}
              />

              {/* Harvest / Growth badge above plot: 56px source -> >= 28px on screen, >= 44px hit area */}
              {growth.isReady ? (
                <button
                  type="button"
                  data-rt-badge-btn="true"
                  disabled={isVisitMode || interactiveMode}
                  onClick={() => onHarvestTap(tile.x, tile.y)}
                  aria-label={t('town.map.harvestBadgeAria', {
                    crop: t(`town.crops.${tile.cropId}.name`),
                    x: tile.x,
                    y: tile.y,
                  })}
                  style={{
                    left: badgeCenterX,
                    top: badgeTopY,
                    zIndex: objectZ(sortKey, Z_LAYER.badge),
                    transform: 'translate(-50%, -35%)',
                  }}
                  className={`focus-visible:outline-3 absolute flex min-h-[88px] min-w-[88px] flex-col items-center justify-center gap-1 bg-transparent focus-visible:outline-offset-2 focus-visible:outline-[#C6FF3D] disabled:cursor-default ${
                    interactiveMode ? 'pointer-events-none' : 'cursor-pointer'
                  }`}
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
                  <div className="flex items-center gap-1.5">
                    <span className="rt-pixel-bubble rt-pixel-bubble--tail whitespace-nowrap px-1.5 py-0.5 text-[14px] font-bold leading-tight">
                      {formatDurationShort(growth.remainingSeconds)}
                    </span>
                    {!isVisitMode && !interactiveMode && speedupEnabled && onSpeedupTap && (
                      <button
                        type="button"
                        data-rt-badge-btn="true"
                        data-testid={`speedup-chip-${key}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSpeedupTap(tile);
                        }}
                        aria-label={t('town.speedup.chipAria', {
                          crop: t(`town.crops.${tile.cropId}.name`),
                          cost: calculateSpeedupCost(growth.remainingSeconds, tile.cropId),
                        })}
                        className="focus-visible:outline-3 pointer-events-auto -m-3 flex min-h-[88px] min-w-[88px] cursor-pointer items-center justify-center bg-transparent focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF]"
                      >
                        <span className="whitespace-nowrap rounded-lg border-2 border-[#0E0D15] bg-[#C6FF3D] px-2 py-1 font-mono text-[16px] font-black leading-none text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15]">
                          ⚡ {calculateSpeedupCost(growth.remainingSeconds, tile.cropId)}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {speedupSparkleKey === key && (
                <div
                  aria-hidden="true"
                  data-testid="speedup-sparkle"
                  style={{
                    left: badgeCenterX,
                    top: soilOrigin.y + 8 - boundsMinY,
                    zIndex: objectZ(sortKey, Z_LAYER.badge + 2),
                  }}
                  className="rt-speedup-sparkle pointer-events-none absolute"
                >
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 16 16"
                    shapeRendering="crispEdges"
                    className="block"
                  >
                    <rect x="7" y="1" width="2" height="14" fill="#C6FF3D" />
                    <rect x="1" y="7" width="14" height="2" fill="#C6FF3D" />
                    <rect x="6" y="6" width="4" height="4" fill="#FFF7EC" />
                    <rect x="3" y="3" width="2" height="2" fill="#FACC15" />
                    <rect x="11" y="3" width="2" height="2" fill="#FACC15" />
                    <rect x="3" y="11" width="2" height="2" fill="#FACC15" />
                    <rect x="11" y="11" width="2" height="2" fill="#FACC15" />
                  </svg>
                </div>
              )}
            </Fragment>
          );
        }

        // Buildings & other decor
        const spec = CATALOG_SPRITES[tile.itemId];
        const isFlipped = (tile.rot ?? 0) % 2 === 1;
        const isItemRotating = rotatingTarget?.key === key && rotatingTarget.layer === 'item';
        const itemFlipClass = isItemRotating
          ? rotatingTarget.toRot % 2 === 1
            ? 'rt-flip2-to1'
            : 'rt-flip2-to0'
          : '';
        if (!spec || spec.isPlaceholder) {
          const anchor = getBuildingPlacement(tile.x, tile.y, w, h, 96, 96);
          const placeholderZ = objectZ(anchor.sortKey, Z_LAYER.building);
          return (
            <div
              key={`obj_${key}`}
              data-item-tile={key}
              data-rt-pick="placeholder"
              data-rt-key={key}
              data-rt-x={tile.x}
              data-rt-y={tile.y}
              data-rt-flip-x={isFlipped ? '1' : undefined}
              data-rt-object-z={placeholderZ}
              aria-hidden="true"
              className={`rt-pixel-bubble rt-pick-object pointer-events-auto absolute flex select-none items-center justify-center p-2 ${itemFlipClass}`}
              style={{
                left: anchor.x - boundsMinX,
                top: anchor.y - boundsMinY,
                width: 96,
                height: 96,
                zIndex: placeholderZ,
                transform: isFlipped ? 'scaleX(-1)' : undefined,
              }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 16 16"
                shapeRendering="crispEdges"
                className="pointer-events-none"
              >
                <polygon points="8,2 14,7 2,7" fill="#D45C44" />
                <rect x="3" y="7" width="10" height="7" fill="#F2E0C4" />
                <rect x="6" y="10" width="4" height="4" fill="#6C422C" />
              </svg>
            </div>
          );
        }

        const placement = getBuildingPlacement(tile.x, tile.y, w, h, spec.width, spec.height);
        const isStarter = tile.itemId === 'starter_house';
        const buildingZ = objectZ(placement.sortKey, Z_LAYER.building);
        return (
          <img
            key={`obj_${key}`}
            data-item-tile={key}
            data-rt-pick="sprite"
            data-rt-key={key}
            data-rt-x={tile.x}
            data-rt-y={tile.y}
            data-rt-flip-x={isFlipped ? '1' : undefined}
            data-rt-object-z={buildingZ}
            aria-hidden="true"
            src={spec.src}
            alt=""
            width={spec.width}
            height={spec.height}
            loading={isStarter ? 'eager' : 'lazy'}
            decoding="async"
            className={`rt-pick-object pointer-events-auto absolute block select-none ${itemFlipClass}`}
            style={{
              left: placement.x - boundsMinX,
              top: placement.y - boundsMinY,
              zIndex: buildingZ,
              transform: isFlipped ? 'scaleX(-1)' : undefined,
            }}
            draggable={false}
          />
        );
      })}

      {/* 4. Road placement preview (50% opacity in floor band under cursor) */}
      {previewRoadCell &&
        (() => {
          const spec = resolveRoadSprite(
            previewRoadCell.x,
            previewRoadCell.y,
            isRoadWithPreview,
            placingRoadRot,
          );
          const origin = isoToScreen(previewRoadCell.x, previewRoadCell.y);
          const dipClass =
            roadRotateTick > 0
              ? roadRotateTick % 2 === 1
                ? 'rt-road-dip-a'
                : 'rt-road-dip-b'
              : '';
          return (
            <div
              key="road-preview-wrap"
              className="pointer-events-none absolute select-none"
              style={{
                left: origin.x - boundsMinX,
                top: origin.y - boundsMinY,
                width: spec.width,
                height: spec.height,
                zIndex: floorZ(previewRoadCell.x, previewRoadCell.y, 1),
                opacity: 0.5,
              }}
            >
              <img
                key="road-preview"
                data-road-preview="true"
                src={spec.src}
                alt=""
                width={spec.width}
                height={spec.height}
                decoding="async"
                className={`rt-road-preview-img block select-none ${dipClass}`}
                style={{
                  transform: spec.flipX ? 'scaleX(-1)' : 'scaleX(1)',
                }}
                draggable={false}
              />
            </div>
          );
        })()}
    </>
  );
});

const EMPTY_LAND_ROT: Record<string, 1 | 2 | 3> = {};

interface HoveredObject {
  key: string;
  src: string | null;
  left: number;
  top: number;
  width: number;
  height: number;
  flipX: boolean;
  zIndex: number;
  clipPath?: string;
  isPlaceholder: boolean;
}

export function IsoMap({
  land,
  landRot = EMPTY_LAND_ROT,
  tiles,
  expandRing,
  blockedKeys,
  catalog,
  population,
  isVisitMode,
  placingItemId,
  moveModeActive,
  rotateModeActive = false,
  rotatingTarget = null,
  movingTile,
  selectedSeed,
  floatingRewards,
  speedupEnabled = false,
  speedupSparkleKey = null,
  childBorn = false,
  familyEventEligible = false,
  canPlaceAt,
  canPlantAt,
  onTileTap,
  onRotateCell,
  onExpandTap,
  onHarvestComplete,
  onSpeedupTap,
  onFamilyEventComplete,
  lastTownEvent,
  placingRoadRot = 0,
  roadRotateTick = 0,
}: IsoMapProps) {
  const t = useTranslations();
  const reducedMotion = useReducedMotion();
  const [hoveredCell, setHoveredCell] = useState<GridCoord | null>(null);
  const [hoveredObject, setHoveredObject] = useState<HoveredObject | null>(null);
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

  // Ground-target modes (place, plant, drop moved item) bypass standing sprites so players can aim behind roofs
  const groundTargetMode = Boolean(placingItemId || selectedSeed || movingTile);
  const groundTargetModeRef = useRef(groundTargetMode);
  groundTargetModeRef.current = groundTargetMode;
  const lastPointerTypeRef = useRef<string>('mouse');

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

  // Immediately refresh nowMs when a crop speed-up completes so Ready badge/state flips on the next frame
  useEffect(() => {
    if (speedupSparkleKey) {
      setNowMs(Date.now());
    }
  }, [speedupSparkleKey]);

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
  const { villagerList, registerDom, dispatchHarvest, notifyTownEvent, familyHeartsHouse } =
    useVillagers({
      population,
      land,
      tiles,
      catalog,
      blockedKeys,
      boundsMinX: bounds.minX,
      boundsMinY: bounds.minY,
      scale: 1,
      reducedMotion,
      childBorn,
      familyEventEligible,
      onFamilyEventComplete,
    });

  useEffect(() => {
    if (!lastTownEvent) return;
    notifyTownEvent({ x: lastTownEvent.x, y: lastTownEvent.y, type: lastTownEvent.type });
  }, [lastTownEvent, notifyTownEvent]);

  const handleHarvestTap = useCallback(
    (x: number, y: number) => {
      if (isVisitMode) return;
      dispatchHarvest({ x, y }, () => {
        notifyTownEvent({ x, y, type: 'harvest' });
        onHarvestComplete(x, y);
      });
    },
    [isVisitMode, dispatchHarvest, notifyTownEvent, onHarvestComplete],
  );

  const setHoveredCellStable = useCallback((next: GridCoord | null) => {
    setHoveredCell((prev) => {
      if (prev === null && next === null) return prev;
      if (prev && next && prev.x === next.x && prev.y === next.y) return prev;
      return next;
    });
  }, []);

  const handleDiamondMouseHover = useCallback(
    (cell: GridCoord | null) => {
      if (!groundTargetModeRef.current) return;
      setHoveredCellStable(cell);
    },
    [setHoveredCellStable],
  );

  // Clear hover highlight when entering a ground-target mode (place / plant / drop-move)
  useEffect(() => {
    if (groundTargetMode) {
      setHoveredObject(null);
    }
  }, [groundTargetMode]);

  // Keep hover highlight synchronized if the hovered building is rotated, moved, or removed
  useEffect(() => {
    setHoveredObject((prev) => {
      if (!prev) return null;
      const tile = tiles[prev.key];
      if (!tile || (tile.itemId === 'plot' && !tile.cropId)) return null;
      const nextFlipX = (tile.rot ?? 0) % 2 === 1;
      if (prev.flipX !== nextFlipX) {
        return { ...prev, flipX: nextFlipX };
      }
      return prev;
    });
  }, [tiles]);

  const updateMouseHover = useCallback(
    (clientX: number, clientY: number) => {
      const hit = pickDomAtPoint(clientX, clientY, {
        groundOnly: false,
        tolerancePx: 0,
        stageEl: stageRef.current,
      });

      if (hit && hit.kind === 'object') {
        setHoveredObject((prev) => {
          if (
            prev &&
            prev.key === hit.key &&
            prev.src === hit.src &&
            prev.flipX === hit.flipX &&
            prev.left === hit.left &&
            prev.top === hit.top &&
            prev.width === hit.width &&
            prev.height === hit.height &&
            prev.zIndex === hit.zIndex &&
            prev.clipPath === hit.clipPath
          ) {
            return prev;
          }
          return {
            key: hit.key,
            src: hit.src,
            left: hit.left,
            top: hit.top,
            width: hit.width,
            height: hit.height,
            flipX: hit.flipX,
            zIndex: hit.zIndex,
            clipPath: hit.clipPath,
            isPlaceholder: hit.isPlaceholder,
          };
        });
        setHoveredCellStable({ x: hit.originX, y: hit.originY });
      } else {
        setHoveredObject((prev) => (prev === null ? prev : null));
        if (hit && (hit.kind === 'ground' || hit.kind === 'expand')) {
          setHoveredCellStable({ x: hit.x, y: hit.y });
        } else {
          setHoveredCellStable(null);
        }
      }
    },
    [setHoveredCellStable],
  );

  // Pointer handlers for 1-pointer drag + 2-pointer pinch
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    lastPointerTypeRef.current = e.pointerType || 'mouse';
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
      if (!pointersRef.current.has(e.pointerId)) {
        if (e.pointerType === 'mouse' && !groundTargetModeRef.current) {
          if ((e.target as HTMLElement | null)?.closest('[data-zoom-control="true"]')) {
            setHoveredObject((prev) => (prev === null ? prev : null));
            setHoveredCellStable(null);
          } else {
            updateMouseHover(e.clientX, e.clientY);
          }
        }
        return;
      }
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
        setHoveredObject((prev) => (prev === null ? prev : null));
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
    [scheduleTransformWrite, syncZoomButtons, updateMouseHover, setHoveredCellStable],
  );

  const finishPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType) {
        lastPointerTypeRef.current = e.pointerType;
      }
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

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse') {
        setHoveredObject((prev) => (prev === null ? prev : null));
        if (!groundTargetModeRef.current) {
          setHoveredCellStable(null);
        }
      }
    },
    [setHoveredCellStable],
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

  // Sprite-aware click interception with alpha fallthrough & touch tolerance.
  // Event-target rule: never intercept clicks whose target is already a ground, expand,
  // harvest, speed-up, or zoom button — let their native onClick handlers run untouched.
  const handleStageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (groundTargetModeRef.current) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (
        target.closest(
          '[data-rt-ground-btn="true"], [data-rt-expand-btn="true"], [data-rt-badge-btn="true"], [data-zoom-control="true"]',
        )
      ) {
        return;
      }

      const pickEl = target.closest<HTMLElement>('[data-rt-pick]');
      if (!pickEl) return;

      e.preventDefault();
      e.stopPropagation();

      const nativePointerType = (e.nativeEvent as PointerEvent).pointerType;
      const pointerType = nativePointerType || lastPointerTypeRef.current || 'mouse';
      const tolerancePx = pointerType !== 'mouse' ? TOUCH_TOLERANCE_PX : 0;

      const hit = pickDomAtPoint(e.clientX, e.clientY, {
        groundOnly: false,
        tolerancePx,
        stageEl: stageRef.current,
      });

      if (!hit || hit.kind === 'passthrough') return;
      if (hit.kind === 'object') {
        onTileTap(hit.originX, hit.originY);
      } else if (hit.kind === 'ground') {
        onTileTap(hit.x, hit.y);
      } else if (hit.kind === 'expand') {
        onExpandTap(hit.x, hit.y);
      }
    },
    [onTileTap, onExpandTap],
  );

  // Keyboard panning (Arrow keys), zooming (+ / -), and R rotate when map has focus
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        rotateModeActive &&
        hoveredCell &&
        (e.key === 'r' || e.key === 'R') &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        onRotateCell?.(hoveredCell.x, hoveredCell.y);
        return;
      }

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
    [applyZoomAtPoint, flushTransformNow, rotateModeActive, hoveredCell, onRotateCell],
  );

  // Evaluate placement / move / rotate / plant cursor validity for hovered/focused cell
  const cursorOverlay = useMemo(() => {
    if (isVisitMode || !hoveredCell) return null;
    const { x, y } = hoveredCell;
    const isInteractiveMode = Boolean(
      placingItemId || movingTile || moveModeActive || rotateModeActive || selectedSeed,
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
    } else if (rotateModeActive) {
      const raw = tiles[`${x}_${y}`];
      const tile = raw?.parentTile ? tiles[raw.parentTile] : raw;
      const ground = land[`${x}_${y}`];
      const itemOk = Boolean(tile && getRotationKind('item', tile.itemId) !== 'none');
      const groundOk = Boolean(ground && getRotationKind('ground', ground) !== 'none');
      isValid = itemOk || groundOk;
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
    rotateModeActive,
    selectedSeed,
    catalog,
    canPlaceAt,
    canPlantAt,
    tiles,
    land,
    bounds.minX,
    bounds.minY,
  ]);

  // Pixel-art tile info tooltip on hover/focus in explore mode (placed buildings/crops)
  const hoverTooltip = useMemo(() => {
    if (!hoveredCell) return null;
    const isInteractiveMode = Boolean(
      placingItemId || movingTile || moveModeActive || rotateModeActive || selectedSeed,
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
    rotateModeActive,
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

  // Road placement preview cell (valid hovered cell while placingItemId === 'road')
  const previewRoadCell = useMemo<GridCoord | null>(() => {
    if (isVisitMode || placingItemId !== 'road' || !hoveredCell) return null;
    if (!canPlaceAt(hoveredCell.x, hoveredCell.y, 1, 1)) return null;
    return hoveredCell;
  }, [isVisitMode, placingItemId, hoveredCell, canPlaceAt]);

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
      onPointerLeave={handlePointerLeave}
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
        data-rt-ground-target={groundTargetMode ? 'true' : undefined}
        onClick={handleStageClick}
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
          landRot={landRot}
          tiles={tiles}
          expandRing={expandRing}
          catalog={catalog}
          boundsMinX={bounds.minX}
          boundsMinY={bounds.minY}
          isVisitMode={isVisitMode}
          rotateModeActive={rotateModeActive}
          interactiveMode={Boolean(
            placingItemId || moveModeActive || movingTile || rotateModeActive || selectedSeed,
          )}
          rotatingTarget={rotatingTarget}
          speedupEnabled={speedupEnabled}
          speedupSparkleKey={speedupSparkleKey}
          nowMs={nowMs}
          reducedMotion={reducedMotion}
          previewRoadCell={previewRoadCell}
          placingRoadRot={placingRoadRot}
          roadRotateTick={roadRotateTick}
          onHoverCell={handleDiamondMouseHover}
          onFocusCell={setHoveredCellStable}
          onTileTap={onTileTap}
          onExpandTap={onExpandTap}
          onHarvestTap={handleHarvestTap}
          onSpeedupTap={onSpeedupTap}
        />

        {/* Desktop hover silhouette highlight (opacity transition only, outside StaticWorldLayer) */}
        {hoveredObject && !groundTargetMode && (
          <div
            key={`hover_${hoveredObject.key}`}
            aria-hidden="true"
            data-rt-hover-outline="true"
            data-rt-hover-key={hoveredObject.key}
            className="rt-object-hover pointer-events-none absolute select-none"
            style={{
              left: hoveredObject.left,
              top: hoveredObject.top,
              width: hoveredObject.width,
              height: hoveredObject.height,
              zIndex: hoveredObject.zIndex + 1,
            }}
          >
            {hoveredObject.src ? (
              <img
                src={hoveredObject.src}
                alt=""
                width={hoveredObject.width}
                height={hoveredObject.height}
                decoding="async"
                draggable={false}
                className="pointer-events-none block select-none"
                style={{
                  transform: hoveredObject.flipX ? 'scaleX(-1)' : undefined,
                  clipPath: hoveredObject.clipPath,
                }}
              />
            ) : (
              <div
                className="pointer-events-none h-full w-full border-2 border-[#C6FF3D]"
                style={{
                  transform: hoveredObject.flipX ? 'scaleX(-1)' : undefined,
                }}
              />
            )}
          </div>
        )}

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
              data-villager-kind={v.kind}
              ref={(el) => registerDom(v.id, 'wrap', el)}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 will-change-transform"
              style={{
                transform: `translate3d(${initX}px, ${initY}px, 0)`,
                zIndex: objectZ(v.initialX + v.initialY, Z_LAYER.villager),
                transition: reducedMotion ? 'opacity 180ms linear' : undefined,
              }}
            >
              {v.isArrivalVisitor ? (
                <div className="rt-pixel-bubble rt-pixel-bubble--tail absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 text-[14px] font-black">
                  +1!
                </div>
              ) : (
                <img
                  ref={(el) => registerDom(v.id, 'bubble', el)}
                  data-villager-bubble={v.id}
                  src={BUBBLE_SPRITES.smile.src}
                  alt=""
                  aria-hidden="true"
                  width={48}
                  height={48}
                  decoding="async"
                  draggable={false}
                  className="pointer-events-none absolute bottom-full left-1/2 mb-1 block select-none will-change-transform"
                  style={{
                    imageRendering: 'pixelated',
                    opacity: 0,
                    transform: reducedMotion
                      ? 'translate3d(-50%, 0, 0)'
                      : 'translate3d(-50%, 0, 0) scale(0.6)',
                  }}
                />
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

        {/* One-time family event floating hearts over starter house roof */}
        {familyHeartsHouse &&
          (() => {
            const origin = isoToScreen(familyHeartsHouse.x, familyHeartsHouse.y);
            const roofCenterX = origin.x + TILE_W / 2 - bounds.minX;
            const roofTopY = origin.y - 78 - bounds.minY;
            const heartOffsets = [
              { dx: -24, dy: 4, delay: 0 },
              { dx: -6, dy: -8, delay: 150 },
              { dx: 14, dy: 0, delay: 300 },
              { dx: 4, dy: -16, delay: 450 },
            ];
            return (
              <div
                aria-hidden="true"
                data-testid="family-hearts-overlay"
                className="pointer-events-none absolute"
                style={{
                  left: roofCenterX - 32,
                  top: roofTopY - 24,
                  width: 84,
                  height: 64,
                  zIndex: Z_UI + 5,
                }}
              >
                {heartOffsets.map((h, i) => (
                  <img
                    key={`fam-heart-${i}`}
                    data-testid="family-heart-float"
                    src={HEART_FLOAT_SPRITE.src}
                    alt=""
                    aria-hidden="true"
                    width={HEART_FLOAT_SPRITE.width * 2}
                    height={HEART_FLOAT_SPRITE.height * 2}
                    decoding="async"
                    draggable={false}
                    className="rt-heart-float pointer-events-none absolute block max-w-none select-none"
                    style={{
                      left: h.dx + 32,
                      top: h.dy + 24,
                      width: HEART_FLOAT_SPRITE.width * 2,
                      height: HEART_FLOAT_SPRITE.height * 2,
                      imageRendering: 'pixelated',
                      animationDelay: `${h.delay}ms`,
                    }}
                  />
                ))}
              </div>
            );
          })()}

        {/* Placement / Move / Plant cursor */}
        {cursorOverlay && (
          <img
            data-rt-cursor-overlay="true"
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
