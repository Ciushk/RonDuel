import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GROUND_TILE_TYPES } from '@ronduel/shared';
import {
  applyRubberBand,
  clampPanPosition,
  computeDisplayZoomRange,
  computeMapBounds,
  DIAMOND_H,
  getBuildingPlacement,
  getCropGrowthInfo,
  getCropPlacement,
  getCursorPlacement,
  isoDiamondBottom,
  isoToScreen,
  MAX_RUBBER_BAND_PX,
  TILE_H,
  TILE_W,
} from './iso';
import {
  CATALOG_SPRITES,
  CROP_BUTTON_SPRITES,
  GROUND_SPRITES,
  resolveCropSprite,
  resolveRoadSprite,
  UI_SPRITES,
  VILLAGER_SPRITES,
  type SpriteSpec,
} from './sprites';

const PUBLIC_RONTOWN_DIR = path.resolve(process.cwd(), 'apps/web/public/rontown');

function readPngSize(filePath: string): { width: number; height: number } {
  const buf = fs.readFileSync(filePath);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('RonTown 128px isometric math, camera bounds & sprite catalog', () => {
  it('computes exact 2:1 isometric tile origin and diamond bottom coordinates at 128px source scale', () => {
    expect(TILE_W).toBe(128);
    expect(DIAMOND_H).toBe(64);
    expect(TILE_H).toBe(76);

    expect(isoToScreen(0, 0)).toEqual({ x: 0, y: 0 });
    expect(isoToScreen(1, 0)).toEqual({ x: 64, y: 32 });
    expect(isoToScreen(0, 1)).toEqual({ x: -64, y: 32 });
    expect(isoToScreen(3, 3)).toEqual({ x: 0, y: 192 });
    expect(isoDiamondBottom(3, 3)).toEqual({ x: 64, y: 256 });
  });

  it('anchors 1x1 and 2x2 buildings bottom-center on the front footprint tile', () => {
    // 1x1 starter_house (125x137) at (3,3) -> diamond bottom (64, 256)
    const p1 = getBuildingPlacement(3, 3, 1, 1, 125, 137);
    expect(p1.sortKey).toBe(6);
    expect(p1.x).toBe(Math.round(64 - 125 / 2));
    expect(p1.y).toBe(256 - 137);

    // 2x2 villa (199x147) at (2,2) -> front tile is (3,3) -> sortKey 6
    const p2 = getBuildingPlacement(2, 2, 2, 2, 199, 147);
    expect(p2.sortKey).toBe(6);
    expect(p2.x).toBe(Math.round(64 - 199 / 2));
    expect(p2.y).toBe(256 - 147);
  });

  it('bottom-aligns tall crops with 128x76 tile bottom and centers 206x128 cursors', () => {
    // Wheat done is 128x88 -> offset y = originY + 76 - 88 = originY - 12
    const origin = isoToScreen(3, 4);
    expect(getCropPlacement(3, 4, 88)).toEqual({ x: origin.x, y: origin.y + TILE_H - 88 });
    expect(getCursorPlacement(3, 4)).toEqual({ x: origin.x - 39, y: origin.y - 32 });
  });

  it('computes padded map bounds and display zoom range keeping max tile width <= 128px', () => {
    const b = computeMapBounds([
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
    ]);
    expect(b.width).toBeGreaterThan(TILE_W * 2);
    expect(b.height).toBeGreaterThan(TILE_H * 2);

    const mobile = computeDisplayZoomRange(390, 660, b.width, b.height);
    expect(mobile.fitScale * TILE_W).toBeGreaterThanOrEqual(64);
    expect(mobile.fitScale * TILE_W).toBeLessThanOrEqual(96);
    expect(mobile.maxZoom * TILE_W).toBeLessThanOrEqual(128);
    expect(mobile.maxZoom).toBeGreaterThan(mobile.minZoom);

    const desktop = computeDisplayZoomRange(1440, 840, b.width, b.height);
    expect(desktop.fitScale * TILE_W).toBeGreaterThanOrEqual(80);
    expect(desktop.maxZoom * TILE_W).toBeLessThanOrEqual(128);
  });

  it('clamps pan to content edges and caps rubber-band overshoot at 24px (0px under reduced motion)', () => {
    // Content larger than viewport
    const clamped = clampPanPosition(150, -900, 390, 600, 800, 900, 1.0);
    expect(clamped).toEqual({ x: 0, y: -300 });

    // Content smaller than viewport -> centered
    const centered = clampPanPosition(500, -500, 1000, 800, 400, 300, 1.0);
    expect(centered).toEqual({ x: 300, y: 250 });

    // Rubber-band caps strictly at MAX_RUBBER_BAND_PX (24px)
    const pulled = applyRubberBand(500, -200, 0, false);
    expect(pulled).toBeGreaterThan(0);
    expect(pulled).toBeLessThanOrEqual(MAX_RUBBER_BAND_PX);

    // Reduced motion performs a hard clamp with zero overshoot
    expect(applyRubberBand(500, -200, 0, true)).toBe(0);
    expect(applyRubberBand(-500, -200, 0, true)).toBe(-200);
  });

  it('splits crop growth into sprout, half, and done stages based on timestamps', () => {
    const start = 1_700_000_000_000;
    const dur = 10_000;
    const ready = start + dur;

    expect(
      getCropGrowthInfo({ plantedAt: start, readyAt: ready, nowMs: start + 1000 }).stage,
    ).toBe('sprout');
    expect(
      getCropGrowthInfo({ plantedAt: start, readyAt: ready, nowMs: start + 5000 }).stage,
    ).toBe('half');
    const done = getCropGrowthInfo({ plantedAt: start, readyAt: ready, nowMs: ready + 100 });
    expect(done.stage).toBe('done');
    expect(done.isReady).toBe(true);
  });

  it('auto-picks road straight, curve, and intersection variants by neighbours', () => {
    const straight = resolveRoadSprite(2, 2, (x, y) => x === 2 && (y === 1 || y === 3));
    expect(straight.src).toContain('basic-block-street.png');
    expect(straight.flipX).toBeUndefined();

    const perp = resolveRoadSprite(2, 2, (x, y) => y === 2 && (x === 1 || x === 3));
    expect(perp.src).toContain('basic-block-street.png');
    expect(perp.flipX).toBe(true);

    const curve = resolveRoadSprite(2, 2, (x, y) => (x === 2 && y === 1) || (x === 3 && y === 2));
    expect(curve.src).toContain('basic-block-street-curve.png');

    const cross = resolveRoadSprite(
      2,
      2,
      (x, y) => (x === 2 && y === 1) || (x === 2 && y === 3) || (x === 3 && y === 2),
    );
    expect(cross.src).toContain('basic-block-intersection.png');
  });

  it('maps every sprite spec (preserving typos wather/cabage/vizit/moving) to an existing 4x PNG matching its declared width/height', () => {
    const specs: SpriteSpec[] = [];

    for (const gt of GROUND_TILE_TYPES) specs.push(GROUND_SPRITES[gt]);
    for (const spec of Object.values(UI_SPRITES)) specs.push(spec);
    for (const spec of Object.values(CATALOG_SPRITES)) {
      if (!spec.isPlaceholder && spec.src) specs.push(spec);
    }
    for (const spec of Object.values(CROP_BUTTON_SPRITES)) specs.push(spec);
    for (const crop of ['wheat', 'cabbage', 'pumpkin', 'oats', 'carrots', 'sunflower']) {
      for (const stage of ['sprout', 'half', 'done'] as const) {
        specs.push(resolveCropSprite(crop, stage));
      }
    }
    for (const set of Object.values(VILLAGER_SPRITES)) {
      specs.push(set.idle);
      if (set.walkFrames) specs.push(...set.walkFrames);
    }

    const seen = new Set<string>();
    for (const spec of specs) {
      expect(spec.src.startsWith('/rontown/')).toBe(true);
      const filename = spec.src.slice('/rontown/'.length);
      const diskPath = path.join(PUBLIC_RONTOWN_DIR, filename);
      expect(fs.existsSync(diskPath), `Missing sprite on disk: ${filename}`).toBe(true);
      const actual = readPngSize(diskPath);
      expect(actual, `Dimension mismatch for ${filename}`).toEqual({
        width: spec.width,
        height: spec.height,
      });
      seen.add(filename);
    }
    expect(seen.size).toBeGreaterThan(50);
  });
});
