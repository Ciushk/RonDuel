'use client';

import { BellSlash, CheckCircle, PaperPlaneTilt, WarningCircle } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Button, Card } from '@/components/ui';
import {
  dismissPushCard,
  enablePush,
  getPushPlatform,
  sendTestPush,
  shouldShowPushOptInCard,
  type PushPlatform,
} from '@/lib/push';

export interface PushOptInCardProps {
  finishedPlaysCount: number;
  anySheetOpen?: boolean;
  uid?: string;
}

type CardViewState = 'idle' | 'granted' | 'denied' | 'error';

function blockedHelpKey(platform: PushPlatform) {
  if (platform === 'android') return 'push.blockedHelpAndroid' as const;
  if (platform === 'ios') return 'push.blockedHelpIos' as const;
  return 'push.blockedHelpDesktop' as const;
}

export function PushOptInCard({
  finishedPlaysCount,
  anySheetOpen = false,
  uid,
}: PushOptInCardProps) {
  const t = useTranslations();
  const locale = useLocale();

  const [eligible, setEligible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewState, setViewState] = useState<CardViewState>('idle');
  const [testBusy, setTestBusy] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [testError, setTestError] = useState(false);

  useEffect(() => {
    if (viewState !== 'idle') return;
    setEligible(
      shouldShowPushOptInCard({
        finishedPlaysCount,
        anySheetOpen,
      }),
    );
  }, [finishedPlaysCount, anySheetOpen, viewState]);

  if (dismissed) return null;
  if (viewState === 'idle' && (!eligible || anySheetOpen)) return null;

  const platform = getPushPlatform();

  const handleEnable = () => {
    if (busy) return;
    setBusy(true);
    // Call enablePush synchronously in the click handler so Notification.requestPermission()
    // runs without any preceding await (required on iOS Safari PWA).
    void enablePush({ locale, uid }).then((outcome) => {
      setBusy(false);
      if (outcome === 'granted') {
        setViewState('granted');
      } else if (outcome === 'denied') {
        setViewState('denied');
      } else if (outcome === 'default') {
        setViewState('idle');
      } else {
        setViewState('error');
      }
    });
  };

  const handleNotNow = () => {
    dismissPushCard();
    setDismissed(true);
  };

  const handleSendTest = async () => {
    if (testBusy) return;
    setTestBusy(true);
    setTestError(false);
    const res = await sendTestPush(locale);
    setTestBusy(false);
    if (res.ok) {
      setTestSent(true);
    } else {
      setTestError(true);
    }
  };

  return (
    <Card
      data-testid="push-opt-in-card"
      data-state={viewState}
      className="rd-push-card-enter space-y-3.5 p-4"
    >
      {viewState === 'idle' && (
        <div className="rd-push-state-fade space-y-3.5">
          <div className="flex items-start gap-3.5">
            <div
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 -rotate-[4deg] items-center justify-center rounded-2xl border-2 border-[#0E0D15] bg-[#FFC53D] text-2xl shadow-[0_3px_0_0_#0E0D15] motion-reduce:rotate-0"
            >
              🔔
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="font-display text-ink text-lg font-extrabold leading-tight">
                {t('push.title')}
              </h2>
              <p className="text-muted text-xs font-medium leading-snug">{t('push.body')}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:flex-row">
            <Button
              fullWidth
              size="md"
              variant="primary"
              disabled={busy}
              onClick={handleEnable}
              data-testid="push-enable-btn"
            >
              {t('push.enable')}
            </Button>
            <Button
              fullWidth
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={handleNotNow}
              data-testid="push-not-now-btn"
              className="sm:w-auto sm:shrink-0"
            >
              {t('push.notNow')}
            </Button>
          </div>
        </div>
      )}

      {viewState === 'granted' && (
        <div
          role="status"
          data-testid="push-granted-state"
          className="rd-push-state-fade flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle
                size={24}
                weight="fill"
                aria-hidden="true"
                className="text-correct-text shrink-0"
              />
              <span className="font-display text-ink text-base font-extrabold">
                {t('push.enabledState')}
              </span>
            </div>
            <button
              type="button"
              disabled={testBusy}
              onClick={() => void handleSendTest()}
              data-testid="push-send-test-btn"
              className="text-duel-strong hover:text-ink inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 px-2 text-xs font-extrabold underline underline-offset-4 disabled:opacity-50"
            >
              <PaperPlaneTilt size={15} weight="bold" aria-hidden="true" />
              <span>{t('push.sendTest')}</span>
            </button>
          </div>
          {testSent && (
            <p
              data-testid="push-test-sent-msg"
              className="border-border-subtle bg-surface-2 text-ink flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
            >
              <CheckCircle
                size={16}
                weight="fill"
                aria-hidden="true"
                className="text-correct-text shrink-0"
              />
              <span>{t('push.testSent')}</span>
            </p>
          )}
          {testError && (
            <p className="text-wrong flex items-center gap-1.5 text-xs font-bold">
              <WarningCircle size={16} weight="fill" aria-hidden="true" className="shrink-0" />
              <span>{t('push.error')}</span>
            </p>
          )}
        </div>
      )}

      {viewState === 'denied' && (
        <div
          role="status"
          data-testid="push-denied-state"
          className="rd-push-state-fade flex items-start gap-2.5"
        >
          <BellSlash
            size={22}
            weight="fill"
            aria-hidden="true"
            className="text-wrong mt-0.5 shrink-0"
          />
          <div className="space-y-1">
            <p className="text-ink text-sm font-extrabold">{t('push.blocked')}</p>
            <p className="text-muted text-xs font-semibold leading-snug">
              {t(blockedHelpKey(platform))}
            </p>
          </div>
        </div>
      )}

      {viewState === 'error' && (
        <div
          role="status"
          data-testid="push-error-state"
          className="rd-push-state-fade space-y-2.5"
        >
          <div className="flex items-start gap-2.5">
            <WarningCircle
              size={22}
              weight="fill"
              aria-hidden="true"
              className="text-wrong mt-0.5 shrink-0"
            />
            <p className="text-ink text-sm font-extrabold">{t('push.error')}</p>
          </div>
          <Button
            size="sm"
            variant="primary"
            disabled={busy}
            onClick={handleEnable}
            data-testid="push-retry-btn"
          >
            {t('push.enable')}
          </Button>
        </div>
      )}
    </Card>
  );
}
