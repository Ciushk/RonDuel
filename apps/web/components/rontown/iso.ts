import type { GridCoord } from '@ronduel/shared';
import type { CropGrowthStage } from './sprites';

/** Measured from basic-block.png (32x19): 32x16 2:1 diamond + 3px earth strip. */
export const TILE_W = 32;
export const DIAMOND_H = 16;
export const TILE_H = 19;

/**
 * Placeholder configurable visual growth stage split thresholds (fraction of growTimeSeconds).
 * Server catalog `growTimeSeconds` drives total growth duration.
 */
export const CROP_STAGE_THRESHOLDS = {
  half: 0.45,
  done: 1,
} as const;

/** Top-left logical pixel coordinates for an isometric ground slab at (col, row). */
export function isoToScreen(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (DIAMOND_H / 2),
  };
}

/** Diamond bottom point (tileX + 16, tileY + 16) for cell (col, row). */
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
 * Bottom-aligns a crop sprite (which may be taller than 19px) with the 32x19 tile bottom.
 */
export function getCropPlacement(
  col: number,
  row: number,
  spriteH: number,
): { x: number; y: number } {
  const origin = isoToScreen(col, row);
  return {
    x: origin.x,
    y: origin.y + TILE_H - spriteH,
  };
}

/**
 * Centers the 52x32 placement cursor (block-free-spot / button-taken-spot)
 * inner diamond on the target tile's 32x16 diamond.
 */
export function getCursorPlacement(col: number, row: number): { x: number; y: number } {
  const origin = isoToScreen(col, row);
  return {
    x: origin.x - 10,
    y: origin.y - 6,
  };
}

/**
 * Feet anchor point for a villager standing at fractional or integer iso coordinates (col, row).
 */
export function getVillagerFeetPoint(col: number, row: number): { x: number; y: number } {
  const origin = isoToScreen(col, row);
  return {
    x: origin.x + TILE_W / 2,
    y: origin.y + DIAMOND_H - 2,
  };
}

/**
 * Computes tight logical pixel bounds for all visible cells (owned land + expand ring),
 * with generous top padding for tall buildings and harvest badges.
 */
export function computeMapBounds(coords: GridCoord[]): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  if (coords.length === 0) {
    return { minX: -64, minY: -48, width: 192, height: 144 };
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

  // Pad around edges for 2x2 buildings, corner-bracket cursors (52x32), and harvest badges
  const padX = 24;
  const padTop = 44;
  const padBottom = 18;

  return {
    minX: minX - padX,
    minY: minY - padTop,
    width: maxX - minX + padX * 2,
    height: maxY - minY + padTop + padBottom,
  };
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
    return { stage: 'sprout', progress: 0, remainingSeconds: Math.ceil(totalMs / 1000), isReady: false };
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
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.ceil((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 && minutes < 60 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${Math.max(1, minutes)}m`;
}
