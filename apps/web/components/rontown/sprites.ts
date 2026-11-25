import type { GroundTileType } from '@ronduel/shared';

export interface SpriteSpec {
  src: string;
  width: number;
  height: number;
  /** Optional horizontal mirror for opposite iso diagonal. */
  flipX?: boolean;
  /** True when art is missing and UI should render a placeholder silhouette. */
  isPlaceholder?: boolean;
  note?: string;
}

export const SPRITE_BASE = '/rontown';

export function spriteUrl(filename: string): string {
  return `${SPRITE_BASE}/${filename}`;
}

export const GROUND_SPRITES: Record<GroundTileType, SpriteSpec> = {
  'basic-block': { src: spriteUrl('basic-block.png'), width: 32, height: 19 },
  'basic-block-flowers': { src: spriteUrl('basic-block-flowers.png'), width: 32, height: 19 },
  'basic-block-flowers-two': {
    src: spriteUrl('basic-block-flowers-two.png'),
    width: 32,
    height: 19,
  },
  'basic-block-dirt': { src: spriteUrl('basic-block-dirt.png'), width: 32, height: 19 },
  'basic-block-street': { src: spriteUrl('basic-block-street.png'), width: 32, height: 19 },
  'basic-block-street-curve': {
    src: spriteUrl('basic-block-street-curve.png'),
    width: 32,
    height: 19,
  },
  'basic-block-intersection': {
    src: spriteUrl('basic-block-intersection.png'),
    width: 32,
    height: 19,
  },
  'basic-block-wather': { src: spriteUrl('basic-block-wather.png'), width: 32, height: 19 },
  'basic-block-wather-two': { src: spriteUrl('basic-block-wather-two.png'), width: 32, height: 19 },
  'basic-block-wather-grass-50-50': {
    src: spriteUrl('basic-block-wather-grass-50-50.png'),
    width: 32,
    height: 19,
  },
  'basic-block-water-grass-20-80': {
    src: spriteUrl('basic-block-water-grass-20-80.png'),
    width: 32,
    height: 19,
  },
  'basic-block-water-grass-80-20': {
    src: spriteUrl('basic-block-water-grass-80-20.png'),
    width: 32,
    height: 19,
  },
};

export const UI_SPRITES = {
  expand: { src: spriteUrl('tile_expand.png'), width: 32, height: 19 },
  freeSpot: { src: spriteUrl('block-free-spot.png'), width: 52, height: 32 },
  takenSpot: { src: spriteUrl('button-taken-spot.png'), width: 52, height: 32 },
  build: { src: spriteUrl('build-button.png'), width: 32, height: 32 },
  move: { src: spriteUrl('move-button.png'), width: 32, height: 32 },
  plant: { src: spriteUrl('plant-button.png'), width: 32, height: 32 },
  visit: { src: spriteUrl('button-vizit.png'), width: 32, height: 32 },
  coinsShop: { src: spriteUrl('button-coins.png'), width: 32, height: 32 },
  hideBar: { src: spriteUrl('button-hide-bar.png'), width: 32, height: 32 },
  seedWheat: { src: spriteUrl('button-wheat.png'), width: 32, height: 32 },
  seedCabbage: { src: spriteUrl('button-cabage.png'), width: 32, height: 32 },
  seedPumpkin: { src: spriteUrl('button-pumpkin.png'), width: 32, height: 32 },
  farmGrowing: { src: spriteUrl('farm-done-icon.png'), width: 14, height: 14 },
  farmReady: { src: spriteUrl('farm-done-icon-gold.png'), width: 14, height: 14 },
} as const;

/**
 * Maps DEFAULT_TOWN_CATALOG spriteKeys to pixel-art PNG specs.
 * Catalog footprints are authoritative; mismatches with art dimensions are noted with TODOs.
 */
export const CATALOG_SPRITES: Record<string, SpriteSpec> = {
  starter_house: { src: spriteUrl('building-house-basic.png'), width: 31, height: 34 },
  // TODO(art): building-two-blocks-house.png is ~2x1 (46x35) while catalog cottage is 1x1.
  // Confirm whether cottage footprint should become 2x1 or swap PNG.
  cottage: { src: spriteUrl('building-two-blocks-house.png'), width: 46, height: 35 },
  house: { src: spriteUrl('building-two-level-house.png'), width: 28, height: 35 },
  // TODO(art): building-apartment.png missing — swap filename when art arrives.
  apartment: { src: '', width: 48, height: 48, isPlaceholder: true },
  // TODO(art): building-villa.png is 50px wide (< 64px for 2x2); centered on 2x2 at integer scale.
  villa: { src: spriteUrl('building-villa.png'), width: 50, height: 37 },
  shop: { src: spriteUrl('building-shop.png'), width: 33, height: 32 },
  // TODO(art): building-town-hall.png is 33px wide (< 64px for 2x2); centered on 2x2 at integer scale.
  town_hall: { src: spriteUrl('building-town-hall.png'), width: 33, height: 38 },
  // TODO(art): building-park.png is drawn as 2x2 (50x35) while catalog park is 1x1.
  // Confirm whether park catalog footprint should become 2x2 or swap PNG.
  park: { src: spriteUrl('building-park.png'), width: 50, height: 35 },
  bakery: { src: spriteUrl('building-bakery.png'), width: 32, height: 34 },
  // TODO(art): building-school.png is 44px wide (< 64px for 2x2); centered on 2x2 at integer scale.
  school: { src: spriteUrl('building-school.png'), width: 44, height: 32 },
  police_station: { src: spriteUrl('building-police.png'), width: 38, height: 33 },
  fire_station: { src: spriteUrl('building-fire-station.png'), width: 40, height: 42 },
  // TODO(art): building-hospital.png is 44px wide (< 64px for 2x2); centered on 2x2 at integer scale.
  hospital: { src: spriteUrl('building-hospital.png'), width: 44, height: 32 },
  // TODO(art): No dedicated empty tilled plot PNG; using basic-block-dirt.png as placeholder.
  plot: { src: spriteUrl('basic-block-dirt.png'), width: 32, height: 19 },
  road: { src: spriteUrl('basic-block-street.png'), width: 32, height: 19 },
  fence: { src: spriteUrl('decor-fence.png'), width: 31, height: 26 },
  tree: { src: spriteUrl('decor-tree.png'), width: 29, height: 30 },
  lantern: { src: spriteUrl('decor-lantern.png'), width: 14, height: 33 },
  // TODO(art): Missing decor art — swap by filename when PNGs arrive.
  bench: { src: '', width: 24, height: 20, isPlaceholder: true },
  fountain: { src: '', width: 28, height: 28, isPlaceholder: true },
  golden_fountain: { src: '', width: 28, height: 28, isPlaceholder: true },
  windmill: { src: '', width: 32, height: 40, isPlaceholder: true },
  clock_tower: { src: '', width: 32, height: 44, isPlaceholder: true },
  ronduel_statue: { src: '', width: 32, height: 44, isPlaceholder: true },
};

export type CropGrowthStage = 'sprout' | 'half' | 'done';

export const CROP_BUTTON_SPRITES: Record<string, SpriteSpec> = {
  wheat: UI_SPRITES.seedWheat,
  cabbage: UI_SPRITES.seedCabbage,
  pumpkin: UI_SPRITES.seedPumpkin,
  // TODO(art): oats, carrots, sunflower lack seed button art; fall back to sprout icon.
  oats: { src: spriteUrl('land-farm-one.png'), width: 32, height: 22 },
  carrots: { src: spriteUrl('land-farm-one.png'), width: 32, height: 22 },
  sunflower: { src: spriteUrl('land-farm-one.png'), width: 32, height: 22 },
};

export function resolveCropSprite(cropId: string, stage: CropGrowthStage): SpriteSpec {
  if (stage === 'sprout') {
    return { src: spriteUrl('land-farm-one.png'), width: 32, height: 22 };
  }
  if (cropId === 'wheat') {
    return stage === 'done'
      ? { src: spriteUrl('block-wheat-done.png'), width: 32, height: 22 }
      : { src: spriteUrl('block-wheat-half.png'), width: 32, height: 21 };
  }
  if (cropId === 'cabbage') {
    return stage === 'done'
      ? { src: spriteUrl('block-cabage-done.png'), width: 32, height: 20 }
      : { src: spriteUrl('block-cabage-half.png'), width: 32, height: 20 };
  }
  if (cropId === 'pumpkin') {
    return stage === 'done'
      ? { src: spriteUrl('block-pumpkin-done.png'), width: 32, height: 20 }
      : { src: spriteUrl('block-pumpkin-half.png'), width: 32, height: 20 };
  }
  // TODO(art): oats, carrots, sunflower use land-farm-one stand-in until crop PNGs arrive.
  return { src: spriteUrl('land-farm-one.png'), width: 32, height: 22 };
}

/**
 * Auto-picks straight, curved, or 4-way intersection road sprite based on 4-neighbours.
 */
export function resolveRoadSprite(
  x: number,
  y: number,
  isRoadAt: (nx: number, ny: number) => boolean,
): SpriteSpec {
  const n = isRoadAt(x, y - 1);
  const s = isRoadAt(x, y + 1);
  const e = isRoadAt(x + 1, y);
  const w = isRoadAt(x - 1, y);
  const count = Number(n) + Number(s) + Number(e) + Number(w);

  if (count >= 3) {
    return GROUND_SPRITES['basic-block-intersection'];
  }
  if ((n || s) && (e || w)) {
    // Corner curve; mirror horizontally when turning toward west
    return {
      ...GROUND_SPRITES['basic-block-street-curve'],
      flipX: w && !e,
    };
  }
  if (e || w) {
    // Runs along col axis (mirror of row axis)
    return {
      ...GROUND_SPRITES['basic-block-street'],
      flipX: true,
    };
  }
  return GROUND_SPRITES['basic-block-street'];
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
  /** 4-frame front/right walk cycle if available; null means static + 2px bob. */
  walkFrames: SpriteSpec[] | null;
}

export const VILLAGER_SPRITES: Record<VillagerKind, VillagerSpriteSet> = {
  'small-villager': {
    kind: 'small-villager',
    idle: { src: spriteUrl('small-villager.png'), width: 13, height: 16 },
    walkFrames: [1, 2, 3, 4].map((f) => ({
      src: spriteUrl(`small-villager-walking-animation-right_f${f}.png`),
      width: 15,
      height: 17,
    })),
  },
  'woman-villager': {
    kind: 'woman-villager',
    idle: { src: spriteUrl('woman-villager.png'), width: 9, height: 16 },
    walkFrames: [1, 2, 3, 4].map((f) => ({
      src: spriteUrl(`woman-villager-walking-animation-right_f${f}.png`),
      width: 13,
      height: 17,
    })),
  },
  'granny-villager': {
    kind: 'granny-villager',
    idle: { src: spriteUrl('granny-villager.png'), width: 8, height: 16 },
    walkFrames: [1, 2, 3, 4].map((f) => ({
      src: spriteUrl(`granny-villager-moving-animation-right_f${f}.png`),
      width: 11,
      height: 17,
    })),
  },
  'child-villager': {
    kind: 'child-villager',
    idle: { src: spriteUrl('child-villager.png'), width: 7, height: 13 },
    walkFrames: [1, 2, 3, 4].map((f) => ({
      src: spriteUrl(`child-villager-walking-animation-right_f${f}.png`),
      width: 10,
      height: 14,
    })),
  },
  'blacksmith-villager': {
    kind: 'blacksmith-villager',
    idle: { src: spriteUrl('blacksmith-villager.png'), width: 8, height: 16 },
    walkFrames: [1, 2, 3, 4].map((f) => ({
      src: spriteUrl(`blacksmith-villager-walking-animation-right_f${f}.png`),
      width: 13,
      height: 17,
    })),
  },
  'baker-villager': {
    kind: 'baker-villager',
    idle: { src: spriteUrl('baker-villager.png'), width: 9, height: 16 },
    walkFrames: null,
  },
  visitor: {
    kind: 'visitor',
    // TODO(art): visitor.png contains an unwanted miniature house in the background; regenerate PNG.
    idle: { src: spriteUrl('visitor.png'), width: 15, height: 16 },
    walkFrames: null,
  },
};

export const RESIDENT_VILLAGER_KINDS: readonly VillagerKind[] = [
  'small-villager',
  'woman-villager',
  'granny-villager',
  'child-villager',
  'baker-villager',
  'blacksmith-villager',
];

const preloadedUrls = new Set<string>();

/**
 * Preloads the essential sprites used on the initial map render to prevent pop-in.
 */
export function preloadInitialSprites(extraUrls: string[] = []): void {
  if (typeof window === 'undefined') return;
  const urls = [
    GROUND_SPRITES['basic-block'].src,
    GROUND_SPRITES['basic-block-dirt'].src,
    UI_SPRITES.expand.src,
    UI_SPRITES.freeSpot.src,
    UI_SPRITES.takenSpot.src,
    UI_SPRITES.build.src,
    UI_SPRITES.move.src,
    UI_SPRITES.plant.src,
    UI_SPRITES.visit.src,
    UI_SPRITES.coinsShop.src,
    UI_SPRITES.hideBar.src,
    UI_SPRITES.seedWheat.src,
    UI_SPRITES.seedCabbage.src,
    UI_SPRITES.seedPumpkin.src,
    UI_SPRITES.farmGrowing.src,
    UI_SPRITES.farmReady.src,
    CATALOG_SPRITES.starter_house!.src,
    spriteUrl('land-farm-one.png'),
    ...VILLAGER_SPRITES['small-villager'].walkFrames!.map((f) => f.src),
    ...VILLAGER_SPRITES['woman-villager'].walkFrames!.map((f) => f.src),
    VILLAGER_SPRITES['small-villager'].idle.src,
    VILLAGER_SPRITES['woman-villager'].idle.src,
    VILLAGER_SPRITES.visitor.idle.src,
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
