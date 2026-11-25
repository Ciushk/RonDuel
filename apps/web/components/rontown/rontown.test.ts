import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GROUND_TILE_TYPES } from '@ronduel/shared';
import {
  computeMapBounds,
  getBuildingPlacement,
  getCropGrowthInfo,
  getCropPlacement,
  getCursorPlacement,
  isoDiamondBottom,
  isoToScreen,
  TILE_H,
} from './iso';
import {
  CATALOG_SPRITES,
  CROP_BUTTON_SPRITES,
  GROUND_SPRITES,
  resolveCropSprite,
  resolveRoadSprite,
  UI_SPRITES,
  VILLAGER_SPRITES,
} from './sprites';

const PUBLIC_RONTOWN_DIR = path.resolve(process.cwd(), 'apps/web/public/rontown');

describe('RonTown isometric math & sprite catalog', () => {
  it('computes exact 2:1 isometric tile origin and diamond bottom coordinates', () => {
    expect(isoToScreen(0, 0)).toEqual({ x: 0, y: 0 });
    expect(isoToScreen(1, 0)).toEqual({ x: 16, y: 8 });
    expect(isoToScreen(0, 1)).toEqual({ x: -16, y: 8 });
    expect(isoToScreen(3, 3)).toEqual({ x: 0, y: 48 });
    expect(isoDiamondBottom(3, 3)).toEqual({ x: 16, y: 64 });
  });

  it('anchors 1x1 and 2x2 buildings bottom-center on the front footprint tile', () => {
    // 1x1 starter_house (31x34) at (3,3) -> diamond bottom (16, 64)
    const p1 = getBuildingPlacement(3, 3, 1, 1, 31, 34);
    expect(p1.sortKey).toBe(6);
    expect(p1.x).toBe(Math.round(16 - 31 / 2));
    expect(p1.y).toBe(64 - 34);

    // 2x2 villa (50x37) at (2,2) -> front tile is (3,3) -> sortKey 6
    const p2 = getBuildingPlacement(2, 2, 2, 2, 50, 37);
    expect(p2.sortKey).toBe(6);
    expect(p2.x).toBe(Math.round(16 - 50 / 2));
    expect(p2.y).toBe(64 - 37);
  });

  it('bottom-aligns tall crops with tile bottom and centers 52x32 cursors', () => {
    // Wheat done is 32x22 -> offset y = originY + 19 - 22 = originY - 3
    const origin = isoToScreen(3, 4);
    expect(getCropPlacement(3, 4, 22)).toEqual({ x: origin.x, y: origin.y + TILE_H - 22 });
    expect(getCursorPlacement(3, 4)).toEqual({ x: origin.x - 10, y: origin.y - 6 });
  });

  it('computes positive padded map bounds for any set of coordinates', () => {
    const b = computeMapBounds([
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
    ]);
    expect(b.width).toBeGreaterThan(64);
    expect(b.height).toBeGreaterThan(64);
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

  it('maps every sprite URL (preserving typos wather/cabage/vizit/moving) to an existing PNG in public/rontown', () => {
    const referencedUrls = new Set<string>();

    for (const gt of GROUND_TILE_TYPES) {
      referencedUrls.add(GROUND_SPRITES[gt].src);
    }
    for (const spec of Object.values(UI_SPRITES)) {
      referencedUrls.add(spec.src);
    }
    for (const spec of Object.values(CATALOG_SPRITES)) {
      if (!spec.isPlaceholder && spec.src) referencedUrls.add(spec.src);
    }
    for (const spec of Object.values(CROP_BUTTON_SPRITES)) {
      referencedUrls.add(spec.src);
    }
    for (const crop of ['wheat', 'cabbage', 'pumpkin', 'oats', 'carrots', 'sunflower']) {
      for (const stage of ['sprout', 'half', 'done'] as const) {
        referencedUrls.add(resolveCropSprite(crop, stage).src);
      }
    }
    for (const set of Object.values(VILLAGER_SPRITES)) {
      referencedUrls.add(set.idle.src);
      if (set.walkFrames) {
        for (const frame of set.walkFrames) referencedUrls.add(frame.src);
      }
    }

    expect(referencedUrls.size).toBeGreaterThan(50);
    for (const url of referencedUrls) {
      expect(url.startsWith('/rontown/')).toBe(true);
      const filename = url.slice('/rontown/'.length);
      const diskPath = path.join(PUBLIC_RONTOWN_DIR, filename);
      expect(fs.existsSync(diskPath), `Missing sprite on disk: ${filename}`).toBe(true);
    }
  });
});
