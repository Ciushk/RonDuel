'use client';

import {
  ArrowsOutCardinal,
  Backpack,
  Buildings,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Coins,
  Compass,
  Hammer,
  Plant,
  Question,
  Scroll,
  Sparkle,
  Storefront,
  Trash,
  Users,
  Heart,
  Gift,
  X,
} from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { trackEvent } from '@/lib/analytics';
import { useFeatureFlag } from '@/lib/feature-flags';
import { getLocalSession } from '@/lib/session';
import {
  DEFAULT_TOWN_CATALOG,
  getGridSizeForLevel,
  getPlotPrice,
  type CatalogItem,
  type TownCatalogDoc,
  type TownDoc,
  type TownOrderItem,
  type TownOrdersDoc,
  type TownTileDoc,
} from '@ronduel/shared';

type ActiveSheet =
  | 'build'
  | 'shop'
  | 'orders'
  | 'inventory'
  | 'stats'
  | 'visit'
  | 'coins'
  | 'transfer'
  | 'help'
  | 'tile'
  | null;

interface TileInfo extends TownTileDoc {
  x: number;
  y: number;
  parentTile?: string;
}

function TownContent() {
  const t = useTranslations();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const visitHostUid = searchParams.get('visit');
  const isVisitMode = Boolean(visitHostUid);

  const townEnabled = useFeatureFlag('town_enabled');
  const coinsPurchaseEnabled = useFeatureFlag('coins_purchase_enabled');
  const coinsTransferEnabled = useFeatureFlag('coins_transfer_enabled');
  const townHelpEnabled = useFeatureFlag('town_help_enabled');

  const [loading, setLoading] = useState(true);
  const [hostInfo, setHostInfo] = useState<{
    displayName: string;
    likesCount: number;
    hasLiked: boolean;
  } | null>(null);
  const [likeLoading, setLikeLoading] = useState(false);
  const [transferRecipient, setTransferRecipient] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<number>(10);
  const [transferStatus, setTransferStatus] = useState<{
    isPro: boolean;
    triviaBalance: number;
    dailyRemaining: number;
    dailyCap: number;
  } | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [waterLoading, setWaterLoading] = useState(false);
  const [town, setTown] = useState<TownDoc | null>(null);
  const [tiles, setTiles] = useState<Record<string, TileInfo>>({});
  const [walletBalance, setWalletBalance] = useState<number>(100);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [selectedTile, setSelectedTile] = useState<TileInfo | null>(null);
  const [tutorialStep, setTutorialStep] = useState<number>(0);
  const [toolbarVisible, setToolbarVisible] = useState<boolean>(true);

  // Shop & Farm State
  const [catalog] = useState<TownCatalogDoc>(DEFAULT_TOWN_CATALOG);
  const [shopTab, setShopTab] = useState<'housing' | 'service' | 'plot' | 'decor'>('housing');
  const [placingItemId, setPlacingItemId] = useState<string | null>(null);
  const [movingTile, setMovingTile] = useState<TileInfo | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Inventory & Orders
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<TownOrderItem[]>([]);
  const [ordersUnlocked, setOrdersUnlocked] = useState<boolean>(true);

  // Map viewport pan state
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Load toolbar preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rt_toolbar_visible');
      if (saved !== null) {
        setToolbarVisible(saved === 'true');
      }
    } catch {
      // Ignore
    }
  }, []);

  const toggleToolbar = () => {
    setToolbarVisible((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('rt_toolbar_visible', String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  // Initialize town on mount
  useEffect(() => {
    if (!townEnabled) {
      setLoading(false);
      return;
    }

    let active = true;
    const session = getLocalSession();
    if (!session?.uid || session.uid === 'u_ssr' || session.uid === 'anon') {
      setLoading(false);
      return;
    }

    if (isVisitMode && visitHostUid) {
      fetch(
        `/api/town/visit?hostUid=${encodeURIComponent(visitHostUid)}&viewerUid=${encodeURIComponent(session.uid)}`,
      )
        .then((res) => {
          if (!res.ok) throw new Error('Visit fetch failed');
          return res.json();
        })
        .then((data) => {
          if (!active) return;
          const snap = data.snapshot;
          setHostInfo({
            displayName: snap.displayName,
            likesCount: snap.likesCount ?? 0,
            hasLiked: Boolean(data.hasLiked),
          });
          const snapGridSize = getGridSizeForLevel(snap.level ?? 1);
          setTown({
            gridSize: snapGridSize,
            population: snap.population ?? 2,
            housingCapacity: snap.population ?? 2,
            serviceCapacity: 4,
            populationCap: snap.population ?? 2,
            level: snap.level ?? 1,
            maxLevelReached: snap.level ?? 1,
            tutorialStep: 3,
            likesCount: snap.likesCount ?? 0,
            plotsOwned: 2,
          });
          const visitTiles: Record<string, TileInfo> = {};
          if (Array.isArray(snap.tiles)) {
            for (const t of snap.tiles) {
              visitTiles[`${t.x}_${t.y}`] = {
                x: t.x,
                y: t.y,
                itemId: t.itemId,
                cropId: t.cropId,
                readyAt: t.ready ? 1 : undefined,
              };
            }
          }
          setTiles(visitTiles);
          setLoading(false);
        })
        .catch(() => {
          if (!active) return;
          setActionMessage('Could not load friend town');
          setLoading(false);
        });
      return () => {
        active = false;
      };
    }

    fetch(`/api/town/init?uid=${encodeURIComponent(session.uid)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Init failed');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        if (data.town) {
          setTown(data.town);
          setTutorialStep(data.town.tutorialStep ?? 0);
        }
        // Initialize starter tiles
        const initialTiles: Record<string, TileInfo> = {
          '3_3': { x: 3, y: 3, itemId: 'starter_house' },
          '3_4': { x: 3, y: 4, itemId: 'plot' },
          '4_4': { x: 4, y: 4, itemId: 'plot' },
        };
        setTiles(initialTiles);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setTown({
          gridSize: 8,
          population: 2,
          housingCapacity: 2,
          serviceCapacity: 4,
          populationCap: 2,
          level: 1,
          maxLevelReached: 1,
          tutorialStep: 0,
          likesCount: 0,
          plotsOwned: 2,
        });
        setTiles({
          '3_3': { x: 3, y: 3, itemId: 'starter_house' },
          '3_4': { x: 3, y: 4, itemId: 'plot' },
          '4_4': { x: 4, y: 4, itemId: 'plot' },
        });
        setLoading(false);
      });

    // Fetch initial inventory
    fetch(`/api/town/inventory?uid=${encodeURIComponent(session.uid)}`)
      .then((r) => r.json())
      .then((d) => {
        if (active && d?.crops) setInventory(d.crops);
      })
      .catch(() => {});

    // Fetch daily orders
    fetch(`/api/town/orders?uid=${encodeURIComponent(session.uid)}`)
      .then((r) => r.json())
      .then((d) => {
        if (active && d?.orders) {
          setOrders(d.orders);
          setOrdersUnlocked(Boolean(d.unlocked));
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [townEnabled, isVisitMode, visitHostUid]);

  const executeLike = async () => {
    if (!visitHostUid || likeLoading || hostInfo?.hasLiked) return;
    const session = getLocalSession();
    if (!session?.uid) return;
    setLikeLoading(true);
    try {
      const res = await fetch('/api/town/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostUid: visitHostUid, viewerUid: session.uid }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setHostInfo((prev) =>
          prev
            ? { ...prev, hasLiked: true, likesCount: data.likesCount ?? prev.likesCount + 1 }
            : null,
        );
      } else {
        setActionMessage(data.error || 'Failed to like town');
        setTimeout(() => setActionMessage(null), 2500);
      }
    } catch {
      // Ignore
    } finally {
      setLikeLoading(false);
    }
  };

  const executeWaterCrop = async (x: number, y: number) => {
    if (!visitHostUid || waterLoading) return;
    const session = getLocalSession();
    if (!session?.uid) return;
    setWaterLoading(true);
    try {
      const res = await fetch('/api/town/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          helperUid: session.uid,
          hostUid: visitHostUid,
          tileX: x,
          tileY: y,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionMessage(t('town.visit.water') + ' ✓ (-30m)');
        setTimeout(() => setActionMessage(null), 2500);
        closeSheet();
      } else {
        setActionMessage(data.error || 'Failed to water crop');
        setTimeout(() => setActionMessage(null), 2500);
      }
    } catch {
      setActionMessage('Failed to water crop');
      setTimeout(() => setActionMessage(null), 2500);
    } finally {
      setWaterLoading(false);
    }
  };

  const gridSize = town?.gridSize ?? 8;
  const population = town?.population ?? 2;
  const populationCap = town?.populationCap ?? 2;
  const housingCapacity = town?.housingCapacity ?? 2;
  const serviceCapacity = town?.serviceCapacity ?? 4;
  const level = town?.level ?? 1;
  const maxLevel = town?.maxLevelReached ?? 1;

  // Determine why not growing
  const growthBottleneck = useMemo(() => {
    if (population < populationCap) return null;
    if (housingCapacity <= serviceCapacity) {
      return t('town.growth.limitedByHousing');
    }
    return t('town.growth.limitedByServices');
  }, [population, populationCap, housingCapacity, serviceCapacity, t]);

  // Cosmetic villagers sprites positions
  const villagerSprites = useMemo(() => {
    const count = Math.min(population, 20);
    const sprites: Array<{ id: number; emoji: string; x: number; y: number }> = [];
    const emojis = ['🧑‍🌾', '👩‍🌾', '🚶', '🏃', '🧍', '🧓'];
    for (let i = 0; i < count; i++) {
      const vx = (i * 3 + 1) % gridSize;
      const vy = (i * 2 + 2) % gridSize;
      sprites.push({
        id: i,
        emoji: emojis[i % emojis.length]!,
        x: vx,
        y: vy,
      });
    }
    return sprites;
  }, [population, gridSize]);

  // Handle tile click
  const handleTileClick = async (x: number, y: number) => {
    const key = `${x}_${y}`;
    const tile = tiles[key];

    if (isVisitMode) {
      if (tile) {
        setSelectedTile(tile);
        setActiveSheet('tile');
      }
      return;
    }

    // If placing item from shop/build
    if (placingItemId) {
      if (tile) {
        setActionMessage(t('town.tiles.occupied') || 'Tile already occupied!');
        setTimeout(() => setActionMessage(null), 2500);
        return;
      }
      await executeBuild(placingItemId, x, y);
      setPlacingItemId(null);
      return;
    }

    // If moving existing tile
    if (movingTile) {
      if (tile) {
        setActionMessage('Destination tile is occupied');
        setTimeout(() => setActionMessage(null), 2500);
        return;
      }
      await executeMove(movingTile.x, movingTile.y, x, y);
      setMovingTile(null);
      return;
    }

    // Select tile and open action sheet
    setSelectedTile(tile ?? { x, y, itemId: 'empty' });
    setActiveSheet('tile');
  };

  // Build execution
  const executeBuild = async (itemId: string, x: number, y: number) => {
    const session = getLocalSession();
    try {
      const res = await fetch('/api/town/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: session.uid, itemId, x, y }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage(data.error || 'Build failed');
        setTimeout(() => setActionMessage(null), 2500);
        return;
      }
      const item = catalog.items[itemId];
      setTiles((prev) => ({
        ...prev,
        [`${x}_${y}`]: { x, y, itemId },
      }));
      if (item && item.priceCoins > 0) {
        setWalletBalance((prev) => Math.max(0, prev - item.priceCoins));
      }
      if (data.town) {
        setTown(data.town);
      }
      trackEvent('nav_tab_clicked', { action: 'town_build', itemId });
    } catch {
      const item = catalog.items[itemId];
      setTiles((prev) => ({
        ...prev,
        [`${x}_${y}`]: { x, y, itemId },
      }));
      if (item && item.priceCoins > 0) {
        setWalletBalance((prev) => Math.max(0, prev - item.priceCoins));
      }
    }
  };

  // Move execution
  const executeMove = async (fromX: number, fromY: number, toX: number, toY: number) => {
    const session = getLocalSession();
    try {
      const res = await fetch('/api/town/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: session.uid, fromX, fromY, toX, toY }),
      });
      if (!res.ok) {
        const err = await res.json();
        setActionMessage(err.error || 'Move failed');
        setTimeout(() => setActionMessage(null), 2500);
        return;
      }
    } catch {
      // fallback
    }
    const fromKey = `${fromX}_${fromY}`;
    const toKey = `${toX}_${toY}`;
    setTiles((prev) => {
      const next = { ...prev };
      const current = next[fromKey];
      if (current) {
        delete next[fromKey];
        next[toKey] = { ...current, x: toX, y: toY };
      }
      return next;
    });
  };

  // Remove execution
  const executeRemove = async (x: number, y: number) => {
    const key = `${x}_${y}`;
    const tile = tiles[key];
    if (!tile || tile.itemId === 'starter_house') return;

    const session = getLocalSession();
    try {
      const res = await fetch('/api/town/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: session.uid, x, y }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage(data.error || 'Remove failed');
        setTimeout(() => setActionMessage(null), 2500);
        return;
      }
      if (data.refundCoins) {
        setWalletBalance((prev) => prev + data.refundCoins);
      }
    } catch {
      const item = catalog.items[tile.itemId];
      if (item) {
        setWalletBalance((prev) => prev + Math.floor(item.priceCoins * 0.5));
      }
    }

    setTiles((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    closeSheet();
  };

  // Plant Crop execution
  const executePlantCrop = async (x: number, y: number, cropId: string) => {
    const session = getLocalSession();
    const cropItem = catalog.items[cropId];
    if (!cropItem) return;

    try {
      const res = await fetch('/api/town/plant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: session.uid, x, y, cropId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage(data.error || 'Planting failed');
        setTimeout(() => setActionMessage(null), 2500);
        return;
      }
      if (cropItem.priceCoins > 0) {
        setWalletBalance((prev) => Math.max(0, prev - cropItem.priceCoins));
      }
      setTiles((prev) => ({
        ...prev,
        [`${x}_${y}`]: {
          ...prev[`${x}_${y}`]!,
          cropId,
          plantedAt: new Date().toISOString(),
          readyAt: new Date(Date.now() + (cropItem.growTimeSeconds ?? 14400) * 1000).toISOString(),
        },
      }));
      closeSheet();
    } catch {
      // preview fallback
      setTiles((prev) => ({
        ...prev,
        [`${x}_${y}`]: {
          ...prev[`${x}_${y}`]!,
          cropId,
        },
      }));
      closeSheet();
    }
  };

  // Harvest Crop execution
  const executeHarvestCrop = async (x: number, y: number) => {
    const session = getLocalSession();
    const key = `${x}_${y}`;
    const tile = tiles[key];
    if (!tile?.cropId) return;

    try {
      const res = await fetch('/api/town/harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: session.uid, x, y }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage(data.error || 'Harvest failed');
        setTimeout(() => setActionMessage(null), 2500);
        return;
      }
      // Add yield to inventory
      setInventory((prev) => ({
        ...prev,
        [tile.cropId!]: (prev[tile.cropId!] || 0) + (data.yieldCount ?? 2),
      }));
      // Reset plot
      setTiles((prev) => ({
        ...prev,
        [key]: { x, y, itemId: 'plot' },
      }));
      closeSheet();
    } catch {
      // preview fallback
      setInventory((prev) => ({
        ...prev,
        [tile.cropId!]: (prev[tile.cropId!] || 0) + 2,
      }));
      setTiles((prev) => ({
        ...prev,
        [key]: { x, y, itemId: 'plot' },
      }));
      closeSheet();
    }
  };

  // Deliver Daily Order execution
  const executeDeliverOrder = async (orderId: string) => {
    const session = getLocalSession();
    try {
      const res = await fetch('/api/town/deliver-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: session.uid, orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage(data.error || 'Delivery failed');
        setTimeout(() => setActionMessage(null), 2500);
        return;
      }
      if (data.rewardCoins) {
        setWalletBalance((prev) => prev + data.rewardCoins);
      }
      // Mark order done locally
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, done: true } : o)));
      // Re-fetch inventory
      fetch(`/api/town/inventory?uid=${encodeURIComponent(session.uid)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d?.crops) setInventory(d.crops);
        })
        .catch(() => {});
    } catch {
      // preview
    }
  };

  // Buy farm plot
  const executeBuyPlot = async (x: number, y: number) => {
    const session = getLocalSession();
    try {
      const res = await fetch('/api/town/buy-plot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: session.uid, x, y }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage(data.error || 'Failed to buy plot');
        setTimeout(() => setActionMessage(null), 2500);
        return;
      }
      if (data.cost) {
        setWalletBalance((prev) => Math.max(0, prev - data.cost));
      }
      if (town) {
        setTown({ ...town, plotsOwned: data.plotsOwned });
      }
    } catch {
      // preview
    }
    setTiles((prev) => ({
      ...prev,
      [`${x}_${y}`]: { x, y, itemId: 'plot' },
    }));
    closeSheet();
  };

  // Coin pack checkout
  const executeCoinCheckout = async (packId: string) => {
    const session = getLocalSession();
    if (!session?.uid || session.uid === 'anon' || session.uid === 'u_ssr') {
      setActionMessage('Please sign in or link your account before purchasing coins');
      setTimeout(() => setActionMessage(null), 2500);
      return;
    }
    try {
      const res = await fetch('/api/town/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: session.uid,
          packId,
          simulateImmediately: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage(data.error || 'Checkout failed');
        setTimeout(() => setActionMessage(null), 2500);
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch {
      setActionMessage('Checkout request failed');
      setTimeout(() => setActionMessage(null), 2500);
    }
  };

  const loadTransferStatus = async () => {
    const session = getLocalSession();
    if (!session?.uid) return;
    try {
      const res = await fetch(`/api/town/transfer-status?uid=${encodeURIComponent(session.uid)}`);
      const data = await res.json();
      if (res.ok) setTransferStatus(data);
    } catch {
      // Ignore
    }
  };

  const executeTransfer = async () => {
    const session = getLocalSession();
    if (!session?.uid || !transferRecipient || transferAmount <= 0) return;
    setTransferLoading(true);
    try {
      const res = await fetch('/api/town/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderUid: session.uid,
          receiverUid: transferRecipient,
          amount: transferAmount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage(data.error || 'Transfer failed');
        setTimeout(() => setActionMessage(null), 2500);
        return;
      }
      if (data.senderBalanceAfter !== undefined) {
        setWalletBalance(data.senderBalanceAfter);
      }
      setActionMessage(`Transferred ${transferAmount} RonCoins!`);
      setTimeout(() => setActionMessage(null), 2500);
      closeSheet();
    } catch {
      setActionMessage('Transfer failed');
      setTimeout(() => setActionMessage(null), 2500);
    } finally {
      setTransferLoading(false);
    }
  };

  const openSheet = (sheet: ActiveSheet) => {
    if (sheet === 'transfer') {
      void loadTransferStatus();
    }
    setActiveSheet(sheet);
  };

  const closeSheet = () => {
    setActiveSheet(null);
    setSelectedTile(null);
  };

  // Filtered shop items
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

  if (!townEnabled) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
        <div className="border-border flex h-20 w-20 items-center justify-center rounded-3xl border-2 bg-[#C6FF3D] text-[#0E0D15] shadow-[4px_4px_0px_0px_#16131F]">
          <Buildings size={40} weight="fill" />
        </div>
        <h1 className="text-ink mt-6 text-2xl font-black">{t('nav.town')}</h1>
        <p className="text-muted mt-2 max-w-sm text-sm">
          RonTown is launching soon! Build your town, grow crops, and unlock rewards with your
          RonCoins.
        </p>
        <Link
          href={`/${locale}`}
          className="border-border bg-surface text-ink hover:bg-surface-2 mt-6 inline-flex min-h-[44px] items-center rounded-xl border-2 px-6 text-sm font-black shadow-[2px_2px_0px_0px_#16131F]"
        >
          {t('play.backToHome')}
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="border-volt h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden bg-[#F6F5EE] dark:bg-[#121118]">
      {/* 1. TOP HEADER: Status Chips or Visit Mode Bar */}
      <header className="border-border bg-surface/90 relative z-10 flex shrink-0 items-center justify-between border-b-2 px-3 py-2 backdrop-blur-md">
        {isVisitMode ? (
          <>
            <div className="flex items-center gap-2">
              <Link
                href={`/${locale}/town`}
                className="border-border bg-surface-2 text-ink hover:bg-surface flex cursor-pointer items-center gap-1 rounded-xl border-2 px-2.5 py-1 text-xs font-bold shadow-[2px_2px_0px_0px_#16131F]"
              >
                <CaretLeft size={16} weight="bold" />
                <span className="hidden sm:inline">Home</span>
              </Link>
              <div className="flex flex-col">
                <span className="text-ink text-xs font-black">
                  {t('town.visit.title', { name: hostInfo?.displayName || 'Friend' })}
                </span>
                <span className="text-muted text-[10px] font-bold">
                  {t('town.visit.readOnlyNotice')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-lg border-2 border-[#0E0D15] bg-[#C6FF3D] px-2 py-0.5 text-xs font-black text-[#0E0D15]">
                {t('town.chips.level', { level })}
              </div>
              <button
                type="button"
                onClick={() => void executeLike()}
                disabled={likeLoading || hostInfo?.hasLiked}
                className={`border-border flex cursor-pointer items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-black shadow-[2px_2px_0px_0px_#16131F] transition-colors ${
                  hostInfo?.hasLiked
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-surface-2 text-ink hover:bg-rose-50'
                }`}
              >
                <Heart
                  size={16}
                  weight={hostInfo?.hasLiked ? 'fill' : 'regular'}
                  className={hostInfo?.hasLiked ? 'text-rose-600' : 'text-ink'}
                />
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
                  className="border-border bg-surface-2 text-ink hover:bg-surface flex cursor-pointer items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-black shadow-[2px_2px_0px_0px_#16131F]"
                  title={t('town.transfer.title')}
                >
                  <Gift size={16} weight="bold" className="text-purple-600" />
                  <span className="hidden sm:inline">Gift</span>
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Wallet chip */}
            <div className="border-border bg-surface-2 flex items-center gap-1.5 rounded-full border-2 px-3 py-1 shadow-[2px_2px_0px_0px_#16131F]">
              <Coins size={18} weight="fill" className="text-[#F59E0B]" />
              <span className="text-ink text-xs font-black">
                {t('town.chips.coins', { count: walletBalance })}
              </span>
            </div>

            {/* Level badge */}
            <div className="rounded-lg border-2 border-[#0E0D15] bg-[#C6FF3D] px-2.5 py-0.5 text-xs font-black text-[#0E0D15] shadow-[1px_1px_0px_0px_#0E0D15]">
              {t('town.chips.level', { level })}
            </div>

            {/* Population chip */}
            <div
              className="border-border bg-surface-2 flex items-center gap-1.5 rounded-full border-2 px-3 py-1 shadow-[2px_2px_0px_0px_#16131F]"
              title={growthBottleneck ?? t('town.growth.maxCapacity')}
            >
              <Users size={16} weight="fill" className="text-volt dark:text-volt" />
              <span className="text-ink text-xs font-black">
                {t('town.chips.population', { population, cap: populationCap })}
              </span>
              {growthBottleneck && (
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              )}
            </div>
          </>
        )}
      </header>

      {/* Action toast/banner */}
      {actionMessage && (
        <div className="border-border animate-in fade-in relative z-20 border-b-2 bg-red-500 px-3 py-1.5 text-center text-xs font-black text-white">
          {actionMessage}
        </div>
      )}

      {/* Placement mode banner */}
      {placingItemId && (
        <div className="relative z-20 flex items-center justify-between border-b-2 border-[#0E0D15] bg-[#C6FF3D] px-4 py-2 text-xs font-black text-[#0E0D15] shadow-md">
          <span>Tap any free tile on the map to place {catalog.items[placingItemId]?.id}</span>
          <button
            type="button"
            onClick={() => setPlacingItemId(null)}
            className="rounded-lg border border-[#0E0D15] bg-white px-2 py-0.5 text-[10px]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Moving mode banner */}
      {movingTile && (
        <div className="bg-volt relative z-20 flex items-center justify-between border-b-2 border-[#0E0D15] px-4 py-2 text-xs font-black text-[#0E0D15] shadow-md">
          <span>
            Tap a free destination tile to move ({movingTile.x}, {movingTile.y})
          </span>
          <button
            type="button"
            onClick={() => setMovingTile(null)}
            className="rounded-lg border border-[#0E0D15] bg-white px-2 py-0.5 text-[10px]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Bottleneck notice if population capped */}
      {growthBottleneck && !placingItemId && !movingTile && (
        <div className="border-border relative z-10 border-b bg-amber-500/10 px-3 py-1 text-center text-[11px] font-bold text-amber-900 dark:text-amber-200">
          ⚠️ {growthBottleneck}
        </div>
      )}

      {/* 2. MAIN MAP VIEWPORT */}
      <main
        ref={mapContainerRef}
        className="relative flex flex-1 touch-pan-x touch-pan-y select-none items-center justify-center overflow-auto p-4"
      >
        <div
          className="border-border/60 grid gap-1 rounded-2xl border-2 bg-[#D4E8C2] p-3 shadow-inner dark:bg-[#1E2619]"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, minmax(38px, 52px))`,
            gridTemplateRows: `repeat(${gridSize}, minmax(38px, 52px))`,
          }}
        >
          {Array.from({ length: gridSize * gridSize }).map((_, index) => {
            const x = index % gridSize;
            const y = Math.floor(index / gridSize);
            const key = `${x}_${y}`;
            const tile = tiles[key];

            const isHouse =
              tile?.itemId === 'starter_house' ||
              tile?.itemId === 'cottage' ||
              tile?.itemId === 'house' ||
              tile?.itemId === 'apartment' ||
              tile?.itemId === 'villa';
            const isService =
              tile?.itemId === 'shop' ||
              tile?.itemId === 'town_hall' ||
              tile?.itemId === 'hospital' ||
              tile?.itemId === 'school' ||
              tile?.itemId === 'park' ||
              tile?.itemId === 'bakery' ||
              tile?.itemId === 'police_station' ||
              tile?.itemId === 'fire_station';
            const isPlot = tile?.itemId === 'plot';
            const isDecor =
              tile?.itemId === 'tree' ||
              tile?.itemId === 'road' ||
              tile?.itemId === 'fence' ||
              tile?.itemId === 'fountain' ||
              tile?.itemId === 'windmill';

            return (
              <button
                key={key}
                type="button"
                onClick={() => handleTileClick(x, y)}
                aria-label={`Tile ${x}, ${y}`}
                className={`relative flex items-center justify-center rounded-lg border border-emerald-600/20 transition-transform active:scale-95 dark:border-emerald-900/30 ${
                  isHouse
                    ? 'bg-[#EAD5BE] shadow-sm dark:bg-[#3D2D1E]'
                    : isService
                      ? 'bg-[#D1E0EE] shadow-sm dark:bg-[#203042]'
                      : isPlot
                        ? 'bg-[#A87B51] shadow-inner dark:bg-[#4A321F]'
                        : isDecor
                          ? 'bg-[#CBE4B4] dark:bg-[#253A1B]'
                          : placingItemId || movingTile
                            ? 'border-2 border-dashed border-[#0E0D15] bg-[#C6FF3D]/30 hover:bg-[#C6FF3D]/60'
                            : 'hover:bg-emerald-300/30'
                }`}
                style={{ aspectRatio: '1/1' }}
              >
                {isHouse && (
                  <span className="text-2xl drop-shadow-sm">
                    {tile.itemId === 'starter_house'
                      ? '🏡'
                      : tile.itemId === 'cottage'
                        ? '🏠'
                        : tile.itemId === 'apartment'
                          ? '🏢'
                          : '🏘️'}
                  </span>
                )}
                {isService && (
                  <span className="text-2xl drop-shadow-sm">
                    {tile.itemId === 'town_hall'
                      ? '🏛️'
                      : tile.itemId === 'hospital'
                        ? '🏥'
                        : tile.itemId === 'school'
                          ? '🏫'
                          : tile.itemId === 'shop'
                            ? '🏪'
                            : '🏬'}
                  </span>
                )}
                {isPlot && (
                  <span className="flex items-center justify-center text-xl">
                    {tile.cropId === 'oats'
                      ? '🌾'
                      : tile.cropId === 'wheat'
                        ? '🌾'
                        : tile.cropId === 'carrots'
                          ? '🥕'
                          : tile.cropId === 'sunflower'
                            ? '🌻'
                            : tile.cropId === 'pumpkin'
                              ? '🎃'
                              : '🟫'}
                  </span>
                )}
                {isDecor && (
                  <span className="text-xl">
                    {tile.itemId === 'tree'
                      ? '🌳'
                      : tile.itemId === 'road'
                        ? '🧱'
                        : tile.itemId === 'fountain'
                          ? '⛲'
                          : '🌻'}
                  </span>
                )}
              </button>
            );
          })}

          {/* Cosmetic villagers sprites walking/standing */}
          {villagerSprites.map((sprite) => (
            <div
              key={sprite.id}
              className="pointer-events-none absolute text-sm transition-all duration-1000 motion-reduce:transition-none"
              style={{
                left: `${(sprite.x / gridSize) * 88 + 6}%`,
                top: `${(sprite.y / gridSize) * 88 + 6}%`,
              }}
            >
              {sprite.emoji}
            </div>
          ))}
        </div>
      </main>

      {/* 3. DOCKED RIGHT ACTION TOOLBAR */}
      {!isVisitMode && (
        <aside
          aria-label="Town Actions"
          className={`fixed bottom-20 end-0 top-24 z-20 flex items-center transition-transform duration-300 ease-out motion-reduce:transition-none ${
            toolbarVisible && !activeSheet
              ? 'translate-x-0'
              : 'translate-x-[calc(100%-28px)] rtl:-translate-x-[calc(100%-28px)]'
          }`}
        >
          {/* Toolbar edge toggle tab */}
          <button
            type="button"
            onClick={toggleToolbar}
            aria-label={t('town.actions.toggle')}
            className="border-border bg-surface text-ink hover:bg-surface-2 flex h-12 w-7 cursor-pointer items-center justify-center rounded-l-xl border-2 border-r-0 shadow-[-2px_2px_0px_0px_#16131F] rtl:rounded-l-none rtl:rounded-r-xl rtl:border-l-0 rtl:border-r-2"
          >
            {toolbarVisible ? (
              <CaretRight size={18} weight="bold" className="rtl:rotate-180" />
            ) : (
              <CaretLeft size={18} weight="bold" className="rtl:rotate-180" />
            )}
          </button>

          {/* Toolbar buttons container */}
          <div className="border-border bg-surface/95 flex max-h-[80vh] w-16 flex-col items-center gap-2 overflow-y-auto rounded-l-2xl border-2 border-r-0 p-2 shadow-[-4px_4px_0px_0px_#16131F] backdrop-blur-md rtl:rounded-l-none rtl:rounded-r-2xl rtl:border-l-0 rtl:border-r-2">
            {/* Build */}
            <button
              type="button"
              onClick={() => {
                setShopTab('housing');
                openSheet('shop');
              }}
              className="text-ink hover:border-border hover:bg-surface-2 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-transparent p-1.5 active:scale-95"
              title={t('town.actions.build')}
            >
              <div className="border-border bg-volt/30 text-ink flex h-9 w-9 items-center justify-center rounded-lg border-2">
                <Hammer size={18} weight="fill" />
              </div>
              <span className="text-[9px] font-black leading-none">{t('town.actions.build')}</span>
            </button>

            {/* Shop */}
            <button
              type="button"
              onClick={() => {
                setShopTab('service');
                openSheet('shop');
              }}
              className="text-ink hover:border-border hover:bg-surface-2 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-transparent p-1.5 active:scale-95"
              title={t('town.actions.shop')}
            >
              <div className="border-border flex h-9 w-9 items-center justify-center rounded-lg border-2 bg-[#C6FF3D] text-[#0E0D15]">
                <Storefront size={18} weight="fill" />
              </div>
              <span className="text-[9px] font-black leading-none">{t('town.actions.shop')}</span>
            </button>

            {/* Orders */}
            <button
              type="button"
              onClick={() => openSheet('orders')}
              className="text-ink hover:border-border hover:bg-surface-2 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-transparent p-1.5 active:scale-95"
              title={t('town.actions.orders')}
            >
              <div className="border-border text-ink flex h-9 w-9 items-center justify-center rounded-lg border-2 bg-amber-400/30">
                <Scroll size={18} weight="fill" />
              </div>
              <span className="text-[9px] font-black leading-none">{t('town.actions.orders')}</span>
            </button>

            {/* Inventory */}
            <button
              type="button"
              onClick={() => openSheet('inventory')}
              className="text-ink hover:border-border hover:bg-surface-2 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-transparent p-1.5 active:scale-95"
              title={t('town.actions.inventory')}
            >
              <div className="border-border text-ink flex h-9 w-9 items-center justify-center rounded-lg border-2 bg-emerald-400/30">
                <Backpack size={18} weight="fill" />
              </div>
              <span className="text-[9px] font-black leading-none">
                {t('town.actions.inventory')}
              </span>
            </button>

            {/* Stats / Villagers */}
            <button
              type="button"
              onClick={() => openSheet('stats')}
              className="text-ink hover:border-border hover:bg-surface-2 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-transparent p-1.5 active:scale-95"
              title={t('town.actions.stats')}
            >
              <div className="border-border text-ink flex h-9 w-9 items-center justify-center rounded-lg border-2 bg-sky-400/30">
                <Users size={18} weight="fill" />
              </div>
              <span className="text-[9px] font-black leading-none">{t('town.actions.stats')}</span>
            </button>

            {/* Visit friends */}
            <button
              type="button"
              onClick={() => openSheet('visit')}
              className="text-ink hover:border-border hover:bg-surface-2 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-transparent p-1.5 active:scale-95"
              title={t('town.actions.visit')}
            >
              <div className="border-border text-ink flex h-9 w-9 items-center justify-center rounded-lg border-2 bg-purple-400/30">
                <Compass size={18} weight="fill" />
              </div>
              <span className="text-[9px] font-black leading-none">{t('town.actions.visit')}</span>
            </button>

            {/* Coins Store (Gated) */}
            {coinsPurchaseEnabled && (
              <button
                type="button"
                onClick={() => openSheet('coins')}
                className="text-ink hover:border-border hover:bg-surface-2 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-transparent p-1.5 active:scale-95"
                title={t('town.actions.coins')}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#0E0D15] bg-[#F59E0B] text-white">
                  <Coins size={18} weight="fill" />
                </div>
                <span className="text-[9px] font-black leading-none">
                  {t('town.actions.coins')}
                </span>
              </button>
            )}

            {/* Transfer RonCoins (Gated) */}
            {coinsTransferEnabled && (
              <button
                type="button"
                onClick={() => openSheet('transfer')}
                className="text-ink hover:border-border hover:bg-surface-2 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-transparent p-1.5 active:scale-95"
                title={t('town.transfer.title')}
              >
                <div className="border-border text-ink flex h-9 w-9 items-center justify-center rounded-lg border-2 bg-purple-400/30">
                  <Gift size={18} weight="fill" />
                </div>
                <span className="text-[9px] font-black leading-none">
                  {t('town.transfer.title')}
                </span>
              </button>
            )}

            {/* Settings / Help */}
            <button
              type="button"
              onClick={() => openSheet('help')}
              className="text-ink hover:border-border hover:bg-surface-2 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-transparent p-1.5 active:scale-95"
              title={t('town.actions.help')}
            >
              <div className="border-border bg-surface-2 text-muted flex h-9 w-9 items-center justify-center rounded-lg border-2">
                <Question size={18} weight="bold" />
              </div>
              <span className="text-[9px] font-black leading-none">{t('town.actions.help')}</span>
            </button>
          </div>
        </aside>
      )}

      {/* 4. TUTORIAL OVERLAY (First time, 3 steps, skippable) */}
      {!isVisitMode && tutorialStep < 3 && (
        <div className="border-border bg-surface absolute inset-x-4 top-16 z-20 mx-auto max-w-sm rounded-2xl border-2 p-4 shadow-[4px_4px_0px_0px_#16131F]">
          <div className="flex items-start justify-between">
            <span className="bg-volt/30 text-ink rounded-full px-2.5 py-0.5 text-xs font-black">
              Tutorial {tutorialStep + 1}/3
            </span>
            <button
              type="button"
              onClick={() => setTutorialStep(3)}
              className="text-muted hover:text-ink cursor-pointer text-xs font-bold"
            >
              {t('town.tutorial.skip')}
            </button>
          </div>
          <h3 className="text-ink mt-2 text-base font-black">
            {tutorialStep === 0 && t('town.tutorial.step1Title')}
            {tutorialStep === 1 && t('town.tutorial.step2Title')}
            {tutorialStep === 2 && t('town.tutorial.step3Title')}
          </h3>
          <p className="text-muted mt-1 text-xs">
            {tutorialStep === 0 && t('town.tutorial.step1Desc')}
            {tutorialStep === 1 && t('town.tutorial.step2Desc')}
            {tutorialStep === 2 && t('town.tutorial.step3Desc')}
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (tutorialStep === 1) {
                  setShopTab('housing');
                  openSheet('shop');
                } else if (tutorialStep === 2) {
                  openSheet('orders');
                }
                setTutorialStep((prev) => prev + 1);
              }}
              className="cursor-pointer rounded-xl border-2 border-[#0E0D15] bg-[#C6FF3D] px-4 py-1.5 text-xs font-black text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15] active:translate-y-0.5"
            >
              {tutorialStep === 2 ? t('town.tutorial.finish') : t('town.tutorial.next')}
            </button>
          </div>
        </div>
      )}

      {/* 5. BOTTOM SHEETS */}
      {activeSheet && (
        <div className="backdrop-blur-xs fixed inset-0 z-40 flex items-end justify-center bg-black/40">
          <div className="border-border bg-surface animate-in slide-in-from-bottom-5 w-full max-w-lg rounded-t-3xl border-x-2 border-t-2 p-5 pb-24 shadow-2xl">
            <div className="border-border flex items-center justify-between border-b pb-3">
              <h2 className="text-ink text-lg font-black">
                {activeSheet === 'shop' && t('town.shop.title')}
                {activeSheet === 'orders' && t('town.orders.title')}
                {activeSheet === 'inventory' && t('town.actions.inventory')}
                {activeSheet === 'stats' && t('town.actions.stats')}
                {activeSheet === 'visit' && t('town.actions.visit')}
                {activeSheet === 'coins' && t('town.coinStore.title')}
                {activeSheet === 'help' && t('town.actions.help')}
                {activeSheet === 'tile' && `Tile (${selectedTile?.x}, ${selectedTile?.y})`}
              </h2>
              <button
                type="button"
                onClick={closeSheet}
                className="border-border bg-surface-2 text-muted hover:text-ink flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] overflow-y-auto">
              {/* ORDERS SHEET */}
              {activeSheet === 'orders' && (
                <div className="space-y-3">
                  {!ordersUnlocked && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-xs font-bold text-amber-800 dark:text-amber-200">
                      {t('town.orders.locked')}
                    </div>
                  )}

                  {orders.map((ord) => {
                    const canDeliver =
                      !ord.done &&
                      Object.entries(ord.items).every(
                        ([crop, qty]) => (inventory[crop] || 0) >= qty,
                      );

                    return (
                      <div
                        key={ord.id}
                        className="border-border bg-surface-2 flex items-center justify-between rounded-xl border-2 p-3 shadow-[2px_2px_0px_0px_#16131F]"
                      >
                        <div className="space-y-1">
                          <span className="text-ink text-xs font-black">
                            {t(`town.orders.templates.${ord.templateKey}`) || ord.templateKey}
                          </span>
                          <div className="text-muted flex items-center gap-2 text-xs">
                            {Object.entries(ord.items).map(([crop, qty]) => (
                              <span
                                key={crop}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  (inventory[crop] || 0) >= qty
                                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-red-500/20 text-red-700 dark:text-red-300'
                                }`}
                              >
                                {crop}: {inventory[crop] || 0}/{qty}
                              </span>
                            ))}
                          </div>
                          <span className="text-xs font-black text-[#F59E0B]">
                            {t('town.orders.reward', { coins: ord.rewardCoins })}
                          </span>
                        </div>

                        {ord.done ? (
                          <span className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-black text-emerald-600">
                            <CheckCircle size={16} weight="fill" />
                            {t('town.orders.completed')}
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={!canDeliver}
                            onClick={() => executeDeliverOrder(ord.id)}
                            className={`rounded-xl border-2 border-[#0E0D15] px-3 py-1.5 text-xs font-black transition-all ${
                              canDeliver
                                ? 'cursor-pointer bg-[#C6FF3D] text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15] active:translate-y-0.5'
                                : 'bg-surface text-muted cursor-not-allowed opacity-40'
                            }`}
                          >
                            {t('town.orders.deliver')}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* INVENTORY SHEET */}
              {activeSheet === 'inventory' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {cropItems.map((crop) => (
                      <div
                        key={crop.id}
                        className="border-border bg-surface-2 flex items-center gap-3 rounded-xl border-2 p-3 shadow-[2px_2px_0px_0px_#16131F]"
                      >
                        <span className="text-2xl">
                          {crop.id === 'oats'
                            ? '🌾'
                            : crop.id === 'wheat'
                              ? '🌾'
                              : crop.id === 'carrots'
                                ? '🥕'
                                : crop.id === 'sunflower'
                                  ? '🌻'
                                  : '🎃'}
                        </span>
                        <div>
                          <p className="text-ink text-xs font-black">{crop.id}</p>
                          <p className="text-volt text-sm font-black">{inventory[crop.id] || 0}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SHOP / BUILD SHEET */}
              {activeSheet === 'shop' && (
                <div className="space-y-4">
                  {/* Category Tabs */}
                  <div className="border-border flex gap-2 overflow-x-auto border-b pb-2">
                    {(['housing', 'service', 'plot', 'decor'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setShopTab(tab)}
                        className={`rounded-lg px-3 py-1 text-xs font-black transition-all ${
                          shopTab === tab
                            ? 'border-border border-2 bg-[#C6FF3D] text-[#0E0D15] shadow-[2px_2px_0px_0px_#16131F]'
                            : 'text-muted hover:text-ink'
                        }`}
                      >
                        {tab === 'housing' && t('town.shop.tabHousing')}
                        {tab === 'service' && t('town.shop.tabServices')}
                        {tab === 'plot' && t('town.shop.tabFarm')}
                        {tab === 'decor' && t('town.shop.tabDecor')}
                      </button>
                    ))}
                  </div>

                  {/* Items List */}
                  <div className="space-y-3">
                    {catalogList.map((item) => {
                      const canAfford = walletBalance >= item.priceCoins;
                      const levelLocked = item.unlockLevel > maxLevel;
                      const disabled = !canAfford || levelLocked;

                      return (
                        <div
                          key={item.id}
                          className="border-border bg-surface-2 flex items-center justify-between rounded-xl border-2 p-3 shadow-[2px_2px_0px_0px_#16131F]"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-ink text-sm font-black">{item.id}</span>
                              {item.proOnly && (
                                <span className="bg-volt/30 text-ink rounded px-1.5 py-0.5 text-[9px] font-black">
                                  {t('town.shop.proOnly')}
                                </span>
                              )}
                              {levelLocked && (
                                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-500">
                                  {t('town.shop.unlockLevel', { level: item.unlockLevel })}
                                </span>
                              )}
                            </div>
                            <p className="text-muted text-xs">
                              {item.housing && `+${item.housing} housing `}
                              {item.supports && `+${item.supports} service `}
                              {item.footprint.w > 1 && `(${item.footprint.w}x${item.footprint.h})`}
                            </p>
                            <p className="text-xs font-black text-[#F59E0B]">
                              {t('town.shop.priceCoins', { coins: item.priceCoins })}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              setPlacingItemId(item.id);
                              closeSheet();
                            }}
                            className={`border-border rounded-xl border-2 px-4 py-2 text-xs font-black transition-all ${
                              disabled
                                ? 'bg-surface cursor-not-allowed opacity-40'
                                : 'cursor-pointer bg-[#C6FF3D] text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15] active:translate-y-0.5'
                            }`}
                          >
                            {levelLocked
                              ? `Lv${item.unlockLevel}`
                              : !canAfford
                                ? t('town.shop.insufficientFunds')
                                : t('town.shop.buy')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TILE ACTIONS SHEET */}
              {activeSheet === 'tile' && selectedTile && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-ink text-base font-black">
                      {selectedTile.itemId === 'starter_house'
                        ? t('town.catalog.starter_house.name')
                        : selectedTile.itemId === 'plot'
                          ? selectedTile.cropId
                            ? `${selectedTile.cropId} Crop`
                            : t('town.tiles.emptyPlot')
                          : selectedTile.itemId === 'empty'
                            ? 'Free Ground'
                            : selectedTile.itemId}
                    </h3>
                    <p className="text-muted mt-0.5 text-xs">
                      Coordinates: ({selectedTile.x}, {selectedTile.y})
                    </p>
                  </div>

                  {isVisitMode && (
                    <div className="border-border bg-surface-2 text-muted rounded-xl border p-4 text-center text-xs font-bold">
                      {t('town.visit.readOnlyNotice')}
                    </div>
                  )}

                  {isVisitMode &&
                    townHelpEnabled &&
                    selectedTile.itemId === 'plot' &&
                    selectedTile.cropId && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => executeWaterCrop(selectedTile.x, selectedTile.y)}
                          disabled={waterLoading}
                          className="border-border flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 bg-[#38BDF8] py-3 text-sm font-black text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15] active:translate-y-0.5 disabled:opacity-50"
                        >
                          💧 {t('town.visit.water')}
                        </button>
                      </div>
                    )}

                  {/* Empty ground tile: Option to Build or Buy Plot */}
                  {!isVisitMode && selectedTile.itemId === 'empty' && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          closeSheet();
                          setShopTab('housing');
                          openSheet('shop');
                        }}
                        className="border-border flex w-full items-center justify-center gap-2 rounded-xl border-2 bg-[#C6FF3D] py-3 text-sm font-black text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15]"
                      >
                        <Hammer size={18} weight="fill" />
                        {t('town.actions.build')}
                      </button>

                      <button
                        type="button"
                        onClick={() => executeBuyPlot(selectedTile.x, selectedTile.y)}
                        className="border-border bg-surface-2 text-ink flex w-full items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-black shadow-[2px_2px_0px_0px_#16131F]"
                      >
                        Buy Farm Plot ({getPlotPrice(town?.plotsOwned ?? 2)} coins)
                      </button>
                    </div>
                  )}

                  {/* Farm plot: Plant or Harvest */}
                  {!isVisitMode && selectedTile.itemId === 'plot' && !selectedTile.cropId && (
                    <div className="space-y-3">
                      <h4 className="text-muted text-xs font-black uppercase">
                        Select seeds to plant:
                      </h4>
                      <div className="space-y-2">
                        {cropItems.map((crop) => (
                          <div
                            key={crop.id}
                            className="border-border bg-surface-2 flex items-center justify-between rounded-xl border-2 p-2.5"
                          >
                            <div>
                              <p className="text-ink text-xs font-black">{crop.id}</p>
                              <p className="text-muted text-[11px]">
                                Grows in {(crop.growTimeSeconds ?? 14400) / 3600}h · Yield:{' '}
                                {crop.yieldCount ?? 2}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                executePlantCrop(selectedTile.x, selectedTile.y, crop.id)
                              }
                              className="rounded-lg border-2 border-[#0E0D15] bg-[#C6FF3D] px-3 py-1 text-xs font-black text-[#0E0D15] shadow-[1px_1px_0px_0px_#0E0D15]"
                            >
                              Plant ({crop.priceCoins}c)
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Farm plot with growing or ready crop */}
                  {!isVisitMode && selectedTile.itemId === 'plot' && selectedTile.cropId && (
                    <div className="space-y-3">
                      <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                        <span className="text-3xl">🌾</span>
                        <p className="mt-2 text-sm font-black text-emerald-800 dark:text-emerald-200">
                          {t('town.tiles.ready')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => executeHarvestCrop(selectedTile.x, selectedTile.y)}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-[#0E0D15] bg-[#C6FF3D] py-3 text-sm font-black text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15] active:translate-y-0.5"
                      >
                        <Plant size={18} weight="fill" />
                        {t('town.tiles.harvestAction')}
                      </button>
                    </div>
                  )}

                  {/* Non-plot occupied tile: Move and Remove actions */}
                  {!isVisitMode &&
                    selectedTile.itemId !== 'empty' &&
                    selectedTile.itemId !== 'plot' && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMovingTile(selectedTile);
                            closeSheet();
                          }}
                          className="border-border bg-surface-2 text-ink flex w-full items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-black shadow-[2px_2px_0px_0px_#16131F]"
                        >
                          <ArrowsOutCardinal size={18} weight="bold" />
                          {t('town.tiles.move')}
                        </button>

                        {selectedTile.itemId !== 'starter_house' ? (
                          <button
                            type="button"
                            onClick={() => executeRemove(selectedTile.x, selectedTile.y)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-500 bg-red-500/10 py-2.5 text-sm font-black text-red-500"
                          >
                            <Trash size={18} weight="bold" />
                            {t('town.tiles.remove', {
                              coins: Math.floor(
                                (catalog.items[selectedTile.itemId]?.priceCoins ?? 0) * 0.5,
                              ),
                            })}
                          </button>
                        ) : (
                          <p className="text-muted text-center text-xs">
                            {t('town.tiles.starterCannotRemove')}
                          </p>
                        )}
                      </div>
                    )}
                </div>
              )}

              {/* STATS SHEET */}
              {activeSheet === 'stats' && (
                <div className="space-y-4">
                  <div className="border-border bg-surface-2 space-y-2 rounded-xl border-2 p-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted font-bold">Population</span>
                      <span className="text-ink font-black">
                        {population} / {populationCap}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted font-bold">Housing Capacity</span>
                      <span className="text-ink font-black">{housingCapacity}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted font-bold">Service Capacity</span>
                      <span className="text-ink font-black">{serviceCapacity}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted font-bold">Town Level</span>
                      <span className="text-ink font-black">
                        Lv. {level} (Max reached: {maxLevel})
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted font-bold">Grid Dimensions</span>
                      <span className="text-ink font-black">
                        {gridSize} x {gridSize}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* VISIT FRIENDS SHEET */}
              {activeSheet === 'visit' && (
                <div className="space-y-4">
                  <div className="border-border bg-surface-2 rounded-xl border-2 p-4 text-center">
                    <span className="text-3xl">🧭</span>
                    <h3 className="text-ink mt-2 text-sm font-black">{t('town.actions.visit')}</h3>
                    <p className="text-muted mt-1 text-xs">
                      Visit your league friends' towns directly from the League leaderboard! Look
                      for the 🏡 icon next to any player's name.
                    </p>
                  </div>
                  <Link
                    href={`/${locale}/leagues`}
                    onClick={closeSheet}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-[#0E0D15] bg-[#C6FF3D] py-3 text-sm font-black text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15] active:translate-y-0.5"
                  >
                    <span>Open Leagues</span>
                  </Link>
                </div>
              )}

              {/* COIN STORE SHEET */}
              {activeSheet === 'coins' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center">
                    <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      {t('town.coinStore.nonCompetitiveDisclaimer')}
                    </p>
                    <p className="mt-1 text-[11px] font-black text-amber-800 dark:text-amber-300">
                      {t('town.coinStore.monthlyCapNotice', { remaining: '20.00', max: '20' })}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {[
                      { id: 'pack_1000', coins: 1000, eur: '1.99', popular: false },
                      { id: 'pack_2800', coins: 2800, eur: '4.99', popular: true },
                      { id: 'pack_6000', coins: 6000, eur: '9.99', popular: false },
                      { id: 'pack_13000', coins: 13000, eur: '19.99', popular: false },
                    ].map((pack) => (
                      <div
                        key={pack.id}
                        className={`relative flex flex-col justify-between rounded-2xl border-2 p-3.5 shadow-[2px_2px_0px_0px_#16131F] transition-all ${
                          pack.popular
                            ? 'border-[#0E0D15] bg-[#C6FF3D]/20'
                            : 'border-border bg-surface-2'
                        }`}
                      >
                        {pack.popular && (
                          <span className="absolute -top-2.5 right-3 rounded-full border border-[#0E0D15] bg-[#C6FF3D] px-2 py-0.5 text-[9px] font-black text-[#0E0D15]">
                            Best Value
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <Coins size={22} weight="fill" className="text-[#F59E0B]" />
                          <div>
                            <span className="text-ink text-base font-black">
                              {pack.coins.toLocaleString()}
                            </span>
                            <span className="text-muted ml-1 text-xs font-bold">RonCoins</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => executeCoinCheckout(pack.id)}
                          className="mt-3 flex w-full cursor-pointer items-center justify-center rounded-xl border-2 border-[#0E0D15] bg-[#C6FF3D] py-2 text-xs font-black text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15] active:translate-y-0.5"
                        >
                          {t('town.coinStore.buyPack', { price: `€${pack.eur}` })}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TRANSFER SHEET */}
              {activeSheet === 'transfer' && (
                <div className="space-y-4">
                  <div className="border-border bg-surface-2 rounded-xl border p-3 text-center">
                    <p className="text-muted text-xs font-bold">{t('town.transfer.desc')}</p>
                    {transferStatus && (
                      <p className="text-ink mt-1 text-[11px] font-black">
                        {t('town.transfer.dailyCapNotice', {
                          remaining: transferStatus.dailyRemaining,
                        })}
                      </p>
                    )}
                  </div>

                  {!transferStatus?.isPro && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-center text-xs font-bold text-amber-900 dark:text-amber-200">
                      Transferring RonCoins requires an active Pro subscription.
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="text-ink mb-1 block text-xs font-black">
                        {t('town.transfer.recipientLabel')} (User ID)
                      </label>
                      <input
                        type="text"
                        value={transferRecipient}
                        onChange={(e) => setTransferRecipient(e.target.value)}
                        placeholder="e.g. friend_user_id"
                        className="border-border bg-surface text-ink w-full rounded-xl border-2 px-3 py-2 text-xs font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-ink mb-1 block text-xs font-black">
                        {t('town.transfer.amountLabel')} (1 - {transferStatus?.dailyRemaining ?? 50}{' '}
                        coins)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={transferStatus?.dailyRemaining ?? 50}
                          value={transferAmount}
                          onChange={(e) =>
                            setTransferAmount(Math.max(1, parseInt(e.target.value || '1', 10)))
                          }
                          className="border-border bg-surface text-ink w-full rounded-xl border-2 px-3 py-2 text-xs font-bold"
                        />
                        <span className="text-muted text-xs font-bold">coins</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={
                        transferLoading ||
                        !transferRecipient ||
                        transferAmount <= 0 ||
                        !transferStatus?.isPro
                      }
                      onClick={() => void executeTransfer()}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#0E0D15] py-2.5 text-xs font-black shadow-[2px_2px_0px_0px_#0E0D15] transition-all ${
                        transferLoading ||
                        !transferRecipient ||
                        transferAmount <= 0 ||
                        !transferStatus?.isPro
                          ? 'bg-surface text-muted cursor-not-allowed opacity-40'
                          : 'cursor-pointer bg-[#C6FF3D] text-[#0E0D15] active:translate-y-0.5'
                      }`}
                    >
                      <Gift size={16} weight="bold" />
                      <span>{transferLoading ? 'Sending...' : t('town.transfer.send')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* PLACEHOLDER FOR HELP */}
              {activeSheet !== 'shop' &&
                activeSheet !== 'tile' &&
                activeSheet !== 'stats' &&
                activeSheet !== 'orders' &&
                activeSheet !== 'inventory' &&
                activeSheet !== 'visit' &&
                activeSheet !== 'coins' &&
                activeSheet !== 'transfer' && (
                  <div className="text-muted py-8 text-center text-sm">
                    Interactive content for {activeSheet} will load here.
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TownPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C6FF3D] border-t-transparent" />
        </div>
      }
    >
      <TownContent />
    </Suspense>
  );
}
