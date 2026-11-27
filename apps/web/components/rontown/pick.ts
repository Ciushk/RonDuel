/**
 * Sprite-aware alpha hit-testing for RonTown's DOM isometric map.
 *
 * Pure helpers (`sampleAlpha`, `pickFromCandidates`) require no browser/DOM and
 * are unit-tested directly with synthetic ImageData buffers. The DOM walker
 * (`pickDomAtPoint`) reuses the same alpha sampling & lazy offscreen-canvas mask
 * cache so pointer events fall through transparent PNG corners to rear sprites
 * or ground/expand diamonds.
 */

export const ALPHA_THRESHOLD = 32;
export const TOUCH_TOLERANCE_PX = 10;

export interface AlphaMask {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface SpritePickCandidate {
  kind: 'sprite';
  key: string;
  originX: number;
  originY: number;
  left: number;
  top: number;
  width: number;
  height: number;
  z: number;
  flipX?: boolean;
  src?: string;
  mask?: AlphaMask | null;
  cropClip?: { side: number; bottom: number };
}

export interface PlaceholderPickCandidate {
  kind: 'placeholder';
  key: string;
  originX: number;
  originY: number;
  left: number;
  top: number;
  width: number;
  height: number;
  z: number;
}

export interface DiamondPickCandidate {
  kind: 'ground' | 'expand';
  key: string;
  x: number;
  y: number;
  left: number;
  top: number;
  width: number;
  height: number;
  z: number;
}

export type PickCandidate = SpritePickCandidate | PlaceholderPickCandidate | DiamondPickCandidate;

export interface PickOptions {
  /** When true (placement / plant / drop-move mode), ignore standing sprites & placeholders. */
  groundOnly?: boolean;
  /** Alpha values strictly greater than threshold are opaque (default 32: 32=miss, 33=hit). */
  alphaThreshold?: number;
  /** Touch tap tolerance radius in the same coordinate units as worldX/worldY (default 0). */
  tolerance?: number;
}

export type CandidateAlphaSampler = (
  candidate: SpritePickCandidate,
  px: number,
  py: number,
  threshold: number,
) => boolean;

/**
 * Samples a single pixel in an RGBA mask (`ImageData`-compatible).
 * Returns true iff the pixel is in-bounds and its alpha byte is strictly greater than `threshold`.
 * When `flipX` is true, mirrors horizontally (`width - 1 - floor(px)`).
 */
export function sampleAlpha(
  imageData: AlphaMask,
  px: number,
  py: number,
  flipX = false,
  threshold = ALPHA_THRESHOLD,
): boolean {
  const ix = Math.floor(px);
  const iy = Math.floor(py);
  if (ix < 0 || iy < 0 || ix >= imageData.width || iy >= imageData.height) {
    return false;
  }
  const sx = flipX ? imageData.width - 1 - ix : ix;
  const alphaIdx = (iy * imageData.width + sx) * 4 + 3;
  return (imageData.data[alphaIdx] ?? 0) > threshold;
}

/** Tests whether (x, y) lies inside the 2:1 isometric diamond inscribed in [left, top, width, height]. */
export function isPointInIsoDiamond(
  x: number,
  y: number,
  left: number,
  top: number,
  width: number,
  height: number,
): boolean {
  if (width <= 0 || height <= 0) return false;
  const rx = width / 2;
  const ry = height / 2;
  const cx = left + rx;
  const cy = top + ry;
  return Math.abs(x - cx) / rx + Math.abs(y - cy) / ry <= 1;
}

function isPointInCropClip(
  localX: number,
  localY: number,
  width: number,
  clip: { side: number; bottom: number },
): boolean {
  const halfW = width / 2;
  if (halfW <= 0) return false;
  const distFromCenter = Math.abs(localX - halfW) / halfW;
  const maxY = clip.side + (clip.bottom - clip.side) * (1 - distFromCenter);
  return localY <= maxY;
}

function hitStandingObjectAt(
  worldX: number,
  worldY: number,
  objects: ReadonlyArray<SpritePickCandidate | PlaceholderPickCandidate>,
  sampleAlphaFn: CandidateAlphaSampler | undefined,
  threshold: number,
): SpritePickCandidate | PlaceholderPickCandidate | null {
  for (const cand of objects) {
    const localX = worldX - cand.left;
    const localY = worldY - cand.top;
    if (localX < 0 || localY < 0 || localX >= cand.width || localY >= cand.height) {
      continue;
    }
    if (cand.kind === 'placeholder') {
      return cand;
    }
    if (cand.cropClip && !isPointInCropClip(localX, localY, cand.width, cand.cropClip)) {
      continue;
    }
    let opaque: boolean;
    if (sampleAlphaFn) {
      opaque = sampleAlphaFn(cand, localX, localY, threshold);
    } else if (cand.mask) {
      const px = (localX / cand.width) * cand.mask.width;
      const py = (localY / cand.height) * cand.mask.height;
      opaque = sampleAlpha(cand.mask, px, py, Boolean(cand.flipX), threshold);
    } else {
      // Mask not ready / unavailable -> opaque bbox fallback
      opaque = true;
    }
    if (opaque) {
      return cand;
    }
  }
  return null;
}

function buildToleranceOffsets(maxRadius: number): Array<{ dx: number; dy: number }> {
  const offsets: Array<{ dx: number; dy: number }> = [];
  if (maxRadius <= 0) return offsets;

  const radii: number[] = [];
  for (let r = 2; r < maxRadius; r += 2) {
    radii.push(r);
  }
  radii.push(maxRadius);

  for (const r of radii) {
    const steps = r <= 4 ? 8 : 16;
    for (let i = 0; i < steps; i++) {
      const angle = (i * 2 * Math.PI) / steps;
      offsets.push({
        dx: Math.cos(angle) * r,
        dy: Math.sin(angle) * r,
      });
    }
  }
  return offsets;
}

/**
 * Pure front-to-back picker for unit tests and headless hit-testing.
 *
 * 1. Sorts candidates front-to-back (highest `z` first, preserving input order on ties).
 * 2. Unless `groundOnly`, tests standing sprites/placeholders at the exact point.
 * 3. If exact point misses a standing object and `tolerance > 0` (touch), searches
 *    concentric rings up to `tolerance` for the nearest opaque standing object.
 * 4. Otherwise falls through to the topmost ground/expand diamond under the original point.
 */
export function pickFromCandidates(
  worldX: number,
  worldY: number,
  candidates: ReadonlyArray<PickCandidate>,
  sampleAlphaFn?: CandidateAlphaSampler,
  options?: PickOptions,
): PickCandidate | null {
  const groundOnly = Boolean(options?.groundOnly);
  const threshold = options?.alphaThreshold ?? ALPHA_THRESHOLD;
  const tolerance = options?.tolerance ?? 0;

  const sorted = candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => b.candidate.z - a.candidate.z || a.index - b.index)
    .map((entry) => entry.candidate);

  if (!groundOnly) {
    const objects = sorted.filter(
      (c): c is SpritePickCandidate | PlaceholderPickCandidate =>
        c.kind === 'sprite' || c.kind === 'placeholder',
    );

    const exactHit = hitStandingObjectAt(worldX, worldY, objects, sampleAlphaFn, threshold);
    if (exactHit) return exactHit;

    if (tolerance > 0 && objects.length > 0) {
      for (const { dx, dy } of buildToleranceOffsets(tolerance)) {
        const nearHit = hitStandingObjectAt(
          worldX + dx,
          worldY + dy,
          objects,
          sampleAlphaFn,
          threshold,
        );
        if (nearHit) return nearHit;
      }
    }
  }

  for (const cand of sorted) {
    if (cand.kind !== 'ground' && cand.kind !== 'expand') continue;
    if (isPointInIsoDiamond(worldX, worldY, cand.left, cand.top, cand.width, cand.height)) {
      return cand;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Lazy offscreen-canvas alpha mask cache (browser-only, zero preload on boot)
// ---------------------------------------------------------------------------

type CachedMaskEntry = AlphaMask | 'tainted';

const maskCache = new Map<string, CachedMaskEntry>();
const pendingLoads = new Set<string>();
let scratchCanvas: HTMLCanvasElement | null = null;

function extractMaskFromImage(img: HTMLImageElement): CachedMaskEntry | null {
  if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
    return null;
  }
  if (typeof document === 'undefined') return null;
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const canvas = scratchCanvas ?? (scratchCanvas = document.createElement('canvas'));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 'tainted';
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    return { width: imgData.width, height: imgData.height, data: imgData.data };
  } catch {
    return 'tainted';
  }
}

export function getCachedSpriteMask(img: HTMLImageElement): CachedMaskEntry | 'pending' {
  const key = img.currentSrc || img.src;
  if (!key) return 'tainted';

  const cached = maskCache.get(key);
  if (cached) return cached;

  const extracted = extractMaskFromImage(img);
  if (extracted) {
    maskCache.set(key, extracted);
    pendingLoads.delete(key);
    return extracted;
  }

  // Image not decoded yet: kick off async population for subsequent events and
  // treat this single event as an opaque bounding box.
  if (!pendingLoads.has(key)) {
    pendingLoads.add(key);
    const onDone = () => {
      pendingLoads.delete(key);
      if (maskCache.has(key)) return;
      const mask = extractMaskFromImage(img);
      if (mask) maskCache.set(key, mask);
    };
    img.addEventListener('load', onDone, { once: true });
    img.addEventListener(
      'error',
      () => {
        pendingLoads.delete(key);
      },
      { once: true },
    );
  }
  return 'pending';
}

export function clearMaskCache(): void {
  maskCache.clear();
  pendingLoads.clear();
}

function isDomSpriteOpaqueAt(
  img: HTMLImageElement,
  clientX: number,
  clientY: number,
  flipX: boolean,
  threshold: number,
): boolean {
  const rect = img.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;

  const u = (clientX - rect.left) / rect.width;
  const v = (clientY - rect.top) / rect.height;
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;

  const mask = getCachedSpriteMask(img);
  if (mask === 'pending' || mask === 'tainted') {
    return true;
  }

  // Map normalized 0..1 coordinates directly to natural PNG pixel space (no DPR scaling).
  return sampleAlpha(mask, u * mask.width, v * mask.height, flipX, threshold);
}

// ---------------------------------------------------------------------------
// DOM `elementsFromPoint` stack walker
// ---------------------------------------------------------------------------

export interface DomObjectPick {
  kind: 'object';
  element: HTMLElement;
  key: string;
  originX: number;
  originY: number;
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

export interface DomDiamondPick {
  kind: 'ground' | 'expand';
  element: HTMLButtonElement;
  x: number;
  y: number;
}

export interface DomPassthroughPick {
  kind: 'passthrough';
  element: HTMLElement;
}

export type DomPickResult = DomObjectPick | DomDiamondPick | DomPassthroughPick | null;

export interface DomPickOptions {
  groundOnly?: boolean;
  tolerancePx?: number;
  alphaThreshold?: number;
  stageEl?: HTMLElement | null;
}

function isIgnoredOverlay(el: Element): boolean {
  return Boolean(
    el.closest(
      '[data-zoom-control="true"], [data-villager-id], [data-villager-bubble], [data-rt-hover-outline="true"], [data-rt-lifted-outline="true"], [data-rt-move-flight="true"], [data-rt-cursor-overlay="true"], [role="tooltip"], [role="status"]',
    ),
  );
}

function buildDomObjectPick(el: HTMLElement, isPlaceholder: boolean): DomObjectPick | null {
  const key = el.dataset.rtKey;
  const originX = Number(el.dataset.rtX);
  const originY = Number(el.dataset.rtY);
  if (!key || !Number.isInteger(originX) || !Number.isInteger(originY)) {
    return null;
  }
  const left = parseFloat(el.style.left) || 0;
  const top = parseFloat(el.style.top) || 0;
  const width =
    el instanceof HTMLImageElement
      ? el.width || el.naturalWidth || parseFloat(el.style.width) || 0
      : parseFloat(el.style.width) || 96;
  const height =
    el instanceof HTMLImageElement
      ? el.height || el.naturalHeight || parseFloat(el.style.height) || 0
      : parseFloat(el.style.height) || 96;
  const zIndex = Number(el.dataset.rtObjectZ) || Number(el.style.zIndex) || 1040;
  const flipX = el.dataset.rtFlipX === '1';
  const src = el instanceof HTMLImageElement ? el.getAttribute('src') : null;
  const clipPath = el.style.clipPath || undefined;

  return {
    kind: 'object',
    element: el,
    key,
    originX,
    originY,
    src,
    left,
    top,
    width,
    height,
    flipX,
    zIndex,
    clipPath,
    isPlaceholder,
  };
}

function walkStackAtPoint(
  clientX: number,
  clientY: number,
  opts: {
    groundOnly: boolean;
    objectsOnly: boolean;
    threshold: number;
    stageEl?: HTMLElement | null;
  },
): DomPickResult {
  if (typeof document === 'undefined' || typeof document.elementsFromPoint !== 'function') {
    return null;
  }
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const el of stack) {
    if (!(el instanceof HTMLElement)) continue;
    if (isIgnoredOverlay(el)) continue;
    if (opts.stageEl && !opts.stageEl.contains(el)) continue;

    // Harvest & speed-up buttons always win and let native clicks run
    const badgeBtn = el.closest<HTMLElement>('[data-rt-badge-btn="true"]');
    if (badgeBtn) {
      if (opts.objectsOnly) continue;
      return { kind: 'passthrough', element: badgeBtn };
    }

    const pickKind = el.dataset.rtPick;
    if (pickKind && !opts.groundOnly) {
      if (pickKind === 'placeholder') {
        const result = buildDomObjectPick(el, true);
        if (result) return result;
      } else if (pickKind === 'sprite' && el instanceof HTMLImageElement) {
        const flipX = el.dataset.rtFlipX === '1';
        if (isDomSpriteOpaqueAt(el, clientX, clientY, flipX, opts.threshold)) {
          const result = buildDomObjectPick(el, false);
          if (result) return result;
        }
        // Alpha <= threshold -> fall through to elements behind this sprite
        continue;
      }
    }

    if (!opts.objectsOnly) {
      if (el instanceof HTMLButtonElement && el.dataset.rtGroundBtn === 'true') {
        const x = Number(el.dataset.rtX);
        const y = Number(el.dataset.rtY);
        if (Number.isInteger(x) && Number.isInteger(y)) {
          return { kind: 'ground', element: el, x, y };
        }
      }
      if (el instanceof HTMLButtonElement && el.dataset.rtExpandBtn === 'true') {
        const x = Number(el.dataset.rtX);
        const y = Number(el.dataset.rtY);
        if (Number.isInteger(x) && Number.isInteger(y)) {
          return { kind: 'expand', element: el, x, y };
        }
      }
    }
  }
  return null;
}

const TOUCH_RING_RADII = [3, 6, 10] as const;

/**
 * Walks `document.elementsFromPoint(clientX, clientY)` topmost-first with PNG
 * alpha fallthrough. On touch (`tolerancePx > 0`), if the exact pixel misses a
 * standing object, probes concentric rings up to `tolerancePx` CSS px for the
 * nearest opaque sprite before falling through to the diamond at the original point.
 */
export function pickDomAtPoint(
  clientX: number,
  clientY: number,
  options?: DomPickOptions,
): DomPickResult {
  const groundOnly = Boolean(options?.groundOnly);
  const tolerancePx = options?.tolerancePx ?? 0;
  const threshold = options?.alphaThreshold ?? ALPHA_THRESHOLD;
  const stageEl = options?.stageEl ?? null;

  const exact = walkStackAtPoint(clientX, clientY, {
    groundOnly,
    objectsOnly: false,
    threshold,
    stageEl,
  });

  if (exact && (exact.kind === 'object' || exact.kind === 'passthrough')) {
    return exact;
  }

  if (!groundOnly && tolerancePx > 0) {
    const radii: number[] = TOUCH_RING_RADII.filter((r) => r <= tolerancePx);
    if (radii.length === 0 || radii[radii.length - 1]! < tolerancePx) {
      radii.push(tolerancePx);
    }
    for (const r of radii) {
      const steps = r <= 4 ? 8 : 12;
      for (let i = 0; i < steps; i++) {
        const angle = (i * 2 * Math.PI) / steps;
        const near = walkStackAtPoint(
          clientX + Math.cos(angle) * r,
          clientY + Math.sin(angle) * r,
          {
            groundOnly: false,
            objectsOnly: true,
            threshold,
            stageEl,
          },
        );
        if (near && near.kind === 'object') {
          return near;
        }
      }
    }
  }

  return exact;
}
