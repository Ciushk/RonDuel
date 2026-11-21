import {
  buildEmojiLine,
  canPublishRound,
  computeItemScore,
  computePromptSimilarity,
  computeRoundNumber,
  deterministicShuffle,
  FREE_LIMITS,
  generateInviteCode,
  getLocalDateString,
  ITEM_TIME_LIMIT_MS,
  PRO_LIMITS,
  resolveDuelOutcome,
  selectDuelQuestions,
  suggestLeagueName,
  updateStreakWithShield,
  validateNickname,
  validateRoundSchedule,
  type DuelSideResult,
  type Locale,
  type Question,
  type QuestionType,
} from '@ronduel/shared';

export interface UserRecord {
  uid: string;
  nickname: string;
  locale: Locale;
  tz: string;
  ageConfirmed16: boolean;
  relaxedTimer: boolean;
  isAnonymous: boolean;
  email?: string;
  authProvider?: 'anonymous' | 'email_link' | 'google';
  isAdmin?: boolean;
  pro: {
    active: boolean;
    plan?: 'monthly' | 'yearly';
    until?: string;
  };
  notif: {
    pushEnabled: boolean;
    emailEnabled: boolean;
    reminderLocalTime: string;
    sentTodayCount: number;
  };
  streakCurrent: number;
  streakBest: number;
  lastPlayedDate?: string;
  streakShieldUsedWeek?: string;
  leagueIds: string[];
  createdAt: string;
}

export interface ResolvedRoundItem {
  index: number;
  questionId: string;
  type: Question['type'];
  prompt: string;
  options: string[];
  correctIndex?: number;
  correctOrder?: string[];
  explanation?: string;
  limitMs: number;
  isEnFallback: boolean;
  topics: string[];
}

export interface PlayItemState {
  index: number;
  servedAt: number;
  answeredAt?: number;
  choice?: number | string[];
  correct?: boolean;
  points: number;
  timedOut: boolean;
  emoji?: '⚡' | '🟩' | '🟥';
}

export interface PlayRecord {
  playId: string;
  uid: string;
  date: string;
  roundNumber: number;
  locale: Locale;
  relaxedTimer: boolean;
  status: 'in_progress' | 'finished';
  items: PlayItemState[];
  totalScore: number;
  totalMs: number;
  emojiLine: string;
  finishedAt?: string;
}

export interface LeagueMember {
  uid: string;
  nickname: string;
  role: 'owner' | 'member';
  joinedAt: string;
  allTimeScore: number;
  roundsPlayed: number;
  weeklyWins: number;
  bestStreak: number;
  lastFinishedDate?: string;
}

export interface LeagueDayScore {
  uid: string;
  nickname: string;
  score: number;
  totalMs: number;
  emojiLine: string;
  relaxedTimer: boolean;
  finishedAt: string;
}

export interface LeagueFeedEvent {
  id: string;
  type: 'join' | 'weekly_winner' | 'duel_complete';
  text: string;
  createdAt: string;
}

export interface LeagueRecord {
  id: string;
  name: string;
  inviteCode: string;
  ownerUid: string;
  tz: string;
  maxMembers: number;
  members: Record<string, LeagueMember>;
  days: Record<string, Record<string, LeagueDayScore>>;
  feed: LeagueFeedEvent[];
  createdAt: string;
}

export interface DuelSidePlay {
  uid: string;
  nickname: string;
  items: PlayItemState[];
  score: number;
  totalMs: number;
  finishedAt?: string;
}

export interface DuelRecord {
  id: string;
  leagueId?: string;
  challengerUid: string;
  opponentUid: string | null;
  questionIds: string[];
  status: 'pending' | 'active' | 'complete' | 'expired';
  sides: Record<string, DuelSidePlay>;
  winnerUid: string | null;
  walkover: boolean;
  createdAt: string;
}

export interface AdminRoundSchedule {
  date: string;
  roundNumber: number;
  questionIds: string[];
  topicOfTheDay: string;
  status: 'draft' | 'scheduled' | 'published';
  explicitFallbackLocales: Locale[];
}

export interface ModerationReport {
  id: string;
  targetType: 'nickname' | 'league';
  targetId: string;
  reason: string;
  reporterUid: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export type StoredQuestion = Question & {
  lastUsedOn?: string;
  factChecklist?: string[];
  reviewedBy?: string;
  reviewedAt?: string;
};

interface StoreState {
  questions: StoredQuestion[];
  users: Record<string, UserRecord>;
  plays: Record<string, PlayRecord>;
  leagues: Record<string, LeagueRecord>;
  inviteCodes: Record<string, string>;
  duels: Record<string, DuelRecord>;
  pairRecords: Record<string, Record<string, number>>; // pairKey -> { [uid]: wins }
  stripeEvents: Record<string, string>;
  subscriptions: Record<
    string,
    { plan: 'monthly' | 'yearly'; status: string; currentPeriodEnd: string }
  >;
  scheduledRounds: Record<string, AdminRoundSchedule>;
  reports: Record<string, ModerationReport>;
}

const globalForStore = globalThis as unknown as { __ronduelStore?: StoreState };

import seedQuestionsData from '../content/seed/questions.en.json';

function loadSeedQuestions(): StoredQuestion[] {
  return structuredClone(seedQuestionsData) as unknown as StoredQuestion[];
}

function getStore(): StoreState {
  if (!globalForStore.__ronduelStore) {
    globalForStore.__ronduelStore = {
      questions: loadSeedQuestions(),
      users: {},
      plays: {},
      leagues: {},
      inviteCodes: {},
      duels: {},
      pairRecords: {},
      stripeEvents: {},
      subscriptions: {},
      scheduledRounds: {},
      reports: {},
    };
  }
  const s = globalForStore.__ronduelStore;
  if (!s.duels) s.duels = {};
  if (!s.pairRecords) s.pairRecords = {};
  if (!s.stripeEvents) s.stripeEvents = {};
  if (!s.subscriptions) s.subscriptions = {};
  if (!s.scheduledRounds) s.scheduledRounds = {};
  if (!s.reports) s.reports = {};
  return s;
}

const TOPICS_OF_DAY = [
  'World & Science 🌍',
  'History & Logic ⏳',
  'Numbers & Nature 🔢',
  'Culture & Mind 🎨',
  'Speed & Space 🚀',
];

export function getRoundMeta(date: string) {
  const store = getStore();
  const scheduled = store.scheduledRounds[date];
  const launchDate = process.env.NEXT_PUBLIC_LAUNCH_DATE ?? '2026-12-01';
  const roundNumber = scheduled?.roundNumber ?? computeRoundNumber(date, launchDate);
  const topicOfTheDay =
    scheduled?.topicOfTheDay ?? TOPICS_OF_DAY[(roundNumber - 1) % TOPICS_OF_DAY.length]!;
  return { date, roundNumber, topicOfTheDay, itemCount: 6 };
}

function resolveQuestionToItem(
  q: StoredQuestion,
  index: number,
  seedPrefix: string,
  locale: Locale,
): ResolvedRoundItem {
  const localized = q.content[locale];
  const isEnFallback = !localized;
  const content = localized ?? q.content.en!;
  const seed = `${seedPrefix}:${q.id}`;
  const shuffledOptions = deterministicShuffle(content.options, seed);

  if (q.type === 'order') {
    return {
      index,
      questionId: q.id,
      type: q.type,
      prompt: content.prompt,
      options: shuffledOptions,
      correctOrder: content.options,
      explanation: content.explanation,
      limitMs: ITEM_TIME_LIMIT_MS[q.type],
      isEnFallback,
      topics: q.topics,
    };
  }

  const correctText = content.options[q.answer.correctIndex ?? 0]!;
  const correctIndex = shuffledOptions.indexOf(correctText);

  return {
    index,
    questionId: q.id,
    type: q.type,
    prompt: content.prompt,
    options: shuffledOptions,
    correctIndex,
    explanation: content.explanation,
    limitMs: ITEM_TIME_LIMIT_MS[q.type],
    isEnFallback,
    topics: q.topics,
  };
}

export function resolveRoundItems(date: string, locale: Locale): ResolvedRoundItem[] {
  const store = getStore();
  const scheduled = store.scheduledRounds[date];
  if (scheduled && scheduled.questionIds.length === 6) {
    const picked = scheduled.questionIds
      .map((id) => store.questions.find((q) => q.id === id))
      .filter((q): q is StoredQuestion => Boolean(q));
    if (picked.length === 6) {
      return picked.map((q, idx) => resolveQuestionToItem(q, idx, date, locale));
    }
  }

  const mcqs = store.questions.filter((q) => q.type === 'mcq' && q.reviewStatus === 'approved');
  const orders = store.questions.filter((q) => q.type === 'order' && q.reviewStatus === 'approved');
  const odds = store.questions.filter((q) => q.type === 'odd' && q.reviewStatus === 'approved');
  const logics = store.questions.filter((q) => q.type === 'logic' && q.reviewStatus === 'approved');

  const roundNum = getRoundMeta(date).roundNumber;
  const dayIdx = Math.abs(roundNum - 1) % 5;

  const picked: StoredQuestion[] = [
    mcqs[(dayIdx * 2) % mcqs.length]!,
    mcqs[(dayIdx * 2 + 1) % mcqs.length]!,
    orders[dayIdx % orders.length]!,
    odds[dayIdx % odds.length]!,
    logics[(dayIdx * 2) % logics.length]!,
    logics[(dayIdx * 2 + 1) % logics.length]!,
  ].filter(Boolean);

  return picked.map((q, index) => resolveQuestionToItem(q, index, date, locale));
}

export function getOrCreateUser(params: {
  uid: string;
  nickname?: string;
  locale?: Locale;
  tz?: string;
  ageConfirmed16?: boolean;
  relaxedTimer?: boolean;
}): UserRecord {
  const store = getStore();
  let user = store.users[params.uid];
  if (!user) {
    user = {
      uid: params.uid,
      nickname: params.nickname ?? `Player_${params.uid.slice(-4)}`,
      locale: params.locale ?? 'en',
      tz: params.tz ?? 'UTC',
      ageConfirmed16: params.ageConfirmed16 ?? true,
      relaxedTimer: params.relaxedTimer ?? false,
      isAnonymous: true,
      authProvider: 'anonymous',
      pro: { active: false },
      notif: {
        pushEnabled: false,
        emailEnabled: false,
        reminderLocalTime: '18:00',
        sentTodayCount: 0,
      },
      streakCurrent: 0,
      streakBest: 0,
      leagueIds: [],
      createdAt: new Date().toISOString(),
    };
    store.users[params.uid] = user;
  } else {
    if (params.nickname) user.nickname = params.nickname;
    if (params.locale) user.locale = params.locale;
    if (params.tz) user.tz = params.tz;
    if (typeof params.relaxedTimer === 'boolean') user.relaxedTimer = params.relaxedTimer;
    if (!user.pro) user.pro = { active: false };
    if (!user.notif) {
      user.notif = {
        pushEnabled: false,
        emailEnabled: false,
        reminderLocalTime: '18:00',
        sentTodayCount: 0,
      };
    }
    if (typeof user.isAnonymous !== 'boolean') user.isAnonymous = true;
  }
  return user;
}

export function getTodayStatus(uid: string, tz: string) {
  const store = getStore();
  const date = getLocalDateString(new Date(), tz);
  const meta = getRoundMeta(date);
  const playId = `${date}_${uid}`;
  const play = store.plays[playId];
  const user = getOrCreateUser({ uid, tz });
  const finishedPlaysCount = Object.values(store.plays).filter(
    (p) => p.uid === uid && p.status === 'finished',
  ).length;

  const activeDuels = Object.values(store.duels)
    .filter(
      (d) =>
        (d.challengerUid === uid || d.opponentUid === uid) &&
        (d.status === 'pending' || d.status === 'active'),
    )
    .map((d) => ({
      id: d.id,
      status: d.status,
      challengerNickname: d.sides[d.challengerUid]?.nickname ?? 'Challenger',
      opponentNickname: d.opponentUid
        ? (d.sides[d.opponentUid]?.nickname ?? 'Opponent')
        : 'Open invite',
      myTurn: !d.sides[uid]?.finishedAt,
    }));

  return {
    ...meta,
    played: play?.status === 'finished',
    inProgress: play?.status === 'in_progress',
    playId: play ? play.playId : undefined,
    streakCurrent: user.streakCurrent,
    streakBest: user.streakBest,
    isPro: user.pro.active,
    isAnonymous: user.isAnonymous,
    finishedPlaysCount,
    activeDuels,
    leagues: user.leagueIds
      .map((id) => store.leagues[id])
      .filter((l): l is LeagueRecord => Boolean(l))
      .map((l) => ({
        id: l.id,
        name: l.name,
        inviteCode: l.inviteCode,
        memberCount: Object.keys(l.members).length,
        playedTodayCount: Object.keys(l.days[date] ?? {}).length,
      })),
  };
}

function toClientItem(item: ResolvedRoundItem, relaxedTimer: boolean) {
  return {
    index: item.index,
    type: item.type,
    prompt: item.prompt,
    options: item.options,
    limitMs: relaxedTimer ? Math.round(item.limitMs * 1.5) : item.limitMs,
    isEnFallback: item.isEnFallback,
  };
}

export function startRound(params: {
  uid: string;
  tz: string;
  locale: Locale;
  nickname?: string;
  relaxedTimer?: boolean;
}) {
  const store = getStore();
  const user = getOrCreateUser({
    uid: params.uid,
    nickname: params.nickname,
    locale: params.locale,
    tz: params.tz,
    relaxedTimer: params.relaxedTimer,
  });

  const date = getLocalDateString(new Date(), params.tz);
  const meta = getRoundMeta(date);
  const playId = `${date}_${params.uid}`;
  const resolved = resolveRoundItems(date, params.locale);

  let play = store.plays[playId];
  if (play?.status === 'finished') {
    return { alreadyFinished: true as const, playId };
  }

  const now = Date.now();
  if (!play) {
    play = {
      playId,
      uid: params.uid,
      date,
      roundNumber: meta.roundNumber,
      locale: params.locale,
      relaxedTimer: user.relaxedTimer,
      status: 'in_progress',
      items: [{ index: 0, servedAt: now, points: 0, timedOut: false }],
      totalScore: 0,
      totalMs: 0,
      emojiLine: '',
    };
    store.plays[playId] = play;
  }

  const currentItemState =
    play.items.find((i) => i.answeredAt === undefined) ?? play.items[play.items.length - 1]!;
  const resolvedItem = resolved[currentItemState.index]!;
  const clientItem = toClientItem(resolvedItem, play.relaxedTimer);
  const elapsedMs = Math.max(0, now - currentItemState.servedAt);

  return {
    alreadyFinished: false as const,
    playId,
    roundNumber: meta.roundNumber,
    totalItems: resolved.length,
    item: clientItem,
    remainingMs: Math.max(0, clientItem.limitMs - elapsedMs),
    serverNow: now,
  };
}

export function submitAnswer(params: {
  uid: string;
  playId: string;
  index: number;
  choice: number | string[] | null;
}) {
  const store = getStore();
  const play = store.plays[params.playId];
  if (!play || play.uid !== params.uid) {
    throw new Error('Play not found');
  }
  if (play.status === 'finished') {
    throw new Error('Play already finished');
  }

  const itemState = play.items.find((i) => i.index === params.index);
  if (!itemState) {
    throw new Error('Item not served yet');
  }
  if (itemState.answeredAt !== undefined) {
    throw new Error('Item already answered');
  }

  const resolved = resolveRoundItems(play.date, play.locale);
  const resolvedItem = resolved[params.index]!;
  const limitMs = play.relaxedTimer ? Math.round(resolvedItem.limitMs * 1.5) : resolvedItem.limitMs;

  const now = Date.now();
  const elapsedMs = Math.max(0, now - itemState.servedAt);

  let isCorrect = false;
  if (params.choice !== null) {
    if (resolvedItem.type === 'order' && Array.isArray(params.choice)) {
      isCorrect =
        resolvedItem.correctOrder !== undefined &&
        params.choice.length === resolvedItem.correctOrder.length &&
        params.choice.every((val, idx) => val === resolvedItem.correctOrder![idx]);
    } else if (typeof params.choice === 'number') {
      isCorrect = params.choice === resolvedItem.correctIndex;
    }
  }

  const scoreRes = computeItemScore({ correct: isCorrect, elapsedMs, limitMs });
  itemState.answeredAt = now;
  itemState.choice = params.choice ?? undefined;
  itemState.correct = scoreRes.points > 0;
  itemState.points = scoreRes.points;
  itemState.timedOut = scoreRes.timedOut;
  itemState.emoji = scoreRes.emoji;

  play.totalScore += scoreRes.points;
  play.totalMs += Math.min(scoreRes.effectiveElapsedMs, limitMs);

  const nextIndex = params.index + 1;
  let nextPayload: ReturnType<typeof toClientItem> | null = null;
  if (nextIndex < resolved.length) {
    play.items.push({ index: nextIndex, servedAt: now, points: 0, timedOut: false });
    nextPayload = toClientItem(resolved[nextIndex]!, play.relaxedTimer);
  }

  return {
    correct: itemState.correct,
    points: itemState.points,
    timedOut: itemState.timedOut,
    emoji: itemState.emoji,
    correctIndex: resolvedItem.correctIndex,
    correctOrder: resolvedItem.correctOrder,
    explanation: resolvedItem.explanation,
    next: nextPayload,
  };
}

export function finishRound(uid: string, playId: string) {
  const store = getStore();
  const play = store.plays[playId];
  if (!play || play.uid !== uid) {
    throw new Error('Play not found');
  }

  if (play.status !== 'finished') {
    play.status = 'finished';
    play.finishedAt = new Date().toISOString();
    play.emojiLine = buildEmojiLine(play.items.map((i) => ({ emoji: i.emoji ?? '🟥' })));

    const user = getOrCreateUser({ uid });
    const nextStreak = updateStreakWithShield({
      lastPlayedDate: user.lastPlayedDate,
      currentDate: play.date,
      streakCurrent: user.streakCurrent,
      streakBest: user.streakBest,
      isPro: user.pro.active,
      streakShieldUsedWeek: user.streakShieldUsedWeek,
    });
    user.streakCurrent = nextStreak.streakCurrent;
    user.streakBest = nextStreak.streakBest;
    user.lastPlayedDate = play.date;
    user.streakShieldUsedWeek = nextStreak.streakShieldUsedWeek;

    for (const leagueId of user.leagueIds) {
      const league = store.leagues[leagueId];
      if (!league) continue;
      const member = league.members[uid];
      if (!member) continue;
      member.allTimeScore += play.totalScore;
      member.roundsPlayed += 1;
      member.bestStreak = Math.max(member.bestStreak, user.streakBest);
      member.lastFinishedDate = play.date;

      if (!league.days[play.date]) league.days[play.date] = {};
      league.days[play.date]![uid] = {
        uid,
        nickname: member.nickname,
        score: play.totalScore,
        totalMs: play.totalMs,
        emojiLine: play.emojiLine,
        relaxedTimer: play.relaxedTimer,
        finishedAt: play.finishedAt,
      };
    }
  }

  const user = getOrCreateUser({ uid });
  const resolved = resolveRoundItems(play.date, play.locale);
  const finishedPlaysCount = Object.values(store.plays).filter(
    (p) => p.uid === uid && p.status === 'finished',
  ).length;

  return {
    playId: play.playId,
    date: play.date,
    roundNumber: play.roundNumber,
    totalScore: play.totalScore,
    totalMs: play.totalMs,
    emojiLine: play.emojiLine,
    streakCurrent: user.streakCurrent,
    streakBest: user.streakBest,
    finishedPlaysCount,
    review: resolved.map((r, idx) => ({
      index: idx,
      prompt: r.prompt,
      correctAnswer:
        r.type === 'order' ? (r.correctOrder ?? []).join(' → ') : r.options[r.correctIndex ?? 0]!,
      explanation: r.explanation,
      points: play.items[idx]?.points ?? 0,
      emoji: play.items[idx]?.emoji ?? '🟥',
    })),
    primaryLeague: user.leagueIds[0]
      ? {
          id: user.leagueIds[0],
          inviteCode: store.leagues[user.leagueIds[0]]?.inviteCode,
          name: store.leagues[user.leagueIds[0]]?.name,
        }
      : null,
  };
}

export function getPlayResult(playId: string) {
  const store = getStore();
  const play = store.plays[playId];
  if (!play || play.status !== 'finished') return null;
  return finishRound(play.uid, playId);
}

export function createLeague(params: { uid: string; name?: string; tz: string; locale: Locale }) {
  const store = getStore();
  const user = getOrCreateUser({ uid: params.uid, tz: params.tz, locale: params.locale });

  let inviteCode = generateInviteCode();
  while (store.inviteCodes[inviteCode]) {
    inviteCode = generateInviteCode();
  }

  const id = `lg_${inviteCode.toLowerCase()}`;
  const name = params.name?.trim() || suggestLeagueName(params.locale);
  const maxMembers = user.pro.active
    ? PRO_LIMITS.maxMembersPerLeague
    : FREE_LIMITS.maxMembersPerLeague;

  const league: LeagueRecord = {
    id,
    name,
    inviteCode,
    ownerUid: params.uid,
    tz: params.tz,
    maxMembers,
    members: {
      [params.uid]: {
        uid: params.uid,
        nickname: user.nickname,
        role: 'owner',
        joinedAt: new Date().toISOString(),
        allTimeScore: 0,
        roundsPlayed: 0,
        weeklyWins: 0,
        bestStreak: user.streakBest,
        lastFinishedDate: user.lastPlayedDate,
      },
    },
    days: {},
    feed: [
      {
        id: `ev_${Date.now()}`,
        type: 'join',
        text: `${user.nickname} created ${name}`,
        createdAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
  };

  const today = getLocalDateString(new Date(), params.tz);
  const todayPlay = store.plays[`${today}_${params.uid}`];
  if (todayPlay?.status === 'finished') {
    league.days[today] = {
      [params.uid]: {
        uid: params.uid,
        nickname: user.nickname,
        score: todayPlay.totalScore,
        totalMs: todayPlay.totalMs,
        emojiLine: todayPlay.emojiLine,
        relaxedTimer: todayPlay.relaxedTimer,
        finishedAt: todayPlay.finishedAt ?? new Date().toISOString(),
      },
    };
    league.members[params.uid]!.allTimeScore = todayPlay.totalScore;
    league.members[params.uid]!.roundsPlayed = 1;
  }

  store.leagues[id] = league;
  store.inviteCodes[inviteCode] = id;
  if (!user.leagueIds.includes(id)) {
    user.leagueIds.push(id);
  }

  return league;
}

export function getLeagueByCodeOrId(codeOrId: string, viewerUid?: string) {
  const store = getStore();
  const id = store.inviteCodes[codeOrId.toUpperCase()] ?? codeOrId;
  const league = store.leagues[id];
  if (!league) return null;

  const today = getLocalDateString(new Date(), league.tz);
  const viewerMember = viewerUid ? league.members[viewerUid] : undefined;
  const viewerFinishedToday = viewerMember?.lastFinishedDate === today;

  const rawToday = Object.values(league.days[today] ?? {}).sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.totalMs - b.totalMs,
  );

  const todayScores = rawToday.map((entry) => ({
    uid: entry.uid,
    nickname: entry.nickname,
    score: viewerFinishedToday ? entry.score : null,
    totalMs: viewerFinishedToday ? entry.totalMs : null,
    emojiLine: viewerFinishedToday ? entry.emojiLine : null,
    relaxedTimer: entry.relaxedTimer,
  }));

  const allTime = Object.values(league.members).sort((a, b) => b.allTimeScore - a.allTimeScore);

  return {
    id: league.id,
    name: league.name,
    inviteCode: league.inviteCode,
    tz: league.tz,
    memberCount: Object.keys(league.members).length,
    maxMembers: league.maxMembers,
    viewerFinishedToday,
    todayScores,
    allTime,
    feed: (league.feed ?? []).slice(-10).reverse(),
  };
}

export function joinLeague(params: {
  inviteCode: string;
  uid: string;
  nickname: string;
  tz: string;
}) {
  const store = getStore();
  const id = store.inviteCodes[params.inviteCode.toUpperCase()];
  if (!id) throw new Error('League not found');
  const league = store.leagues[id]!;

  const nickCheck = validateNickname(params.nickname);
  if (!nickCheck.ok) {
    throw new Error(`Invalid nickname: ${nickCheck.reason}`);
  }

  if (!league.members[params.uid] && Object.keys(league.members).length >= league.maxMembers) {
    throw new Error('League is full (25 members on Free tier). Upgrade to Pro for up to 200.');
  }

  const user = getOrCreateUser({ uid: params.uid, nickname: nickCheck.value, tz: params.tz });
  if (!league.members[params.uid]) {
    league.members[params.uid] = {
      uid: params.uid,
      nickname: nickCheck.value,
      role: 'member',
      joinedAt: new Date().toISOString(),
      allTimeScore: 0,
      roundsPlayed: 0,
      weeklyWins: 0,
      bestStreak: user.streakBest,
      lastFinishedDate: user.lastPlayedDate,
    };
    if (!league.feed) league.feed = [];
    league.feed.push({
      id: `ev_${Date.now()}_${params.uid.slice(-3)}`,
      type: 'join',
      text: `${nickCheck.value} joined the league`,
      createdAt: new Date().toISOString(),
    });
  } else {
    league.members[params.uid]!.nickname = nickCheck.value;
  }

  if (!user.leagueIds.includes(id)) {
    user.leagueIds.push(id);
  }

  return league;
}

// ==========================================
// Phase 2: Async 1v1 Duels & Account Upgrade
// ==========================================

function getForbiddenDailyQuestionIds(tz: string): Set<string> {
  const forbidden = new Set<string>();
  const now = new Date();
  // Exclude today's daily round; if the pool is > 30 items, also exclude upcoming 7 days
  // With the 30-item seed (5 days * 6 items = 30), excluding today's 6 items leaves 24 items
  // so 5 duel items never overlap with today's round.
  const store = getStore();
  const daysToExclude = store.questions.length > 48 ? 8 : 1;
  for (let d = 0; d < daysToExclude; d += 1) {
    const dt = new Date(now.getTime() + d * 86_400_000);
    const dateStr = getLocalDateString(dt, tz);
    for (const item of resolveRoundItems(dateStr, 'en')) {
      forbidden.add(item.questionId);
    }
  }
  return forbidden;
}

function getPairKey(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('::');
}

export function createDuel(params: {
  challengerUid: string;
  opponentUid?: string | null;
  leagueId?: string;
  tz: string;
  nickname?: string;
}) {
  const store = getStore();
  const user = getOrCreateUser({
    uid: params.challengerUid,
    nickname: params.nickname,
    tz: params.tz,
  });

  const activeCount = Object.values(store.duels).filter(
    (d) =>
      d.challengerUid === params.challengerUid && (d.status === 'pending' || d.status === 'active'),
  ).length;
  const maxDuels = user.pro.active ? PRO_LIMITS.maxActiveDuels : FREE_LIMITS.maxActiveDuels;
  if (activeCount >= maxDuels) {
    throw new Error(
      `Free tier limit reached (${FREE_LIMITS.maxActiveDuels} active duels). Upgrade to Pro for unlimited duels.`,
    );
  }

  const duelId = `duel_${generateInviteCode().toLowerCase()}`;
  const forbidden = getForbiddenDailyQuestionIds(params.tz);
  const picked = selectDuelQuestions({
    allQuestions: store.questions,
    forbiddenQuestionIds: forbidden,
    seed: duelId,
  });

  const sides: Record<string, DuelSidePlay> = {
    [params.challengerUid]: {
      uid: params.challengerUid,
      nickname: user.nickname,
      items: [],
      score: 0,
      totalMs: 0,
    },
  };

  if (params.opponentUid) {
    const opp = getOrCreateUser({ uid: params.opponentUid });
    sides[params.opponentUid] = {
      uid: params.opponentUid,
      nickname: opp.nickname,
      items: [],
      score: 0,
      totalMs: 0,
    };
  }

  const duel: DuelRecord = {
    id: duelId,
    leagueId: params.leagueId,
    challengerUid: params.challengerUid,
    opponentUid: params.opponentUid ?? null,
    questionIds: picked.map((q) => q.id),
    status: 'pending',
    sides,
    winnerUid: null,
    walkover: false,
    createdAt: new Date().toISOString(),
  };

  store.duels[duelId] = duel;
  return duel;
}

function resolveDuelItems(duel: DuelRecord, locale: Locale): ResolvedRoundItem[] {
  const store = getStore();
  return duel.questionIds.map((qid, idx) => {
    const q = store.questions.find((item) => item.id === qid) ?? store.questions[idx]!;
    return resolveQuestionToItem(q, idx, duel.id, locale);
  });
}

export function getDuelView(duelId: string, locale: Locale = 'en') {
  const store = getStore();
  const duel = store.duels[duelId];
  if (!duel) return null;

  const challengerSide = duel.sides[duel.challengerUid];
  const opponentSide = duel.opponentUid ? duel.sides[duel.opponentUid] : undefined;

  const outcome = resolveDuelOutcome({
    challengerUid: duel.challengerUid,
    opponentUid: duel.opponentUid,
    createdAtMs: Date.parse(duel.createdAt),
    nowMs: Date.now(),
    challengerSide: challengerSide as DuelSideResult | undefined,
    opponentSide: opponentSide as DuelSideResult | undefined,
  });

  duel.status = outcome.status;
  duel.winnerUid = outcome.winnerUid;
  duel.walkover = outcome.walkover;

  let headToHead: Record<string, number> = {};
  if (duel.opponentUid) {
    const pk = getPairKey(duel.challengerUid, duel.opponentUid);
    headToHead = store.pairRecords[pk] ?? {};
  }

  const resolved = resolveDuelItems(duel, locale);

  return {
    id: duel.id,
    leagueId: duel.leagueId,
    status: duel.status,
    challengerUid: duel.challengerUid,
    opponentUid: duel.opponentUid,
    winnerUid: duel.winnerUid,
    walkover: duel.walkover,
    createdAt: duel.createdAt,
    sides: Object.fromEntries(
      Object.entries(duel.sides).map(([uid, s]) => [
        uid,
        {
          uid: s.uid,
          nickname: s.nickname,
          score: s.score,
          totalMs: s.totalMs,
          finishedAt: s.finishedAt,
          itemPoints: s.items.map((i) => ({ points: i.points, emoji: i.emoji ?? '🟥' })),
        },
      ]),
    ),
    headToHead,
    breakdown:
      duel.status === 'complete'
        ? resolved.map((r, idx) => ({
            index: idx,
            prompt: r.prompt,
            correctAnswer:
              r.type === 'order'
                ? (r.correctOrder ?? []).join(' → ')
                : r.options[r.correctIndex ?? 0]!,
            challengerPts: challengerSide?.items[idx]?.points ?? 0,
            opponentPts: opponentSide?.items[idx]?.points ?? 0,
          }))
        : [],
  };
}

export function startDuelSide(params: {
  duelId: string;
  uid: string;
  nickname?: string;
  locale: Locale;
}) {
  const store = getStore();
  const duel = store.duels[params.duelId];
  if (!duel) throw new Error('Duel not found');

  const user = getOrCreateUser({
    uid: params.uid,
    nickname: params.nickname,
    locale: params.locale,
  });

  if (params.uid !== duel.challengerUid && !duel.opponentUid) {
    duel.opponentUid = params.uid;
  }

  if (params.uid !== duel.challengerUid && params.uid !== duel.opponentUid) {
    throw new Error('This duel already has two players');
  }

  if (!duel.sides[params.uid]) {
    duel.sides[params.uid] = {
      uid: params.uid,
      nickname: user.nickname,
      items: [],
      score: 0,
      totalMs: 0,
    };
  } else if (params.nickname) {
    duel.sides[params.uid]!.nickname = user.nickname;
  }

  const side = duel.sides[params.uid]!;
  if (side.finishedAt) {
    return { alreadyFinished: true as const };
  }

  const now = Date.now();
  if (side.items.length === 0) {
    side.items.push({ index: 0, servedAt: now, points: 0, timedOut: false });
  }
  duel.status = 'active';

  const resolved = resolveDuelItems(duel, params.locale);
  const currentItemState =
    side.items.find((i) => i.answeredAt === undefined) ?? side.items[side.items.length - 1]!;
  const resolvedItem = resolved[currentItemState.index]!;
  const clientItem = toClientItem(resolvedItem, user.relaxedTimer);

  return {
    alreadyFinished: false as const,
    totalItems: resolved.length,
    item: clientItem,
    remainingMs: clientItem.limitMs,
  };
}

export function submitDuelAnswer(params: {
  duelId: string;
  uid: string;
  index: number;
  choice: number | string[] | null;
  locale?: Locale;
}) {
  const store = getStore();
  const duel = store.duels[params.duelId];
  if (!duel) throw new Error('Duel not found');
  const side = duel.sides[params.uid];
  if (!side || side.finishedAt) throw new Error('Side not active');

  const itemState = side.items.find((i) => i.index === params.index);
  if (!itemState || itemState.answeredAt !== undefined) {
    throw new Error('Invalid duel item state');
  }

  const user = getOrCreateUser({ uid: params.uid });
  const resolved = resolveDuelItems(duel, params.locale ?? user.locale);
  const resolvedItem = resolved[params.index]!;
  const limitMs = user.relaxedTimer ? Math.round(resolvedItem.limitMs * 1.5) : resolvedItem.limitMs;

  const now = Date.now();
  const elapsedMs = Math.max(0, now - itemState.servedAt);

  let isCorrect = false;
  if (params.choice !== null) {
    if (resolvedItem.type === 'order' && Array.isArray(params.choice)) {
      isCorrect =
        resolvedItem.correctOrder !== undefined &&
        params.choice.length === resolvedItem.correctOrder.length &&
        params.choice.every((val, idx) => val === resolvedItem.correctOrder![idx]);
    } else if (typeof params.choice === 'number') {
      isCorrect = params.choice === resolvedItem.correctIndex;
    }
  }

  const scoreRes = computeItemScore({ correct: isCorrect, elapsedMs, limitMs });
  itemState.answeredAt = now;
  itemState.choice = params.choice ?? undefined;
  itemState.correct = scoreRes.points > 0;
  itemState.points = scoreRes.points;
  itemState.timedOut = scoreRes.timedOut;
  itemState.emoji = scoreRes.emoji;

  side.score += scoreRes.points;
  side.totalMs += Math.min(scoreRes.effectiveElapsedMs, limitMs);

  const nextIndex = params.index + 1;
  let nextPayload: ReturnType<typeof toClientItem> | null = null;
  if (nextIndex < resolved.length) {
    side.items.push({ index: nextIndex, servedAt: now, points: 0, timedOut: false });
    nextPayload = toClientItem(resolved[nextIndex]!, user.relaxedTimer);
  } else {
    side.finishedAt = new Date().toISOString();
    // Check if both sides completed
    const challengerSide = duel.sides[duel.challengerUid];
    const opponentSide = duel.opponentUid ? duel.sides[duel.opponentUid] : undefined;
    const outcome = resolveDuelOutcome({
      challengerUid: duel.challengerUid,
      opponentUid: duel.opponentUid,
      createdAtMs: Date.parse(duel.createdAt),
      nowMs: now,
      challengerSide: challengerSide as DuelSideResult | undefined,
      opponentSide: opponentSide as DuelSideResult | undefined,
    });
    duel.status = outcome.status;
    duel.winnerUid = outcome.winnerUid;
    duel.walkover = outcome.walkover;

    if (outcome.status === 'complete' && outcome.winnerUid && duel.opponentUid) {
      const pk = getPairKey(duel.challengerUid, duel.opponentUid);
      if (!store.pairRecords[pk]) store.pairRecords[pk] = {};
      store.pairRecords[pk]![outcome.winnerUid] =
        (store.pairRecords[pk]![outcome.winnerUid] ?? 0) + 1;

      if (duel.leagueId && store.leagues[duel.leagueId]) {
        const lg = store.leagues[duel.leagueId]!;
        const winnerNick = duel.sides[outcome.winnerUid]?.nickname ?? 'Winner';
        if (!lg.feed) lg.feed = [];
        lg.feed.push({
          id: `ev_${Date.now()}`,
          type: 'duel_complete',
          text: `⚔️ ${winnerNick} won a 1v1 duel (${challengerSide?.score ?? 0} vs ${opponentSide?.score ?? 0})`,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  return {
    correct: itemState.correct,
    points: itemState.points,
    timedOut: itemState.timedOut,
    emoji: itemState.emoji,
    correctIndex: resolvedItem.correctIndex,
    correctOrder: resolvedItem.correctOrder,
    explanation: resolvedItem.explanation,
    next: nextPayload,
    duelComplete: duel.status === 'complete',
  };
}

export function upgradeAccount(params: {
  uid: string;
  email: string;
  provider: 'email_link' | 'google';
}) {
  const user = getOrCreateUser({ uid: params.uid });
  user.isAnonymous = false;
  user.email = params.email.trim().toLowerCase();
  user.authProvider = params.provider;

  const adminEmails = (process.env.ADMIN_BOOTSTRAP_EMAILS ?? 'admin@ronduel.eu')
    .split(',')
    .map((e) => e.trim().toLowerCase());
  if (adminEmails.includes(user.email)) {
    user.isAdmin = true;
  }

  return {
    uid: user.uid,
    nickname: user.nickname,
    email: user.email,
    isAnonymous: user.isAnonymous,
    authProvider: user.authProvider,
    isAdmin: Boolean(user.isAdmin),
    streakCurrent: user.streakCurrent,
    streakBest: user.streakBest,
    leagueIds: user.leagueIds,
  };
}

export function getUserProfile(uid: string) {
  const store = getStore();
  const user = getOrCreateUser({ uid });
  const userPlays = Object.values(store.plays).filter(
    (p) => p.uid === uid && p.status === 'finished',
  );

  // Compute topic accuracy for Pro stats
  const topicTotals: Record<string, { correct: number; total: number }> = {};
  for (const play of userPlays) {
    const resolved = resolveRoundItems(play.date, play.locale);
    for (const item of play.items) {
      const r = resolved[item.index];
      if (!r) continue;
      for (const topic of r.topics) {
        if (!topicTotals[topic]) topicTotals[topic] = { correct: 0, total: 0 };
        topicTotals[topic]!.total += 1;
        if (item.correct) topicTotals[topic]!.correct += 1;
      }
    }
  }

  const topicAccuracy = Object.entries(topicTotals).map(([topic, stat]) => ({
    topic,
    accuracyPct: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
    total: stat.total,
  }));

  return {
    uid: user.uid,
    nickname: user.nickname,
    email: user.email,
    isAnonymous: user.isAnonymous,
    authProvider: user.authProvider ?? 'anonymous',
    isAdmin: Boolean(user.isAdmin),
    pro: user.pro,
    notif: user.notif,
    streakCurrent: user.streakCurrent,
    streakBest: user.streakBest,
    playedDates: userPlays.map((p) => ({ date: p.date, score: p.totalScore })),
    topicAccuracy: user.pro.active ? topicAccuracy : [],
  };
}

// ==========================================
// Phase 3: RonDuel Pro (Stripe)
// ==========================================

export function processStripeWebhook(params: {
  eventId: string;
  type:
    | 'checkout.session.completed'
    | 'customer.subscription.updated'
    | 'customer.subscription.deleted';
  uid: string;
  plan?: 'monthly' | 'yearly';
  currentPeriodEnd?: string;
}) {
  const store = getStore();
  // Idempotency check (§5 & Phase 3 acceptance)
  if (store.stripeEvents[params.eventId]) {
    return { duplicate: true, processedAt: store.stripeEvents[params.eventId] };
  }
  store.stripeEvents[params.eventId] = new Date().toISOString();

  const user = getOrCreateUser({ uid: params.uid });
  const plan = params.plan ?? 'monthly';
  const until = params.currentPeriodEnd ?? new Date(Date.now() + 30 * 86_400_000).toISOString();

  if (
    params.type === 'checkout.session.completed' ||
    params.type === 'customer.subscription.updated'
  ) {
    user.pro = { active: true, plan, until };
    store.subscriptions[params.uid] = { plan, status: 'active', currentPeriodEnd: until };
    // Upgrade owned leagues maxMembers to 200
    for (const league of Object.values(store.leagues)) {
      if (league.ownerUid === params.uid) {
        league.maxMembers = PRO_LIMITS.maxMembersPerLeague;
      }
    }
  } else if (params.type === 'customer.subscription.deleted') {
    user.pro = { active: false };
    store.subscriptions[params.uid] = { plan, status: 'canceled', currentPeriodEnd: until };
  }

  return { duplicate: false, pro: user.pro };
}

// ==========================================
// Phase 4: Notifications
// ==========================================

export function updateNotificationPrefs(params: {
  uid: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  reminderLocalTime: string;
}) {
  const user = getOrCreateUser({ uid: params.uid });
  if (params.emailEnabled && user.isAnonymous) {
    throw new Error('Email reminders require a linked email account.');
  }
  user.notif = {
    ...user.notif,
    pushEnabled: params.pushEnabled,
    emailEnabled: params.emailEnabled,
    reminderLocalTime: params.reminderLocalTime,
  };
  return user.notif;
}

export function unsubscribeUserEmail(uid: string) {
  const user = getOrCreateUser({ uid });
  user.notif.emailEnabled = false;
  return { ok: true, uid, emailEnabled: false };
}

// ==========================================
// Phase 5: Admin & AI-assisted Content
// ==========================================

export function getAdminDashboard() {
  const store = getStore();
  const questions = store.questions.map((q) => {
    const prompt = q.content.en?.prompt ?? '';
    const duplicates = store.questions
      .filter((other) => other.id !== q.id)
      .filter((other) => computePromptSimilarity(prompt, other.content.en?.prompt ?? '') > 0.55)
      .map((other) => other.id);
    return { ...q, duplicateWarnings: duplicates };
  });

  const allPlays = Object.values(store.plays);
  const finished = allPlays.filter((p) => p.status === 'finished');

  return {
    questions,
    scheduledRounds: Object.values(store.scheduledRounds),
    reports: Object.values(store.reports),
    ops: {
      totalPlays: allPlays.length,
      finishedPlays: finished.length,
      completionRatePct:
        allPlays.length > 0 ? Math.round((finished.length / allPlays.length) * 100) : 100,
      avgScore:
        finished.length > 0
          ? Math.round(finished.reduce((acc, p) => acc + p.totalScore, 0) / finished.length)
          : 0,
    },
  };
}

export function generateAiQuestionDrafts(params: {
  topic: string;
  type: QuestionType;
  difficulty: 1 | 2 | 3;
  count: number;
}) {
  const store = getStore();
  const created: StoredQuestion[] = [];
  for (let i = 0; i < Math.min(5, Math.max(1, params.count)); i += 1) {
    const id = `q-ai-${Date.now()}-${i + 1}`;
    const draft: StoredQuestion = {
      id,
      type: params.type,
      difficulty: params.difficulty,
      topics: [params.topic.toLowerCase()],
      content: {
        en: {
          prompt: `[AI Draft] ${params.topic} (${params.type} #${i + 1}): Verify facts before approving.`,
          options: ['Option A (Correct)', 'Option B', 'Option C', 'Option D'],
          explanation: 'Generated draft — reviewer must verify factual accuracy.',
        },
      },
      answer: params.type === 'order' ? {} : { correctIndex: 0 },
      translationStatus: { en: 'machine_draft', es: 'missing', pt: 'missing', ro: 'missing' },
      source: 'ai_draft',
      reviewStatus: 'draft',
      usageCount: 0,
      factChecklist: [
        'Primary fact verified against an authoritative reference',
        'Distractors are unambiguously wrong (only 1 valid answer)',
        'No time-sensitive wording that could age poorly',
      ],
    };
    store.questions.unshift(draft);
    created.push(draft);
  }
  return created;
}

export function approveAdminQuestion(id: string, reviewer = 'admin') {
  const store = getStore();
  const q = store.questions.find((item) => item.id === id);
  if (!q) throw new Error('Question not found');
  q.reviewStatus = 'approved';
  q.translationStatus.en = 'reviewed';
  q.reviewedBy = reviewer;
  q.reviewedAt = new Date().toISOString();
  return q;
}

export function scheduleAdminRound(params: {
  date: string;
  questionIds: string[];
  topicOfTheDay: string;
}) {
  const store = getStore();
  const picked = params.questionIds
    .map((id) => store.questions.find((q) => q.id === id))
    .filter((q): q is StoredQuestion => Boolean(q));

  const validation = validateRoundSchedule({
    date: params.date,
    questions: picked,
  });

  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }

  const launchDate = process.env.NEXT_PUBLIC_LAUNCH_DATE ?? '2026-12-01';
  const schedule: AdminRoundSchedule = {
    date: params.date,
    roundNumber: computeRoundNumber(params.date, launchDate),
    questionIds: params.questionIds,
    topicOfTheDay: params.topicOfTheDay,
    status: 'scheduled',
    explicitFallbackLocales: ['es', 'pt', 'ro'],
  };
  store.scheduledRounds[params.date] = schedule;
  return { schedule, warnings: validation.warnings };
}

export function publishAdminRound(params: { date: string; explicitFallbackLocales: Locale[] }) {
  const store = getStore();
  const schedule = store.scheduledRounds[params.date];
  if (!schedule) throw new Error('Round not scheduled');

  const picked = schedule.questionIds
    .map((id) => store.questions.find((q) => q.id === id))
    .filter((q): q is StoredQuestion => Boolean(q));

  const check = canPublishRound({
    questions: picked,
    explicitFallbackLocales: new Set(params.explicitFallbackLocales),
  });
  if (!check.ok) {
    throw new Error(
      `Cannot publish: missing reviewed translations or fallback approval for locales: ${check.missingLocales.join(', ')}`,
    );
  }

  schedule.status = 'published';
  schedule.explicitFallbackLocales = params.explicitFallbackLocales;
  for (const q of picked) {
    q.lastUsedOn = params.date;
    q.usageCount += 1;
  }
  return schedule;
}

export function exportUserData(uid: string) {
  const store = getStore();
  return {
    exportedAt: new Date().toISOString(),
    user: store.users[uid] ?? null,
    plays: Object.values(store.plays).filter((p) => p.uid === uid),
  };
}

export function deleteUserData(uid: string) {
  const store = getStore();
  delete store.users[uid];
  for (const [playId, play] of Object.entries(store.plays)) {
    if (play.uid === uid) delete store.plays[playId];
  }
  for (const league of Object.values(store.leagues)) {
    if (league.members[uid]) {
      league.members[uid]!.nickname = 'Former player';
    }
    for (const dayScores of Object.values(league.days)) {
      if (dayScores[uid]) {
        dayScores[uid]!.nickname = 'Former player';
      }
    }
  }
  return { ok: true };
}
