'use client';

import { Flame, Play, Trophy, UsersThree } from '@phosphor-icons/react';
import { validateNickname } from '@ronduel/shared';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { HowItWorksSection } from '@/components/HowItWorksSection';
import { Button, Card, Chip, Sheet, Wordmark } from '@/components/ui';
import { getBrowserTimeZone, getLocalSession, saveLocalSession } from '@/lib/session';

interface TodayStatus {
  date: string;
  roundNumber: number;
  topicOfTheDay: string;
  played: boolean;
  inProgress: boolean;
  playId?: string;
  streakCurrent: number;
  streakBest: number;
  leagues: Array<{
    id: string;
    name: string;
    inviteCode: string;
    memberCount: number;
    playedTodayCount: number;
  }>;
}

const SUGGESTED_NAMES = ['Spark', 'Ace', 'Volt', 'Nova', 'Blitz'];

export default function LocaleHomePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [status, setStatus] = useState<TodayStatus | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [ageOk, setAgeOk] = useState(true);
  const [nickError, setNickError] = useState('');

  useEffect(() => {
    const session = getLocalSession();
    setNickname(
      session.nickname ||
        `${SUGGESTED_NAMES[Math.floor(Math.random() * SUGGESTED_NAMES.length)]}_${session.uid.slice(-3)}`,
    );
    const tz = getBrowserTimeZone();
    fetch(`/api/game/status?uid=${encodeURIComponent(session.uid)}&tz=${encodeURIComponent(tz)}`)
      .then((r) => r.json())
      .then((data: TodayStatus) => setStatus(data))
      .catch(() => {});
  }, []);

  const handlePrimaryCta = () => {
    if (status?.played && status.playId) {
      router.push(`/${locale}/result/${encodeURIComponent(status.playId)}`);
      return;
    }
    const session = getLocalSession();
    if (!session.nickname || !session.ageConfirmed16) {
      setSheetOpen(true);
      return;
    }
    router.push(`/${locale}/play`);
  };

  const handleConfirmNickname = () => {
    const check = validateNickname(nickname);
    if (!check.ok) {
      setNickError(t('onboarding.invalidNickname'));
      return;
    }
    if (!ageOk) return;
    const session = getLocalSession();
    saveLocalSession({ ...session, nickname: check.value, ageConfirmed16: true });
    setNickError('');
    setSheetOpen(false);
    router.push(`/${locale}/play`);
  };

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6">
      <section className="flex flex-col items-center gap-3 text-center">
        <div className="rd-seam h-2 w-24 rounded-full" aria-hidden="true" />
        <Wordmark size="lg" />
        <p className="text-muted text-base">{t('brand.tagline')}</p>
      </section>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Chip tone="volt">{t('brand.roundBadge', { number: status?.roundNumber ?? 1 })}</Chip>
          <Chip tone="neutral">{status?.topicOfTheDay ?? 'World & Science 🌍'}</Chip>
        </div>

        {status && status.streakCurrent > 0 && (
          <div className="flex items-center gap-2 text-sm font-bold">
            <Flame size={20} weight="fill" className="text-ron-strong" aria-hidden="true" />
            <span>{t('result.streak', { days: status.streakCurrent })}</span>
          </div>
        )}

        <Button fullWidth size="lg" onClick={handlePrimaryCta}>
          <Play size={20} weight="fill" aria-hidden="true" />
          {status?.played
            ? t('brand.viewResult')
            : status?.inProgress
              ? t('brand.continueRound')
              : t('brand.playToday')}
        </Button>
      </Card>

      {status && status.leagues.length > 0 && (
        <section className="space-y-3" aria-labelledby="my-leagues-heading">
          <h2 id="my-leagues-heading" className="font-display text-xl font-extrabold">
            {t('nav.leagues')}
          </h2>
          {status.leagues.map((lg) => (
            <Link key={lg.id} href={`/${locale}/league/${lg.id}`} className="block">
              <Card variant="subtle" className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-extrabold">{lg.name}</p>
                  <p className="text-muted text-xs">
                    <UsersThree
                      size={14}
                      weight="bold"
                      className="mr-1 inline"
                      aria-hidden="true"
                    />
                    {t('league.membersCount', { count: lg.memberCount })} · {lg.playedTodayCount}{' '}
                    played today
                  </p>
                </div>
                <Trophy size={22} weight="fill" className="text-gold" aria-hidden="true" />
              </Card>
            </Link>
          ))}
        </section>
      )}

      <HowItWorksSection played={Boolean(status?.played)} onPrimaryCta={handlePrimaryCta} />

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('onboarding.pickNickname')}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="nickname-input" className="block text-sm font-bold">
              {t('onboarding.nicknameLabel')}
            </label>
            <input
              id="nickname-input"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t('onboarding.nicknamePlaceholder')}
              maxLength={20}
              className="border-border bg-surface-2 text-ink min-h-12 w-full rounded-[14px] border-2 px-4 text-base font-medium"
            />
            {nickError && <p className="text-wrong text-xs font-bold">{nickError}</p>}
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={ageOk}
              onChange={(e) => setAgeOk(e.target.checked)}
              className="h-5 w-5 accent-[var(--rd-blue-strong)]"
            />
            <span>{t('onboarding.ageConfirm')}</span>
          </label>

          <div className="text-muted space-y-1 text-xs">
            <p>{t('onboarding.termsNotice')}</p>
            <p className="flex flex-wrap gap-3 font-bold">
              <Link
                href={`/${locale}/legal/terms`}
                className="text-duel-strong underline"
                onClick={() => setSheetOpen(false)}
              >
                {t('legal.footerTerms')}
              </Link>
              <Link
                href={`/${locale}/legal/privacy`}
                className="text-duel-strong underline"
                onClick={() => setSheetOpen(false)}
              >
                {t('legal.footerPrivacy')}
              </Link>
            </p>
          </div>

          <Button fullWidth size="lg" disabled={!ageOk} onClick={handleConfirmNickname}>
            {t('onboarding.startPlaying')}
          </Button>
        </div>
      </Sheet>
    </main>
  );
}
