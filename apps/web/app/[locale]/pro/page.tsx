'use client';

import {
  CheckCircle,
  Lightning,
  ShieldCheck,
  Sparkle,
  Sword,
  UsersThree,
} from '@phosphor-icons/react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AccountLinkingSheet } from '@/components/AccountLinkingSheet';
import { Button, Card, Chip, Toast } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { getLocalSession } from '@/lib/session';

export default function ProPaywallPage() {
  const t = useTranslations();
  const format = useFormatter();
  const locale = useLocale();

  const [plan, setPlan] = useState<'monthly' | 'yearly'>('yearly');
  const [euConsent, setEuConsent] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [proActive, setProActive] = useState<{ active: boolean; plan?: string }>({ active: false });
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    const s = getLocalSession();
    fetch(`/api/me/profile?uid=${encodeURIComponent(s.uid)}`)
      .then((r) => r.json())
      .then((d) => {
        setIsAnonymous(Boolean(d.isAnonymous));
        setProActive(d.pro ?? { active: false });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    trackEvent('paywall_viewed');
  }, []);

  const handleLinked = () => {
    // The guest profile is now a permanent account, so Pro can be tied to it.
    setIsAnonymous(false);
    setLinkOpen(false);
  };

  const handleCheckout = async () => {
    setError('');
    trackEvent('checkout_started', { plan });
    const s = getLocalSession();
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: s.uid,
        plan,
        euWithdrawalConsent: euConsent,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? t('pro.checkoutError'));
      return;
    }
    if (data.pro?.active) {
      trackEvent('subscription_started', { plan: data.pro.plan ?? plan });
      setProActive(data.pro);
      setToast(t('pro.activeBadge', { plan: data.pro.plan ?? plan }));
    }
  };

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6">
      <Card className="space-y-4">
        <Chip tone="volt">
          <Lightning size={14} weight="fill" aria-hidden="true" />
          {t('pro.title')}
        </Chip>
        <h1 className="font-display text-3xl font-extrabold">{t('pro.title')}</h1>
        <p className="text-muted text-sm">{t('pro.subtitle')}</p>

        <ul className="space-y-2.5 text-sm font-bold">
          <li className="flex items-center gap-2.5">
            <UsersThree size={20} weight="fill" className="text-duel-strong" aria-hidden="true" />
            <span>{t('pro.benefitLeagues')}</span>
          </li>
          <li className="flex items-center gap-2.5">
            <Sword size={20} weight="fill" className="text-ron-strong" aria-hidden="true" />
            <span>{t('pro.benefitDuels')}</span>
          </li>
          <li className="flex items-center gap-2.5">
            <ShieldCheck size={20} weight="fill" className="text-correct-text" aria-hidden="true" />
            <span>{t('pro.benefitShield')}</span>
          </li>
          <li className="flex items-center gap-2.5">
            <Sparkle size={20} weight="fill" className="text-gold" aria-hidden="true" />
            <span>{t('pro.benefitThemes')}</span>
          </li>
        </ul>

        <div>
          <Link
            href={`/${locale}/regulament#pro`}
            data-testid="pro-rules-link"
            className="text-duel-strong inline-flex min-h-11 items-center text-xs font-bold underline underline-offset-2"
          >
            {t('rules.proLink')}
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2" role="group" aria-label={t('pro.billingIntervalLabel')}>
          <Button
            size="sm"
            variant={plan === 'monthly' ? 'primary' : 'secondary'}
            onClick={() => setPlan('monthly')}
          >
            {t('pro.monthly', { price: format.number(4.99, { style: 'currency', currency: 'EUR' }) })}
          </Button>
          <Button
            size="sm"
            variant={plan === 'yearly' ? 'volt' : 'secondary'}
            onClick={() => setPlan('yearly')}
          >
            {t('pro.yearly', {
              price: format.number(39.99, { style: 'currency', currency: 'EUR' }),
              percent: 33,
            })}
          </Button>
        </div>

        <p className="text-muted text-xs">{t('pro.taxNote')}</p>

        {proActive.active ? (
          <div className="border-border bg-volt flex items-center gap-2 rounded-[14px] border-2 p-3 text-sm font-extrabold text-[#16131F]">
            <CheckCircle size={20} weight="fill" aria-hidden="true" />
            <span>{t('pro.activeBadge', { plan: proActive.plan ?? 'yearly' })}</span>
          </div>
        ) : (
          <>
            {isAnonymous && (
              <div className="bg-surface-2 text-ink rounded-[12px] p-3 text-xs font-bold">
                <p className="mb-2">{t('pro.upgradeFirst')}</p>
                <button
                  type="button"
                  onClick={() => setLinkOpen(true)}
                  className="text-duel-strong cursor-pointer underline"
                >
                  {t('account.createAccountBtn')} {'\u2192'}
                </button>
              </div>
            )}

            <label className="text-ink flex cursor-pointer items-start gap-3 text-xs font-medium">
              <input
                type="checkbox"
                checked={euConsent}
                onChange={(e) => setEuConsent(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--rd-blue-strong)]"
              />
              <span>{t('pro.euConsent')}</span>
            </label>

            {error && <p className="text-wrong text-xs font-bold">{error}</p>}

            <Button
              fullWidth
              size="lg"
              disabled={!euConsent}
              onClick={() => {
                if (isAnonymous) {
                  setLinkOpen(true);
                  return;
                }
                void handleCheckout();
              }}
            >
              {t('pro.subscribeCta')}
            </Button>
          </>
        )}
      </Card>

      <AccountLinkingSheet
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        score={0}
        streak={0}
        onLinked={handleLinked}
      />

      {toast && (
        <div className="flex justify-center">
          <Toast message={toast} tone="success" />
        </div>
      )}
    </main>
  );
}
