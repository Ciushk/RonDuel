'use client';

import { CheckCircle, X } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';

import { Button, Chip, Sheet } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import {
  promptInstall,
  recordInstallAccepted,
  recordInstallIosGotIt,
  recordInstallLater,
} from '@/lib/install-prompt';
import { iosVersion, isIPad, type InstallPlatform } from '@/lib/pwa-env';

export interface InstallAppSheetProps {
  open: boolean;
  platform: Exclude<InstallPlatform, 'none'>;
  onClose: () => void;
}

function PixelShareIcon() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Up arrow in Duel Blue Strong (#1E4FD8) */}
      <rect x="7" y="1" width="2" height="1" fill="#1E4FD8" />
      <rect x="6" y="2" width="4" height="1" fill="#1E4FD8" />
      <rect x="5" y="3" width="2" height="1" fill="#1E4FD8" />
      <rect x="9" y="3" width="2" height="1" fill="#1E4FD8" />
      <rect x="4" y="4" width="2" height="1" fill="#1E4FD8" />
      <rect x="10" y="4" width="2" height="1" fill="#1E4FD8" />
      <rect x="7" y="2" width="2" height="7" fill="#1E4FD8" />
      {/* Open-top pixel square */}
      <rect x="2" y="6" width="4" height="2" fill="#1E4FD8" />
      <rect x="10" y="6" width="4" height="2" fill="#1E4FD8" />
      <rect x="2" y="6" width="2" height="9" fill="#1E4FD8" />
      <rect x="12" y="6" width="2" height="9" fill="#1E4FD8" />
      <rect x="2" y="13" width="12" height="2" fill="#1E4FD8" />
    </svg>
  );
}

function PixelAddToHomeIcon() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Pixel square frame in ink (#0E0D15) */}
      <rect x="3" y="2" width="10" height="2" fill="#0E0D15" />
      <rect x="3" y="12" width="10" height="2" fill="#0E0D15" />
      <rect x="2" y="3" width="2" height="10" fill="#0E0D15" />
      <rect x="12" y="3" width="2" height="10" fill="#0E0D15" />
      {/* Center plus */}
      <rect x="7" y="5" width="2" height="6" fill="#0E0D15" />
      <rect x="5" y="7" width="6" height="2" fill="#0E0D15" />
    </svg>
  );
}

function PixelAddButtonTile() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-[34px] min-w-[38px] shrink-0 items-center justify-center rounded-[8px] border-2 border-[#0E0D15] bg-[#C6FF3D] px-1.5 font-mono text-[11px] font-extrabold leading-none text-[#1E4FD8] shadow-[0_2px_0_0_#0E0D15]"
    >
      Add
    </span>
  );
}

export function InstallAppSheet({ open, platform, onClose }: InstallAppSheetProps) {
  const t = useTranslations();
  const titleId = useId();
  const descId = useId();
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [busy, setBusy] = useState(false);
  const [installedThanks, setInstalledThanks] = useState(false);

  const isIos = platform === 'ios-howto';
  const showIphonePointer = isIos && !isIPad();
  const detectedIosVersion = isIos ? iosVersion() : null;
  const isOldIos = detectedIosVersion !== null && detectedIosVersion < 16.4;

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setInstalledThanks(false);
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleDismissAsLater = () => {
    if (installedThanks) {
      onClose();
      return;
    }
    recordInstallLater();
    trackEvent('install_prompt_result', { platform, outcome: 'later' });
    onClose();
  };

  const handleChromiumInstall = async () => {
    if (busy || installedThanks) return;
    setBusy(true);
    const outcome = await promptInstall();
    setBusy(false);

    if (outcome === 'accepted') {
      recordInstallAccepted();
      trackEvent('install_prompt_result', { platform: 'chromium-prompt', outcome: 'accepted' });
      setInstalledThanks(true);
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        onClose();
      }, 1200);
      return;
    }

    recordInstallLater();
    trackEvent('install_prompt_result', { platform: 'chromium-prompt', outcome });
    onClose();
  };

  const handleIosGotIt = () => {
    recordInstallIosGotIt();
    trackEvent('install_prompt_result', { platform: 'ios-howto', outcome: 'got_it' });
    onClose();
  };

  const sheetTitle = isIos ? t('install.iosTitle') : t('install.title');

  return (
    <Sheet
      open={open}
      onClose={handleDismissAsLater}
      title={sheetTitle}
      labelledBy={titleId}
      describedBy={descId}
      trapFocus
      initialFocusRef={primaryBtnRef}
      hideHeader
      animate
      className="relative"
    >
      <div data-testid="install-app-sheet" data-platform={platform} className="space-y-4">
        {/* Top bar with close button (X counts as Later) */}
        <div className="flex items-start justify-between gap-3">
          {!isIos ? (
            <div className="flex items-center gap-3.5">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-[#0E0D15] bg-[#FFF7EC] shadow-[0_3px_0_0_#0E0D15]">
                <img
                  src="/brand/icon-192.png"
                  alt=""
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-1.5">
                <Chip tone="volt" className="px-2 py-0.5 text-[11px] font-extrabold">
                  {t('install.freePill')}
                </Chip>
                <h2
                  id={titleId}
                  className="font-display text-ink text-xl font-extrabold leading-tight"
                >
                  {t('install.title')}
                </h2>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <h2
                id={titleId}
                className="font-display text-ink text-xl font-extrabold leading-tight"
              >
                {t('install.iosTitle')}
              </h2>
              <p id={descId} className="text-muted text-sm font-bold">
                {t('install.iosSubtitle')}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleDismissAsLater}
            aria-label={t('common.close')}
            data-testid="install-close-btn"
            className="border-border-subtle bg-surface-2 text-ink inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border"
          >
            <X size={20} weight="bold" aria-hidden="true" />
          </button>
        </div>

        {/* Chromium / Android body */}
        {!isIos ? (
          installedThanks ? (
            <div
              role="status"
              data-testid="install-thanks-banner"
              className="flex items-center gap-3 rounded-2xl border-2 border-[#0E0D15] bg-[#C6FF3D] p-4 text-[#0E0D15] shadow-[0_3px_0_0_#0E0D15]"
            >
              <CheckCircle size={24} weight="fill" aria-hidden="true" className="shrink-0" />
              <p id={descId} className="text-sm font-extrabold leading-snug">
                {t('install.thanks')}
              </p>
            </div>
          ) : (
            <>
              <ul id={descId} className="space-y-2.5">
                <li className="border-border-subtle bg-surface-2 text-ink flex items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2.5 text-sm font-bold">
                  {t('install.benefitFast')}
                </li>
                <li className="border-border-subtle bg-surface-2 text-ink flex items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2.5 text-sm font-bold">
                  {t('install.benefitReminders')}
                </li>
                <li className="border-border-subtle bg-surface-2 text-ink flex items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2.5 text-sm font-bold">
                  {t('install.benefitTown')}
                </li>
              </ul>

              <div className="space-y-2 pt-1">
                <Button
                  ref={primaryBtnRef}
                  fullWidth
                  size="lg"
                  variant="primary"
                  disabled={busy}
                  onClick={() => void handleChromiumInstall()}
                  data-testid="install-cta-btn"
                >
                  {t('install.installCta')}
                </Button>
                <Button
                  fullWidth
                  size="sm"
                  variant="ghost"
                  onClick={handleDismissAsLater}
                  data-testid="install-later-btn"
                >
                  {t('install.later')}
                </Button>
              </div>
            </>
          )
        ) : (
          /* iOS / iPadOS How-To body */
          <>
            <ol className="space-y-2.5">
              <li className="rd-install-step rd-install-step-1 flex items-center gap-3 rounded-2xl border-2 border-[#0E0D15] bg-[#FFF7EC] px-3 py-2.5 text-[#0E0D15] shadow-[0_2px_0_0_#0E0D15]">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0E0D15] font-mono text-xs font-extrabold text-[#C6FF3D]"
                >
                  1
                </span>
                <PixelShareIcon />
                <span className="text-sm font-bold leading-snug">{t('install.iosStep1')}</span>
              </li>

              <li className="rd-install-step rd-install-step-2 flex items-center gap-3 rounded-2xl border-2 border-[#0E0D15] bg-[#FFF7EC] px-3 py-2.5 text-[#0E0D15] shadow-[0_2px_0_0_#0E0D15]">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0E0D15] font-mono text-xs font-extrabold text-[#C6FF3D]"
                >
                  2
                </span>
                <PixelAddToHomeIcon />
                <span className="text-sm font-bold leading-snug">{t('install.iosStep2')}</span>
              </li>

              <li className="rd-install-step rd-install-step-3 flex items-center gap-3 rounded-2xl border-2 border-[#0E0D15] bg-[#FFF7EC] px-3 py-2.5 text-[#0E0D15] shadow-[0_2px_0_0_#0E0D15]">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0E0D15] font-mono text-xs font-extrabold text-[#C6FF3D]"
                >
                  3
                </span>
                <PixelAddButtonTile />
                <span className="text-sm font-bold leading-snug">{t('install.iosStep3')}</span>
              </li>
            </ol>

            {/* Push reminder note for iOS 16.4+ / older iOS */}
            <div
              data-testid="install-ios-note"
              className="border-border-subtle bg-surface-2 text-ink flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold leading-snug"
            >
              <span aria-hidden="true" className="shrink-0 text-sm leading-tight">
                🔔
              </span>
              <span>{isOldIos ? t('install.iosOldNote') : t('install.iosPushNote')}</span>
            </div>

            <div className="space-y-1.5 pt-0.5">
              <Button
                ref={primaryBtnRef}
                fullWidth
                size="lg"
                variant="volt"
                onClick={handleIosGotIt}
                data-testid="install-got-it-btn"
              >
                {t('install.gotIt')}
              </Button>
              <Button
                fullWidth
                size="sm"
                variant="ghost"
                onClick={handleDismissAsLater}
                data-testid="install-later-btn"
              >
                {t('install.later')}
              </Button>
            </div>

            {/* Bottom-center pointer toward iPhone Safari toolbar Share icon (hidden on iPad) */}
            {showIphonePointer && (
              <div
                data-testid="install-ios-pointer"
                aria-hidden="true"
                className="rd-install-pointer text-duel-strong flex justify-center pt-0.5 text-base font-black leading-none"
              >
                ▼
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
