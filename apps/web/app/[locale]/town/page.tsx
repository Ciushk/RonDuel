'use client';

import {
  ArrowsClockwise,
  Buildings,
  CaretLeft,
  Gift,
  Heart,
  List,
  Users,
} from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ActionBar, type SeedChoiceId } from '@/components/rontown/ActionBar';
import { IsoMap, type RotatingTarget } from '@/components/rontown/IsoMap';
import { isoToScreen, TILE_H, TILE_W } from '@/components/rontown/iso';
import { RonCoinIcon } from '@/components/rontown/RonCoinIcon';
import { GROUND_SPRITES } from '@/components/rontown/sprites';
import type { ActiveSheet } from '@/components/rontown/TownSheets';
import { useTownState, type TileInfo } from '@/components/rontown/useTownState';
import { useReducedMotion } from '@/components/rontown/useVillagers';
import { useFeatureFlag } from '@/lib/feature-flags';
import { getRotationKind, type GridCoord, type GroundTileType } from '@ronduel/shared';

const SKELETON_CELLS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 2, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 2 },
  { x: 2, y: 1 },
  { x: 1, y: 2 },
  { x: 2, y: 2 },
];

const BuyLandSheet = dynamic(
  () => import('@/components/rontown/BuyLandSheet').then((m) => m.BuyLandSheet),
  { ssr: false },
);

const TownSheets = dynamic(
  () => import('@/components/rontown/TownSheets').then((m) => m.TownSheets),
  { ssr: false },
);

const SpeedupConfirmSheet = dynamic(
  () => import('@/components/rontown/SpeedupConfirmSheet').then((m) => m.SpeedupConfirmSheet),
  { ssr: false },
);

export default function TownPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [visitHostUid, setVisitHostUid] = useState<string | null>(null);
  const isVisitMode = Boolean(visitHostUid);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('visit');
    if (v) setVisitHostUid(v);
  }, []);

  // Lock page/body scroll & rubber-band overscroll while on /[locale]/town
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, []);

  const townEnabled = useFeatureFlag('town_enabled');
  const coinsPurchaseEnabled = useFeatureFlag('coins_purchase_enabled');
  const coinsTransferEnabled = useFeatureFlag('coins_transfer_enabled');
  const townHelpEnabled = useFeatureFlag('town_help_enabled');

  const state = useTownState({ townEnabled, isVisitMode, visitHostUid });
  const {
    catalog,
    townReady,
    hydratedFromCache,
    connectionStatus,
    retryInit,
    town,
    tiles,
    land,
    landRot,
    expandRing,
    blockedKeys,
    walletBalance,
    inventory,
    orders,
    ordersUnlocked,
    tutorialStep,
    tutorialDone,
    advanceTutorial,
    skipTutorial,
    hostInfo,
    likeLoading,
    waterLoading,
    transferStatus,
    transferLoading,
    landPurchasing,
    speedupEnabled,
    speedupLoading,
    actionMessage,
    showToast,
    floatingRewards,
    canPlaceAt,
    canPlantAt,
    executeBuyLand,
    executeBuild,
    executeMove,
    executeRotate,
    executeRemove,
    executePlantCrop,
    executeHarvestCrop,
    executeSpeedup,
    executeBuyPlot,
    executeDeliverOrder,
    executeLike,
    executeWaterCrop,
    executeCoinCheckout,
    loadTransferStatus,
    executeTransfer,
  } = state;

  const reducedMotion = useReducedMotion();
  const [mapRevealed, setMapRevealed] = useState<boolean>(false);
  const [displayedWalletBalance, setDisplayedWalletBalance] = useState<number>(walletBalance);
  const displayedWalletRef = useRef<number>(walletBalance);

  useEffect(() => {
    const startVal = displayedWalletRef.current;
    if (reducedMotion || startVal === walletBalance) {
      displayedWalletRef.current = walletBalance;
      setDisplayedWalletBalance(walletBalance);
      return;
    }
    const startMs = performance.now();
    const durationMs = 400;
    let rafId = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - startMs) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(startVal + (walletBalance - startVal) * eased);
      displayedWalletRef.current = next;
      setDisplayedWalletBalance(next);
      if (p < 1) {
        rafId = window.requestAnimationFrame(step);
      } else {
        displayedWalletRef.current = walletBalance;
        setDisplayedWalletBalance(walletBalance);
      }
    };
    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, [walletBalance, reducedMotion]);

  useEffect(() => {
    if (!townReady) return;
    if (hydratedFromCache || reducedMotion) {
      setMapRevealed(true);
      return;
    }
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setMapRevealed(true);
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [townReady, hydratedFromCache, reducedMotion]);

  const [activeSheet, setActiveSheet] = useState<ActiveSheet | null>(null);
  const [selectedTile, setSelectedTile] = useState<TileInfo | null>(null);
  const [expandTarget, setExpandTarget] = useState<GridCoord | null>(null);
  const [speedupTarget, setSpeedupTarget] = useState<TileInfo | null>(null);
  const [speedupSparkleKey, setSpeedupSparkleKey] = useState<string | null>(null);
  const speedupSparkleTimerRef = useRef<number | null>(null);
  const [toolbarVisible, setToolbarVisible] = useState<boolean>(true);

  const [shopTab, setShopTab] = useState<'housing' | 'service' | 'plot' | 'decor'>('housing');
  const [placingItemId, setPlacingItemId] = useState<string | null>(null);
  const [roadRot, setRoadRot] = useState<0 | 1>(0);
  const [roadRotateTick, setRoadRotateTick] = useState<number>(0);
  const [moveModeActive, setMoveModeActive] = useState<boolean>(false);
  const [movingTile, setMovingTile] = useState<TileInfo | null>(null);
  const [rotateModeActive, setRotateModeActive] = useState<boolean>(false);
  const [rotatingTarget, setRotatingTarget] = useState<RotatingTarget | null>(null);
  const [rotateAnnouncement, setRotateAnnouncement] = useState<string>('');
  const rotateTickRef = useRef<number>(0);
  const rotateSwapTimerRef = useRef<number | null>(null);
  const rotateClearTimerRef = useRef<number | null>(null);
  const pendingRotRef = useRef<{
    x: number;
    y: number;
    layer: 'ground' | 'item';
    rot: 0 | 1 | 2 | 3;
  } | null>(null);
  const [farmMenuOpen, setFarmMenuOpen] = useState<boolean>(false);
  const [selectedSeed, setSelectedSeed] = useState<SeedChoiceId | null>(null);

  const [transferRecipient, setTransferRecipient] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<number>(10);
  const [lastTownEvent, setLastTownEvent] = useState<{
    id: number;
    x: number;
    y: number;
    type: 'harvest' | 'build' | 'plant';
  } | null>(null);

  useEffect(() => {
    return () => {
      if (rotateSwapTimerRef.current !== null) window.clearTimeout(rotateSwapTimerRef.current);
      if (rotateClearTimerRef.current !== null) window.clearTimeout(rotateClearTimerRef.current);
      if (speedupSparkleTimerRef.current !== null) {
        window.clearTimeout(speedupSparkleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('rt_toolbar_visible');
      if (saved !== null) {
        setToolbarVisible(saved === 'true');
      }
    } catch {
      // Ignore
    }
  }, []);

  const toggleToolbar = useCallback(() => {
    setToolbarVisible((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('rt_toolbar_visible', String(next));
      } catch {
        // Ignore
      }
      if (!next) setFarmMenuOpen(false);
      return next;
    });
  }, []);

  const toggleRoadRot = useCallback(() => {
    setRoadRot((prev) => (prev === 0 ? 1 : 0));
    setRoadRotateTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (placingItemId !== 'road') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'r' && e.key !== 'R') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      toggleRoadRot();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [placingItemId, toggleRoadRot]);

  const clearModes = useCallback(() => {
    setPlacingItemId(null);
    setRoadRot(0);
    setRoadRotateTick(0);
    setMoveModeActive(false);
    setMovingTile(null);
    setRotateModeActive(false);
    setSelectedSeed(null);
    setFarmMenuOpen(false);
  }, []);

  const openSheet = useCallback(
    (sheet: ActiveSheet) => {
      if (sheet === 'transfer') {
        void loadTransferStatus();
      }
      setExpandTarget(null);
      setActiveSheet(sheet);
    },
    [loadTransferStatus],
  );

  const closeSheet = useCallback(() => {
    setActiveSheet(null);
    setSelectedTile(null);
  }, []);

  useEffect(() => {
    if (!activeSheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeSheet, closeSheet]);

  const population = town?.population ?? 2;
  const populationCap = town?.populationCap ?? 2;
  const housingCapacity = town?.housingCapacity ?? 2;
  const serviceCapacity = town?.serviceCapacity ?? 4;
  const level = town?.level ?? 1;
  const maxLevel = town?.maxLevelReached ?? 1;

  const growthBottleneck = useMemo(() => {
    if (population < populationCap) return null;
    if (housingCapacity <= serviceCapacity) {
      return t('town.growth.limitedByHousing');
    }
    return t('town.growth.limitedByServices');
  }, [population, populationCap, housingCapacity, serviceCapacity, t]);

  const catalogList = useMemo(() => {
    return Object.values(catalog.items).filter((item) => {
      if (item.id === 'starter_house') return false;
      if (shopTab === 'housing') return item.type === 'housing';
      if (shopTab === 'service') return item.type === 'service';
      if (shopTab === 'plot') return item.type === 'plot';
      if (shopTab === 'decor') return item.type === 'decor';
      return false;
    });
  }, [catalog, shopTab]);

  const cropItems = useMemo(() => {
    return Object.values(catalog.items).filter((item) => item.type === 'crop');
  }, [catalog]);

  const isServerReady = isVisitMode || connectionStatus === 'connected';

  const handleExpandTap = useCallback(
    (x: number, y: number) => {
      if (isVisitMode || !isServerReady) return;
      clearModes();
      closeSheet();
      setExpandTarget({ x, y });
    },
    [isVisitMode, isServerReady, clearModes, closeSheet],
  );

  const handleConfirmBuyLand = useCallback(
    async (x: number, y: number, groundType: GroundTileType) => {
      const ok = await executeBuyLand(x, y, groundType);
      if (ok) {
        setExpandTarget(null);
      }
    },
    [executeBuyLand],
  );

  const handleRotateCell = useCallback(
    (x: number, y: number) => {
      if (isVisitMode || !isServerReady) return;
      const key = `${x}_${y}`;
      const rawTile = tiles[key];
      const tile = rawTile?.parentTile ? tiles[rawTile.parentTile] : rawTile;

      // Flush any pending 90ms swap so rapid taps stay deterministic
      let flushedPrev: {
        x: number;
        y: number;
        layer: 'ground' | 'item';
        rot: 0 | 1 | 2 | 3;
      } | null = null;
      if (rotateSwapTimerRef.current !== null && pendingRotRef.current) {
        window.clearTimeout(rotateSwapTimerRef.current);
        rotateSwapTimerRef.current = null;
        flushedPrev = pendingRotRef.current;
        pendingRotRef.current = null;
        void executeRotate(flushedPrev.x, flushedPrev.y, flushedPrev.layer, flushedPrev.rot);
      }

      let layer: 'ground' | 'item' | null = null;
      let kind: 'rot4' | 'flip2' = 'flip2';
      let targetX = x;
      let targetY = y;
      let targetKey = key;
      let curRot: 0 | 1 | 2 | 3 = 0;
      let itemLabel = '';

      if (tile) {
        const itemKind = getRotationKind('item', tile.itemId);
        if (itemKind !== 'none') {
          layer = 'item';
          kind = itemKind;
          targetX = tile.x;
          targetY = tile.y;
          targetKey = `${tile.x}_${tile.y}`;
          curRot =
            flushedPrev &&
            flushedPrev.layer === 'item' &&
            flushedPrev.x === targetX &&
            flushedPrev.y === targetY
              ? flushedPrev.rot
              : (((tile.rot ?? 0) % 4) as 0 | 1 | 2 | 3);
          const meta = catalog.items[tile.itemId];
          itemLabel = meta?.nameKey ? t(meta.nameKey) : tile.itemId;
        }
      }

      if (!layer) {
        const ground = land[key];
        const groundKind = ground ? getRotationKind('ground', ground) : 'none';
        if (ground && groundKind !== 'none') {
          layer = 'ground';
          kind = groundKind;
          curRot =
            flushedPrev &&
            flushedPrev.layer === 'ground' &&
            flushedPrev.x === x &&
            flushedPrev.y === y
              ? flushedPrev.rot
              : (((landRot[key] ?? 0) % 4) as 0 | 1 | 2 | 3);
          itemLabel = t(`town.land.types.${ground}`);
        }
      }

      if (!layer) {
        showToast(t('town.rotate.notRotatable'));
        return;
      }

      const mod = kind === 'rot4' ? 4 : 2;
      const nextRot = ((curRot + 1) % mod) as 0 | 1 | 2 | 3;
      rotateTickRef.current += 1;
      const tick = rotateTickRef.current;

      setRotatingTarget({ key: targetKey, layer, kind, toRot: nextRot, tick });
      setRotateAnnouncement(
        t('town.rotate.announce', {
          item: itemLabel,
          dir: t(`town.rotate.dir${nextRot}`),
        }),
      );

      if (rotateClearTimerRef.current !== null) {
        window.clearTimeout(rotateClearTimerRef.current);
      }
      rotateClearTimerRef.current = window.setTimeout(
        () => {
          setRotatingTarget((cur) => (cur && cur.tick === tick ? null : cur));
          rotateClearTimerRef.current = null;
        },
        reducedMotion ? 140 : 200,
      );

      if (reducedMotion || kind === 'flip2') {
        void executeRotate(targetX, targetY, layer, nextRot);
      } else {
        const scheduled = { x: targetX, y: targetY, layer, rot: nextRot };
        pendingRotRef.current = scheduled;
        rotateSwapTimerRef.current = window.setTimeout(() => {
          rotateSwapTimerRef.current = null;
          pendingRotRef.current = null;
          void executeRotate(scheduled.x, scheduled.y, scheduled.layer, scheduled.rot);
        }, 90);
      }
    },
    [
      isVisitMode,
      isServerReady,
      tiles,
      land,
      landRot,
      catalog,
      reducedMotion,
      executeRotate,
      showToast,
      t,
    ],
  );

  const handleTileTap = useCallback(
    async (x: number, y: number) => {
      const key = `${x}_${y}`;
      const rawTile = tiles[key];
      const tile = rawTile?.parentTile ? tiles[rawTile.parentTile] : rawTile;

      if (isVisitMode) {
        if (tile) {
          setSelectedTile(tile);
          openSheet('tile');
        }
        return;
      }

      if (!isServerReady) {
        return;
      }

      if (rotateModeActive) {
        handleRotateCell(x, y);
        return;
      }

      if (placingItemId) {
        const ok = await executeBuild(
          placingItemId,
          x,
          y,
          placingItemId === 'road' ? { rot: roadRot } : undefined,
        );
        if (ok) {
          setPlacingItemId(null);
          setRoadRot(0);
          setRoadRotateTick(0);
          setLastTownEvent({ id: Date.now(), x, y, type: 'build' });
        }
        return;
      }

      if (movingTile) {
        if (movingTile.x === x && movingTile.y === y) {
          setMovingTile(null);
          return;
        }
        const ok = await executeMove(movingTile.x, movingTile.y, x, y);
        if (ok) {
          setMovingTile(null);
          setMoveModeActive(false);
        }
        return;
      }

      if (moveModeActive) {
        if (!tile) {
          showToast(t('town.map.movingPickBanner'));
          return;
        }
        setMovingTile(tile);
        return;
      }

      if (selectedSeed) {
        if (!canPlantAt(x, y)) {
          showToast(t('town.map.plantingBanner', { crop: t(`town.crops.${selectedSeed}.name`) }));
          return;
        }
        const ok = await executePlantCrop(x, y, selectedSeed);
        if (ok) {
          setLastTownEvent({ id: Date.now(), x, y, type: 'plant' });
        }
        return;
      }

      setSelectedTile(tile ?? { x, y, itemId: 'empty' });
      openSheet('tile');
    },
    [
      tiles,
      isVisitMode,
      isServerReady,
      rotateModeActive,
      handleRotateCell,
      placingItemId,
      roadRot,
      movingTile,
      moveModeActive,
      selectedSeed,
      canPlantAt,
      executeBuild,
      executeMove,
      executePlantCrop,
      openSheet,
      showToast,
      t,
    ],
  );

  const handleHarvestComplete = useCallback(
    (x: number, y: number) => {
      void executeHarvestCrop(x, y);
    },
    [executeHarvestCrop],
  );

  const handleSpeedupTap = useCallback(
    (tile: TileInfo) => {
      if (isVisitMode || !isServerReady || !speedupEnabled) return;
      clearModes();
      closeSheet();
      setExpandTarget(null);
      setSpeedupTarget(tile);
    },
    [isVisitMode, isServerReady, speedupEnabled, clearModes, closeSheet],
  );

  const handleConfirmSpeedup = useCallback(
    async (x: number, y: number, expectedCost: number) => {
      const res = await executeSpeedup(x, y, expectedCost);
      if (res.ok) {
        setSpeedupTarget(null);
        const key = `${x}_${y}`;
        setSpeedupSparkleKey(key);
        if (speedupSparkleTimerRef.current !== null) {
          window.clearTimeout(speedupSparkleTimerRef.current);
        }
        speedupSparkleTimerRef.current = window.setTimeout(
          () => {
            setSpeedupSparkleKey((cur) => (cur === key ? null : cur));
            speedupSparkleTimerRef.current = null;
          },
          reducedMotion ? 140 : 320,
        );
      }
    },
    [executeSpeedup, reducedMotion],
  );

  if (!townEnabled) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
        <div className="border-border flex h-20 w-20 items-center justify-center rounded-3xl border-2 bg-[#C6FF3D] text-[#0E0D15] shadow-[4px_4px_0px_0px_#0E0D15]">
          <Buildings size={40} weight="fill" aria-hidden="true" />
        </div>
        <h1 className="text-ink font-display mt-6 text-2xl font-black">{t('nav.town')}</h1>
        <p className="text-muted mt-2 max-w-sm text-sm">
          RonTown is launching soon! Build your town, grow crops, and unlock rewards with your
          RonCoins.
        </p>
        <Link
          href={`/${locale}`}
          prefetch={false}
          className="border-border bg-surface text-ink hover:bg-surface-2 mt-6 inline-flex min-h-[44px] items-center rounded-xl border-2 px-6 text-sm font-black shadow-[2px_2px_0px_0px_#0E0D15]"
        >
          {t('play.backToHome')}
        </Link>
      </div>
    );
  }

  const skeletonTileSrc = GROUND_SPRITES['basic-block'].src;
  const skipFade = hydratedFromCache || reducedMotion;

  return (
    <main className="relative flex h-full w-full flex-col overflow-hidden overscroll-none bg-[#132013]">
      {/* 1. TOP BAR: Split Court chrome matching sample-map.png */}
      <div className="relative z-10 flex shrink-0 items-center justify-between gap-2 border-b-2 border-[#0E0D15] bg-[#14131E] px-3 py-2 text-[#FFF7EC]">
        {isVisitMode ? (
          <>
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href={`/${locale}/town`}
                prefetch={false}
                aria-label={t('play.backToHome')}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-xl border-2 border-[#0E0D15] bg-[#FFF7EC] px-2.5 text-xs font-black text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15]"
              >
                <CaretLeft size={16} weight="bold" aria-hidden="true" />
                <span className="hidden sm:inline">{t('nav.town')}</span>
              </Link>
              <div className="min-w-0">
                <h1 className="font-display truncate text-sm font-black text-[#FFF7EC]">
                  {t('town.visit.title', { name: hostInfo?.displayName || 'Friend' })}
                </h1>
                <p className="truncate text-[11px] font-semibold text-[#FFF7EC]/75">
                  {t('town.visit.readOnlyNotice')}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-lg border-2 border-[#0E0D15] bg-[#C6FF3D] px-2 py-1 font-mono text-xs font-black text-[#0E0D15]">
                {townReady ? t('town.chips.level', { level }) : '—'}
              </span>
              <button
                type="button"
                onClick={() => void executeLike()}
                disabled={likeLoading || hostInfo?.hasLiked}
                aria-label={
                  hostInfo?.hasLiked
                    ? t('town.visit.liked', { count: hostInfo.likesCount })
                    : t('town.visit.like')
                }
                className={`flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border-2 border-[#0E0D15] px-3 text-xs font-black shadow-[2px_2px_0px_0px_#0E0D15] ${
                  hostInfo?.hasLiked
                    ? 'bg-[#FF5A4E] text-white'
                    : 'bg-[#FFF7EC] text-[#0E0D15] hover:bg-[#FFF7EC]/90'
                }`}
              >
                <Heart size={16} weight={hostInfo?.hasLiked ? 'fill' : 'bold'} aria-hidden="true" />
                <span>
                  {hostInfo?.hasLiked
                    ? t('town.visit.liked', { count: hostInfo.likesCount })
                    : t('town.visit.like')}
                </span>
              </button>

              {coinsTransferEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    if (visitHostUid) {
                      setTransferRecipient(visitHostUid);
                      openSheet('transfer');
                    }
                  }}
                  aria-label={t('town.transfer.title')}
                  className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full border-2 border-[#0E0D15] bg-[#FFF7EC] px-2.5 text-xs font-black text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15]"
                >
                  <Gift size={16} weight="bold" aria-hidden="true" />
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="font-display text-base font-black tracking-tight text-[#FFF7EC]">
                RonTown
              </h1>
              <span className="whitespace-nowrap rounded-lg border-2 border-[#0E0D15] bg-[#C6FF3D] px-2 py-0.5 font-mono text-[11px] font-black text-[#0E0D15] shadow-[1px_1px_0px_0px_#0E0D15]">
                {townReady ? t('town.chips.level', { level }) : '—'}
              </span>
              <button
                type="button"
                onClick={() => openSheet('stats')}
                aria-label={`${t('town.toolbar.stats')}: ${
                  townReady ? t('town.chips.population', { population, cap: populationCap }) : '—'
                }`}
                title={growthBottleneck ?? t('town.growth.maxCapacity')}
                className="focus-visible:outline-3 flex min-h-[44px] cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border-2 border-[#0E0D15] bg-[#FFF7EC] px-2.5 text-xs font-black text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15] focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF]"
              >
                <Users size={14} weight="fill" aria-hidden="true" />
                <span className="font-mono tabular-nums">
                  {townReady ? t('town.chips.population', { population, cap: populationCap }) : '—'}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openSheet(coinsPurchaseEnabled ? 'coins' : 'orders')}
                aria-label={
                  townReady
                    ? t('town.chips.coins', { count: walletBalance })
                    : t('town.map.loading')
                }
                className="focus-visible:outline-3 flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border-2 border-[#0E0D15] bg-[#FFF7EC] px-3 shadow-[2px_2px_0px_0px_#0E0D15] focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF]"
              >
                <RonCoinIcon size={24} />
                <span
                  data-testid="town-wallet-balance"
                  className="font-mono text-sm font-black tabular-nums text-[#0E0D15]"
                >
                  {townReady ? displayedWalletBalance : '—'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => openSheet('menu')}
                aria-label={t('town.toolbar.more')}
                title={t('town.toolbar.more')}
                className="focus-visible:outline-3 flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl border-2 border-[#0E0D15] bg-[#FFF7EC] text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15] focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF]"
              >
                <List size={20} weight="bold" aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Action toast banner */}
      {actionMessage && (
        <div
          role="alert"
          className="relative z-20 border-b-2 border-[#0E0D15] bg-[#FF5A4E] px-3 py-1.5 text-center text-xs font-black text-white"
        >
          {actionMessage}
        </div>
      )}

      {/* Active mode banners (Place / Move / Rotate / Plant) */}
      {(placingItemId || moveModeActive || movingTile || rotateModeActive || selectedSeed) && (
        <div className="relative z-20 flex items-center justify-between gap-2 border-b-2 border-[#0E0D15] bg-[#C6FF3D] px-3 py-1.5 text-xs font-black text-[#0E0D15]">
          <span className="truncate">
            {placingItemId &&
              t('town.map.placingBanner', {
                item: catalog.items[placingItemId]?.nameKey
                  ? t(catalog.items[placingItemId]!.nameKey)
                  : placingItemId,
              })}
            {!placingItemId &&
              movingTile &&
              t('town.map.movingDestBanner', { x: movingTile.x, y: movingTile.y })}
            {!placingItemId && !movingTile && moveModeActive && t('town.map.movingPickBanner')}
            {!placingItemId &&
              !movingTile &&
              !moveModeActive &&
              rotateModeActive &&
              t('town.map.rotatingBanner')}
            {!placingItemId &&
              !movingTile &&
              !moveModeActive &&
              !rotateModeActive &&
              selectedSeed &&
              t('town.map.plantingBanner', { crop: t(`town.crops.${selectedSeed}.name`) })}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {placingItemId === 'road' && (
              <button
                type="button"
                data-testid="road-rotate-btn"
                onClick={toggleRoadRot}
                aria-label={t('town.road.rotateAria')}
                aria-pressed={roadRot === 1}
                title={t('town.road.rotateAria')}
                className={`focus-visible:outline-3 flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full border-2 border-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15] focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF] ${
                  roadRot === 1 ? 'bg-[#0E0D15] text-[#C6FF3D]' : 'bg-[#FFF7EC] text-[#0E0D15]'
                }`}
              >
                <ArrowsClockwise size={20} weight="bold" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={clearModes}
              className="min-h-[36px] shrink-0 cursor-pointer rounded-lg border-2 border-[#0E0D15] bg-[#FFF7EC] px-2.5 text-xs font-black text-[#0E0D15]"
            >
              {t('town.map.cancel')}
            </button>
          </div>
          {placingItemId === 'road' && (
            <div role="status" aria-live="polite" data-testid="road-axis-live" className="sr-only">
              {roadRotateTick > 0
                ? roadRot === 1
                  ? t('town.road.axisEw')
                  : t('town.road.axisNs')
                : ''}
            </div>
          )}
          {rotateModeActive && (
            <div role="status" aria-live="polite" data-testid="rotate-live" className="sr-only">
              {rotateAnnouncement}
            </div>
          )}
        </div>
      )}

      {/* 2. ISOMETRIC PIXEL-ART MAP VIEWPORT */}
      <div className="relative isolate z-0 flex min-h-0 flex-1 flex-col">
        {/* Connection status overlay while syncing/retrying /api/town/init (absolute to avoid CLS) */}
        {!isVisitMode && connectionStatus !== 'connected' && (
          <div
            role="status"
            aria-live="polite"
            data-testid="town-connection-status"
            className="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-2 border-b-2 border-[#0E0D15] bg-[#FFF7EC] px-3 py-1.5 text-xs font-extrabold text-[#16131F]"
          >
            <span
              aria-hidden="true"
              className={`inline-block h-2 w-2 rounded-full border border-[#16131F] ${
                connectionStatus === 'connecting'
                  ? 'animate-pulse bg-[#C6FF3D] motion-reduce:animate-none'
                  : 'bg-[#FFC53D]'
              }`}
            />
            <span>
              {connectionStatus === 'connecting'
                ? t('town.status.connecting')
                : t('town.status.reconnectingFailed')}
            </span>
            {connectionStatus === 'offline' && (
              <button
                type="button"
                onClick={retryInit}
                className="min-h-[30px] cursor-pointer rounded-lg border-2 border-[#16131F] bg-[#C6FF3D] px-2.5 text-xs font-black text-[#16131F] shadow-[1px_1px_0px_0px_#16131F]"
              >
                {t('town.status.retry')}
              </button>
            )}
          </div>
        )}

        {!townReady ? (
          <div
            data-testid="town-skeleton"
            role="status"
            aria-label={t('town.map.loading')}
            className="rt-skeleton-pulse flex h-full w-full flex-1 items-center justify-center"
          >
            <div
              aria-hidden="true"
              className="relative"
              style={{
                width: 384,
                height: 204,
                transform: 'scale(0.75)',
                transformOrigin: 'center center',
              }}
            >
              {SKELETON_CELLS.map((cell) => {
                const pos = isoToScreen(cell.x, cell.y);
                return (
                  <img
                    key={`skel-${cell.x}-${cell.y}`}
                    src={skeletonTileSrc}
                    alt=""
                    width={TILE_W}
                    height={TILE_H}
                    draggable={false}
                    className="pointer-events-none absolute select-none"
                    style={{
                      left: pos.x + 128,
                      top: pos.y,
                      width: TILE_W,
                      height: TILE_H,
                      zIndex: (cell.x + cell.y) * 2,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div
            data-testid="town-map-wrapper"
            className={
              skipFade
                ? 'relative flex h-full min-h-0 w-full flex-1 flex-col'
                : 'rt-map-fade-in relative flex h-full min-h-0 w-full flex-1 flex-col'
            }
            style={{ opacity: skipFade || mapRevealed ? 1 : 0 }}
          >
            {!isVisitMode &&
              isServerReady &&
              tutorialStep >= 3 &&
              !placingItemId &&
              !moveModeActive &&
              !movingTile &&
              !rotateModeActive &&
              !selectedSeed && (
                <p className="pointer-events-none absolute inset-x-4 top-2.5 z-10 mx-auto max-w-xs text-center text-xs font-semibold leading-snug text-[#FFF7EC]/80">
                  {t('town.map.helpBody')}
                </p>
              )}
            <IsoMap
              land={land}
              landRot={landRot}
              tiles={tiles}
              expandRing={isServerReady ? expandRing : []}
              blockedKeys={blockedKeys}
              catalog={catalog}
              population={population}
              isVisitMode={isVisitMode}
              placingItemId={placingItemId}
              moveModeActive={moveModeActive}
              rotateModeActive={rotateModeActive}
              rotatingTarget={rotatingTarget}
              movingTile={movingTile}
              selectedSeed={selectedSeed}
              floatingRewards={floatingRewards}
              speedupEnabled={speedupEnabled}
              speedupSparkleKey={speedupSparkleKey}
              canPlaceAt={canPlaceAt}
              canPlantAt={canPlantAt}
              onTileTap={(x, y) => void handleTileTap(x, y)}
              onRotateCell={handleRotateCell}
              onExpandTap={handleExpandTap}
              onHarvestComplete={handleHarvestComplete}
              onSpeedupTap={handleSpeedupTap}
              lastTownEvent={lastTownEvent}
              placingRoadRot={roadRot}
              roadRotateTick={roadRotateTick}
            />
          </div>
        )}
      </div>

      {/* 3. RIGHT VERTICAL PIXEL-ART ACTION BAR */}
      {!isVisitMode && isServerReady && (
        <ActionBar
          visible={toolbarVisible}
          onToggleVisible={toggleToolbar}
          moveModeActive={moveModeActive || Boolean(movingTile)}
          rotateModeActive={rotateModeActive}
          farmMenuOpen={farmMenuOpen}
          selectedSeed={selectedSeed}
          maxLevel={maxLevel}
          onOpenBuild={() => {
            clearModes();
            setShopTab('housing');
            openSheet('shop');
          }}
          onToggleMoveMode={() => {
            const next = !(moveModeActive || Boolean(movingTile));
            clearModes();
            setMoveModeActive(next);
          }}
          onToggleRotateMode={() => {
            const next = !rotateModeActive;
            clearModes();
            setRotateModeActive(next);
          }}
          onToggleFarmMenu={() => {
            setPlacingItemId(null);
            setMoveModeActive(false);
            setMovingTile(null);
            setRotateModeActive(false);
            setFarmMenuOpen((prev) => {
              const next = !prev;
              if (!next) setSelectedSeed(null);
              return next;
            });
          }}
          onSelectSeed={(seed) => {
            setPlacingItemId(null);
            setMoveModeActive(false);
            setMovingTile(null);
            setRotateModeActive(false);
            setSelectedSeed((prev) => (prev === seed ? null : seed));
          }}
          onOpenVisit={() => {
            clearModes();
            openSheet('visit');
          }}
          onOpenShop={() => {
            clearModes();
            openSheet(coinsPurchaseEnabled ? 'coins' : 'shop');
          }}
        />
      )}

      {/* 4. TUTORIAL PIXEL-ART SPEECH BUBBLE */}
      {!isVisitMode &&
        isServerReady &&
        !tutorialDone &&
        tutorialStep < 3 &&
        !activeSheet &&
        !expandTarget && (
          <div
            data-testid="town-tutorial-card"
            className="rt-pixel-bubble rt-pixel-bubble--tail absolute start-3 top-16 z-20 max-w-[260px] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="border-2 border-[#0E0D15] bg-[#C6FF3D] px-1.5 py-0.5 font-mono text-[10px] font-black text-[#0E0D15]">
                {tutorialStep + 1}/3
              </span>
              <button
                type="button"
                onClick={skipTutorial}
                className="min-h-[32px] cursor-pointer px-1 font-mono text-xs font-bold text-[#0E0D15]/70 hover:text-[#0E0D15]"
              >
                {t('town.tutorial.skip')}
              </button>
            </div>
            <h2 className="mt-1.5 font-mono text-sm font-black text-[#0E0D15]">
              {tutorialStep === 0 && t('town.tutorial.step1Title')}
              {tutorialStep === 1 && t('town.tutorial.step2Title')}
              {tutorialStep === 2 && t('town.tutorial.step3Title')}
            </h2>
            <p className="mt-1 font-mono text-xs leading-snug text-[#0E0D15]/80">
              {tutorialStep === 0 && t('town.tutorial.step1Desc')}
              {tutorialStep === 1 && t('town.tutorial.step2Desc')}
              {tutorialStep === 2 && t('town.tutorial.step3Desc')}
            </p>
            <div className="mt-2.5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (tutorialStep === 1) {
                    setShopTab('housing');
                    openSheet('shop');
                  } else if (tutorialStep === 2) {
                    openSheet('orders');
                  }
                  advanceTutorial(tutorialStep + 1);
                }}
                className="min-h-[36px] cursor-pointer border-2 border-[#0E0D15] bg-[#C6FF3D] px-3.5 font-mono text-xs font-black text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15]"
              >
                {tutorialStep === 2 ? t('town.tutorial.finish') : t('town.tutorial.next')}
              </button>
            </div>
          </div>
        )}

      {/* 5. BUY LAND BOTTOM SHEET (lazy-loaded on demand) */}
      {expandTarget && (
        <BuyLandSheet
          targetCell={expandTarget}
          walletBalance={walletBalance}
          purchasing={landPurchasing}
          onConfirm={handleConfirmBuyLand}
          onClose={() => setExpandTarget(null)}
        />
      )}

      {/* 5b. HARVEST SPEED-UP CONFIRM SHEET (gated behind speedupEnabled) */}
      {speedupTarget && (
        <SpeedupConfirmSheet
          tile={speedupTarget}
          catalog={catalog}
          walletBalance={walletBalance}
          loading={speedupLoading}
          onConfirm={(x, y, expectedCost) => void handleConfirmSpeedup(x, y, expectedCost)}
          onClose={() => setSpeedupTarget(null)}
        />
      )}

      {/* 6. TOWN SHEETS (lazy-loaded on demand) */}
      {activeSheet && (
        <TownSheets
          activeSheet={activeSheet}
          locale={locale}
          isVisitMode={isVisitMode}
          coinsPurchaseEnabled={coinsPurchaseEnabled}
          coinsTransferEnabled={coinsTransferEnabled}
          townHelpEnabled={townHelpEnabled}
          town={town}
          landCount={Object.keys(land).length}
          catalog={catalog}
          catalogList={catalogList}
          cropItems={cropItems}
          shopTab={shopTab}
          setShopTab={setShopTab}
          selectedTile={selectedTile}
          walletBalance={walletBalance}
          inventory={inventory}
          orders={orders}
          ordersUnlocked={ordersUnlocked}
          growthBottleneck={growthBottleneck}
          transferStatus={transferStatus}
          transferRecipient={transferRecipient}
          setTransferRecipient={setTransferRecipient}
          transferAmount={transferAmount}
          setTransferAmount={setTransferAmount}
          transferLoading={transferLoading}
          waterLoading={waterLoading}
          openSheet={openSheet}
          closeSheet={closeSheet}
          onStartPlace={(itemId) => {
            setPlacingItemId(itemId);
            closeSheet();
          }}
          onStartMove={(tile) => {
            setMovingTile(tile);
            setMoveModeActive(true);
            closeSheet();
          }}
          onBuyPlot={executeBuyPlot}
          onPlantCrop={executePlantCrop}
          onHarvestCrop={executeHarvestCrop}
          onRemoveTile={executeRemove}
          onDeliverOrder={executeDeliverOrder}
          onWaterCrop={executeWaterCrop}
          onCoinCheckout={executeCoinCheckout}
          onTransfer={executeTransfer}
        />
      )}
    </main>
  );
}
