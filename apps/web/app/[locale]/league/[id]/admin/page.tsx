'use client';

import {
  ArrowClockwise,
  ArrowLeft,
  Copy,
  Lock,
  ShareNetwork,
  Trash,
  UserMinus,
  UsersThree,
} from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button, Card, Chip, Toast } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { getLeagueTheme } from '@/lib/league-theme';
import { getBrowserTimeZone, getLocalSession } from '@/lib/session';

interface LeagueMember {
  uid: string;
  nickname: string;
  joinedAt?: string;
  allTimeScore: number;
  roundsPlayed: number;
}

interface LeagueAdminData {
  id: string;
  name: string;
  inviteCode: string;
  ownerUid: string;
  adminName: string;
  themeEmoji?: string;
  themeColor?: string;
  memberCount: number;
  maxMembers: number;
  createdAt?: string;
  isOwner?: boolean;
  privateApproval?: boolean;
  allTime: LeagueMember[];
}

export default function LeagueAdminPage() {
  const t = useTranslations('league');
  const locale = useLocale();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const leagueId = decodeURIComponent(params.id);

  const [league, setLeague] = useState<LeagueAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [sessionUid, setSessionUid] = useState('');
  const [toast, setToast] = useState('');

  // Rename state
  const [newName, setNewName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  // Regenerate code state
  const [regenLoading, setRegenLoading] = useState(false);

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Private approval state
  const [privateApproval, setPrivateApproval] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);

  // Member removal state
  const [removingUid, setRemovingUid] = useState<string | null>(null);

  useEffect(() => {
    const s = getLocalSession();
    setSessionUid(s.uid);

    const resolvedId =
      leagueId === '_shell' && typeof window !== 'undefined'
        ? decodeURIComponent(
            window.location.pathname.split('/').filter(Boolean).slice(-2)[0] ?? leagueId,
          )
        : leagueId;

    fetch(`/api/leagues/${encodeURIComponent(resolvedId)}?uid=${encodeURIComponent(s.uid)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data: LeagueAdminData) => {
        if (!data.isOwner) {
          router.replace(`/${locale}/league/${data.id}`);
          return;
        }
        setLeague(data);
        setNewName(data.name);
        setPrivateApproval(Boolean(data.privateApproval));
        if (data.maxMembers > 5) {
          setIsPro(true);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    fetch(
      `/api/game/status?uid=${encodeURIComponent(s.uid)}&tz=${encodeURIComponent(getBrowserTimeZone())}`,
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.isPro) setIsPro(true);
      })
      .catch(() => {});
  }, [leagueId, locale, router]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const getInviteLink = () => {
    if (!league) return '';
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://ronduel.web.app';
    return `${origin}/${locale}/l/${league.inviteCode}?r=${sessionUid}`;
  };

  const handleCopyLink = async () => {
    const link = getInviteLink();
    await navigator.clipboard.writeText(link).catch(() => {});
    showToast(t('linkCopiedToast', { default: 'Link copiat' }));
  };

  const handleShareInvite = async () => {
    if (!league) return;
    const link = getInviteLink();
    const text = t('inviteShareText', {
      name: league.name,
      link,
      default: `Hai în liga mea ${league.name} pe RonDuel! O rundă de trivia pe zi: ${link}`,
    });

    if (navigator.share) {
      try {
        await navigator.share({ text });
        trackEvent('invite_shared', { channel: 'native', code: league.inviteCode });
        return;
      } catch {
        // Fallback
      }
    }
    await navigator.clipboard.writeText(link).catch(() => {});
    showToast(t('linkCopiedToast', { default: 'Link copiat' }));
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!league) return;
    const trimmed = newName.trim();
    if (trimmed.length < 2 || trimmed.length > 30) return;

    setRenameLoading(true);
    try {
      const res = await fetch(`/api/leagues/${encodeURIComponent(league.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename',
          actorUid: sessionUid,
          name: trimmed,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLeague((prev) => (prev ? { ...prev, name: data.name ?? trimmed } : prev));
        showToast(t('renameSuccess', { default: 'Numele ligii a fost actualizat!' }));
      }
    } catch {
      // Error
    } finally {
      setRenameLoading(false);
    }
  };

  const handleRegenerateCode = async () => {
    if (!league || !isPro) return;
    const confirmed = window.confirm(
      t('regenerateConfirm', {
        default:
          'Sigur vrei să generezi un cod nou de invitație? Vechiul link nu va mai funcționa.',
      }),
    );
    if (!confirmed) return;

    setRegenLoading(true);
    try {
      const res = await fetch(`/api/leagues/${encodeURIComponent(league.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerate_code',
          actorUid: sessionUid,
        }),
      });
      const data = await res.json();
      if (res.ok && data.inviteCode) {
        setLeague((prev) => (prev ? { ...prev, inviteCode: data.inviteCode } : prev));
        showToast(t('codeRegeneratedToast', { default: 'Cod de invitație regenerat ✓' }));
      }
    } catch {
      // Error
    } finally {
      setRegenLoading(false);
    }
  };

  const handleTogglePrivateApproval = async () => {
    if (!league || !isPro) return;
    setApprovalLoading(true);
    const nextVal = !privateApproval;
    try {
      const res = await fetch(`/api/leagues/${encodeURIComponent(league.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'private_approval',
          actorUid: sessionUid,
          enabled: nextVal,
        }),
      });
      if (res.ok) {
        setPrivateApproval(nextVal);
        showToast(nextVal ? 'Aprobare privată activată' : 'Aprobare privată dezactivată');
      }
    } catch {
      // Error
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleRemoveMember = async (targetUid: string) => {
    if (!league || !isPro) return;
    const confirmed = window.confirm(
      t('removeMemberConfirm', {
        default: 'Sigur vrei să elimini acest membru din ligă?',
      }),
    );
    if (!confirmed) return;

    setRemovingUid(targetUid);
    try {
      const res = await fetch(`/api/leagues/${encodeURIComponent(league.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_member',
          actorUid: sessionUid,
          targetUid,
        }),
      });
      if (res.ok) {
        setLeague((prev) => {
          if (!prev) return prev;
          const filtered = prev.allTime.filter((m) => m.uid !== targetUid);
          return {
            ...prev,
            memberCount: Math.max(1, prev.memberCount - 1),
            allTime: filtered,
          };
        });
        showToast(t('memberRemovedToast', { default: 'Membrul a fost eliminat' }));
      }
    } catch {
      // Error
    } finally {
      setRemovingUid(null);
    }
  };

  const handleDeleteLeague = async () => {
    if (!league) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/leagues/${encodeURIComponent(league.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorUid: sessionUid }),
      });
      if (res.ok) {
        router.push(`/${locale}`);
      }
    } catch {
      // Error
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="text-muted mx-auto max-w-[480px] px-4 py-16 text-center text-sm font-bold">
        Se încarcă administrarea ligii…
      </main>
    );
  }

  if (!league) {
    return (
      <main className="mx-auto flex max-w-[480px] flex-col gap-4 px-4 py-12 text-center">
        <p className="font-display text-xl font-bold">Liga nu a fost găsită</p>
        <Link href={`/${locale}`} className="text-duel-strong text-sm font-bold underline">
          Înapoi la pagina principală
        </Link>
      </main>
    );
  }

  const isFullFreeLeague = !isPro && league.memberCount >= 5;
  const theme = getLeagueTheme(league.themeColor);

  return (
    <main className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 py-6">
      {/* Back button */}
      <div>
        <Link
          href={`/${locale}/league/${league.id}`}
          className="text-muted hover:text-ink inline-flex items-center gap-1.5 text-xs font-extrabold"
        >
          <ArrowLeft size={16} weight="bold" aria-hidden="true" />
          <span>{t('backToLeaderboard', { default: '← Înapoi la clasament' })}</span>
        </Link>
      </div>

      {/* Header card */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-2xl"
              style={{ backgroundColor: `${theme.hex}22` }}
              aria-hidden="true"
            >
              {league.themeEmoji ?? '🏆'}
            </span>
            <h1 className="font-display text-xl font-extrabold">{league.name}</h1>
          </div>
          <Chip tone={isPro ? 'gold' : 'volt'}>
            {isPro
              ? t('playersCountPro', { count: league.memberCount })
              : t('playersCountFree', { count: league.memberCount })}
          </Chip>
        </div>

        {/* 5/5 Full Banner for Free League Owner (§14) */}
        {isFullFreeLeague && (
          <div className="border-border bg-volt flex flex-col gap-2 rounded-xl border-2 p-3 text-xs font-bold text-[#16131F]">
            <p>
              {t('leagueFullOwnerBanner', {
                default: 'Liga ta e plină (5/5). Cu Pro intră până la 200 de prieteni.',
              })}
            </p>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                trackEvent('upgrade_from_league_full', { leagueId: league.id });
                router.push(`/${locale}/pro`);
              }}
            >
              {t('goProBtn', { default: 'Treci la Pro' })}
            </Button>
          </div>
        )}
      </Card>

      {/* Section 1: Invite code and share (§9) */}
      <Card className="space-y-3">
        <h2 className="font-display text-base font-extrabold">
          {t('inviteCodeSection', { default: 'Cod și link de invitație' })}
        </h2>
        <div className="border-border bg-surface-2 flex items-center justify-between rounded-xl border p-3">
          <div>
            <p className="text-muted text-[11px] font-bold uppercase tracking-wider">Cod ligă</p>
            <p className="font-mono text-2xl font-extrabold tracking-widest">{league.inviteCode}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={handleCopyLink}>
            <Copy size={16} weight="bold" aria-hidden="true" />
            {t('copyInvite', { default: 'Copiază' })}
          </Button>
        </div>

        <Button fullWidth size="lg" variant="primary" onClick={handleShareInvite}>
          <ShareNetwork size={20} weight="bold" aria-hidden="true" />
          {t('sendInvite', { default: 'Trimite invitația' })}
        </Button>

        {isPro ? (
          <div className="pt-1">
            <Button
              fullWidth
              size="sm"
              variant="secondary"
              disabled={regenLoading}
              onClick={handleRegenerateCode}
            >
              <ArrowClockwise size={16} weight="bold" aria-hidden="true" />
              {t('regenerateCode', { default: 'Regenerează codul' })}
            </Button>
          </div>
        ) : (
          <p className="text-muted text-xs">
            Cu RonDuel Pro poți regenera codul oricând sau activa aprobarea privată a cererilor.
          </p>
        )}
      </Card>

      {/* Section 2: Pro Settings (Private approval) */}
      {isPro && (
        <Card className="space-y-3">
          <h2 className="font-display text-base font-extrabold">Setări Pro</h2>
          <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-bold">
            <span>{t('privateApproval', { default: 'Aprobare privată pentru membri noi' })}</span>
            <input
              type="checkbox"
              checked={privateApproval}
              disabled={approvalLoading}
              onChange={handleTogglePrivateApproval}
              className="h-5 w-5 accent-[var(--rd-blue-strong)]"
            />
          </label>
        </Card>
      )}

      {/* Section 3: Members list (§9) */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-extrabold">
            {t('membersTitle', {
              count: league.memberCount,
              default: `Membrii ligii (${league.memberCount})`,
            })}
          </h2>
          <UsersThree size={20} weight="bold" className="text-muted" aria-hidden="true" />
        </div>

        <div className="divide-border/40 divide-y">
          {league.allTime.map((member) => {
            const isOwnerMember = member.uid === league.ownerUid;
            return (
              <div key={member.uid} className="flex items-center justify-between py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">{member.nickname}</p>
                    {isOwnerMember && (
                      <Chip tone="gold" className="px-1.5 py-0 text-[10px]">
                        {t('roleOwner', { default: 'Proprietar' })}
                      </Chip>
                    )}
                  </div>
                  {member.joinedAt && (
                    <p className="text-muted text-xs">
                      {t('joinedOnDate', {
                        date: new Date(member.joinedAt).toLocaleDateString(locale, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        }),
                        default: `S-a alăturat pe ${new Date(member.joinedAt).toLocaleDateString(locale)}`,
                      })}
                    </p>
                  )}
                </div>

                {isPro && !isOwnerMember && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-wrong min-h-8 px-2 text-xs"
                    disabled={removingUid === member.uid}
                    onClick={() => handleRemoveMember(member.uid)}
                    aria-label={`Elimină ${member.nickname}`}
                  >
                    <UserMinus size={14} weight="bold" aria-hidden="true" />
                    <span>{t('removeMember', { default: 'Elimină' })}</span>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Section 4: Rename League */}
      <Card className="space-y-3">
        <h2 className="font-display text-base font-extrabold">
          {t('renameTitle', { default: 'Redenumește liga' })}
        </h2>
        <form onSubmit={handleRename} className="flex gap-2">
          <input
            type="text"
            required
            minLength={2}
            maxLength={30}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="border-border bg-surface-2 text-ink flex-1 rounded-xl border px-3.5 py-2 text-sm font-bold"
            placeholder={t('namePlaceholder')}
          />
          <Button size="md" variant="primary" type="submit" disabled={renameLoading}>
            {renameLoading ? '...' : t('confirmRename', { default: 'Salvează' })}
          </Button>
        </form>
      </Card>

      {/* Section 5: Delete League */}
      <Card className="border-wrong/50 space-y-3">
        <h2 className="font-display text-wrong text-base font-extrabold">
          {t('delete', { default: 'Șterge liga' })}
        </h2>
        <p className="text-muted text-xs">
          {t('deleteConfirm', {
            default: 'Sigur vrei să ștergi această ligă? Toți membrii vor fi eliminați.',
          })}
        </p>
        {showDeleteConfirm ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              fullWidth
              onClick={() => setShowDeleteConfirm(false)}
            >
              {t('cancel', { default: 'Anulează' })}
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="bg-wrong border-border text-white hover:opacity-90"
              fullWidth
              disabled={deleteLoading}
              onClick={handleDeleteLeague}
            >
              {deleteLoading ? '...' : t('delete', { default: 'Șterge liga' })}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="text-wrong"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash size={16} weight="bold" aria-hidden="true" />
            {t('delete', { default: 'Șterge liga' })}
          </Button>
        )}
      </Card>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <Toast message={toast} tone="success" />
        </div>
      )}
    </main>
  );
}
