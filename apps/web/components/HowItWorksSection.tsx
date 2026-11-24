'use client';

import {
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  Lightning,
  LinkSimple,
  Play,
  Sword,
  Trophy,
} from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRef, useState, type PointerEvent } from 'react';

import { CreateLeagueWizard } from '@/components/CreateLeagueWizard';
import { JoinByCodeDialog } from '@/components/JoinByCodeDialog';
import { Button, Card, Chip } from '@/components/ui';
import { cn } from '@/lib/cn';
import { getLocalSession } from '@/lib/session';

interface HowItWorksSectionProps {
  played: boolean;
  onPrimaryCta: () => void;
}

export function HowItWorksSection({ played, onPrimaryCta }: HowItWorksSectionProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const [showCreateLeague, setShowCreateLeague] = useState(false);
  const [showJoinByCode, setShowJoinByCode] = useState(false);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ isDown: boolean; startX: number; scrollLeft: number }>({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
  });

  const steps = [
    {
      icon: Lightning,
      tone: 'bg-volt text-[#16131F]',
      chipTone: 'volt' as const,
      title: t('explainer.step1Title'),
      body: t('explainer.step1Body'),
    },
    {
      icon: CalendarBlank,
      tone: 'bg-ron text-[#16131F]',
      chipTone: 'red' as const,
      title: t('explainer.step2Title'),
      body: t('explainer.step2Body'),
    },
    {
      icon: Trophy,
      tone: 'bg-gold text-[#16131F]',
      chipTone: 'gold' as const,
      title: t('explainer.step3Title'),
      body: t('explainer.step3Body'),
    },
  ];

  const scrollToSlide = (index: number) => {
    const track = trackRef.current;
    const bounded = Math.max(0, Math.min(steps.length - 1, index));
    setActiveSlide(bounded);
    if (!track) return;
    const slideEl = track.children[bounded] as HTMLElement | undefined;
    if (slideEl) {
      track.scrollTo({
        left: slideEl.offsetLeft,
        behavior: 'smooth',
      });
    }
  };

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.children.length === 0) return;
    const scrollCenter = track.scrollLeft + track.clientWidth / 2;
    let closestIdx = 0;
    let minDistance = Number.POSITIVE_INFINITY;
    Array.from(track.children).forEach((child, idx) => {
      const el = child as HTMLElement;
      const center = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(scrollCenter - center);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });
    if (closestIdx !== activeSlide) {
      setActiveSlide(closestIdx);
    }
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return; // let native touch scroll-snap handle mobile swipe
    const track = trackRef.current;
    if (!track) return;
    dragStateRef.current = {
      isDown: true,
      startX: e.clientX,
      scrollLeft: track.scrollLeft,
    };
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.isDown) return;
    const track = trackRef.current;
    if (!track) return;
    const dx = e.clientX - dragStateRef.current.startX;
    track.scrollLeft = dragStateRef.current.scrollLeft - dx;
  };

  const handlePointerUp = () => {
    dragStateRef.current.isDown = false;
  };

  const faqs = [
    { q: t('explainer.faq1Q'), a: t('explainer.faq1A') },
    { q: t('explainer.faq2Q'), a: t('explainer.faq2A') },
    { q: t('explainer.faq3Q'), a: t('explainer.faq3A') },
    { q: t('explainer.faq4Q'), a: t('explainer.faq4A') },
  ];

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  return (
    <section
      id="cum-merge"
      data-testid="how-it-works-section"
      aria-labelledby="how-it-works-heading"
      className="mt-4 flex flex-col gap-6"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* a) Title "Cum merge" + Left/Right Slideable Cards Carousel (Mobile swipe + Desktop arrows/drag) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="how-it-works-heading" className="font-display text-2xl font-extrabold">
            {t('explainer.title')}
          </h2>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollToSlide(activeSlide - 1)}
              disabled={activeSlide === 0}
              aria-label={t('explainer.prevSlide')}
              data-testid="explainer-prev-btn"
              className="rd-sticker rd-sticker-pressable bg-surface text-ink inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-[12px] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CaretLeft size={18} weight="bold" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scrollToSlide(activeSlide + 1)}
              disabled={activeSlide === steps.length - 1}
              aria-label={t('explainer.nextSlide')}
              data-testid="explainer-next-btn"
              className="rd-sticker rd-sticker-pressable bg-surface text-ink inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-[12px] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CaretRight size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Horizontal snap-x carousel track */}
        <div
          ref={trackRef}
          tabIndex={0}
          role="group"
          aria-label={t('explainer.title')}
          onScroll={handleScroll}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          data-testid="explainer-carousel-track"
          className="rd-no-scrollbar flex select-none snap-x snap-mandatory gap-3.5 overflow-x-auto pb-2 pt-0.5"
        >
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <Card
                key={idx}
                variant="sticker"
                data-testid={`explainer-step-${idx + 1}`}
                className="flex w-[86%] shrink-0 snap-center flex-col justify-between gap-3 p-5 sm:w-[88%]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className={cn(
                      'border-border flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border-2',
                      step.tone,
                    )}
                    aria-hidden="true"
                  >
                    <Icon size={22} weight="fill" />
                  </div>
                  <Chip tone={step.chipTone} className="rd-tabular">
                    {t('explainer.stepBadge', { current: idx + 1, total: steps.length })}
                  </Chip>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-display text-lg font-extrabold">{step.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{step.body}</p>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Slide pagination dots */}
        <div className="flex items-center justify-center gap-2" role="tablist">
          {steps.map((_, idx) => {
            const isCurrent = activeSlide === idx;
            return (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                aria-label={t('explainer.goToSlide', { step: idx + 1 })}
                onClick={() => scrollToSlide(idx)}
                className={cn(
                  'border-border h-3 cursor-pointer rounded-full border transition-all duration-200',
                  isCurrent ? 'bg-ron w-7' : 'bg-surface-2 w-3',
                )}
              />
            );
          })}
        </div>
      </div>

      {/* b) Example result card (static demo) */}
      <Card variant="sticker" className="space-y-2.5 text-center" data-testid="explainer-demo-card">
        <div className="border-border-subtle bg-surface-2 rounded-[14px] border px-3 py-3">
          <p className="rd-tabular text-ink text-sm font-extrabold sm:text-base">
            {t('explainer.demoCard')}
          </p>
        </div>
        <p className="text-muted text-xs font-medium">{t('explainer.demoCaption')}</p>
      </Card>

      {/* c) Leagues and duels row */}
      <div className="space-y-3">
        <h3 className="font-display text-xl font-extrabold">{t('explainer.featuresTitle')}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card variant="secondary" className="flex flex-col justify-between gap-3 p-4">
            <div className="flex items-start gap-3">
              <Chip tone="volt" className="shrink-0 px-2 py-1.5" aria-hidden="true">
                <LinkSimple size={16} weight="bold" />
              </Chip>
              <p className="text-ink text-sm font-bold leading-snug">
                {t('explainer.featureLeagues')}
              </p>
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              <Button size="sm" variant="volt" onClick={() => setShowCreateLeague(true)}>
                {t('league.createBtn')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setShowJoinByCode(true)}>
                {t('splash.joinLeague')}
              </Button>
            </div>
          </Card>

          <Card variant="secondary" className="flex items-start gap-3 p-4">
            <Chip tone="red" className="shrink-0 px-2 py-1.5" aria-hidden="true">
              <Sword size={16} weight="bold" />
            </Chip>
            <p className="text-ink text-sm font-bold leading-snug">{t('explainer.featureDuels')}</p>
          </Card>
        </div>
      </div>

      <CreateLeagueWizard
        open={showCreateLeague}
        onClose={() => setShowCreateLeague(false)}
        onCreated={(lg) => router.push(`/${locale}/league/${lg.id ?? lg.leagueId}`)}
      />
      <JoinByCodeDialog open={showJoinByCode} onClose={() => setShowJoinByCode(false)} />

      {/* d) Short FAQ (accordion), 4 items */}
      <div className="space-y-2.5" data-testid="explainer-faq">
        {faqs.map((item, idx) => {
          const isOpen = openFaq === idx;
          const panelId = `faq-panel-${idx}`;
          const btnId = `faq-btn-${idx}`;
          return (
            <Card key={idx} variant="subtle" className="overflow-hidden p-0">
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenFaq(isOpen ? null : idx)}
                className="text-ink flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left text-sm font-bold"
              >
                <span>{item.q}</span>
                <CaretDown
                  size={16}
                  weight="bold"
                  aria-hidden="true"
                  className={cn(
                    'text-muted shrink-0 transition-transform duration-150',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>
              {isOpen && (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  className="border-border-subtle text-muted border-t px-4 py-3 text-sm leading-relaxed"
                >
                  {item.a}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* e) Final CTA repeating the main button */}
      <div>
        <Button fullWidth size="lg" onClick={onPrimaryCta} data-testid="explainer-final-cta">
          <Play size={20} weight="fill" aria-hidden="true" />
          {played ? t('brand.viewResult') : t('brand.playToday')}
        </Button>
      </div>
    </section>
  );
}
