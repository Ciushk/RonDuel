import type { GridCoord } from '@ronduel/shared';
import type { CropGrowthStage } from './sprites';

/** Measured from high-res 4x basic-block.png (128x76): 128x64 2:1 diamond + 12px earth strip. */
export const TILE_W = 128;
export const DIAMOND_H = 64;
export const TILE_H = 76;

/** Two-band isometric depth constants: flat floor slabs stay below all standing objects. */
export const Z_FLOOR_BASE = 0; // flat slabs only
export const Z_OBJECT_BASE = 1000; // everything that stands up
export const Z_DEPTH_STEP = 100; // per (x+y) diagonal
export const Z_LAYER = { crop: 20, building: 40, villager: 50, badge: 80 } as const;
export const Z_UI = 50000; // tooltips and floating rewards above everything

export function floorZ(x: number, y: number, sub = 0): number {
  return Z_FLOOR_BASE + (x + y) * 2 + sub;
}

export function objectZ(depth: number, layer: number): number {
  return Z_OBJECT_BASE + Math.round(depth * Z_DEPTH_STEP) + layer;
}

/** Placement cursor sprite dimensions (block-free-spot / button-taken-spot). */
export const CURSOR_W = 206;
export const CURSOR_H = 128;

/**
 * Placeholder configurable visual growth stage split thresholds (fraction of growTimeSeconds).
 * Server catalog `growTimeSeconds` drives total growth duration.
 */
export const CROP_STAGE_THRESHOLDS = {
  half: 0.45,
  done: 1,
} as const;

/** Top-left source-pixel coordinates for an isometric ground slab at (col, row). */
export function isoToScreen(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (DIAMOND_H / 2),
  };
}

/** Diamond bottom point (tileX + 64, tileY + 64) for cell (col, row). */
export function isoDiamondBottom(col: number, row: number): { x: number; y: number } {
  const origin = isoToScreen(col, row);
  return {
    x: origin.x + TILE_W / 2,
    y: origin.y + DIAMOND_H,
  };
}

/**
 * Anchors a building or decor sprite bottom-center on the front footprint tile's
 * diamond bottom point (cell with largest col + row).
 */
export function getBuildingPlacement(
  col: number,
  row: number,
  footprintW: number,
  footprintH: number,
  spriteW: number,
  spriteH: number,
): { x: number; y: number; sortKey: number } {
  const frontCol = col + Math.max(1, footprintW) - 1;
  const frontRow = row + Math.max(1, footprintH) - 1;
  const anchor = isoDiamondBottom(frontCol, frontRow);

  // For asymmetric 2x1 footprints, center horizontally between the two front-edge cells
  const asymOffsetX = footprintW !== footprintH ? ((footprintH - footprintW) * TILE_W) / 4 : 0;

  return {
    x: Math.round(anchor.x + asymOffsetX - spriteW / 2),
    y: Math.round(anchor.y - spriteH),
    sortKey: frontCol + frontRow,
  };
}

/**
 * Bottom-aligns a crop sprite (which may be taller than 76px) with the 128x76 tile bottom,
 * applying an optional vertical offset (positive = down) so crop slabs sit flush with neighbors.
 */
export function getCropPlacement(
  col: number,
  row: number,
  spriteH: number,
  groundOffsetY = 0,
): { x: number; y: number } {
  const origin = isoToScreen(col, row);
  return {
    x: origin.x,
    y: origin.y + TILE_H - spriteH + groundOffsetY,
  };
}

/** Clip a bottom-aligned crop sprite to the tile top face (diamond V at tile y=32 / y=64), removing its own walls. */
export function getCropFaceClipPath(spriteH: number, groundOffsetY = 0): string {
  const top = TILE_H - spriteH + groundOffsetY; // sprite top in tile coords (same as getCropPlacement)
  const side = DIAMOND_H / 2 - top; // left/right vertex row inside the sprite
  const bottom = DIAMOND_H - top; // bottom vertex row inside the sprite
  return `polygon(0 0, 100% 0, 100% ${side}px, 50% ${bottom}px, 0 ${side}px)`;
}

/**
 * Centers the 206x128 placement cursor (block-free-spot / button-taken-spot)
 * inner diamond on the target tile's 128x64 diamond.
 */
export function getCursorPlacement(col: number, row: number): { x: number; y: number } {
  const origin = isoToScreen(col, row);
  return {
    x: origin.x - Math.round((CURSOR_W - TILE_W) / 2),
    y: origin.y - Math.round((CURSOR_H - DIAMOND_H) / 2),
  };
}

/**
 * Feet anchor point for a villager standing at fractional or integer iso coordinates (col, row).
 * Placed at the diamond center plus a small 4px grounding bias so anchor and depth match.
 */
export function getVillagerFeetPoint(col: number, row: number): { x: number; y: number } {
  const origin = isoToScreen(col, row);
  return {
    x: origin.x + TILE_W / 2,
    y: origin.y + DIAMOND_H / 2 + 4,
  };
}

/**
 * Computes source-pixel bounds for all visible cells (owned land + expand ring),
 * with ~1 tile of padding around the edges plus room for tall buildings and harvest badges.
 */
export function computeMapBounds(coords: GridCoord[]): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  if (coords.length === 0) {
    return { minX: -256, minY: -192, width: 768, height: 576 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const c of coords) {
    const p = isoToScreen(c.x, c.y);
    if (p.x < minX) minX = p.x;
    if (p.x + TILE_W > maxX) maxX = p.x + TILE_W;
    if (p.y < minY) minY = p.y;
    if (p.y + TILE_H > maxY) maxY = p.y + TILE_H;
  }

  // ~1 tile of horizontal/bottom padding and extra headroom for tall 2x2 buildings & badges
  const padX = TILE_W;
  const padTop = TILE_W + 48;
  const padBottom = TILE_H;

  return {
    minX: minX - padX,
    minY: minY - padTop,
    width: maxX - minX + padX * 2,
    height: maxY - minY + padTop + padBottom,
  };
}

/**
 * Computes the fit-to-view display scale and zoom bounds for a given viewport and content size.
 * - Mobile (< 1024px): fit tile width targets 64..92px (scale 0.5..0.71875).
 * - Desktop (>= 1024px): fit tile width targets 80..112px (scale 0.625..0.875).
 * - Max zoom: up to 2x the fit level, capped at 1.0 (<= 128px native tile width so sprites stay sharp).
 */
export function computeDisplayZoomRange(
  viewportW: number,
  viewportH: number,
  contentW: number,
  contentH: number,
): { fitScale: number; minZoom: number; maxZoom: number } {
  const safeVW = Math.max(320, viewportW);
  const safeVH = Math.max(320, viewportH);
  const safeCW = Math.max(TILE_W * 2, contentW);
  const safeCH = Math.max(TILE_H * 2, contentH);

  const isDesktop = safeVW >= 1024;
  const rawFit = Math.min((safeVW - 16) / safeCW, (safeVH - 16) / safeCH);

  const minFit = isDesktop ? 80 / TILE_W : 64 / TILE_W;
  const maxFit = isDesktop ? 112 / TILE_W : 92 / TILE_W;
  const fitScale = Math.max(minFit, Math.min(maxFit, rawFit));
  const maxZoom = Math.min(fitScale * 2, 1.0);

  return {
    fitScale,
    minZoom: fitScale,
    maxZoom: Math.max(fitScale, maxZoom),
  };
}

export const MAX_RUBBER_BAND_PX = 24;

/**
 * Computes valid [min, max] pan range along one axis so content edges stay within the viewport.
 * When scaled content is smaller than the viewport, centers it (min === max).
 */
export function getPanAxisLimits(
  viewportSize: number,
  contentSize: number,
  zoom: number,
): { min: number; max: number } {
  const scaled = contentSize * zoom;
  if (scaled <= viewportSize) {
    const centered = (viewportSize - scaled) / 2;
    return { min: centered, max: centered };
  }
  return { min: viewportSize - scaled, max: 0 };
}

/** Hard-clamps a (panX, panY) camera offset to the content bounds at the given zoom. */
export function clampPanPosition(
  panX: number,
  panY: number,
  viewportW: number,
  viewportH: number,
  contentW: number,
  contentH: number,
  zoom: number,
): { x: number; y: number } {
  const limX = getPanAxisLimits(viewportW, contentW, zoom);
  const limY = getPanAxisLimits(viewportH, contentH, zoom);
  return {
    x: Math.max(limX.min, Math.min(limX.max, panX)),
    y: Math.max(limY.min, Math.min(limY.max, panY)),
  };
}

/**
 * Applies soft asymptotic rubber-band resistance (max 24px overshoot) past [min, max].
 * Under reduced motion, returns a hard clamp with zero overshoot.
 */
export function applyRubberBand(
  value: number,
  min: number,
  max: number,
  reducedMotion: boolean,
): number {
  if (value >= min && value <= max) return value;
  if (reducedMotion) return Math.max(min, Math.min(max, value));
  if (value < min) {
    const over = min - value;
    return min - MAX_RUBBER_BAND_PX * Math.tanh(over / (MAX_RUBBER_BAND_PX * 3));
  }
  const over = value - max;
  return max + MAX_RUBBER_BAND_PX * Math.tanh(over / (MAX_RUBBER_BAND_PX * 3));
}

/**
 * Parses a Firestore Timestamp, ISO string, or epoch number (ms or s) into epoch milliseconds.
 */
export function parseTimestampMs(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    // Heuristic: < 1e11 means seconds (e.g. legacy `readyAt: 1` from visit snapshot)
    return value < 1e11 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'object') {
    const obj = value as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof obj.toMillis === 'function') return obj.toMillis();
    if (typeof obj.seconds === 'number') return obj.seconds * 1000;
    if (typeof obj._seconds === 'number') return obj._seconds * 1000;
  }
  return null;
}

/**
 * Computes visual growth stage (sprout / half / done) and remaining seconds for a planted crop.
 */
export function getCropGrowthInfo(params: {
  plantedAt?: unknown;
  readyAt?: unknown;
  growTimeSeconds?: number;
  nowMs?: number;
}): {
  stage: CropGrowthStage;
  progress: number;
  remainingSeconds: number;
  isReady: boolean;
} {
  const nowMs = params.nowMs ?? Date.now();
  const readyMs = parseTimestampMs(params.readyAt);
  const plantedMs = parseTimestampMs(params.plantedAt);
  const totalMs = Math.max(1000, (params.growTimeSeconds ?? 14400) * 1000);

  if (readyMs === null) {
    // Fallback when no readyAt timestamp is present
    return {
      stage: 'sprout',
      progress: 0,
      remainingSeconds: Math.ceil(totalMs / 1000),
      isReady: false,
    };
  }

  if (nowMs >= readyMs) {
    return { stage: 'done', progress: 1, remainingSeconds: 0, isReady: true };
  }

  const startMs = plantedMs ?? readyMs - totalMs;
  const durationMs = Math.max(1000, readyMs - startMs);
  const progress = Math.max(0, Math.min(1, (nowMs - startMs) / durationMs));
  const remainingSeconds = Math.max(1, Math.ceil((readyMs - nowMs) / 1000));

  const stage: CropGrowthStage =
    progress >= CROP_STAGE_THRESHOLDS.done
      ? 'done'
      : progress >= CROP_STAGE_THRESHOLDS.half
        ? 'half'
        : 'sprout';

  return { stage, progress, remainingSeconds, isReady: false };
}

export function formatDurationShort(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m';
  const totalMinutes = Math.ceil(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
