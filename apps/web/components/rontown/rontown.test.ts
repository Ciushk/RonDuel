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
  floorZ,
  getBuildingPlacement,
  getCropGrowthInfo,
  getCropPlacement,
  getCursorPlacement,
  getVillagerFeetPoint,
  isoDiamondBottom,
  isoToScreen,
  MAX_RUBBER_BAND_PX,
  objectZ,
  TILE_H,
  TILE_W,
  Z_LAYER,
  Z_UI,
} from './iso';
import {
  CATALOG_SPRITES,
  CROP_BUTTON_SPRITES,
  GROUND_SPRITES,
  resolveCropSprite,
  resolveRoadSprite,
  spriteUrl,
  UI_SPRITES,
  uiSpriteUrl,
  VILLAGER_SPRITES,
  type SpriteSpec,
} from './sprites';
import { getRonCoinSources } from './RonCoinIcon';

const PUBLIC_RONTOWN_DIR = path.resolve(process.cwd(), 'apps/web/public/rontown');
const PUBLIC_RONTOWN_UI_DIR = path.resolve(process.cwd(), 'apps/web/public/rontown/ui');

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

    expect(getCropGrowthInfo({ plantedAt: start, readyAt: ready, nowMs: start + 1000 }).stage).toBe(
      'sprout',
    );
    expect(getCropGrowthInfo({ plantedAt: start, readyAt: ready, nowMs: start + 5000 }).stage).toBe(
      'half',
    );
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
      const filename = spec.src.slice('/rontown/'.length).split('?')[0]!;
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

  it('appends ?v=BUILD_ID to spriteUrl, uiSpriteUrl, and RonCoinIcon srcset when buildId is set', () => {
    expect(spriteUrl('basic-block.png', '')).toBe('/rontown/basic-block.png');
    expect(spriteUrl('basic-block.png', 'abc1234')).toBe('/rontown/basic-block.png?v=abc1234');
    expect(uiSpriteUrl('icon-orders.png', 'abc1234')).toBe('/rontown/ui/icon-orders.png?v=abc1234');
    expect(getRonCoinSources(24, 'single', 'abc1234')).toEqual({
      src: '/rontown/ui/roncoin-24.png?v=abc1234',
      srcSet: '/rontown/ui/roncoin-24.png?v=abc1234 1x, /rontown/ui/roncoin-48.png?v=abc1234 2x',
      base: 24,
      retina: 48,
    });
  });

  it('maps RonCoinIcon CSS sizes to exact 1x/2x srcset pairs and avoids stack-16', () => {
    const stripQuery = (url: string) => url.split('?')[0]!;
    expect(stripQuery(getRonCoinSources(14, 'single', '').src)).toBe('/rontown/ui/roncoin-16.png');
    expect(getRonCoinSources(14, 'single', '')).toEqual({
      src: '/rontown/ui/roncoin-16.png',
      srcSet: '/rontown/ui/roncoin-16.png 1x, /rontown/ui/roncoin-32.png 2x',
      base: 16,
      retina: 32,
    });
    expect(getRonCoinSources(16).base).toBe(16);
    expect(getRonCoinSources(18).base).toBe(24);
    expect(getRonCoinSources(20, 'single', '')).toEqual({
      src: '/rontown/ui/roncoin-24.png',
      srcSet: '/rontown/ui/roncoin-24.png 1x, /rontown/ui/roncoin-48.png 2x',
      base: 24,
      retina: 48,
    });
    expect(getRonCoinSources(22).base).toBe(24);
    expect(getRonCoinSources(24).base).toBe(24);
    expect(getRonCoinSources(28).base).toBe(32);
    expect(getRonCoinSources(32).base).toBe(32);
    expect(getRonCoinSources(64).base).toBe(64);
    expect(getRonCoinSources(128, 'single', '')).toEqual({
      src: '/rontown/ui/roncoin-128.png',
      srcSet: '/rontown/ui/roncoin-128.png 1x, /rontown/ui/roncoin-256.png 2x',
      base: 128,
      retina: 256,
    });

    // Stack variant enforces minimum 24px base so roncoin-stack-16 is never used
    expect(getRonCoinSources(16, 'stack', '')).toEqual({
      src: '/rontown/ui/roncoin-stack-24.png',
      srcSet: '/rontown/ui/roncoin-stack-24.png 1x, /rontown/ui/roncoin-stack-48.png 2x',
      base: 24,
      retina: 48,
    });
    expect(stripQuery(getRonCoinSources(28, 'stack').src)).toBe('/rontown/ui/roncoin-stack-32.png');
  });

  it('ships all 6 town menu 1x/2x icons and official RonCoin PNG sizes in public/rontown/ui', () => {
    const menuIcons = [
      'icon-orders',
      'icon-inventory',
      'icon-villagers',
      'icon-coins',
      'icon-send-coins',
      'icon-help',
    ];
    for (const name of menuIcons) {
      const f1 = path.join(PUBLIC_RONTOWN_UI_DIR, `${name}.png`);
      const f2 = path.join(PUBLIC_RONTOWN_UI_DIR, `${name}@2x.png`);
      expect(fs.existsSync(f1), `Missing ${name}.png`).toBe(true);
      expect(fs.existsSync(f2), `Missing ${name}@2x.png`).toBe(true);
      expect(readPngSize(f1)).toEqual({ width: 128, height: 128 });
      expect(readPngSize(f2)).toEqual({ width: 256, height: 256 });
    }

    const coinSizes = [16, 24, 32, 48, 64, 128, 256];
    for (const sz of coinSizes) {
      for (const prefix of ['roncoin', 'roncoin-stack']) {
        const f = path.join(PUBLIC_RONTOWN_UI_DIR, `${prefix}-${sz}.png`);
        expect(fs.existsSync(f), `Missing ${prefix}-${sz}.png`).toBe(true);
        expect(readPngSize(f)).toEqual({ width: sz, height: sz });
      }
    }
  });

  it('keeps villager z above every floor slab across a 6x6 grid and all walk directions/progresses', () => {
    // Max floor z across a 6x6 grid (including road/dirt sub=1)
    let maxFloorZ = -Infinity;
    for (let x = 0; x < 6; x++) {
      for (let y = 0; y < 6; y++) {
        maxFloorZ = Math.max(maxFloorZ, floorZ(x, y, 0), floorZ(x, y, 1));
      }
    }

    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];
    const progresses = [0, 0.25, 0.5, 0.75, 1];

    for (let c = 0; c < 6; c++) {
      for (let r = 0; r < 6; r++) {
        // Integer tile comparisons against standing objects
        const vIntZ = objectZ(c + r, Z_LAYER.villager);
        expect(vIntZ).toBeGreaterThan(maxFloorZ);
        expect(vIntZ).toBeGreaterThan(objectZ(c + r, Z_LAYER.building));
        expect(vIntZ).toBeLessThan(objectZ(c + r + 1, Z_LAYER.crop));
        expect(vIntZ).toBeLessThan(Z_UI);

        // Feet anchor sits at diamond center + 4px (+36)
        const origin = isoToScreen(c, r);
        expect(getVillagerFeetPoint(c, r)).toEqual({
          x: origin.x + TILE_W / 2,
          y: origin.y + DIAMOND_H / 2 + 4,
        });

        for (const { dx, dy } of dirs) {
          const nc = c + dx;
          const nr = r + dy;
          if (nc < 0 || nr < 0 || nc >= 6 || nr >= 6) continue;
          for (const p of progresses) {
            const col = c + dx * p;
            const row = r + dy * p;
            const vz = objectZ(col + row, Z_LAYER.villager);
            expect(vz).toBeGreaterThan(maxFloorZ);
          }
        }
      }
    }
  });
});
