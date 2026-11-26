'use client';

import { useTranslations } from 'next-intl';
import { UI_SPRITES } from './sprites';

export type SeedChoiceId = 'wheat' | 'cabbage' | 'pumpkin';

interface ActionBarProps {
  visible: boolean;
  onToggleVisible: () => void;
  moveModeActive: boolean;
  rotateModeActive: boolean;
  farmMenuOpen: boolean;
  selectedSeed: SeedChoiceId | null;
  maxLevel: number;
  onOpenBuild: () => void;
  onToggleMoveMode: () => void;
  onToggleRotateMode: () => void;
  onToggleFarmMenu: () => void;
  onSelectSeed: (seed: SeedChoiceId) => void;
  onOpenVisit: () => void;
  onOpenShop: () => void;
}

const FAN_OUT_SEEDS: ReadonlyArray<{
  id: SeedChoiceId;
  sprite:
    | (typeof UI_SPRITES)['seedWheat']
    | (typeof UI_SPRITES)['seedCabbage']
    | (typeof UI_SPRITES)['seedPumpkin'];
  unlockLevel: number;
  labelKey: string;
  staggerMs: number;
}> = [
  {
    id: 'wheat',
    sprite: UI_SPRITES.seedWheat,
    unlockLevel: 1,
    labelKey: 'town.crops.wheat.name',
    staggerMs: 0,
  },
  {
    id: 'cabbage',
    sprite: UI_SPRITES.seedCabbage,
    unlockLevel: 1,
    labelKey: 'town.crops.cabbage.name',
    staggerMs: 60,
  },
  {
    id: 'pumpkin',
    sprite: UI_SPRITES.seedPumpkin,
    unlockLevel: 4,
    labelKey: 'town.crops.pumpkin.name',
    staggerMs: 120,
  },
];

const ACTION_BTN_CLASS =
  'pointer-events-auto flex h-14 w-14 min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl border-2 border-[#0E0D15] bg-[#FFF7EC] p-1 shadow-[2px_2px_0px_0px_#0E0D15] transition-transform hover:scale-105 active:translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF] motion-reduce:transition-none lg:h-16 lg:w-16';

export function ActionBar({
  visible,
  onToggleVisible,
  moveModeActive,
  rotateModeActive,
  farmMenuOpen,
  selectedSeed,
  maxLevel,
  onOpenBuild,
  onToggleMoveMode,
  onToggleRotateMode,
  onToggleFarmMenu,
  onSelectSeed,
  onOpenVisit,
  onOpenShop,
}: ActionBarProps) {
  const t = useTranslations();

  return (
    <aside
      aria-label={t('town.toolbar.ariaLabel')}
      className="pointer-events-none absolute end-2 top-1/2 z-20 flex -translate-y-1/2 flex-col items-end gap-1.5 lg:end-4 lg:gap-2"
    >
      {/* Main vertical stack of hi-res controls (slides off-screen when collapsed) */}
      <div
        aria-hidden={!visible}
        className={`pointer-events-none flex flex-col items-end gap-1.5 transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none lg:gap-2 ${
          visible ? 'translate-x-0 opacity-100' : 'invisible translate-x-24 opacity-0'
        }`}
      >
        {/* 1. Build */}
        <button
          type="button"
          tabIndex={visible ? 0 : -1}
          onClick={onOpenBuild}
          aria-label={t('town.toolbar.build')}
          title={t('town.toolbar.build')}
          className={ACTION_BTN_CLASS}
        >
          <img
            src={UI_SPRITES.build.src}
            alt=""
            width={UI_SPRITES.build.width}
            height={UI_SPRITES.build.height}
            className="block h-full w-full select-none object-contain"
            draggable={false}
          />
        </button>

        {/* 2. Move */}
        <button
          type="button"
          tabIndex={visible ? 0 : -1}
          onClick={onToggleMoveMode}
          aria-label={t('town.toolbar.move')}
          aria-pressed={moveModeActive}
          title={t('town.toolbar.move')}
          className={`${ACTION_BTN_CLASS} ${moveModeActive ? 'bg-[#C6FF3D]' : 'bg-[#FFF7EC]'}`}
        >
          <img
            src={UI_SPRITES.move.src}
            alt=""
            width={UI_SPRITES.move.width}
            height={UI_SPRITES.move.height}
            className="block h-full w-full select-none object-contain"
            draggable={false}
          />
        </button>

        {/* 2b. Rotate */}
        <button
          type="button"
          data-testid="toolbar-rotate-btn"
          tabIndex={visible ? 0 : -1}
          onClick={onToggleRotateMode}
          aria-label={t('town.toolbar.rotate')}
          aria-pressed={rotateModeActive}
          title={t('town.toolbar.rotate')}
          className={`${ACTION_BTN_CLASS} ${rotateModeActive ? 'bg-[#C6FF3D]' : 'bg-[#FFF7EC]'}`}
        >
          <img
            src={UI_SPRITES.rotate.src}
            alt=""
            width={UI_SPRITES.rotate.width}
            height={UI_SPRITES.rotate.height}
            className="block h-full w-full select-none object-contain"
            draggable={false}
          />
        </button>

        {/* 3. Farm / Plant with staggered 3-seed fan-out (60ms stagger, 200ms total) */}
        <div className="relative flex items-center justify-end">
          <div
            role="group"
            aria-label={t('town.toolbar.seedMenu')}
            aria-hidden={!farmMenuOpen || !visible}
            className={`me-2 flex items-center gap-1.5 lg:gap-2 ${
              farmMenuOpen && visible
                ? 'pointer-events-auto visible'
                : 'pointer-events-none invisible'
            }`}
          >
            {FAN_OUT_SEEDS.map((seed) => {
              const locked = seed.unlockLevel > maxLevel;
              const isSelected = selectedSeed === seed.id;
              const cropName = t(seed.labelKey);
              const seedAria = locked
                ? `${cropName} (${t('town.shop.unlockLevel', { level: seed.unlockLevel })})`
                : t('town.toolbar.plantSeed', { crop: cropName });
              const open = farmMenuOpen && visible;

              return (
                <button
                  key={seed.id}
                  type="button"
                  tabIndex={open ? 0 : -1}
                  disabled={locked}
                  onClick={() => onSelectSeed(seed.id)}
                  aria-label={seedAria}
                  aria-pressed={isSelected}
                  title={seedAria}
                  style={{
                    transitionDelay: farmMenuOpen ? `${seed.staggerMs}ms` : '0ms',
                  }}
                  className={`focus-visible:outline-3 relative flex h-14 min-h-[44px] w-14 min-w-[44px] items-center justify-center rounded-full border-2 border-[#0E0D15] p-1 shadow-[2px_2px_0px_0px_#0E0D15] transition-[transform,opacity] duration-[80ms] ease-out focus-visible:outline-offset-2 focus-visible:outline-[#3D7BFF] motion-reduce:transition-none lg:h-16 lg:w-16 ${
                    locked
                      ? 'cursor-not-allowed bg-[#E7E2D8]'
                      : isSelected
                        ? 'cursor-pointer bg-[#C6FF3D]'
                        : 'cursor-pointer bg-[#FFF7EC] hover:scale-105'
                  } ${
                    open
                      ? locked
                        ? 'translate-x-0 scale-100 opacity-65'
                        : 'translate-x-0 scale-100 opacity-100'
                      : 'translate-x-3 scale-75 opacity-0'
                  }`}
                >
                  <img
                    src={seed.sprite.src}
                    alt=""
                    width={seed.sprite.width}
                    height={seed.sprite.height}
                    loading="lazy"
                    decoding="async"
                    className="block h-full w-full select-none object-contain"
                    draggable={false}
                  />
                  {locked && (
                    <span className="absolute -bottom-1 rounded bg-[#0E0D15] px-1 font-mono text-[10px] font-black text-[#FFF7EC]">
                      Lv{seed.unlockLevel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            tabIndex={visible ? 0 : -1}
            onClick={onToggleFarmMenu}
            aria-label={t('town.toolbar.farm')}
            aria-expanded={farmMenuOpen}
            title={t('town.toolbar.farm')}
            className={`${ACTION_BTN_CLASS} ${
              farmMenuOpen || selectedSeed ? 'bg-[#C6FF3D]' : 'bg-[#FFF7EC]'
            }`}
          >
            <img
              src={UI_SPRITES.plant.src}
              alt=""
              width={UI_SPRITES.plant.width}
              height={UI_SPRITES.plant.height}
              className="block h-full w-full select-none object-contain"
              draggable={false}
            />
          </button>
        </div>

        {/* 4. Visit */}
        <button
          type="button"
          tabIndex={visible ? 0 : -1}
          onClick={onOpenVisit}
          aria-label={t('town.toolbar.visit')}
          title={t('town.toolbar.visit')}
          className={ACTION_BTN_CLASS}
        >
          <img
            src={UI_SPRITES.visit.src}
            alt=""
            width={UI_SPRITES.visit.width}
            height={UI_SPRITES.visit.height}
            className="block h-full w-full select-none object-contain"
            draggable={false}
          />
        </button>

        {/* 5. Shop */}
        <button
          type="button"
          tabIndex={visible ? 0 : -1}
          onClick={onOpenShop}
          aria-label={t('town.toolbar.shop')}
          title={t('town.toolbar.shop')}
          className={ACTION_BTN_CLASS}
        >
          <img
            src={UI_SPRITES.coinsShop.src}
            alt=""
            width={UI_SPRITES.coinsShop.width}
            height={UI_SPRITES.coinsShop.height}
            className="block h-full w-full select-none object-contain"
            draggable={false}
          />
        </button>
      </div>

      {/* 6. Hide / Show bar toggle — always visible, mirrors with scaleX(-1) when collapsed */}
      <button
        type="button"
        onClick={onToggleVisible}
        aria-label={visible ? t('town.toolbar.hideBar') : t('town.toolbar.showBar')}
        aria-expanded={visible}
        title={visible ? t('town.toolbar.hideBar') : t('town.toolbar.showBar')}
        className={`pointer-events-auto ${ACTION_BTN_CLASS}`}
      >
        <img
          src={UI_SPRITES.hideBar.src}
          alt=""
          width={UI_SPRITES.hideBar.width}
          height={UI_SPRITES.hideBar.height}
          className="block h-full w-full select-none object-contain"
          style={{ transform: visible ? 'scaleX(1)' : 'scaleX(-1)' }}
          draggable={false}
        />
      </button>
    </aside>
  );
}
