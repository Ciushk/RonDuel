export interface MergePro {
  active: boolean;
  plan?: 'monthly' | 'yearly';
  until?: string;
  isTrial?: boolean;
  trialEndsAt?: string;
}

export interface MergeDuelStats {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  bestWinStreak: number;
  currentWinStreak: number;
}

export interface MergeUser {
  uid: string;
  nickname: string;
  streakCurrent: number;
  streakBest: number;
  leagueIds: string[];
  freezes: number;
  email?: string;
  isAnonymous: boolean;
  authProvider?: string;
  pro?: MergePro;
  duelStats?: MergeDuelStats;
  expiresAt?: string | null;
  upgradedAt?: string | null;
}

export interface MergePlay {
  playId: string;
  uid: string;
  date: string;
}

export interface MergeDuel {
  id: string;
  challengerUid: string;
  opponentUid: string | null;
}

export interface AccountMergePlan {
  target: MergeUser;
  deleteUid: string;
  playReassignments: Array<{ playId: string; uid: string; date: string }>;
  duelRepoints: Array<{ id: string; challengerUid: string; opponentUid: string | null }>;
}

export function normalizeAuthProvider(
  provider: string,
): 'password' | 'google.com' | 'email_link' | 'anonymous' {
  if (provider === 'google' || provider === 'google.com') return 'google.com';
  if (provider === 'password' || provider === 'email_password') return 'password';
  if (provider === 'email_link') return 'email_link';
  if (provider === 'anonymous') return 'anonymous';
  return 'password';
}

function pickPro(target?: MergePro, source?: MergePro): MergePro {
  if (target?.active) return target;
  if (source?.active) return source;
  return target ?? source ?? { active: false };
}

/**
 * Fold an anonymous profile into an existing permanent account.
 * Streak is the max of the two, leagues are a union, plays move when the
 * target has no play that day, and duels are re-pointed at the target uid.
 */
export function planAccountMerge(input: {
  source: MergeUser;
  target: MergeUser;
  plays: MergePlay[];
  duels: MergeDuel[];
  nowIso: string;
  provider: string;
}): AccountMergePlan {
  const { source, target } = input;
  const leagueIds = [...new Set([...target.leagueIds, ...source.leagueIds])];
  const targetDates = new Set(
    input.plays.filter((play) => play.uid === target.uid).map((play) => play.date),
  );
  const playReassignments = input.plays
    .filter((play) => play.uid === source.uid && !targetDates.has(play.date))
    .map((play) => ({ playId: play.playId, uid: target.uid, date: play.date }));
  const duelRepoints = input.duels
    .filter((duel) => duel.challengerUid === source.uid || duel.opponentUid === source.uid)
    .map((duel) => ({
      id: duel.id,
      challengerUid: duel.challengerUid === source.uid ? target.uid : duel.challengerUid,
      opponentUid: duel.opponentUid === source.uid ? target.uid : duel.opponentUid,
    }));

  return {
    deleteUid: source.uid,
    playReassignments,
    duelRepoints,
    target: {
      ...target,
      nickname: target.nickname?.trim() ? target.nickname : source.nickname,
      streakCurrent: Math.max(target.streakCurrent, source.streakCurrent),
      streakBest: Math.max(target.streakBest, source.streakBest),
      leagueIds,
      freezes: Math.max(target.freezes ?? 0, source.freezes ?? 0),
      email: (target.email || source.email || '').trim().toLowerCase() || undefined,
      isAnonymous: false,
      authProvider: normalizeAuthProvider(input.provider),
      expiresAt: null,
      upgradedAt: target.upgradedAt || input.nowIso,
      pro: pickPro(target.pro, source.pro),
      duelStats: target.duelStats ?? source.duelStats,
    },
  };
}
