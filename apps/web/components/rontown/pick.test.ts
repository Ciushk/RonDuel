import { describe, expect, it } from 'vitest';
import {
  DIAMOND_H,
  floorZ,
  getBuildingPlacement,
  isoToScreen,
  objectZ,
  TILE_W,
  Z_LAYER,
} from './iso';
import {
  ALPHA_THRESHOLD,
  pickFromCandidates,
  sampleAlpha,
  type AlphaMask,
  type DiamondPickCandidate,
  type PickCandidate,
} from './pick';

function makeMask(
  width: number,
  height: number,
  fill: (x: number, y: number) => number,
): AlphaMask {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      data[idx + 3] = fill(x, y);
    }
  }
  return { width, height, data };
}

function makeDiamond(
  kind: 'ground' | 'expand',
  x: number,
  y: number,
): Extract<PickCandidate, { kind: 'ground' | 'expand' }> {
  const origin = isoToScreen(x, y);
  return {
    kind,
    key: `${x}_${y}`,
    x,
    y,
    left: origin.x,
    top: origin.y,
    width: TILE_W,
    height: DIAMOND_H,
    z: floorZ(x, y),
  };
}

describe('RonTown sprite-aware alpha hit-testing (pick.ts)', () => {
  // Starter house (125x137) at (3,3): placement x=2, y=119, bottom=256.
  // Overlaps rear ground (3,2) [x=64..192, y=160..224] and rear expand (2,2) [x=0..128, y=128..192].
  const housePos = getBuildingPlacement(3, 3, 1, 1, 125, 137);
  // Roof triangle in the top half, solid walls in the lower half, transparent top-left/top-right corners
  const houseMask = makeMask(125, 137, (x, y) => {
    if (y >= 60) return 255;
    // Triangular gable roof: apex at x=62, y=10; widens to full width by y=60
    const halfSpan = ((y - 10) / 50) * 55;
    if (y >= 10 && Math.abs(x - 62) <= halfSpan) return 255;
    return 0;
  });

  const houseCandidate: Extract<PickCandidate, { kind: 'sprite' }> = {
    kind: 'sprite',
    key: '3_3',
    originX: 3,
    originY: 3,
    left: housePos.x,
    top: housePos.y,
    width: 125,
    height: 137,
    z: objectZ(housePos.sortKey, Z_LAYER.building),
    src: '/rontown/building-house-basic.png',
    mask: houseMask,
  };

  it('1. hits house origin (3,3) on opaque roof overlapping rear (2,2) / (3,2) diamonds', () => {
    const candidates: PickCandidate[] = [
      makeDiamond('expand', 2, 2),
      makeDiamond('ground', 3, 2),
      makeDiamond('ground', 3, 3),
      houseCandidate,
    ];

    // Point (64, 150) is inside the expand diamond (2,2) [top=(64,128), bottom=(64,192)]
    // AND lands on the opaque roof of house (3,3) (local x=62, y=31).
    const hit = pickFromCandidates(64, 150, candidates);
    expect(hit).not.toBeNull();
    expect(hit?.kind).toBe('sprite');
    if (hit?.kind === 'sprite') {
      expect(hit.originX).toBe(3);
      expect(hit.originY).toBe(3);
      expect(hit.key).toBe('3_3');
    }
  });

  it('2. falls through transparent roof corner to rear expand or ground diamond', () => {
    const candidates: PickCandidate[] = [
      makeDiamond('expand', 2, 2),
      makeDiamond('ground', 3, 2),
      makeDiamond('ground', 3, 3),
      houseCandidate,
    ];

    // Point (98, 155): inside house bbox (local x=96, y=36 -> |96-62|=34 > roof halfSpan=28.6 -> alpha=0)
    // AND inside rear expand diamond (2,2) [center=(64,160): |98-64|/64 + |155-160|/32 = 0.531+0.156 <= 1]
    const hitExpand = pickFromCandidates(98, 155, candidates);
    expect(hitExpand?.kind).toBe('expand');
    if (hitExpand?.kind === 'expand') {
      expect(hitExpand.x).toBe(2);
      expect(hitExpand.y).toBe(2);
    }

    // Point (120, 175): inside house bbox (local x=118, y=56 -> |118-62|=56 > halfSpan=50.6 -> alpha=0)
    // AND inside rear ground diamond (3,2) [origin=(64,160), center=(128,192): |120-128|/64 + |175-192|/32 = 0.125+0.531 <= 1]
    const hitGround = pickFromCandidates(120, 175, candidates);
    expect(hitGround?.kind).toBe('ground');
    if (hitGround?.kind === 'ground') {
      expect(hitGround.x).toBe(3);
      expect(hitGround.y).toBe(2);
    }
  });

  it('3. prefers front overlapping sprite when opaque, and falls through to rear sprite when front is transparent', () => {
    const rearMask = makeMask(100, 100, () => 255);
    const frontMask = makeMask(100, 100, (x) => (x >= 50 ? 255 : 0));

    const rearSprite: Extract<PickCandidate, { kind: 'sprite' }> = {
      kind: 'sprite',
      key: '2_2',
      originX: 2,
      originY: 2,
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      z: objectZ(4, Z_LAYER.building),
      mask: rearMask,
    };
    const frontSprite: Extract<PickCandidate, { kind: 'sprite' }> = {
      kind: 'sprite',
      key: '3_3',
      originX: 3,
      originY: 3,
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      z: objectZ(6, Z_LAYER.building),
      mask: frontMask,
    };

    // Pass rear before front in input array to verify front-to-back z sorting
    const candidates: PickCandidate[] = [rearSprite, frontSprite];

    // Right half (x=70): both opaque -> front wins
    const hitFront = pickFromCandidates(70, 50, candidates);
    expect(hitFront?.key).toBe('3_3');

    // Left half (x=20): front is transparent -> rear wins
    const hitRear = pickFromCandidates(20, 50, candidates);
    expect(hitRear?.key).toBe('2_2');
  });

  it('4. mirrors horizontal sampling when flipX is true', () => {
    // Only the right side (x >= 80) of a 100x50 mask is opaque
    const asymmetricMask = makeMask(100, 50, (x) => (x >= 80 ? 255 : 0));

    expect(sampleAlpha(asymmetricMask, 10, 25, false)).toBe(false);
    expect(sampleAlpha(asymmetricMask, 90, 25, false)).toBe(true);

    // With flipX: true, left side of rect (px=10) reads source x=89 -> opaque!
    expect(sampleAlpha(asymmetricMask, 10, 25, true)).toBe(true);
    // Right side of rect (px=90) reads source x=9 -> transparent!
    expect(sampleAlpha(asymmetricMask, 90, 25, true)).toBe(false);

    const flippedSprite: Extract<PickCandidate, { kind: 'sprite' }> = {
      kind: 'sprite',
      key: '4_2',
      originX: 4,
      originY: 2,
      left: 100,
      top: 100,
      width: 100,
      height: 50,
      z: objectZ(6, Z_LAYER.building),
      flipX: true,
      mask: asymmetricMask,
    };

    expect(pickFromCandidates(110, 125, [flippedSprite])?.key).toBe('4_2');
    expect(pickFromCandidates(190, 125, [flippedSprite])).toBeNull();
  });

  it('5. returns the origin cell (not the front cell) for a 2x2 footprint sprite', () => {
    // 2x2 apartment at origin (2,2) is anchored on front cell (3,3)
    const aptPos = getBuildingPlacement(2, 2, 2, 2, 192, 192);
    const aptMask = makeMask(192, 192, () => 255);
    const aptCandidate: Extract<PickCandidate, { kind: 'sprite' }> = {
      kind: 'sprite',
      key: '2_2',
      originX: 2,
      originY: 2,
      left: aptPos.x,
      top: aptPos.y,
      width: 192,
      height: 192,
      z: objectZ(aptPos.sortKey, Z_LAYER.building),
      mask: aptMask,
    };

    const frontGround = makeDiamond('ground', 3, 3);
    // Click near the front cell (3,3) diamond center (64, 224) — covered by the 2x2 apartment
    const hit = pickFromCandidates(64, 224, [frontGround, aptCandidate]);
    expect(hit?.kind).toBe('sprite');
    if (hit?.kind === 'sprite') {
      expect(hit.originX).toBe(2);
      expect(hit.originY).toBe(2);
      expect(hit.key).toBe('2_2');
    }
  });

  it('6. ignores sprites in ground-target / placement mode and returns the ground cell under an opaque roof', () => {
    const candidates: PickCandidate[] = [
      makeDiamond('expand', 2, 2),
      makeDiamond('ground', 3, 2),
      makeDiamond('ground', 3, 3),
      houseCandidate,
    ];

    // Same opaque roof point (64, 150) over (2,2), but with groundOnly: true
    const hit = pickFromCandidates(64, 150, candidates, undefined, { groundOnly: true });
    expect(hit?.kind).toBe('expand');
    if (hit?.kind === 'expand') {
      expect(hit.x).toBe(2);
      expect(hit.y).toBe(2);
    }
  });

  it('7. touch tolerance hits a sprite 6px from an opaque pixel but misses 20px away', () => {
    // Narrow opaque pillar centered at x=50..59, y=20..80 inside a 100x100 sprite at (0, 0)
    const pillarMask = makeMask(100, 100, (x, y) =>
      x >= 50 && x < 60 && y >= 20 && y < 80 ? 255 : 0,
    );
    const pillar: Extract<PickCandidate, { kind: 'sprite' }> = {
      kind: 'sprite',
      key: '3_3',
      originX: 3,
      originY: 3,
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      z: objectZ(6, Z_LAYER.building),
      mask: pillarMask,
    };
    const ground: DiamondPickCandidate = {
      kind: 'ground',
      key: '3_2',
      x: 3,
      y: 2,
      left: 0,
      top: 0,
      width: 128,
      height: 100,
      z: floorZ(3, 2),
    };

    // Mouse (tolerance 0): 6px left of pillar (x=44, y=50) misses pillar -> hits ground
    expect(pickFromCandidates(44, 50, [ground, pillar], undefined, { tolerance: 0 })?.kind).toBe(
      'ground',
    );

    // Touch (tolerance 10): 6px left of pillar (x=44, y=50) hits pillar!
    const nearTouch = pickFromCandidates(44, 50, [ground, pillar], undefined, { tolerance: 10 });
    expect(nearTouch?.kind).toBe('sprite');
    expect(nearTouch?.key).toBe('3_3');

    // Touch (tolerance 10): 20px left of pillar (x=30, y=50) misses pillar -> falls through to ground
    const farTouch = pickFromCandidates(30, 50, [ground, pillar], undefined, { tolerance: 10 });
    expect(farTouch?.kind).toBe('ground');
    expect(farTouch?.key).toBe('3_2');
  });

  it('8. enforces strict alpha > 32 threshold (32 is a miss, 33 is a hit)', () => {
    expect(ALPHA_THRESHOLD).toBe(32);
    const mask = makeMask(4, 1, (x) => {
      if (x === 0) return 0;
      if (x === 1) return 32;
      if (x === 2) return 33;
      return 255;
    });

    expect(sampleAlpha(mask, 0, 0)).toBe(false);
    expect(sampleAlpha(mask, 1, 0)).toBe(false);
    expect(sampleAlpha(mask, 2, 0)).toBe(true);
    expect(sampleAlpha(mask, 3, 0)).toBe(true);
  });

  it('treats placeholders as opaque boxes and ignores them in groundOnly mode', () => {
    const placeholder: Extract<PickCandidate, { kind: 'placeholder' }> = {
      kind: 'placeholder',
      key: '3_3',
      originX: 3,
      originY: 3,
      left: 16,
      top: 160,
      width: 96,
      height: 96,
      z: objectZ(6, Z_LAYER.building),
    };
    const ground = makeDiamond('ground', 3, 3);

    expect(pickFromCandidates(64, 200, [ground, placeholder])?.kind).toBe('placeholder');
    expect(
      pickFromCandidates(64, 200, [ground, placeholder], undefined, { groundOnly: true })?.kind,
    ).toBe('ground');
  });
});
