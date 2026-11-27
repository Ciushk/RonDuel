import type { GroundTileType } from '@ronduel/shared';

export interface SpriteSpec {
  src: string;
  width: number;
  height: number;
  /** Optional horizontal mirror for opposite iso diagonal. */
  flipX?: boolean;
  /** Optional vertical alignment tweak in source px (positive = down) so crop slabs sit flush. */
  groundOffsetY?: number;
  /** True when art is missing and UI should render a placeholder silhouette. */
  isPlaceholder?: boolean;
  note?: string;
}

export const SPRITE_BASE = '/rontown';

const ASSET_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID?.trim() || '';

export function spriteUrl(filename: string, buildId: string = ASSET_BUILD_ID): string {
  const clean = filename.replace(/^\/+/, '');
  const base = `${SPRITE_BASE}/${clean}`;
  return buildId ? `${base}?v=${encodeURIComponent(buildId)}` : base;
}

export function uiSpriteUrl(filename: string, buildId: string = ASSET_BUILD_ID): string {
  return spriteUrl(`ui/${filename.replace(/^\/+/, '')}`, buildId);
}

export const ROAD_VARIANT_KEYS = [
  'basic-block-street-curve-nw',
  'basic-block-street-curve-se',
  'basic-block-street-t-nes',
  'basic-block-street-t-esw',
  'basic-block-street-t-nsw',
  'basic-block-street-t-new',
  'basic-block-street-end-n',
  'basic-block-street-end-e',
  'basic-block-street-end-s',
  'basic-block-street-end-w',
] as const;

export type RoadVariantKey = (typeof ROAD_VARIANT_KEYS)[number];

export const SHORE_ROTATION_KEYS = [
  'basic-block-wather-grass-50-50-r1',
  'basic-block-wather-grass-50-50-r2',
  'basic-block-wather-grass-50-50-r3',
  'basic-block-water-grass-20-80-r1',
  'basic-block-water-grass-20-80-r2',
  'basic-block-water-grass-20-80-r3',
  'basic-block-water-grass-80-20-r1',
  'basic-block-water-grass-80-20-r2',
  'basic-block-water-grass-80-20-r3',
] as const;

export type ShoreRotationKey = (typeof SHORE_ROTATION_KEYS)[number];

export const GROUND_LABEL_KEY: Record<GroundTileType, string> = {
  'basic-block': 'town.land.types.grass',
  'basic-block-flowers': 'town.land.types.flowers',
  'basic-block-flowers-two': 'town.land.types.flowersTwo',
  'basic-block-dirt': 'town.land.types.dirt',
  'basic-block-street': 'town.land.types.street',
  'basic-block-street-curve': 'town.land.types.streetCurve',
  'basic-block-intersection': 'town.land.types.intersection',
  'basic-block-wather': 'town.land.types.water',
  'basic-block-wather-two': 'town.land.types.waterTwo',
  'basic-block-wather-grass-50-50': 'town.land.types.shoreHalf',
  'basic-block-water-grass-20-80': 'town.land.types.shoreCorner',
  'basic-block-water-grass-80-20': 'town.land.types.shoreEdge',
};

export const GROUND_SPRITES: Record<
  GroundTileType | RoadVariantKey | ShoreRotationKey,
  SpriteSpec
> = {
  'basic-block': { src: spriteUrl('basic-block.png'), width: 128, height: 76 },
  'basic-block-flowers': { src: spriteUrl('basic-block-flowers.png'), width: 128, height: 76 },
  'basic-block-flowers-two': {
    src: spriteUrl('basic-block-flowers-two.png'),
    width: 128,
    height: 76,
  },
  'basic-block-dirt': { src: spriteUrl('basic-block-dirt.png'), width: 128, height: 76 },
  'basic-block-street': { src: spriteUrl('basic-block-street.png'), width: 128, height: 76 },
  'basic-block-street-curve': {
    src: spriteUrl('basic-block-street-curve.png'),
    width: 128,
    height: 76,
  },
  'basic-block-street-curve-nw': {
    src: spriteUrl('basic-block-street-curve-nw.png'),
    width: 128,
    height: 76,
  },
  'basic-block-street-curve-se': {
    src: spriteUrl('basic-block-street-curve-se.png'),
    width: 128,
    height: 76,
  },
  'basic-block-street-t-nes': {
    src: spriteUrl('basic-block-street-t-nes.png'),
    width: 128,
    height: 76,
  },
  'basic-block-street-t-esw': {
    src: spriteUrl('basic-block-street-t-esw.png'),
    width: 128,
    height: 76,
  },
  'basic-block-street-t-nsw': {
    src: spriteUrl('basic-block-street-t-nsw.png'),
    width: 128,
    height: 76,
  },
  'basic-block-street-t-new': {
    src: spriteUrl('basic-block-street-t-new.png'),
    width: 128,
    height: 76,
  },
  'basic-block-street-end-n': {
    src: spriteUrl('basic-block-street-end-n.png'),
    width: 128,
    height: 76,
  },
  'basic-block-street-end-e': {
    src: spriteUrl('basic-block-street-end-e.png'),
    width: 128,
    height: 76,
  },
  'basic-block-street-end-s': {
    src: spriteUrl('basic-block-street-end-s.png'),
    width: 128,
    height: 76,
  },
  'basic-block-street-end-w': {
    src: spriteUrl('basic-block-street-end-w.png'),
    width: 128,
    height: 76,
  },
  'basic-block-intersection': {
    src: spriteUrl('basic-block-intersection.png'),
    width: 128,
    height: 76,
  },
  'basic-block-wather': { src: spriteUrl('basic-block-wather.png'), width: 128, height: 76 },
  'basic-block-wather-two': {
    src: spriteUrl('basic-block-wather-two.png'),
    width: 128,
    height: 76,
  },
  'basic-block-wather-grass-50-50': {
    src: spriteUrl('basic-block-wather-grass-50-50.png'),
    width: 128,
    height: 76,
  },
  'basic-block-wather-grass-50-50-r1': {
    src: spriteUrl('basic-block-wather-grass-50-50-r1.png'),
    width: 128,
    height: 76,
  },
  'basic-block-wather-grass-50-50-r2': {
    src: spriteUrl('basic-block-wather-grass-50-50-r2.png'),
    width: 128,
    height: 76,
  },
  'basic-block-wather-grass-50-50-r3': {
    src: spriteUrl('basic-block-wather-grass-50-50-r3.png'),
    width: 128,
    height: 76,
  },
  'basic-block-water-grass-20-80': {
    src: spriteUrl('basic-block-water-grass-20-80.png'),
    width: 128,
    height: 76,
  },
  'basic-block-water-grass-20-80-r1': {
    src: spriteUrl('basic-block-water-grass-20-80-r1.png'),
    width: 128,
    height: 76,
  },
  'basic-block-water-grass-20-80-r2': {
    src: spriteUrl('basic-block-water-grass-20-80-r2.png'),
    width: 128,
    height: 76,
  },
  'basic-block-water-grass-20-80-r3': {
    src: spriteUrl('basic-block-water-grass-20-80-r3.png'),
    width: 128,
    height: 76,
  },
  'basic-block-water-grass-80-20': {
    src: spriteUrl('basic-block-water-grass-80-20.png'),
    width: 128,
    height: 76,
  },
  'basic-block-water-grass-80-20-r1': {
    src: spriteUrl('basic-block-water-grass-80-20-r1.png'),
    width: 128,
    height: 76,
  },
  'basic-block-water-grass-80-20-r2': {
    src: spriteUrl('basic-block-water-grass-80-20-r2.png'),
    width: 128,
    height: 76,
  },
  'basic-block-water-grass-80-20-r3': {
    src: spriteUrl('basic-block-water-grass-80-20-r3.png'),
    width: 128,
    height: 76,
  },
};

export const UI_SPRITES = {
  expand: { src: spriteUrl('tile_expand.png'), width: 128, height: 76 },
  freeSpot: { src: spriteUrl('block-free-spot.png'), width: 206, height: 128 },
  takenSpot: { src: spriteUrl('button-taken-spot.png'), width: 206, height: 128 },
  build: { src: spriteUrl('build-button.png'), width: 128, height: 128 },
  move: { src: spriteUrl('move-button.png'), width: 128, height: 128 },
  rotate: { src: spriteUrl('rotate-button.png'), width: 128, height: 128 },
  plant: { src: spriteUrl('plant-button.png'), width: 128, height: 128 },
  visit: { src: spriteUrl('button-vizit.png'), width: 128, height: 128 },
  coinsShop: { src: spriteUrl('button-coins.png'), width: 128, height: 128 },
  hideBar: { src: spriteUrl('button-hide-bar.png'), width: 128, height: 128 },
  seedOats: { src: spriteUrl('button-oats.png'), width: 128, height: 128 },
  seedWheat: { src: spriteUrl('button-wheat.png'), width: 128, height: 128 },
  seedCabbage: { src: spriteUrl('button-cabage.png'), width: 128, height: 128 },
  seedCarrots: { src: spriteUrl('button-carrots.png'), width: 128, height: 128 },
  seedSunflower: { src: spriteUrl('button-sunflower.png'), width: 128, height: 128 },
  seedPumpkin: { src: spriteUrl('button-pumpkin.png'), width: 128, height: 128 },
  farmGrowing: { src: spriteUrl('farm-done-icon.png'), width: 56, height: 56 },
  farmReady: { src: spriteUrl('farm-done-icon-gold.png'), width: 56, height: 56 },
} as const;

/**
 * Maps DEFAULT_TOWN_CATALOG spriteKeys to high-res 4x PNG specs (measured from elements-rontown).
 * Catalog footprints are authoritative; mismatches with art dimensions are noted with TODOs.
 */
export const CATALOG_SPRITES: Record<string, SpriteSpec> = {
  starter_house: { src: spriteUrl('building-house-basic.png'), width: 125, height: 137 },
  // TODO(art): building-two-blocks-house.png is ~2x1 (182x143) while catalog cottage is 1x1.
  // Confirm whether cottage footprint should become 2x1 or swap PNG.
  cottage: { src: spriteUrl('building-two-blocks-house.png'), width: 182, height: 143 },
  house: { src: spriteUrl('building-two-level-house.png'), width: 111, height: 140 },
  apartment: { src: spriteUrl('building-apartment.png'), width: 192, height: 192 },
  // TODO(art): building-villa.png is 199px wide (< 256px for 2x2); centered on 2x2.
  villa: { src: spriteUrl('building-villa.png'), width: 199, height: 147 },
  shop: { src: spriteUrl('building-shop.png'), width: 132, height: 130 },
  // TODO(art): building-town-hall.png is 132px wide (< 256px for 2x2); centered on 2x2.
  town_hall: { src: spriteUrl('building-town-hall.png'), width: 132, height: 151 },
  // TODO(art): building-park.png is drawn as 2x2 (197x139) while catalog park is 1x1.
  // Confirm whether park catalog footprint should become 2x2 or swap PNG.
  park: { src: spriteUrl('building-park.png'), width: 197, height: 139 },
  bakery: { src: spriteUrl('building-bakery.png'), width: 129, height: 136 },
  // TODO(art): building-school.png is 174px wide (< 256px for 2x2); centered on 2x2.
  school: { src: spriteUrl('building-school.png'), width: 174, height: 127 },
  police_station: { src: spriteUrl('building-police.png'), width: 150, height: 131 },
  fire_station: { src: spriteUrl('building-fire-station.png'), width: 161, height: 168 },
  // TODO(art): building-hospital.png is 176px wide (< 256px for 2x2); centered on 2x2.
  hospital: { src: spriteUrl('building-hospital.png'), width: 176, height: 129 },
  // TODO(art): No dedicated empty tilled plot PNG; using basic-block-dirt.png as placeholder.
  plot: { src: spriteUrl('basic-block-dirt.png'), width: 128, height: 76 },
  road: { src: spriteUrl('basic-block-street.png'), width: 128, height: 76 },
  fence: { src: spriteUrl('decor-fence.png'), width: 125, height: 104 },
  tree: { src: spriteUrl('decor-tree.png'), width: 117, height: 119 },
  lantern: { src: spriteUrl('decor-lantern.png'), width: 55, height: 130 },
  bench: { src: spriteUrl('decor-bench.png'), width: 96, height: 80 },
  fountain: { src: spriteUrl('decor-fountain.png'), width: 112, height: 112 },
  golden_fountain: { src: spriteUrl('decor-golden-fountain.png'), width: 112, height: 112 },
  windmill: { src: spriteUrl('decor-windmill.png'), width: 128, height: 160 },
  clock_tower: { src: spriteUrl('decor-clock-tower.png'), width: 128, height: 176 },
  ronduel_statue: { src: spriteUrl('decor-ronduel-statue.png'), width: 128, height: 176 },
};

export type CropGrowthStage = 'sprout' | 'half' | 'done';

export const CROP_BUTTON_SPRITES: Record<string, SpriteSpec> = {
  oats: UI_SPRITES.seedOats,
  wheat: UI_SPRITES.seedWheat,
  cabbage: UI_SPRITES.seedCabbage,
  carrots: UI_SPRITES.seedCarrots,
  sunflower: UI_SPRITES.seedSunflower,
  pumpkin: UI_SPRITES.seedPumpkin,
};

// TODO(art): Re-export the crop PNGs so the bottom 76 rows match basic-block-dirt.png's
// silhouette exactly, with the plants overflowing upward. groundOffsetY can then go back to 0.
export function resolveCropSprite(cropId: string, stage: CropGrowthStage): SpriteSpec {
  if (stage === 'sprout') {
    return { src: spriteUrl('land-farm-one.png'), width: 128, height: 88 };
  }
  if (cropId === 'wheat') {
    return stage === 'done'
      ? { src: spriteUrl('block-wheat-done.png'), width: 128, height: 88, groundOffsetY: 1 }
      : { src: spriteUrl('block-wheat-half.png'), width: 128, height: 85, groundOffsetY: 3 };
  }
  if (cropId === 'cabbage') {
    return stage === 'done'
      ? { src: spriteUrl('block-cabage-done.png'), width: 128, height: 81, groundOffsetY: 2 }
      : { src: spriteUrl('block-cabage-half.png'), width: 128, height: 80, groundOffsetY: 3 };
  }
  if (cropId === 'pumpkin') {
    return stage === 'done'
      ? { src: spriteUrl('block-pumpkin-done.png'), width: 128, height: 79, groundOffsetY: 1 }
      : { src: spriteUrl('block-pumpkin-half.png'), width: 128, height: 79, groundOffsetY: 2 };
  }
  // TODO(art): oats, carrots, sunflower use land-farm-one stand-in until crop PNGs arrive.
  return { src: spriteUrl('land-farm-one.png'), width: 128, height: 88 };
}

/**
 * Resolves a ground slab sprite with optional persisted rotation (0..3).
 * - Shore tiles (rot4): r1..r3 PNG variants
 * - Street curve (rot4): 0=NE, 1=SE, 2=SW (flipX), 3=NW
 * - Straight street (flip2): rot%2 === 1 -> flipX
 */
export function resolveGroundSprite(ground: GroundTileType, rot?: number): SpriteSpec {
  const base = GROUND_SPRITES[ground] ?? GROUND_SPRITES['basic-block'];
  const r = (((rot ?? 0) % 4) + 4) % 4;
  if (r === 0) return base;

  if (
    ground === 'basic-block-wather-grass-50-50' ||
    ground === 'basic-block-water-grass-20-80' ||
    ground === 'basic-block-water-grass-80-20'
  ) {
    const key = `${ground}-r${r}` as ShoreRotationKey;
    return GROUND_SPRITES[key] ?? base;
  }
  if (ground === 'basic-block-street') {
    return r % 2 === 1 ? { ...base, flipX: true } : base;
  }
  if (ground === 'basic-block-street-curve') {
    if (r === 1) return GROUND_SPRITES['basic-block-street-curve-se'];
    if (r === 2) return { ...GROUND_SPRITES['basic-block-street-curve'], flipX: true };
    if (r === 3) return GROUND_SPRITES['basic-block-street-curve-nw'];
  }
  return base;
}

/**
 * Complete 16-way road auto-tiling resolver from 4-neighbours (N=y-1, E=x+1, S=y+1, W=x-1).
 * For isolated tiles (mask 0), optional `rot % 2 === 1` flips to E-W axis.
 */
export function resolveRoadSprite(
  x: number,
  y: number,
  isRoadAt: (nx: number, ny: number) => boolean,
  rot?: 0 | 1 | 2 | 3,
): SpriteSpec {
  const n = isRoadAt(x, y - 1) ? 1 : 0;
  const e = isRoadAt(x + 1, y) ? 2 : 0;
  const s = isRoadAt(x, y + 1) ? 4 : 0;
  const w = isRoadAt(x - 1, y) ? 8 : 0;
  const mask = n | e | s | w;

  switch (mask) {
    case 0: // none (isolated)
      return (((rot ?? 0) % 2) + 2) % 2 === 1
        ? { ...GROUND_SPRITES['basic-block-street'], flipX: true }
        : GROUND_SPRITES['basic-block-street'];
    case 1: // N
      return GROUND_SPRITES['basic-block-street-end-n'];
    case 2: // E
      return GROUND_SPRITES['basic-block-street-end-e'];
    case 4: // S
      return GROUND_SPRITES['basic-block-street-end-s'];
    case 8: // W
      return GROUND_SPRITES['basic-block-street-end-w'];
    case 5: // N+S
      return GROUND_SPRITES['basic-block-street'];
    case 10: // E+W
      return { ...GROUND_SPRITES['basic-block-street'], flipX: true };
    case 3: // N+E
      return GROUND_SPRITES['basic-block-street-curve'];
    case 12: // S+W
      return { ...GROUND_SPRITES['basic-block-street-curve'], flipX: true };
    case 9: // N+W
      return GROUND_SPRITES['basic-block-street-curve-nw'];
    case 6: // S+E
      return GROUND_SPRITES['basic-block-street-curve-se'];
    case 7: // N+E+S
      return GROUND_SPRITES['basic-block-street-t-nes'];
    case 14: // E+S+W
      return GROUND_SPRITES['basic-block-street-t-esw'];
    case 13: // N+S+W
      return GROUND_SPRITES['basic-block-street-t-nsw'];
    case 11: // N+E+W
      return GROUND_SPRITES['basic-block-street-t-new'];
    case 15: // N+E+S+W
    default:
      return GROUND_SPRITES['basic-block-intersection'];
  }
}

export type VillagerKind =
  | 'small-villager'
  | 'woman-villager'
  | 'granny-villager'
  | 'child-villager'
  | 'blacksmith-villager'
  | 'baker-villager'
  | 'visitor';

export interface VillagerSpriteSet {
  kind: VillagerKind;
  idle: SpriteSpec;
  /** 4-frame front/right walk cycle if available; null means static + vertical bob. */
  walkFrames: SpriteSpec[] | null;
}

export const VILLAGER_SPRITES: Record<VillagerKind, VillagerSpriteSet> = {
  'small-villager': {
    kind: 'small-villager',
    idle: { src: spriteUrl('small-villager.png'), width: 53, height: 64 },
    walkFrames: [1, 2, 3, 4].map((f) => ({
      src: spriteUrl(`small-villager-walking-animation-right_f${f}.png`),
      width: 61,
      height: 68,
    })),
  },
  'woman-villager': {
    kind: 'woman-villager',
    idle: { src: spriteUrl('woman-villager.png'), width: 35, height: 64 },
    walkFrames: [1, 2, 3, 4].map((f) => ({
      src: spriteUrl(`woman-villager-walking-animation-right_f${f}.png`),
      width: 50,
      height: 68,
    })),
  },
  'granny-villager': {
    kind: 'granny-villager',
    idle: { src: spriteUrl('granny-villager.png'), width: 33, height: 64 },
    walkFrames: [1, 2, 3, 4].map((f) => ({
      src: spriteUrl(`granny-villager-moving-animation-right_f${f}.png`),
      width: 45,
      height: 68,
    })),
  },
  'child-villager': {
    kind: 'child-villager',
    idle: { src: spriteUrl('child-villager.png'), width: 27, height: 52 },
    walkFrames: [1, 2, 3, 4].map((f) => ({
      src: spriteUrl(`child-villager-walking-animation-right_f${f}.png`),
      width: 41,
      height: 56,
    })),
  },
  'blacksmith-villager': {
    kind: 'blacksmith-villager',
    idle: { src: spriteUrl('blacksmith-villager.png'), width: 32, height: 64 },
    walkFrames: [1, 2, 3, 4].map((f) => ({
      src: spriteUrl(`blacksmith-villager-walking-animation-right_f${f}.png`),
      width: 50,
      height: 68,
    })),
  },
  'baker-villager': {
    kind: 'baker-villager',
    idle: { src: spriteUrl('baker-villager.png'), width: 34, height: 64 },
    walkFrames: null,
  },
  visitor: {
    kind: 'visitor',
    // TODO(art): visitor.png contains an unwanted miniature house in the background; regenerate PNG.
    idle: { src: spriteUrl('visitor.png'), width: 59, height: 64 },
    walkFrames: null,
  },
};

export const RESIDENT_VILLAGER_KINDS: readonly VillagerKind[] = [
  'small-villager',
  'woman-villager',
  'granny-villager',
  'baker-villager',
  'blacksmith-villager',
];

export const BUBBLE_KINDS = ['heart', 'smile', 'star', 'wheat', 'exclaim', 'note'] as const;

export type BubbleKind = (typeof BUBBLE_KINDS)[number];

export const BUBBLE_SPRITES: Record<BubbleKind, SpriteSpec> = {
  heart: { src: uiSpriteUrl('bubble-heart@2x.png'), width: 48, height: 48 },
  smile: { src: uiSpriteUrl('bubble-smile@2x.png'), width: 48, height: 48 },
  star: { src: uiSpriteUrl('bubble-star@2x.png'), width: 48, height: 48 },
  wheat: { src: uiSpriteUrl('bubble-wheat@2x.png'), width: 48, height: 48 },
  exclaim: { src: uiSpriteUrl('bubble-exclaim@2x.png'), width: 48, height: 48 },
  note: { src: uiSpriteUrl('bubble-note@2x.png'), width: 48, height: 48 },
};

export const HEART_FLOAT_SPRITE: SpriteSpec = {
  src: uiSpriteUrl('heart-float@2x.png'),
  width: 18,
  height: 16,
};

const preloadedUrls = new Set<string>();

/**
 * Preloads the essential sprites used on the initial map paint to avoid pop-in.
 * Off-screen / secondary sprites stay lazy-loaded.
 */
export function preloadInitialSprites(extraUrls: string[] = []): void {
  if (typeof window === 'undefined') return;
  const urls = [
    GROUND_SPRITES['basic-block'].src,
    GROUND_SPRITES['basic-block-dirt'].src,
    GROUND_SPRITES['basic-block-street'].src,
    GROUND_SPRITES['basic-block-street-curve'].src,
    GROUND_SPRITES['basic-block-intersection'].src,
    ...ROAD_VARIANT_KEYS.map((k) => GROUND_SPRITES[k].src),
    ...SHORE_ROTATION_KEYS.map((k) => GROUND_SPRITES[k].src),
    ...BUBBLE_KINDS.map((k) => BUBBLE_SPRITES[k].src),
    HEART_FLOAT_SPRITE.src,
    UI_SPRITES.expand.src,
    UI_SPRITES.build.src,
    UI_SPRITES.move.src,
    UI_SPRITES.rotate.src,
    UI_SPRITES.plant.src,
    UI_SPRITES.visit.src,
    UI_SPRITES.coinsShop.src,
    UI_SPRITES.hideBar.src,
    CATALOG_SPRITES.starter_house!.src,
    VILLAGER_SPRITES['small-villager'].idle.src,
    VILLAGER_SPRITES['woman-villager'].idle.src,
    ...extraUrls,
  ];

  for (const src of urls) {
    if (!src || preloadedUrls.has(src)) continue;
    preloadedUrls.add(src);
    const img = new window.Image();
    img.decoding = 'async';
    img.src = src;
  }
}
