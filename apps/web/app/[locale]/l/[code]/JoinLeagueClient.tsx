'use client';

import { validateNickname } from '@ronduel/shared';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Avatar, Button, Card, Chip, Sheet, Toast } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { loginWithGoogle } from '@/lib/firebase';
import { generateReadableNickname } from '@/lib/format';
import { getBrowserTimeZone, getLocalSession, recordLeagueId, saveLocalSession } from '@/lib/session';

interface LeagueMemberRow {
  uid: string;
  nickname: string;
  allTimeScore: number;
  roundsPlayed: number;
  joinedAt?: string;
  scoreToday?: number | null;
}

interface LeaguePreviewData {
  id: string;
  name: string;
  inviteCode: string;
  adminName: string;
  themeEmoji?: string;
  themeColor?: string;
  memberCount: number;
  maxMembers: number;
  createdAt: string;
  viewerFinishedToday: boolean;
  isMember: boolean;
  isOwner: boolean;
  allTime: LeagueMemberRow[];
}

export function JoinLeagueClient({
  code: initialCode,
}: {
  code: string;
  leagueName?: string;
  memberCount?: number;
  members?: string[];
}) {
  const t = useTranslations('league');
  const tCommon = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [resolvedCode, setResolvedCode] = useState(initialCode);
  const [league, setLeague] = useState<LeaguePreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalidCode, setInvalidCode] = useState(false);

  // Join Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false); // Unchecked by default
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [toast, setToast] = useState('');

  // Email link input
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  useEffect(() => {
    let cleanCode = initialCode;
    if (cleanCode === '_shell' && typeof window !== 'undefined') {
      const parts = window.location.pathname.split('/l/');
      if (parts[1]) {
        cleanCode = parts[1].split(/[?#/]/)[0] ?? cleanCode;
      }
    }
    setResolvedCode(cleanCode);

    const s = getLocalSession();
    setNickname(s.nickname && !s.nickname.startsWith('Player_') ? s.nickname : generateReadableNickname());

    trackEvent('league_preview_viewed', { code: cleanCode, source: 'invite_link' });

    fetch(`/api/leagues/${encodeURIComponent(cleanCode)}?uid=${encodeURIComponent(s.uid)}`)
      .then((r) => {
        if (!r.ok) {
          setInvalidCode(true);
          setLoading(false);
          return null;
        }
        return r.json();
      })
      .then((data: LeaguePreviewData | null) => {
        if (data) {
          setLeague(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setInvalidCode(true);
        setLoading(false);
      });
  }, [initialCode]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleOpenJoin = () => {
    trackEvent('join_clicked', { code: resolvedCode });
    setJoinError('');
    setSheetOpen(true);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!league) return;

    if (!ageConfirmed) {
      setJoinError('Trebuie să confirmi vârsta (16+)');
      return;
    }

    const check = validateNickname(nickname);
    if (!check.ok) {
      setJoinError(tCommon('onboarding.invalidNickname'));
      return;
    }

    setJoinLoading(true);
    setJoinError('');

    try {
      const session = getLocalSession();

      // Check room before joining
      const verifyRes = await fetch(`/api/leagues/${encodeURIComponent(resolvedCode)}?uid=${encodeURIComponent(session.uid)}`);
      const verifyData = await verifyRes.json();
      if (verifyData.memberCount >= verifyData.maxMembers && !verifyData.isMember) {
        setJoinError(t('full', { count: verifyData.memberCount, max: verifyData.maxMembers }));
        setJoinLoading(false);
        return;
      }

      // If user supplied email, upgrade account
      if (emailInput.trim()) {
        await fetch('/api/me/upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: session.uid,
            email: emailInput.trim(),
            provider: 'email_link',
          }),
        }).catch(() => {});
      }

      const res = await fetch(`/api/leagues/${encodeURIComponent(resolvedCode)}/join`, {
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
        setJoinError(data.error ?? 'Could not join league');
        setJoinLoading(false);
        return;
      }

      recordLeagueId(league.id);
      saveLocalSession({
        ...session,
        nickname: check.value,
        ageConfirmed16: true,
        email: emailInput.trim() || session.email,
        isAnonymous: !emailInput.trim() ? session.isAnonymous : false,
      });

      trackEvent('league_joined', {
        leagueId: league.id,
        code: resolvedCode,
      });

      setToast(t('joinedSuccessToast', { name: league.name }));
      setSheetOpen(false);

      setTimeout(() => {
        if (data.playedToday) {
          router.push(`/${locale}/league/${league.id}`);
        } else {
          router.push(`/${locale}/play?returnTo=${encodeURIComponent(`/${locale}/league/${league.id}`)}`);
        }
      }, 700);
    } catch {
      setJoinError('Network error');
    } finally {
      setJoinLoading(false);
    }
  };

  const handleOAuthConnect = async (provider: 'google') => {
    try {
      const user = await loginWithGoogle();
      if (!user.email) {
        setToast('Contul Google nu are o adresă de email asociată.');
        setTimeout(() => setToast(''), 2500);
        return;
      }
      const session = getLocalSession();
      const userNick = user.displayName || session.nickname;

      const res = await fetch('/api/me/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: session.uid,
          email: user.email,
          nickname: userNick,
          provider: 'google',
          confirmMerge: true,
        }),
      });

      const data = await res.json().catch(() => ({}));

      saveLocalSession({
        ...session,
        uid: data.uid || session.uid,
        email: data.email || user.email,
        nickname: data.nickname || userNick,
        isAnonymous: false,
        authProvider: 'google',
      });
      setToast('Cont Google conectat ✓');
      setTimeout(() => setToast(''), 2500);
    } catch (err: unknown) {
      const authErr = err as { code?: string; message?: string };
      if (authErr?.code !== 'auth/popup-closed-by-user') {
        setToast('Autentificarea Google a eșuat.');
        setTimeout(() => setToast(''), 2500);
      }
    }
  };

  if (loading) {
    return (
      <main className="mx-auto flex max-w-[480px] flex-col items-center justify-center px-4 py-16 text-center">
        <div className="rd-seam h-2 w-24 rounded-full mb-4 animate-pulse" />
        <p className="text-muted text-sm font-bold">Se încarcă liga…</p>
      </main>
    );
  }

  if (invalidCode || !league) {
    return (
      <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-12 text-center">
        <Card className="space-y-4 p-6">
          <p className="text-4xl">⚠️</p>
          <h1 className="font-display text-2xl font-extrabold">{t('invalidCode')}</h1>
          <p className="text-muted text-sm">
            Verifică dacă ai introdus codul corect sau cere un link nou de la cel care te-a invitat.
          </p>
          <Button fullWidth size="lg" variant="primary" onClick={() => router.push(`/${locale}`)}>
            {t('back')}
          </Button>
        </Card>
      </main>
    );
  }

  const isFull = league.memberCount >= league.maxMembers;
  const currentUid = typeof window !== 'undefined' ? getLocalSession().uid : '';
  const displayMembers = league.allTime.filter((m) => league.isMember || m.uid !== currentUid);

  return (
    <div className="relative min-h-[calc(100dvh-64px)] pb-12">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 border-b-2 border-border bg-surface/95 backdrop-blur px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-[480px] items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl shrink-0" aria-hidden="true">
              {league.themeEmoji ?? '🏆'}
            </span>
            <span className="font-display truncate text-lg font-extrabold text-ink" title={league.name}>
              {league.name}
            </span>
          </div>

          <div className="shrink-0">
            {league.isMember ? (
              <Button
                size="sm"
                variant="volt"
                onClick={() => router.push(`/${locale}/league/${league.id}`)}
              >
                {t('alreadyMember')}
              </Button>
            ) : isFull ? (
              <Button size="sm" variant="secondary" disabled>
                {t('leagueFullBadge', { count: league.memberCount, max: league.maxMembers })}
              </Button>
            ) : (
              <Button size="sm" variant="primary" onClick={handleOpenJoin}>
                {t('joinLeagueBtn')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto flex max-w-[480px] flex-col gap-4 px-4 pt-4">
        {/* League Info Card */}
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Chip tone={league.maxMembers > 5 ? 'gold' : 'volt'}>
              {league.maxMembers > 5
                ? t('playersCountPro', { count: displayMembers.length })
                : t('playersCountFree', { count: displayMembers.length })}
            </Chip>
            <span className="text-muted text-xs font-bold">
              {t('adminLabel', { name: league.adminName })}
            </span>
          </div>

          <p className="text-muted text-xs font-medium">
            {t('createdOn', { date: formatDate(league.createdAt) })}
          </p>
        </Card>

        {/* Toast */}
        {toast && (
          <div className="flex justify-center">
            <Toast message={toast} tone="success" />
          </div>
        )}

        {/* Players Table Card */}
        <Card className="space-y-3 overflow-hidden p-0">
          <div className="border-b border-border-subtle bg-surface-2 px-4 py-2.5">
            <h2 className="font-display text-sm font-extrabold uppercase tracking-wider text-muted">
              Clasament ligă ({displayMembers.length})
            </h2>
          </div>

          <div className="divide-y divide-border-subtle px-4">
            {displayMembers.map((member, idx) => (
              <div key={member.uid} className="flex items-center justify-between py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="rd-tabular text-muted w-6 text-sm font-extrabold">
                    #{idx + 1}
                  </span>
                  <Avatar nickname={member.nickname} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink" title={member.nickname}>
                      {member.nickname}
                    </p>
                    {member.joinedAt && (
                      <p className="text-muted text-[11px]">
                        {t('joinedOn', { date: formatDate(member.joinedAt) })}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right shrink-0">
                  <div>
                    <span className="text-muted block text-[10px] font-bold uppercase">
                      {t('todayPoints')}
                    </span>
                    <span className="rd-tabular text-xs font-extrabold text-ink">
                      {league.viewerFinishedToday
                        ? member.scoreToday !== null && member.scoreToday !== undefined
                          ? member.scoreToday
                          : '—'
                        : '🔒'}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted block text-[10px] font-bold uppercase">
                      {t('totalPoints')}
                    </span>
                    <span className="rd-tabular text-sm font-extrabold text-duel-strong">
                      {member.allTimeScore.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Bottom CTA for non-members */}
        {!league.isMember && !isFull && (
          <div className="pt-2">
            <Button size="lg" variant="primary" fullWidth onClick={handleOpenJoin}>
              {t('joinLeagueBtn')}
            </Button>
          </div>
        )}
      </main>

      {/* Join Bottom Sheet Flow */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('joinModalTitle', { name: league.name })}
      >
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="join-nick-input" className="block text-sm font-bold text-ink">
              {tCommon('onboarding.nicknameLabel')}
            </label>
            <input
              id="join-nick-input"
              type="text"
              required
              minLength={2}
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="ex. Alex99"
              className="border-border bg-surface-2 text-ink min-h-12 w-full rounded-[14px] border-2 px-4 text-base font-bold"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-ink min-h-11">
            <input
              type="checkbox"
              required
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="h-5 w-5 rounded accent-[var(--rd-blue-strong)]"
            />
            <span>{t('ageCheckbox')}</span>
          </label>

          {/* 4-bullet explanation block */}
          <div className="border-border-subtle bg-surface-2 rounded-2xl border p-3.5 space-y-2 text-xs">
            <p className="font-extrabold text-ink">{t('explanationTitle')}</p>
            <ul className="text-muted space-y-1 list-disc pl-4 font-medium leading-relaxed">
              <li>{t('explanationBullet1', { name: league.name })}</li>
              <li>{t('explanationBullet2')}</li>
              <li>{t('explanationBullet3')}</li>
              <li>{t('explanationBullet4')}</li>
            </ul>
          </div>

          {joinError && (
            <p className="text-wrong text-xs font-bold">{joinError}</p>
          )}

          <Button
            type="submit"
            fullWidth
            size="lg"
            variant="primary"
            disabled={!ageConfirmed || joinLoading}
          >
            {joinLoading ? 'Se intră…' : t('joinConfirmBtn')}
          </Button>

          {/* Optional links */}
          <div className="border-border-subtle border-t pt-3 flex flex-col items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => void handleOAuthConnect('google')}
              className="text-muted hover:text-ink font-bold underline"
            >
              {t('continueWithGoogle')}
            </button>

            {!showEmailInput ? (
              <button
                type="button"
                onClick={() => setShowEmailInput(true)}
                className="text-muted hover:text-ink font-bold underline"
              >
                {t('continueWithEmail')}
              </button>
            ) : (
              <div className="w-full space-y-2 pt-1">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="emailul.tau@exemplu.ro"
                  className="border-border bg-surface-2 text-ink min-h-10 w-full rounded-xl border px-3 text-xs font-medium"
                />
              </div>
            )}
          </div>
        </form>
      </Sheet>
    </div>
  );
}
