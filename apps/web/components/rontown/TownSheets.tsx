'use client';

import {
  ArrowsOutCardinal,
  CheckCircle,
  Gift,
  Hammer,
  Plant,
  Trash,
  X,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  getPlotPrice,
  type CatalogItem,
  type TownCatalogDoc,
  type TownDoc,
  type TownOrderItem,
} from '@ronduel/shared';
import { formatDurationShort, getCropGrowthInfo } from './iso';
import { CATALOG_SPRITES, CROP_BUTTON_SPRITES, UI_SPRITES, uiSpriteUrl } from './sprites';
import { RonCoinIcon } from './RonCoinIcon';
import type { TileInfo, TransferStatusInfo } from './useTownState';

export type ActiveSheet =
  | 'shop'
  | 'orders'
  | 'inventory'
  | 'stats'
  | 'visit'
  | 'coins'
  | 'transfer'
  | 'help'
  | 'menu'
  | 'tile';

interface TownSheetsProps {
  activeSheet: ActiveSheet;
  locale: string;
  isVisitMode: boolean;
  coinsPurchaseEnabled: boolean;
  coinsTransferEnabled: boolean;
  townHelpEnabled: boolean;
  town: TownDoc | null;
  landCount: number;
  catalog: TownCatalogDoc;
  catalogList: CatalogItem[];
  cropItems: CatalogItem[];
  shopTab: 'housing' | 'service' | 'plot' | 'decor';
  setShopTab: (tab: 'housing' | 'service' | 'plot' | 'decor') => void;
  selectedTile: TileInfo | null;
  walletBalance: number;
  inventory: Record<string, number>;
  orders: TownOrderItem[];
  ordersUnlocked: boolean;
  growthBottleneck: string | null;
  transferStatus: TransferStatusInfo | null;
  transferRecipient: string;
  setTransferRecipient: (v: string) => void;
  transferAmount: number;
  setTransferAmount: (v: number) => void;
  transferLoading: boolean;
  waterLoading: boolean;
  openSheet: (sheet: ActiveSheet) => void;
  closeSheet: () => void;
  onStartPlace: (itemId: string) => void;
  onStartMove: (tile: TileInfo) => void;
  onBuyPlot: (x: number, y: number) => Promise<boolean>;
  onPlantCrop: (x: number, y: number, cropId: string) => Promise<boolean>;
  onHarvestCrop: (x: number, y: number) => Promise<boolean>;
  onRemoveTile: (x: number, y: number) => Promise<boolean>;
  onDeliverOrder: (orderId: string) => Promise<void>;
  onWaterCrop: (x: number, y: number, label: string) => Promise<boolean>;
  onCoinCheckout: (packId: string) => Promise<void>;
  onTransfer: (recipientUid: string, amount: number) => Promise<boolean>;
}

export function TownSheets({
  activeSheet,
  locale,
  isVisitMode,
  coinsPurchaseEnabled,
  coinsTransferEnabled,
  townHelpEnabled,
  town,
  landCount,
  catalog,
  catalogList,
  cropItems,
  shopTab,
  setShopTab,
  selectedTile,
  walletBalance,
  inventory,
  orders,
  ordersUnlocked,
  growthBottleneck,
  transferStatus,
  transferRecipient,
  setTransferRecipient,
  transferAmount,
  setTransferAmount,
  transferLoading,
  waterLoading,
  openSheet,
  closeSheet,
  onStartPlace,
  onStartMove,
  onBuyPlot,
  onPlantCrop,
  onHarvestCrop,
  onRemoveTile,
  onDeliverOrder,
  onWaterCrop,
  onCoinCheckout,
  onTransfer,
}: TownSheetsProps) {
  const t = useTranslations();

  const gridSize = town?.gridSize ?? 8;
  const population = town?.population ?? 2;
  const populationCap = town?.populationCap ?? 2;
  const housingCapacity = town?.housingCapacity ?? 2;
  const serviceCapacity = town?.serviceCapacity ?? 4;
  const level = town?.level ?? 1;
  const maxLevel = town?.maxLevelReached ?? 1;

  const selectedTileGrowth =
    selectedTile?.itemId === 'plot' && selectedTile.cropId
      ? getCropGrowthInfo({
          plantedAt: selectedTile.plantedAt,
          readyAt: selectedTile.readyAt,
          growTimeSeconds: catalog.items[selectedTile.cropId]?.growTimeSeconds,
        })
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="town-sheet-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSheet();
      }}
    >
      <div className="border-border bg-surface w-full max-w-lg rounded-t-3xl border-x-2 border-t-2 p-5 pb-24 shadow-2xl lg:pb-6">
        <div className="border-border flex items-center justify-between border-b-2 pb-3">
          <h2 id="town-sheet-title" className="text-ink font-display text-lg font-black">
            {activeSheet === 'shop' && t('town.shop.title')}
            {activeSheet === 'orders' && t('town.orders.title')}
            {activeSheet === 'inventory' && t('town.toolbar.inventory')}
            {activeSheet === 'stats' && t('town.toolbar.stats')}
            {activeSheet === 'visit' && t('town.toolbar.visit')}
            {activeSheet === 'coins' && t('town.coinStore.title')}
            {activeSheet === 'transfer' && t('town.transfer.title')}
            {activeSheet === 'help' && t('town.toolbar.help')}
            {activeSheet === 'menu' && t('town.toolbar.more')}
            {activeSheet === 'tile' &&
              t('town.map.groundCell', {
                x: selectedTile?.x ?? 0,
                y: selectedTile?.y ?? 0,
              })}
          </h2>
          <button
            type="button"
            onClick={closeSheet}
            aria-label={t('town.land.close')}
            className="border-border bg-surface-2 text-ink hover:bg-surface flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl border-2 shadow-[2px_2px_0px_0px_#0E0D15]"
          >
            <X size={18} weight="bold" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          {/* TOWN OVERFLOW MENU SHEET ("Meniu oraș") */}
          {activeSheet === 'menu' && (
            <div className="grid grid-cols-2 gap-3 pb-1 pr-1">
              {[
                {
                  sheet: 'orders' as const,
                  icon: 'icon-orders',
                  label: t('town.toolbar.orders'),
                  visible: true,
                },
                {
                  sheet: 'inventory' as const,
                  icon: 'icon-inventory',
                  label: t('town.toolbar.inventory'),
                  visible: true,
                },
                {
                  sheet: 'stats' as const,
                  icon: 'icon-villagers',
                  label: t('town.toolbar.stats'),
                  visible: true,
                },
                {
                  sheet: 'coins' as const,
                  icon: 'icon-coins',
                  label: t('town.toolbar.coins'),
                  visible: coinsPurchaseEnabled,
                },
                {
                  sheet: 'transfer' as const,
                  icon: 'icon-send-coins',
                  label: t('town.transfer.title'),
                  visible: coinsTransferEnabled,
                },
                {
                  sheet: 'help' as const,
                  icon: 'icon-help',
                  label: t('town.toolbar.help'),
                  visible: true,
                },
              ]
                .filter((item) => item.visible)
                .map((item) => (
                  <button
                    key={item.sheet}
                    type="button"
                    onClick={() => openSheet(item.sheet)}
                    className="rt-menu-sticker text-ink focus-visible:outline-3 dark:bg-surface-2 flex min-h-[96px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-[#FFF7EC] px-3 py-3 text-center text-sm font-black leading-tight focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF]"
                  >
                    <img
                      src={uiSpriteUrl(`${item.icon}.png`)}
                      srcSet={`${uiSpriteUrl(`${item.icon}.png`)} 1x, ${uiSpriteUrl(`${item.icon}@2x.png`)} 2x`}
                      sizes="(min-width: 1024px) 48px, 40px"
                      alt=""
                      aria-hidden="true"
                      width={48}
                      height={48}
                      decoding="async"
                      draggable={false}
                      style={{ imageRendering: 'auto' }}
                      className="rt-menu-sticker-icon block h-10 w-10 shrink-0 select-none object-contain lg:h-12 lg:w-12"
                    />
                    <span>{item.label}</span>
                  </button>
                ))}
            </div>
          )}

          {/* ORDERS SHEET */}
          {activeSheet === 'orders' && (
            <div className="space-y-3">
              {!ordersUnlocked && (
                <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-3 text-center text-xs font-bold text-amber-900 dark:text-amber-200">
                  {t('town.orders.locked')}
                </div>
              )}

              {orders.length === 0 && (
                <p className="text-muted py-4 text-center text-xs font-semibold">
                  {t('town.orders.locked')}
                </p>
              )}

              {orders.map((ord) => {
                const canDeliver =
                  !ord.done &&
                  Object.entries(ord.items).every(([crop, qty]) => (inventory[crop] || 0) >= qty);

                return (
                  <div
                    key={ord.id}
                    className="border-border bg-surface-2 flex items-center justify-between gap-2 rounded-xl border-2 p-3 shadow-[2px_2px_0px_0px_#0E0D15]"
                  >
                    <div className="space-y-1">
                      <span className="text-ink text-xs font-black">
                        {t(`town.orders.templates.${ord.templateKey}`) || ord.templateKey}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {Object.entries(ord.items).map(([crop, qty]) => (
                          <span
                            key={crop}
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                              (inventory[crop] || 0) >= qty
                                ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-200'
                                : 'bg-red-500/20 text-red-800 dark:text-red-200'
                            }`}
                          >
                            {crop}: {inventory[crop] || 0}/{qty}
                          </span>
                        ))}
                      </div>
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-black text-amber-700 dark:text-amber-300">
                        <RonCoinIcon size={14} />
                        {t('town.orders.reward', { coins: ord.rewardCoins })}
                      </span>
                    </div>

                    {ord.done ? (
                      <span className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-black text-emerald-700 dark:text-emerald-200">
                        <CheckCircle size={16} weight="fill" aria-hidden="true" />
                        {t('town.orders.completed')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!canDeliver}
                        onClick={() => void onDeliverOrder(ord.id)}
                        className={`min-h-[44px] rounded-xl border-2 border-[#0E0D15] px-3 text-xs font-black ${
                          canDeliver
                            ? 'cursor-pointer bg-[#C6FF3D] text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15]'
                            : 'bg-surface text-muted cursor-not-allowed opacity-50'
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
            <div className="grid grid-cols-2 gap-3">
              {cropItems.map((crop) => {
                const icon = CROP_BUTTON_SPRITES[crop.id];
                return (
                  <div
                    key={crop.id}
                    className="border-border bg-surface-2 flex items-center gap-3 rounded-xl border-2 p-3 shadow-[2px_2px_0px_0px_#0E0D15]"
                  >
                    {icon && (
                      <img
                        src={icon.src}
                        alt=""
                        width={icon.width}
                        height={icon.height}
                        loading="lazy"
                        decoding="async"
                        className="block h-10 w-10 shrink-0 select-none object-contain"
                        draggable={false}
                      />
                    )}
                    <div>
                      <p className="text-ink text-xs font-black">{t(crop.nameKey)}</p>
                      <p className="text-ink font-mono text-sm font-black tabular-nums">
                        {inventory[crop.id] || 0}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* BUILD / CATALOG SHEET */}
          {activeSheet === 'shop' && (
            <div className="space-y-4">
              <div className="border-border flex gap-2 overflow-x-auto border-b-2 pb-2">
                {(['housing', 'service', 'plot', 'decor'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setShopTab(tab)}
                    className={`min-h-[44px] shrink-0 cursor-pointer rounded-xl px-3 text-xs font-black ${
                      shopTab === tab
                        ? 'border-2 border-[#0E0D15] bg-[#C6FF3D] text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15]'
                        : 'text-muted hover:text-ink border-2 border-transparent'
                    }`}
                  >
                    {tab === 'housing' && t('town.shop.tabHousing')}
                    {tab === 'service' && t('town.shop.tabServices')}
                    {tab === 'plot' && t('town.shop.tabFarm')}
                    {tab === 'decor' && t('town.shop.tabDecor')}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {catalogList.map((item) => {
                  const canAfford = walletBalance >= item.priceCoins;
                  const levelLocked = item.unlockLevel > maxLevel;
                  const disabled = !canAfford || levelLocked;
                  const sprite = CATALOG_SPRITES[item.spriteKey];

                  return (
                    <div
                      key={item.id}
                      className="border-border bg-surface-2 flex items-center justify-between gap-3 rounded-xl border-2 p-3 shadow-[2px_2px_0px_0px_#0E0D15]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="border-border bg-surface flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2">
                          {sprite && !sprite.isPlaceholder ? (
                            <img
                              src={sprite.src}
                              alt=""
                              width={sprite.width}
                              height={sprite.height}
                              loading="lazy"
                              decoding="async"
                              className="block h-11 w-11 select-none object-contain"
                              draggable={false}
                            />
                          ) : (
                            <span className="text-muted font-mono text-[10px] font-black uppercase">
                              {item.id.slice(0, 3)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-ink text-sm font-black">{t(item.nameKey)}</span>
                            {item.proOnly && (
                              <span className="rounded border border-[#0E0D15] bg-[#C6FF3D] px-1.5 py-0.5 text-[9px] font-black text-[#0E0D15]">
                                {t('town.shop.proOnly')}
                              </span>
                            )}
                            {levelLocked && (
                              <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-700 dark:text-red-300">
                                {t('town.shop.unlockLevel', { level: item.unlockLevel })}
                              </span>
                            )}
                          </div>
                          <p className="text-muted text-xs">
                            {item.housing &&
                              `${t('town.shop.housingValue', { count: item.housing })} `}
                            {item.supports &&
                              `${t('town.shop.serviceValue', { count: item.supports })} `}
                            {item.footprint.w > 1 && `(${item.footprint.w}×${item.footprint.h})`}
                          </p>
                          <p className="text-ink inline-flex items-center gap-1 font-mono text-xs font-black tabular-nums">
                            <RonCoinIcon size={14} />
                            {t('town.shop.priceCoins', { coins: item.priceCoins })}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onStartPlace(item.id)}
                        className={`min-h-[44px] shrink-0 rounded-xl border-2 border-[#0E0D15] px-3.5 text-xs font-black ${
                          disabled
                            ? 'bg-surface text-muted cursor-not-allowed opacity-50'
                            : 'cursor-pointer bg-[#C6FF3D] text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15]'
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
                <h3 className="text-ink font-display text-base font-black">
                  {selectedTile.itemId === 'empty'
                    ? t('town.map.groundCell', { x: selectedTile.x, y: selectedTile.y })
                    : selectedTile.itemId === 'plot'
                      ? selectedTile.cropId
                        ? t(`town.crops.${selectedTile.cropId}.name`)
                        : t('town.tiles.emptyPlot')
                      : catalog.items[selectedTile.itemId]?.nameKey
                        ? t(catalog.items[selectedTile.itemId]!.nameKey)
                        : selectedTile.itemId}
                </h3>
              </div>

              {isVisitMode && (
                <div className="border-border bg-surface-2 text-muted rounded-xl border-2 p-3 text-center text-xs font-bold">
                  {t('town.visit.readOnlyNotice')}
                </div>
              )}

              {isVisitMode &&
                townHelpEnabled &&
                selectedTile.itemId === 'plot' &&
                selectedTile.cropId && (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await onWaterCrop(
                        selectedTile.x,
                        selectedTile.y,
                        `${t('town.visit.water')} ✓`,
                      );
                      if (ok) closeSheet();
                    }}
                    disabled={waterLoading}
                    className="flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-[#0E0D15] bg-[#3D7BFF] text-sm font-black text-white shadow-[2px_2px_0px_0px_#0E0D15] disabled:opacity-50"
                  >
                    💧 {t('town.visit.water')}
                  </button>
                )}

              {!isVisitMode && selectedTile.itemId === 'empty' && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShopTab('housing');
                      openSheet('shop');
                    }}
                    className="flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-[#0E0D15] bg-[#C6FF3D] text-sm font-black text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15]"
                  >
                    <Hammer size={18} weight="fill" aria-hidden="true" />
                    {t('town.toolbar.build')}
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await onBuyPlot(selectedTile.x, selectedTile.y);
                      if (ok) closeSheet();
                    }}
                    className="border-border bg-surface-2 text-ink flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 text-sm font-black shadow-[2px_2px_0px_0px_#0E0D15]"
                  >
                    <RonCoinIcon size={16} />
                    {t('town.catalog.farm_plot.name')} (
                    {t('town.shop.priceCoins', {
                      coins: getPlotPrice(town?.plotsOwned ?? 2),
                    })}
                    )
                  </button>
                </div>
              )}

              {!isVisitMode && selectedTile.itemId === 'plot' && !selectedTile.cropId && (
                <div className="space-y-2">
                  {cropItems.map((crop) => {
                    const locked = crop.unlockLevel > maxLevel;
                    const canAfford = walletBalance >= crop.priceCoins;
                    const icon = CROP_BUTTON_SPRITES[crop.id];
                    return (
                      <div
                        key={crop.id}
                        className="border-border bg-surface-2 flex items-center justify-between gap-2 rounded-xl border-2 p-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          {icon && (
                            <img
                              src={icon.src}
                              alt=""
                              width={icon.width}
                              height={icon.height}
                              loading="lazy"
                              decoding="async"
                              className="block h-10 w-10 shrink-0 select-none object-contain"
                              draggable={false}
                            />
                          )}
                          <div>
                            <p className="text-ink text-xs font-black">{t(crop.nameKey)}</p>
                            <p className="text-muted text-[11px]">{t(crop.descKey)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={locked || !canAfford}
                          onClick={async () => {
                            const ok = await onPlantCrop(selectedTile.x, selectedTile.y, crop.id);
                            if (ok) closeSheet();
                          }}
                          className={`min-h-[44px] shrink-0 rounded-xl border-2 border-[#0E0D15] px-3 text-xs font-black ${
                            locked || !canAfford
                              ? 'bg-surface text-muted cursor-not-allowed opacity-50'
                              : 'cursor-pointer bg-[#C6FF3D] text-[#0E0D15] shadow-[1px_1px_0px_0px_#0E0D15]'
                          }`}
                        >
                          {locked
                            ? `Lv${crop.unlockLevel}`
                            : `${t('town.tiles.plantAction')} (${crop.priceCoins})`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {!isVisitMode && selectedTile.itemId === 'plot' && selectedTile.cropId && (
                <div className="space-y-3">
                  <div className="border-border bg-surface-2 flex items-center justify-center gap-3 rounded-xl border-2 p-4">
                    <img
                      src={
                        selectedTileGrowth?.isReady
                          ? UI_SPRITES.farmReady.src
                          : UI_SPRITES.farmGrowing.src
                      }
                      alt=""
                      width={UI_SPRITES.farmReady.width}
                      height={UI_SPRITES.farmReady.height}
                      loading="lazy"
                      decoding="async"
                      className="block h-9 w-9 select-none object-contain"
                      draggable={false}
                    />
                    <p className="text-ink text-sm font-black">
                      {selectedTileGrowth?.isReady
                        ? t('town.tiles.ready')
                        : t('town.tiles.growing', {
                            time: formatDurationShort(selectedTileGrowth?.remainingSeconds ?? 0),
                          })}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!selectedTileGrowth?.isReady}
                    onClick={async () => {
                      const ok = await onHarvestCrop(selectedTile.x, selectedTile.y);
                      if (ok) closeSheet();
                    }}
                    className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-[#0E0D15] text-sm font-black ${
                      selectedTileGrowth?.isReady
                        ? 'cursor-pointer bg-[#C6FF3D] text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15]'
                        : 'bg-surface text-muted cursor-not-allowed opacity-50'
                    }`}
                  >
                    <Plant size={18} weight="fill" aria-hidden="true" />
                    {t('town.tiles.harvestAction')}
                  </button>
                </div>
              )}

              {!isVisitMode &&
                selectedTile.itemId !== 'empty' &&
                selectedTile.itemId !== 'plot' && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => onStartMove(selectedTile)}
                      className="border-border bg-surface-2 text-ink flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 text-sm font-black shadow-[2px_2px_0px_0px_#0E0D15]"
                    >
                      <ArrowsOutCardinal size={18} weight="bold" aria-hidden="true" />
                      {t('town.tiles.move')}
                    </button>

                    {selectedTile.itemId !== 'starter_house' ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await onRemoveTile(selectedTile.x, selectedTile.y);
                          if (ok) closeSheet();
                        }}
                        className="flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-[#FF5A4E] bg-[#FF5A4E]/15 text-sm font-black text-[#D7261E] dark:text-[#FF857D]"
                      >
                        <Trash size={18} weight="bold" aria-hidden="true" />
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
            <div className="border-border bg-surface-2 space-y-2.5 rounded-xl border-2 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted font-bold">{t('town.toolbar.stats')}</span>
                <span className="text-ink font-mono font-black tabular-nums">
                  {population} / {populationCap}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted font-bold">{t('town.shop.tabHousing')}</span>
                <span className="text-ink font-mono font-black tabular-nums">
                  {housingCapacity}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted font-bold">{t('town.shop.tabServices')}</span>
                <span className="text-ink font-mono font-black tabular-nums">
                  {serviceCapacity}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted font-bold">{t('town.chips.level', { level })}</span>
                <span className="text-ink font-mono font-black tabular-nums">
                  {gridSize} × {gridSize} ({landCount})
                </span>
              </div>
              {growthBottleneck && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                  {growthBottleneck}
                </p>
              )}
            </div>
          )}

          {/* VISIT FRIENDS SHEET */}
          {activeSheet === 'visit' && (
            <div className="space-y-4">
              <div className="border-border bg-surface-2 flex flex-col items-center rounded-xl border-2 p-4 text-center">
                <img
                  src={UI_SPRITES.visit.src}
                  alt=""
                  width={UI_SPRITES.visit.width}
                  height={UI_SPRITES.visit.height}
                  loading="lazy"
                  decoding="async"
                  className="block h-14 w-14 select-none object-contain"
                  draggable={false}
                />
                <h3 className="text-ink font-display mt-2 text-sm font-black">
                  {t('town.toolbar.visit')}
                </h3>
                <p className="text-muted mt-1 text-xs">{t('town.visit.readOnlyNotice')}</p>
              </div>
              <Link
                href={`/${locale}/leagues`}
                prefetch={false}
                onClick={closeSheet}
                className="flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-[#0E0D15] bg-[#C6FF3D] text-sm font-black text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15]"
              >
                {t('nav.leagues')}
              </Link>
            </div>
          )}

          {/* COIN STORE SHEET (prices & packs unchanged) */}
          {activeSheet === 'coins' && (
            <div className="space-y-4">
              <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/10 p-3 text-center">
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
                    className={`relative flex flex-col justify-between rounded-2xl border-2 p-3.5 shadow-[2px_2px_0px_0px_#0E0D15] ${
                      pack.popular
                        ? 'border-[#0E0D15] bg-[#C6FF3D]/20'
                        : 'border-border bg-surface-2'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <RonCoinIcon size={28} variant="stack" />
                      <div>
                        <span className="text-ink font-mono text-base font-black tabular-nums">
                          {pack.coins.toLocaleString()}
                        </span>
                        <span className="text-muted ml-1 text-xs font-bold">RonCoins</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void onCoinCheckout(pack.id)}
                      className="mt-3 flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-xl border-2 border-[#0E0D15] bg-[#C6FF3D] text-xs font-black text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15]"
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
              <div className="border-border bg-surface-2 rounded-xl border-2 p-3 text-center">
                <p className="text-muted text-xs font-bold">{t('town.transfer.desc')}</p>
                {transferStatus && (
                  <p className="text-ink mt-1 text-[11px] font-black">
                    {t('town.transfer.dailyCapNotice', {
                      remaining: transferStatus.dailyRemaining,
                    })}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="rt-transfer-recipient"
                    className="text-ink mb-1 block text-xs font-black"
                  >
                    {t('town.transfer.recipientLabel')}
                  </label>
                  <input
                    id="rt-transfer-recipient"
                    type="text"
                    value={transferRecipient}
                    onChange={(e) => setTransferRecipient(e.target.value)}
                    placeholder="uid"
                    className="border-border bg-surface text-ink min-h-[44px] w-full rounded-xl border-2 px-3 text-xs font-bold"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rt-transfer-amount"
                    className="text-ink mb-1 block text-xs font-black"
                  >
                    {t('town.transfer.amountLabel')} (1–{transferStatus?.dailyRemaining ?? 50})
                  </label>
                  <input
                    id="rt-transfer-amount"
                    type="number"
                    min={1}
                    max={transferStatus?.dailyRemaining ?? 50}
                    value={transferAmount}
                    onChange={(e) =>
                      setTransferAmount(Math.max(1, parseInt(e.target.value || '1', 10)))
                    }
                    className="border-border bg-surface text-ink min-h-[44px] w-full rounded-xl border-2 px-3 font-mono text-xs font-bold tabular-nums"
                  />
                </div>

                <button
                  type="button"
                  disabled={
                    transferLoading ||
                    !transferRecipient ||
                    transferAmount <= 0 ||
                    !transferStatus?.isPro
                  }
                  onClick={async () => {
                    const ok = await onTransfer(transferRecipient, transferAmount);
                    if (ok) closeSheet();
                  }}
                  className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-[#0E0D15] text-xs font-black ${
                    transferLoading ||
                    !transferRecipient ||
                    transferAmount <= 0 ||
                    !transferStatus?.isPro
                      ? 'bg-surface text-muted cursor-not-allowed opacity-50'
                      : 'cursor-pointer bg-[#C6FF3D] text-[#0E0D15] shadow-[2px_2px_0px_0px_#0E0D15]'
                  }`}
                >
                  <Gift size={16} weight="bold" aria-hidden="true" />
                  <span>{t('town.transfer.send')}</span>
                </button>
              </div>
            </div>
          )}

          {/* HELP SHEET */}
          {activeSheet === 'help' && (
            <div className="border-border bg-surface-2 text-ink rounded-xl border-2 p-4 text-sm leading-relaxed">
              {t('town.map.helpBody')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
