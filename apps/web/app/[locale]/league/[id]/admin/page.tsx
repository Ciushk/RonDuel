'use client';

import {
  ArrowClockwise,
  ArrowLeft,
  BellSimple,
  Check,
  Copy,
  Lock,
  Palette,
  ShareNetwork,
  Trash,
  UserGear,
  UserMinus,
  UsersThree,
  X,
} from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button, Card, Chip, Toast } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import { getLeagueTheme, LEAGUE_COLOR_OPTIONS, LEAGUE_EMOJI_OPTIONS } from '@/lib/league-theme';
import { getBrowserTimeZone, getLocalSession } from '@/lib/session';

interface LeagueMember {
  uid: string;
  nickname: string;
  joinedAt?: string;
  role?: 'owner' | 'moderator' | 'member';
  hasAccount?: boolean;
  allTimeScore: number;
  roundsPlayed: number;
}

interface LeagueJoinRequest {
  uid: string;
  nickname: string;
  requestedAt: string;
}

interface LeagueModerator {
  uid: string;
  nickname: string;
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
  isModerator?: boolean;
  privateApproval?: boolean;
  requestCount?: number;
  joinRequests?: LeagueJoinRequest[];
  moderators?: LeagueModerator[];
  members?: LeagueMember[];
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

  // Theme state
  const [themeEmoji, setThemeEmoji] = useState('🏆');
  const [themeColor, setThemeColor] = useState('default');
  const [themeLoading, setThemeLoading] = useState(false);

  // Join requests + moderators state
  const [joinRequests, setJoinRequests] = useState<LeagueJoinRequest[]>([]);
  const [moderators, setModerators] = useState<LeagueModerator[]>([]);
  const [moderatorLoadingUid, setModeratorLoadingUid] = useState<string | null>(null);
  const [requestLoadingUid, setRequestLoadingUid] = useState<string | null>(null);

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
        if (!data.isOwner && !data.isModerator) {
          router.replace(`/${locale}/league/${data.id}`);
          return;
        }
        setLeague(data);
        setNewName(data.name);
        setPrivateApproval(Boolean(data.privateApproval));
        setThemeEmoji(data.themeEmoji || '🏆');
        setThemeColor(data.themeColor || 'default');
        setJoinRequests(data.joinRequests ?? []);
        setModerators(data.moderators ?? []);
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
        showToast(
          nextVal
            ? t('privateApprovalOnToast', { default: 'Aprobare privată activată' })
            : t('privateApprovalOffToast', { default: 'Aprobare privată dezactivată' }),
        );
        await refreshLeague(league.id);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(
          data.error ||
            t('privateApprovalFailed', { default: 'Nu am putut schimba aprobarea privată' }),
        );
      }
    } catch {
      // Error
    } finally {
      setApprovalLoading(false);
    }
  };

  const refreshLeague = async (leagueIdToLoad: string) => {
    try {
      const res = await fetch(
        `/api/leagues/${encodeURIComponent(leagueIdToLoad)}?uid=${encodeURIComponent(sessionUid)}`,
      );
      if (!res.ok) return;
      const data: LeagueAdminData = await res.json();
      setLeague(data);
      setNewName(data.name);
      setPrivateApproval(Boolean(data.privateApproval));
      setThemeEmoji(data.themeEmoji || '🏆');
      setThemeColor(data.themeColor || 'default');
      setJoinRequests(data.joinRequests ?? []);
      setModerators(data.moderators ?? []);
    } catch {
      // Keep the current view on a failed refresh
    }
  };

  const handleSaveTheme = async () => {
    if (!league || !isPro) return;
    setThemeLoading(true);
    try {
      const res = await fetch(`/api/leagues/${encodeURIComponent(league.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'theme',
          actorUid: sessionUid,
          themeEmoji,
          themeColor,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLeague((prev) =>
          prev
            ? {
                ...prev,
                themeEmoji: data.themeEmoji ?? themeEmoji,
                themeColor: data.themeColor ?? themeColor,
              }
            : prev,
        );
        showToast(t('themeSaved', { default: 'Iconița și culoarea au fost actualizate!' }));
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || t('themeSaveFailed', { default: 'Nu am putut salva tema' }));
      }
    } catch {
      showToast(t('themeSaveFailed', { default: 'Nu am putut salva tema' }));
    } finally {
      setThemeLoading(false);
    }
  };

  const handleReviewRequest = async (targetUid: string, approve: boolean) => {
    if (!league) return;
    setRequestLoadingUid(targetUid);
    try {
      const res = await fetch(`/api/leagues/${encodeURIComponent(league.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: approve ? 'approve_request' : 'reject_request',
          actorUid: sessionUid,
          targetUid,
        }),
      });
      if (res.ok) {
        showToast(
          approve
            ? t('requestApproved', { default: 'Cererea a fost aprobată' })
            : t('requestRejected', { default: 'Cererea a fost respinsă' }),
        );
        await refreshLeague(league.id);
      }
    } catch {
      // Error
    } finally {
      setRequestLoadingUid(null);
    }
  };

  const handleModeratorChange = async (targetUid: string, add: boolean) => {
    if (!league || !isPro) return;
    setModeratorLoadingUid(targetUid);
    try {
      const res = await fetch(`/api/leagues/${encodeURIComponent(league.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: add ? 'moderator_add' : 'moderator_remove',
          actorUid: sessionUid,
          targetUid,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setModerators(data.moderators ?? moderators);
        showToast(
          add
            ? t('moderatorAdded', { default: 'Moderator adăugat' })
            : t('moderatorRemoved', { default: 'Moderator eliminat' }),
        );
        await refreshLeague(league.id);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(
          data.error || t('moderatorFailed', { default: 'Nu am putut actualiza moderatorii' }),
        );
      }
    } catch {
      // Error
    } finally {
      setModeratorLoadingUid(null);
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
  const canManage = Boolean(league.isOwner);
  const memberList = league.members && league.members.length > 0 ? league.members : league.allTime;

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
          <h2 className="font-display text-base font-extrabold">
            {t('proSettingsTitle', { default: 'Setări Pro' })}
          </h2>
          {canManage && (
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
          )}
          <p className="text-muted flex items-start gap-2 text-xs font-medium">
            <BellSimple size={16} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {privateApproval
                ? t('requestNotificationsOn', {
                    default:
                      'Notificările pentru solicitări sunt active: cererile noi apar mai jos, iar tu decizi cine intră în ligă.',
                  })
                : t('requestNotificationsOff', {
                    default:
                      'Activează aprobarea privată pentru ca fiecare cerere nouă de intrare să fie aprobată de tine.',
                  })}
            </span>
          </p>
        </Card>
      )}

      {/* Section 2b: Pending join requests (only with private approval on) */}
      {isPro && privateApproval && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display flex items-center gap-2 text-base font-extrabold">
              <BellSimple size={18} weight="bold" aria-hidden="true" />
              {t('joinRequestsTitle', { default: 'Solicitări de intrare' })}
            </h2>
            {joinRequests.length > 0 && (
              <Chip tone="volt" className="rd-tabular text-xs font-black">
                {joinRequests.length}
              </Chip>
            )}
          </div>

          {joinRequests.length === 0 ? (
            <p className="text-muted text-xs font-medium">
              {t('joinRequestsEmpty', { default: 'Nicio solicitare în așteptare.' })}
            </p>
          ) : (
            <div className="divide-border/40 divide-y">
              {joinRequests.map((request) => (
                <div key={request.uid} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{request.nickname}</p>
                    <p className="text-muted text-[11px]">
                      {new Date(request.requestedAt).toLocaleDateString(locale, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="volt"
                      className="min-h-8 px-2 text-xs"
                      disabled={requestLoadingUid === request.uid}
                      onClick={() => void handleReviewRequest(request.uid, true)}
                    >
                      <Check size={14} weight="bold" aria-hidden="true" />
                      <span>{t('approveRequest', { default: 'Aprobă' })}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="min-h-8 px-2 text-xs"
                      disabled={requestLoadingUid === request.uid}
                      onClick={() => void handleReviewRequest(request.uid, false)}
                    >
                      <X size={14} weight="bold" aria-hidden="true" />
                      <span>{t('rejectRequest', { default: 'Respinge' })}</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Section 2c: League icon + colour (Pro) */}
      {isPro && canManage && (
        <Card className="space-y-3">
          <h2 className="font-display flex items-center gap-2 text-base font-extrabold">
            <Palette size={18} weight="bold" aria-hidden="true" />
            {t('themeTitle', { default: 'Iconiță și culoare' })}
          </h2>

          <div>
            <p className="text-muted mb-2 text-xs font-bold">
              {t('emojiLabel', { default: 'Iconiță' })}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {LEAGUE_EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setThemeEmoji(emoji)}
                  className={`flex h-11 items-center justify-center rounded-xl border-2 text-2xl transition-transform active:scale-95 ${
                    themeEmoji === emoji
                      ? 'bg-surface-2 border-[var(--rd-blue-strong)] ring-2 ring-[var(--rd-blue-strong)]'
                      : 'border-border bg-surface'
                  }`}
                  aria-pressed={themeEmoji === emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-muted mb-2 text-xs font-bold">
              {t('colorLabel', { default: 'Culoare' })}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {LEAGUE_COLOR_OPTIONS.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setThemeColor(col.id)}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-xl border-2 px-2 text-xs font-bold transition-transform active:scale-95 ${
                    themeColor === col.id
                      ? 'border-[var(--rd-blue-strong)] ring-2 ring-[var(--rd-blue-strong)]'
                      : 'border-border'
                  }`}
                  aria-pressed={themeColor === col.id}
                >
                  <span className={`inline-block h-4 w-4 rounded-full ${col.bg}`} />
                  <span>{col.name}</span>
                </button>
              ))}
            </div>
          </div>

          <Button
            size="sm"
            variant="primary"
            fullWidth
            disabled={themeLoading}
            onClick={() => void handleSaveTheme()}
          >
            {themeLoading ? '...' : t('saveTheme', { default: 'Salvează tema' })}
          </Button>
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

        {isPro && (
          <p className="bg-surface-2 text-muted flex items-start gap-2 rounded-xl p-2.5 text-[11px] font-semibold">
            <UserGear size={14} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {t('moderatorHint', {
                default:
                  'Moderatorii pot aproba cereri și elimina membri. Doar membrii cu cont RonDuel pot fi moderatori.',
              })}
            </span>
          </p>
        )}

        <div className="divide-border/40 divide-y">
          {memberList.map((member) => {
            const isOwnerMember = member.uid === league.ownerUid;
            const isModeratorMember = member.role === 'moderator';
            const canBeModerator = Boolean(member.hasAccount) && !isOwnerMember;
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
                    {isModeratorMember && (
                      <Chip tone="blue" className="px-1.5 py-0 text-[10px]">
                        {t('roleModerator', { default: 'Moderator' })}
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

                <div className="flex shrink-0 items-center gap-1.5">
                  {isPro && !isOwnerMember && canBeModerator && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="min-h-8 px-2 text-xs"
                      disabled={moderatorLoadingUid === member.uid}
                      onClick={() => void handleModeratorChange(member.uid, !isModeratorMember)}
                      title={
                        isModeratorMember
                          ? t('removeModerator', { default: 'Elimină moderatorul' })
                          : t('addModerator', { default: 'Fă moderator' })
                      }
                    >
                      <UserGear size={14} weight="bold" aria-hidden="true" />
                      <span>
                        {isModeratorMember
                          ? t('removeModeratorShort', { default: 'Demote' })
                          : t('addModeratorShort', { default: 'Moderator' })}
                      </span>
                    </Button>
                  )}

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
              </div>
            );
          })}
        </div>
      </Card>

      {/* Section 4: Rename League */}
      {canManage && (
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
      )}

      {/* Section 5: Delete League */}
      {canManage && (
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
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <Toast message={toast} tone="success" />
        </div>
      )}
    </main>
  );
}
