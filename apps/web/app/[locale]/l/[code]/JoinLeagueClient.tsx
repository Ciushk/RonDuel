'use client';

import { validateNickname } from '@ronduel/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Avatar, Button, Card, Chip } from '@/components/ui';
import { getBrowserTimeZone, getLocalSession, saveLocalSession } from '@/lib/session';

export function JoinLeagueClient({
  code,
  leagueName,
  memberCount,
  members,
}: {
  code: string;
  leagueName: string;
  memberCount: number;
  members: string[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [nickname, setNickname] = useState('');
  const [ageOk, setAgeOk] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const s = getLocalSession();
    setNickname(s.nickname || `Player_${s.uid.slice(-3)}`);
  }, []);

  const handleJoin = async () => {
    const check = validateNickname(nickname);
    if (!check.ok) {
      setError(t('onboarding.invalidNickname'));
      return;
    }
    const session = getLocalSession();
    saveLocalSession({ ...session, nickname: check.value, ageConfirmed16: true });

    const res = await fetch(`/api/leagues/${encodeURIComponent(code)}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: session.uid,
        nickname: check.value,
        tz: getBrowserTimeZone(),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Could not join league');
      return;
    }
    router.push(`/${locale}/play`);
  };

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-8">
      <Card className="space-y-4 text-center">
        <Chip tone="volt">{t('league.membersCount', { count: memberCount })}</Chip>
        <h1 className="font-display text-3xl font-extrabold">
          {t('league.joinTitle', { name: leagueName })}
        </h1>

        {members.length > 0 && (
          <div className="flex justify-center gap-2">
            {members.map((m) => (
              <Avatar key={m} nickname={m} size="md" />
            ))}
          </div>
        )}

        <div className="space-y-2 text-left">
          <label htmlFor="join-nickname" className="block text-sm font-bold">
            {t('onboarding.nicknameLabel')}
          </label>
          <input
            id="join-nickname"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            className="border-border bg-surface-2 text-ink min-h-12 w-full rounded-[14px] border-2 px-4 text-base font-medium"
          />
          {error && <p className="text-wrong text-xs font-bold">{error}</p>}
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-left text-sm font-medium">
          <input
            type="checkbox"
            checked={ageOk}
            onChange={(e) => setAgeOk(e.target.checked)}
            className="h-5 w-5 accent-[var(--rd-blue-strong)]"
          />
          <span>{t('onboarding.ageConfirm')}</span>
        </label>

        <Button fullWidth size="lg" disabled={!ageOk} onClick={() => void handleJoin()}>
          {t('league.joinCta')}
        </Button>
      </Card>
    </main>
  );
}
