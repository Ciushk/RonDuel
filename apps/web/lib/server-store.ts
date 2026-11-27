import {
  buildEmojiLine,
  canPublishRound,
  computeItemScore,
  computePromptSimilarity,
  computeRoundNumber,
  deterministicShuffle,
  diffCalendarDays,
  FREE_LIMITS,
  generateInviteCode,
  getLocalDateString,
  ITEM_TIME_LIMIT_MS,
  isValidNickname,
  PRO_LIMITS,
  resolveDuelOutcome,
  sanitizeDisplayName,
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

import { pickCuratedTemplates, type GeneratedDraftTemplate } from './ai-question-bank';
import { planAccountMerge, normalizeAuthProvider, type MergeUser } from './account-merge';
import { anonExpiresAtIso } from './anon-retention';
import { resolveLeagueDisplayName, type LeagueNameLike } from './league-name';
import { normalizeLeagueThemeColor } from './league-theme';
import {
  type DailyRoundRecord,
  type GeneratedQuestionItem,
  generateFullDailyRound,
  generateSingleQuestionWithGemini,
} from './daily-round-generator';
import {
  computeFreezeApplication,
  computeStreakSnapshot,
  getLocalHourInTz,
  normalizeFrozenDates,
  type FreezeLedgerEntry,
} from './streak-logic';

export interface UserRecord {
  uid: string;
  nickname: string;
  locale: Locale | string;
  tz: string;
  country?: string;
  ageConfirmed16: boolean;
  relaxedTimer: boolean;
  isAnonymous: boolean;
  email?: string;
  authProvider?:
    'anonymous' | 'email_link' | 'google' | 'google.com' | 'password' | 'email_password';
  isAdmin?: boolean;
  pro: {
    active: boolean;
    plan?: 'monthly' | 'yearly';
    until?: string;
    isTrial?: boolean;
    trialEndsAt?: string;
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
  streakBeforeToday?: number;
  streakIncreasedDate?: string;
  leagueIds: string[];
  lastNicknameChangeAt?: string;
  freezes: number;
  frozenDates?: string[];
  freezeUsedYesterday?: boolean;
  freezeLedger?: FreezeLedgerEntry[];
  duelStats?: {
    played: number;
    wins: number;
    losses: number;
    draws: number;
    bestWinStreak: number;
    currentWinStreak: number;
  };
  rivals?: Record<
    string,
    {
      opponentUid: string;
      opponentNickname: string;
      wins: number;
      losses: number;
      draws: number;
      lastDuelAt: string;
      currentWinStreak: number;
    }
  >;
  createdAt: string;
  expiresAt?: string | null;
  upgradedAt?: string | null;
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
  choice?: number | string[] | null;
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
  locale: Locale | string;
  relaxedTimer: boolean;
  status: 'in_progress' | 'finished';
  items: PlayItemState[];
  totalScore: number;
  totalMs: number;
  emojiLine: string;
  finishedAt?: string;
  freezeAutoUsed?: boolean;
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
  themeEmoji?: string;
  themeColor?: string;
  privateApproval?: boolean;
  joinRequests?: string[];
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
  rated?: boolean;
  createdAt: string;
}

export interface AdminRoundSchedule {
  date: string;
  roundNumber: number;
  questionIds: string[];
  topicOfTheDay: string;
  status: 'draft' | 'scheduled' | 'published';
  explicitFallbackLocales: Locale[];
  locked?: boolean;
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

export interface AuditLogEntry {
  id: string;
  actorUid: string;
  actorEmail?: string;
  action: string;
  targetType: 'question' | 'round' | 'league' | 'report';
  targetId: string;
  details: string;
  createdAt: string;
}

export type StoredQuestion = Question & {
  lastUsedOn?: string;
  factChecklist?: string[];
  reviewedBy?: string;
  reviewedAt?: string;
  timerSec?: number;
  extraContent?: Record<
    string,
    {
      prompt: string;
      options: string[];
      explanation?: string;
    }
  >;
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
  dailyRounds: Record<string, DailyRoundRecord>;
  questionReports: Record<
    string,
    { count: number; reasons: Record<string, number>; flagged: boolean }
  >;
  reports: Record<string, ModerationReport>;
  auditLogs: AuditLogEntry[];
}

const globalForStore = globalThis as unknown as { __ronduelStore?: StoreState };

import seedQuestionsData from '../content/seed/questions.en.json';
import { CURATED_TOPIC_BANK } from './ai-question-bank';

export function loadCuratedQuestions(): StoredQuestion[] {
  const result: StoredQuestion[] = [];
  for (const [topic, drafts] of Object.entries(CURATED_TOPIC_BANK)) {
    drafts.forEach((draft, idx) => {
      result.push({
        id: `curated-${topic}-${idx}`,
        type: draft.type,
        difficulty: 2,
        topics: [topic],
        content: draft.content as unknown as StoredQuestion['content'],
        answer: { correctIndex: draft.correctIndex ?? 0 },
        translationStatus: { en: 'reviewed', es: 'reviewed', pt: 'reviewed', ro: 'reviewed' },
        source: 'human',
        reviewStatus: 'approved',
        usageCount: 0,
      });
    });
  }
  return result;
}

function loadSeedQuestions(): StoredQuestion[] {
  const curated = loadCuratedQuestions();
  const seed = structuredClone(seedQuestionsData) as unknown as StoredQuestion[];
  return [...seed, ...curated];
}

const TMP_STORE_FILE = '/tmp/ronduel_store.json';

export function saveStoreToDisk(s?: StoreState) {
  try {
    if (typeof process !== 'undefined' && process.versions?.node) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs');
      const target = s || globalForStore.__ronduelStore;
      if (target) {
        fs.writeFileSync(TMP_STORE_FILE, JSON.stringify(target), 'utf-8');
      }
    }
  } catch {
    // ignore
  }
}

function loadStoreFromDisk(): StoreState | null {
  try {
    if (typeof process !== 'undefined' && process.versions?.node) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('node:fs');
      if (fs.existsSync(TMP_STORE_FILE)) {
        const raw = fs.readFileSync(TMP_STORE_FILE, 'utf-8');
        return JSON.parse(raw) as StoreState;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function getStore(): StoreState {
  if (!globalForStore.__ronduelStore) {
    const disk = loadStoreFromDisk();
    if (disk && disk.questions && Array.isArray(disk.questions)) {
      globalForStore.__ronduelStore = disk;
    } else {
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
        dailyRounds: {},
        questionReports: {},
        reports: {},
        auditLogs: [],
      };
    }
  }
  const s = globalForStore.__ronduelStore;
  const curated = loadCuratedQuestions();
  for (let i = curated.length - 1; i >= 0; i--) {
    const cq = curated[i]!;
    if (!s.questions.some((q) => q.id === cq.id)) {
      s.questions.unshift(cq);
    }
  }
  if (!s.duels) s.duels = {};
  if (!s.pairRecords) s.pairRecords = {};
  if (!s.stripeEvents) s.stripeEvents = {};
  if (!s.subscriptions) s.subscriptions = {};
  if (!s.scheduledRounds) s.scheduledRounds = {};
  if (!s.dailyRounds) s.dailyRounds = {};
  if (!s.questionReports) s.questionReports = {};
  if (!s.reports) s.reports = {};
  if (!s.auditLogs) s.auditLogs = [];
  if (!s.leagues['lg_world']) {
    s.leagues['lg_world'] = {
      id: 'lg_world',
      name: 'RonDuel World',
      inviteCode: 'WORLD1',
      ownerUid: 'system',
      tz: 'UTC',
      maxMembers: 10_000_000,
      themeEmoji: '🌍',
      themeColor: 'default',
      members: {},
      days: {},
      feed: [],
      createdAt: '2026-11-01T00:00:00.000Z',
    };
    s.inviteCodes['WORLD1'] = 'lg_world';
  }

  // QA #22: Invariant check and sanitation on plays and league days
  for (const [k, p] of Object.entries(s.plays)) {
    const correctCount = p.emojiLine ? (p.emojiLine.match(/[⚡🟩]/gu) || []).length : 0;
    if (
      (p.items.length === 0 && p.totalScore === 0 && p.status === 'finished') ||
      (correctCount > 0 && p.totalScore < 100 * correctCount)
    ) {
      console.warn(`[Store Invariant] Purging corrupt play ${k}`);
      delete s.plays[k];
    }
  }
  for (const l of Object.values(s.leagues)) {
    for (const [day, dayEntries] of Object.entries(l.days)) {
      for (const [uid, e] of Object.entries(dayEntries)) {
        const correctCount = e.emojiLine ? (e.emojiLine.match(/[⚡🟩]/gu) || []).length : 0;
        if (correctCount > 0 && e.score < 100 * correctCount) {
          console.warn(`[Store Invariant] Purging corrupt day entry ${l.id}/${day}/${uid}`);
          delete dayEntries[uid];
        }
      }
    }
  }

  return s;
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export const PRO_BOOTSTRAP_EMAILS = [
  'eu.andrei89@gmail.com',
  ...(process.env.PRO_BOOTSTRAP_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()),
].filter(Boolean);

export const DEFAULT_ADMIN_BOOTSTRAP_EMAILS = [
  'admin@ronduel.eu',
  'eu.andrei89@gmail.com',
] as const;

export function getAdminBootstrapEmails(
  envValue: string | undefined = process.env.ADMIN_BOOTSTRAP_EMAILS,
): string[] {
  const fromEnv = (envValue ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_ADMIN_BOOTSTRAP_EMAILS, ...fromEnv]));
}

export function isAdminBootstrapEmail(
  email: string | null | undefined,
  envValue: string | undefined = process.env.ADMIN_BOOTSTRAP_EMAILS,
): boolean {
  if (typeof email !== 'string' || !email.trim()) return false;
  return getAdminBootstrapEmails(envValue).includes(email.trim().toLowerCase());
}

const TOPICS_OF_DAY = [
  'World & Science 🌍',
  'History & Logic ⏳',
  'Numbers & Nature 🔢',
  'Culture & Mind 🎨',
  'Speed & Space 🚀',
];

const TOPIC_KEYS: Record<string, string> = {
  'World & Science 🌍': 'worldScience',
  'History & Logic ⏳': 'historyLogic',
  'Numbers & Nature 🔢': 'numbersNature',
  'Culture & Mind 🎨': 'cultureMind',
  'Speed & Space 🚀': 'speedSpace',
};

export function getRoundMeta(date: string) {
  const store = getStore();
  const scheduled = store.scheduledRounds[date];
  const launchDate = process.env.NEXT_PUBLIC_LAUNCH_DATE ?? '2026-11-01';
  const roundNumber = scheduled?.roundNumber ?? computeRoundNumber(date, launchDate);
  const topicOfTheDay =
    scheduled?.topicOfTheDay ?? TOPICS_OF_DAY[(roundNumber - 1) % TOPICS_OF_DAY.length]!;
  const themeKey = TOPIC_KEYS[topicOfTheDay] ?? 'worldScience';
  return { date, roundNumber, topicOfTheDay, themeKey, itemCount: 6 };
}

function resolveQuestionToItem(
  q: StoredQuestion,
  index: number,
  seedPrefix: string,
  locale: Locale | string,
): ResolvedRoundItem {
  const contentMap = q.content as Record<
    string,
    { prompt: string; options: string[]; explanation?: string } | undefined
  >;
  const localized = contentMap[locale] || (q.extraContent && q.extraContent[locale]);
  const isEnFallback = !localized;
  const content = localized ?? contentMap['en'] ?? Object.values(contentMap)[0]!;
  const seed = `${seedPrefix}:${q.id}`;
  const shuffledOptions: string[] = deterministicShuffle<string>(content.options, seed);

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

export function resolveRoundItems(date: string, locale: Locale | string): ResolvedRoundItem[] {
  const store = getStore();

  const dailyRound = store.dailyRounds[date];
  if (dailyRound && dailyRound.status === 'ready' && dailyRound.questions.length === 6) {
    return dailyRound.questions.map((q, idx) => {
      const locContent = (q.content[locale] || q.content.en)!;
      const shuffledOptions = deterministicShuffle(locContent.options, `${date}_${q.id}_${locale}`);
      if (q.type === 'order') {
        return {
          index: idx,
          questionId: q.id,
          type: q.type,
          prompt: locContent.prompt,
          options: shuffledOptions,
          correctOrder: locContent.options,
          explanation: locContent.explanation,
          limitMs: ITEM_TIME_LIMIT_MS[q.type],
          isEnFallback: !q.content[locale],
          topics: [q.category],
        };
      }
      const correctText = locContent.options[q.correctIndex ?? 0]!;
      const correctIdx = shuffledOptions.indexOf(correctText);
      return {
        index: idx,
        questionId: q.id,
        type: q.type,
        prompt: locContent.prompt,
        options: shuffledOptions,
        correctIndex: correctIdx !== -1 ? correctIdx : 0,
        explanation: locContent.explanation,
        limitMs: ITEM_TIME_LIMIT_MS[q.type],
        isEnFallback: !q.content[locale],
        topics: [q.category],
      };
    });
  }

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

  const dayOffset = Math.abs(diffCalendarDays('2026-01-01', date));

  const picked: StoredQuestion[] = [
    mcqs[(dayOffset * 2) % mcqs.length]!,
    mcqs[(dayOffset * 2 + 1) % mcqs.length]!,
    orders[dayOffset % orders.length]!,
    odds[dayOffset % odds.length]!,
    logics[(dayOffset * 2) % logics.length]!,
    logics[(dayOffset * 2 + 1) % logics.length]!,
  ].filter(Boolean);

  return picked.map((q, index) => resolveQuestionToItem(q, index, date, locale));
}

const dirtyUserIds = new Set<string>();

export function markUserDirty(uid: string) {
  if (uid) dirtyUserIds.add(uid);
}

export function isUserDirty(uid: string): boolean {
  return Boolean(uid && dirtyUserIds.has(uid));
}

export function consumeDirtyUsers(): UserRecord[] {
  const store = getStore();
  const users: UserRecord[] = [];
  for (const uid of dirtyUserIds) {
    const user = store.users[uid];
    if (user) users.push(user);
  }
  dirtyUserIds.clear();
  return users;
}

/**
 * Returns a user's finished plays deduplicated by playId (fallback `${date}_${uid}`),
 * since store.plays indexes each play under both `${date}_${uid}` and `${uid}_${date}`.
 */
export function getUniqueFinishedPlays(store: StoreState, uid: string): PlayRecord[] {
  const seen = new Map<string, PlayRecord>();
  for (const play of Object.values(store.plays)) {
    if (play.uid !== uid || play.status !== 'finished') continue;
    const key = play.playId || `${play.date}_${play.uid}`;
    if (!seen.has(key)) {
      seen.set(key, play);
    }
  }
  return [...seen.values()];
}

export function isPlaceholderNickname(raw?: string | null): boolean {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return true;
  return /^Player_[A-Za-z0-9]{2,8}$/.test(trimmed);
}

/**
 * Single source of truth for displaying any player's nickname across leagues,
 * admin panels, world ranking, duels, and profile. Always prefers user.nickname
 * when it is a real (non-placeholder) name.
 */
export function resolveUserDisplayName(uid: string, fallbackNickname?: string | null): string {
  const store = getStore();
  const userNick = store.users[uid]?.nickname?.trim() ?? '';
  if (userNick && !isPlaceholderNickname(userNick)) {
    return sanitizeDisplayName(userNick, uid);
  }
  const fallback = (fallbackNickname ?? '').trim();
  if (fallback && !isPlaceholderNickname(fallback)) {
    return sanitizeDisplayName(fallback, uid);
  }
  return sanitizeDisplayName(userNick || fallback, uid);
}

/** Write the current nickname onto every league member, day score, and duel side when it changed. */
export function syncNicknameToLeagues(uid: string, nickname: string): boolean {
  const trimmed = nickname.trim();
  if (!trimmed) return false;
  const isPlaceholder = isPlaceholderNickname(trimmed);
  const store = getStore();
  let changed = false;

  for (const league of Object.values(store.leagues)) {
    const member = league.members?.[uid];
    if (member && member.nickname !== trimmed) {
      if (!isPlaceholder || isPlaceholderNickname(member.nickname)) {
        member.nickname = trimmed;
        changed = true;
      }
    }
    for (const day of Object.values(league.days ?? {})) {
      const entry = day?.[uid];
      if (entry && entry.nickname !== trimmed) {
        if (!isPlaceholder || isPlaceholderNickname(entry.nickname)) {
          entry.nickname = trimmed;
          changed = true;
        }
      }
    }
  }

  if (!isPlaceholder) {
    for (const duel of Object.values(store.duels)) {
      const side = duel.sides?.[uid];
      if (side && side.nickname !== trimmed) {
        side.nickname = trimmed;
        changed = true;
      }
    }
  }

  return changed;
}

/**
 * Backfill league members, league day rows, and duel sides that still hold a stale
 * or Player_xxxx placeholder nickname when store.users[uid] has a real nickname.
 */
export function backfillLeagueNicknamesFromUsers(): number {
  const store = getStore();
  let updated = 0;

  for (const league of Object.values(store.leagues)) {
    for (const member of Object.values(league.members ?? {})) {
      const realNick = store.users[member.uid]?.nickname?.trim();
      if (realNick && !isPlaceholderNickname(realNick) && member.nickname !== realNick) {
        member.nickname = realNick;
        updated += 1;
      }
    }
    for (const day of Object.values(league.days ?? {})) {
      for (const entry of Object.values(day ?? {})) {
        const realNick = store.users[entry.uid]?.nickname?.trim();
        if (realNick && !isPlaceholderNickname(realNick) && entry.nickname !== realNick) {
          entry.nickname = realNick;
          updated += 1;
        }
      }
    }
  }

  for (const duel of Object.values(store.duels)) {
    for (const side of Object.values(duel.sides ?? {})) {
      const realNick = store.users[side.uid]?.nickname?.trim();
      if (realNick && !isPlaceholderNickname(realNick) && side.nickname !== realNick) {
        side.nickname = realNick;
        updated += 1;
      }
    }
  }

  return updated;
}

export function getOrCreateUser(params: {
  uid: string;
  nickname?: string;
  locale?: Locale | string;
  tz?: string;
  ageConfirmed16?: boolean;
  relaxedTimer?: boolean;
}): UserRecord {
  const store = getStore();
  let user = store.users[params.uid];
  const incomingNick = params.nickname?.trim();
  if (!user) {
    user = {
      uid: params.uid,
      nickname: incomingNick || `Player_${params.uid.slice(-4)}`,
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
      leagueIds: ['lg_world'],
      freezes: 0,
      duelStats: {
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        bestWinStreak: 0,
        currentWinStreak: 0,
      },
      rivals: {},
      createdAt: new Date().toISOString(),
    };
    user.expiresAt = anonExpiresAtIso(user.createdAt);
    store.users[params.uid] = user;
    markUserDirty(user.uid);
  } else {
    const before = `${user.nickname}|${user.locale}|${user.tz}|${user.relaxedTimer}`;
    if (
      incomingNick &&
      (!isPlaceholderNickname(incomingNick) || isPlaceholderNickname(user.nickname))
    ) {
      user.nickname = incomingNick;
    }
    if (params.locale) user.locale = params.locale;
    if (params.tz) user.tz = params.tz;
    if (typeof params.relaxedTimer === 'boolean') user.relaxedTimer = params.relaxedTimer;
    if (before !== `${user.nickname}|${user.locale}|${user.tz}|${user.relaxedTimer}`) {
      markUserDirty(user.uid);
    }
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
    if (typeof user.freezes !== 'number') user.freezes = 0;
    if (!user.duelStats) {
      user.duelStats = {
        played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        bestWinStreak: 0,
        currentWinStreak: 0,
      };
    }
    if (!user.rivals) user.rivals = {};
  }

  if (!user.leagueIds.includes('lg_world')) {
    user.leagueIds.unshift('lg_world');
  }
  const world = store.leagues['lg_world'];
  if (world && !world.members[user.uid]) {
    world.members[user.uid] = {
      uid: user.uid,
      nickname: user.nickname,
      role: 'member',
      joinedAt: user.createdAt,
      allTimeScore: 0,
      roundsPlayed: 0,
      weeklyWins: 0,
      bestStreak: 0,
    };
  }
  syncNicknameToLeagues(user.uid, user.nickname);
  if (!user.country) {
    const tz = user.tz || 'UTC';
    if (tz.includes('Bucharest') || tz.includes('Chisinau')) user.country = 'RO';
    else if (tz.includes('Madrid')) user.country = 'ES';
    else if (tz.includes('Lisbon')) user.country = 'PT';
    else if (tz.includes('London')) user.country = 'GB';
    else
      user.country =
        user.locale === 'ro'
          ? 'RO'
          : user.locale === 'es'
            ? 'ES'
            : user.locale === 'pt'
              ? 'PT'
              : 'US';
  }

  if (user.email && PRO_BOOTSTRAP_EMAILS.includes(user.email.toLowerCase())) {
    user.pro = {
      active: true,
      plan: 'yearly',
      until: '2099-12-31T23:59:59.999Z',
    };
  }

  // Keep owned leagues in sync with Pro status (upgrade maxMembers when Pro becomes active).
  if (user.pro?.active) {
    for (const league of Object.values(store.leagues)) {
      if (league.ownerUid === user.uid && league.maxMembers < PRO_LIMITS.maxMembersPerLeague) {
        league.maxMembers = PRO_LIMITS.maxMembersPerLeague;
      }
    }
  }

  return user;
}

export function checkNicknameAvailable(
  nickname: string,
  excludeUid?: string,
): { available: boolean; suggestions: string[] } {
  const store = getStore();
  const trimmed = nickname.trim().toLowerCase();
  if (!trimmed) return { available: false, suggestions: [] };

  const taken = Object.values(store.users).some(
    (u) => u.uid !== excludeUid && u.nickname.trim().toLowerCase() === trimmed,
  );

  if (!taken) {
    return { available: true, suggestions: [] };
  }

  const base = nickname.trim();
  const candidates = [
    `${base}2`,
    `${base}_ro`,
    `${base}_${Math.floor(10 + Math.random() * 90)}`,
    `${base}99`,
    `Super${base}`,
  ];

  const suggestions = candidates
    .filter((c) => {
      const cLow = c.toLowerCase();
      return !Object.values(store.users).some((u) => u.nickname.trim().toLowerCase() === cLow);
    })
    .slice(0, 3);

  return { available: false, suggestions };
}

export function checkLeagueNameAvailable(
  name: string,
  excludeLeagueId?: string,
): { available: boolean; suggestions: string[] } {
  const store = getStore();
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return { available: false, suggestions: [] };

  const taken = Object.values(store.leagues).some(
    (l) => l.id !== excludeLeagueId && l.name.trim().toLowerCase() === trimmed,
  );

  if (!taken) {
    return { available: true, suggestions: [] };
  }

  const base = name.trim();
  const candidates = [
    `${base} 2`,
    `Liga ${base}`,
    `${base} Pro`,
    `${base} FC`,
    `${base} ${Math.floor(10 + Math.random() * 90)}`,
  ];

  const suggestions = candidates
    .filter((c) => {
      const cLow = c.toLowerCase();
      return !Object.values(store.leagues).some((l) => l.name.trim().toLowerCase() === cLow);
    })
    .slice(0, 3);

  return { available: false, suggestions };
}

export function changeUserNickname(params: { uid: string; newNickname: string }) {
  const store = getStore();
  const user = getOrCreateUser({ uid: params.uid });
  const check = validateNickname(params.newNickname);
  if (!check.ok) {
    throw new ApiError('NICKNAME_INVALID', 'Invalid nickname', 400);
  }
  const validNick = check.value;

  // Uniqueness check
  const avail = checkNicknameAvailable(validNick, params.uid);
  if (!avail.available) {
    throw new ApiError('NICKNAME_TAKEN', 'Nickname already in use', 400);
  }

  // 30-day cooldown check
  if (user.lastNicknameChangeAt) {
    const elapsedMs = Date.now() - new Date(user.lastNicknameChangeAt).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    if (elapsedMs < thirtyDaysMs) {
      throw new ApiError('NICKNAME_CHANGE_COOLDOWN', 'Nickname change cooldown active', 400);
    }
  }

  user.nickname = validNick;
  user.lastNicknameChangeAt = new Date().toISOString();
  markUserDirty(user.uid);
  syncNicknameToLeagues(params.uid, validNick);

  saveStoreToDisk(store);
  return { success: true, nickname: validNick, lastNicknameChangeAt: user.lastNicknameChangeAt };
}

export function getGlobalPlayersLeaderboard(dateStr?: string, viewerUid?: string) {
  const store = getStore();
  const date = dateStr || getLocalDateString(new Date(), 'UTC');
  const world = store.leagues['lg_world'];

  // 1. Today's scores worldwide (only finished plays with finishedAt set and meeting invariant check)
  const rawToday = Object.values(world?.days[date] ?? {})
    .filter((entry) => {
      // Must have finishedAt set (exclude started/abandoned)
      if (!entry.finishedAt) return false;
      // Invariant check: number of ⚡/🟩 must equal correct count and score >= 100 * correct
      const correctCount = entry.emojiLine ? (entry.emojiLine.match(/[⚡🟩]/gu) || []).length : 0;
      if (correctCount > 0 && entry.score < 100 * correctCount) {
        console.warn(
          `[getGlobalPlayersLeaderboard Invariant] Skipped corrupt entry uid=${entry.uid}, score=${entry.score}, emoji=${entry.emojiLine}`,
        );
        return false;
      }
      return true;
    })
    .sort((a, b) =>
      b.score !== a.score ? b.score - a.score : (a.totalMs ?? 0) - (b.totalMs ?? 0),
    );

  const today = rawToday.map((entry, idx) => ({
    rank: idx + 1,
    uid: entry.uid,
    nickname: resolveUserDisplayName(entry.uid, entry.nickname),
    score: entry.score,
    totalMs: entry.totalMs,
    emojiLine: entry.emojiLine || '',
    isCurrentUser: Boolean(viewerUid && entry.uid === viewerUid),
  }));

  const viewerTodayIdx = rawToday.findIndex((e) => viewerUid && e.uid === viewerUid);
  const viewerToday = viewerTodayIdx >= 0 ? today[viewerTodayIdx] : null;

  // 2. All-time scores worldwide (only members who played and scored)
  const rawAllTime = Object.values(world?.members ?? {})
    .filter((m) => (m.allTimeScore || 0) > 0 && (m.roundsPlayed || 0) > 0)
    .sort((a, b) =>
      b.allTimeScore !== a.allTimeScore
        ? b.allTimeScore - a.allTimeScore
        : b.roundsPlayed - a.roundsPlayed,
    );

  const allTime = rawAllTime.map((member, idx) => ({
    rank: idx + 1,
    uid: member.uid,
    nickname: resolveUserDisplayName(member.uid, member.nickname),
    allTimeScore: member.allTimeScore,
    roundsPlayed: member.roundsPlayed,
    isCurrentUser: Boolean(viewerUid && member.uid === viewerUid),
  }));

  const viewerAllTimeIdx = rawAllTime.findIndex((m) => viewerUid && m.uid === viewerUid);
  const viewerAllTime = viewerAllTimeIdx >= 0 ? allTime[viewerAllTimeIdx] : null;

  return {
    today,
    allTime,
    viewerToday,
    viewerAllTime,
    totalPlayers: Object.keys(world?.members ?? {}).length,
  };
}

export function getLeagueLeaderboard(dateStr?: string) {
  const store = getStore();
  const date = dateStr || getLocalDateString(new Date(), 'UTC');
  const list = Object.values(store.leagues)
    .filter((l) => l.id !== 'lg_world')
    .map((l) => {
      const todayEntries = Object.values(l.days[date] ?? {});
      const totalPoints = todayEntries.reduce((sum, e) => sum + (e.score ?? 0), 0);
      const allTimePoints = Object.values(l.members).reduce(
        (sum, m) => sum + (m.allTimeScore || 0),
        0,
      );
      const playedTodayCount = todayEntries.length;
      const memberCount = Object.keys(l.members).length;
      const avgScore = playedTodayCount > 0 ? Math.round(totalPoints / playedTodayCount) : 0;
      return {
        id: l.id,
        name: resolveLeagueDisplayName(l as unknown as LeagueNameLike),
        themeEmoji: l.themeEmoji || '🏆',
        themeColor: l.themeColor || 'default',
        memberCount,
        maxMembers: l.maxMembers,
        playedTodayCount,
        totalPoints,
        allTimePoints,
        avgScore,
      };
    })
    .sort((a, b) =>
      b.allTimePoints !== a.allTimePoints
        ? b.allTimePoints - a.allTimePoints
        : b.memberCount - a.memberCount,
    )
    .map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

  return list;
}

export function getTodayStatus(
  uid: string,
  tz: string,
  clientLeagueIds?: string[],
  nowDate: Date = new Date(),
) {
  const store = getStore();
  const user = getOrCreateUser({ uid, tz });
  const effectiveTz = user.tz || tz || 'UTC';
  const date = getLocalDateString(nowDate, effectiveTz);
  const meta = getRoundMeta(date);
  const playId = `${date}_${uid}`;
  const play =
    store.plays[playId] ||
    store.plays[`${uid}_${date}`] ||
    Object.values(store.plays).find((p) => p.uid === uid && p.date === date);

  if (clientLeagueIds && Array.isArray(clientLeagueIds)) {
    for (const lid of clientLeagueIds) {
      if (store.leagues[lid] && !user.leagueIds.includes(lid)) {
        user.leagueIds.push(lid);
        markUserDirty(user.uid);
        if (!store.leagues[lid].members[uid]) {
          store.leagues[lid].members[uid] = {
            uid,
            nickname: user.nickname,
            role: store.leagues[lid].ownerUid === uid ? 'owner' : 'member',
            joinedAt: new Date().toISOString(),
            allTimeScore: 0,
            roundsPlayed: 0,
            weeklyWins: 0,
            bestStreak: user.streakBest,
          };
        }
      }
    }
  }

  const uniqueFinishedPlays = getUniqueFinishedPlays(store, uid);
  const finishedPlaysCount = uniqueFinishedPlays.length;

  const now = nowDate.getTime();
  const activeDuels = Object.values(store.duels)
    .filter(
      (d) =>
        (d.challengerUid === uid || d.opponentUid === uid) &&
        (d.status === 'pending' || d.status === 'active'),
    )
    .map((d) => {
      const createdAtMs = new Date(d.createdAt).getTime();
      const expiresAtMs = createdAtMs + 24 * 3600 * 1000;
      const timeLeftMs = Math.max(0, expiresAtMs - now);
      return {
        id: d.id,
        status: d.status,
        challengerNickname: resolveUserDisplayName(
          d.challengerUid,
          d.sides[d.challengerUid]?.nickname,
        ),
        opponentNickname: d.opponentUid
          ? resolveUserDisplayName(d.opponentUid, d.sides[d.opponentUid]?.nickname)
          : '',
        myTurn: Boolean(d.opponentUid) && !d.sides[uid]?.finishedAt,
        timeLeftMs,
      };
    });

  const ownedLeaguesCount = Object.values(store.leagues).filter(
    (l) => l.ownerUid === uid && l.id !== 'lg_world',
  ).length;
  const maxOwnedLeagues = user.pro.active
    ? PRO_LIMITS.maxOwnedLeagues
    : FREE_LIMITS.maxOwnedLeagues;
  const maxActiveDuels = user.pro.active ? PRO_LIMITS.maxActiveDuels : FREE_LIMITS.maxActiveDuels;

  const currentMonth = date.slice(0, 7);
  const monthlyDuelsCount = Object.values(store.duels).filter((d) => {
    if (d.challengerUid !== uid) return false;
    const dMonth = getLocalDateString(new Date(d.createdAt), user.tz || tz).slice(0, 7);
    return dMonth === currentMonth;
  }).length;
  const maxMonthlyDuels = user.pro.active
    ? PRO_LIMITS.maxMonthlyDuels
    : FREE_LIMITS.maxMonthlyDuels;

  // RonDuel World public league
  const world = store.leagues['lg_world'];
  const worldTodayEntries = Object.values(world?.days[date] ?? {})
    .filter((entry) => {
      if (!entry.finishedAt) return false;
      const correctCount = entry.emojiLine ? (entry.emojiLine.match(/[⚡🟩]/gu) || []).length : 0;
      if (correctCount > 0 && entry.score < 100 * correctCount) return false;
      return true;
    })
    .sort((a, b) =>
      b.score !== a.score ? b.score - a.score : (a.totalMs ?? 0) - (b.totalMs ?? 0),
    );
  const myWorldRankIdx = worldTodayEntries.findIndex((e) => e.uid === uid);
  const myWorldRankToday = myWorldRankIdx >= 0 ? myWorldRankIdx + 1 : null;
  const worldLeague = world
    ? {
        id: world.id,
        name: world.name,
        memberCount: Object.keys(world.members).length,
        playedTodayCount: worldTodayEntries.length,
        myRankToday: myWorldRankToday,
        myScore: play?.status === 'finished' ? play.totalScore : null,
        myNickname: resolveUserDisplayName(uid, user.nickname),
      }
    : null;

  const leaguesLeaderboard = getLeagueLeaderboard(date);

  // Private leagues: query all leagues where uid is owner or member
  const allUserLeagues = Object.values(store.leagues).filter(
    (l) =>
      l.id !== 'lg_world' &&
      (l.ownerUid === uid || Boolean(l.members[uid]) || user.leagueIds.includes(l.id)),
  );
  for (const l of allUserLeagues) {
    if (!user.leagueIds.includes(l.id)) {
      user.leagueIds.push(l.id);
      markUserDirty(user.uid);
    }
  }

  const privateLeagues = allUserLeagues.map((l) => {
    const todayEntries = Object.values(l.days[date] ?? {})
      .filter((entry) => {
        if (!entry.finishedAt) return false;
        const correctCount = entry.emojiLine ? (entry.emojiLine.match(/[⚡🟩]/gu) || []).length : 0;
        if (correctCount > 0 && entry.score < 100 * correctCount) return false;
        return true;
      })
      .sort((a, b) =>
        b.score !== a.score ? b.score - a.score : (a.totalMs ?? 0) - (b.totalMs ?? 0),
      );
    const myRankIdx = todayEntries.findIndex((e) => e.uid === uid);
    const memberList = Object.values(l.members);
    const initials = memberList
      .slice(0, 4)
      .map((m) => resolveUserDisplayName(m.uid, m.nickname).slice(0, 2).toUpperCase());
    const intlRankIdx = leaguesLeaderboard.findIndex((lb) => lb.id === l.id);
    const intlRank = intlRankIdx >= 0 ? intlRankIdx + 1 : null;
    const intlTotalPoints = intlRankIdx >= 0 ? leaguesLeaderboard[intlRankIdx]!.allTimePoints : 0;

    return {
      id: l.id,
      name: resolveLeagueDisplayName(l as unknown as LeagueNameLike),
      inviteCode: l.inviteCode,
      ownerUid: l.ownerUid,
      isOwner: l.ownerUid === uid,
      memberCount: memberList.length,
      maxMembers: l.maxMembers,
      isFull: memberList.length >= l.maxMembers,
      playedTodayCount: todayEntries.length,
      myRankToday: myRankIdx >= 0 ? myRankIdx + 1 : null,
      myScore: play?.status === 'finished' ? play.totalScore : null,
      myNickname: user.nickname,
      intlRank,
      intlTotalPoints,
      themeEmoji: l.themeEmoji || '🏆',
      themeColor: l.themeColor || 'default',
      initials,
    };
  });

  const hasFullFreeLeague = privateLeagues.some(
    (l) => l.isOwner && !user.pro.active && l.memberCount >= 5,
  );

  const currentHour = getLocalHourInTz(nowDate, effectiveTz);
  const playedDatesSet = new Set<string>(uniqueFinishedPlays.map((p) => p.date));
  const playedToday = play?.status === 'finished';

  const streakSnapshot = computeStreakSnapshot({
    today: date,
    currentHour,
    streakCurrent: user.streakCurrent,
    streakBest: user.streakBest,
    lastPlayedDate: user.lastPlayedDate,
    isPro: user.pro.active,
    freezes: user.freezes ?? 0,
    streakShieldUsedWeek: user.streakShieldUsedWeek,
    frozenDates: user.frozenDates,
    playedDatesSet,
    playedToday,
    streakBeforeToday: user.streakBeforeToday,
    streakIncreasedDate: user.streakIncreasedDate,
  });

  // Expose one-shot boolean flag for client-localized toast (never hardcode UI strings in server)
  const freezeAutoUsed = Boolean(user.freezeUsedYesterday);
  if (user.freezeUsedYesterday) {
    user.freezeUsedYesterday = false;
    markUserDirty(user.uid);
  }

  return {
    ...meta,
    played: playedToday,
    inProgress: play?.status === 'in_progress',
    playId: play ? play.playId : undefined,
    score: playedToday ? play.totalScore : null,
    totalScore: playedToday ? play.totalScore : null,
    emojiLine: playedToday ? play.emojiLine : null,
    streakCurrent: user.streakCurrent,
    streakBest: user.streakBest,
    lastPlayedDate: user.lastPlayedDate,
    freezes: user.freezes ?? 0,
    streakIncreasedToday: streakSnapshot.streakIncreasedToday,
    streakBeforeToday: streakSnapshot.streakBeforeToday,
    weekStrip: streakSnapshot.weekStrip,
    missedDays: streakSnapshot.missedDays,
    freezeAvailable: streakSnapshot.freezeAvailable,
    freezesNeeded: streakSnapshot.freezesNeeded,
    canCoverMiss: streakSnapshot.canCoverMiss,
    weeklyShieldAvailable: streakSnapshot.weeklyShieldAvailable,
    streakAlive: streakSnapshot.streakAlive,
    streakAtRisk: streakSnapshot.streakAtRisk,
    freezeAutoUsed,
    freezeNotice: null as string | null,
    isPro: user.pro.active,
    isAnonymous: user.isAnonymous,
    authProvider: user.authProvider,
    email: user.email,
    nickname: user.nickname,
    ageConfirmed16: user.ageConfirmed16,
    finishedPlaysCount,
    ownedLeaguesCount,
    maxOwnedLeagues,
    activeDuelsCount: activeDuels.length,
    maxActiveDuels,
    monthlyDuelsCount,
    maxMonthlyDuels,
    activeDuels,
    worldLeague,
    privateLeagues,
    hasFullFreeLeague,
    leaguesLeaderboard,
    globalPlayersLeaderboard: getGlobalPlayersLeaderboard(date, uid),
    // Keep backward-compatible leagues array
    leagues: privateLeagues.length > 0 ? privateLeagues : worldLeague ? [worldLeague] : [],
  };
}

export function useStreakFreeze(params: { uid: string; tz?: string; now?: Date }) {
  const store = getStore();
  const user = getOrCreateUser({ uid: params.uid, tz: params.tz });
  const nowDate = params.now ?? new Date();
  const effectiveTz = user.tz || params.tz || 'UTC';
  const today = getLocalDateString(nowDate, effectiveTz);
  const playedDatesSet = new Set(getUniqueFinishedPlays(store, params.uid).map((p) => p.date));

  const applied = computeFreezeApplication({
    user,
    today,
    nowIso: nowDate.toISOString(),
    auto: false,
    playedDatesSet,
  });

  if (!applied.ok) {
    throw new ApiError(
      applied.error ?? 'FREEZE_UNAVAILABLE',
      applied.error ?? 'Freeze unavailable',
      applied.status ?? 409,
    );
  }

  if (!applied.noop) {
    user.freezes = applied.freezes;
    user.streakShieldUsedWeek = applied.streakShieldUsedWeek;
    user.frozenDates = normalizeFrozenDates(applied.frozenDates);
    user.freezeLedger = applied.freezeLedger;
    user.lastPlayedDate = applied.lastPlayedDate;
    user.freezeUsedYesterday = false; // Manual CTA already shows confirmation on client
    markUserDirty(user.uid);
    saveStoreToDisk(store);
  }

  return {
    ok: true as const,
    noop: Boolean(applied.noop),
    streakCurrent: user.streakCurrent,
    freezes: user.freezes,
    lastPlayedDate: user.lastPlayedDate,
    coveredDate: applied.coveredDate,
    source: applied.source,
    weeklyShieldAvailable: applied.weeklyShieldAvailable,
    frozenDates: user.frozenDates ?? [],
  };
}

export function resetUserStreak(params: { uid: string }) {
  const store = getStore();
  const user = getOrCreateUser({ uid: params.uid });
  user.streakCurrent = 0;
  user.lastPlayedDate = undefined;
  user.freezeUsedYesterday = false;
  user.streakBeforeToday = 0;
  user.streakIncreasedDate = undefined;
  markUserDirty(user.uid);
  saveStoreToDisk(store);
  return {
    ok: true as const,
    streakCurrent: 0,
    streakBest: user.streakBest,
    freezes: user.freezes ?? 0,
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
  locale: Locale | string;
  nickname?: string;
  relaxedTimer?: boolean;
  now?: Date;
}) {
  const store = getStore();
  const user = getOrCreateUser({
    uid: params.uid,
    nickname: params.nickname,
    locale: params.locale,
    tz: params.tz,
    relaxedTimer: params.relaxedTimer,
  });

  const nowDate = params.now ?? new Date();
  const effectiveTz = user.tz || params.tz || 'UTC';
  const date = getLocalDateString(nowDate, effectiveTz);
  const meta = getRoundMeta(date);
  const playId = `${date}_${params.uid}`;
  const resolved = resolveRoundItems(date, params.locale);

  let play =
    store.plays[playId] ||
    store.plays[`${params.uid}_${date}`] ||
    Object.values(store.plays).find((p) => p.uid === params.uid && p.date === date);

  if (play?.status === 'finished') {
    return {
      alreadyFinished: true as const,
      playId: play.playId,
      freezeAutoUsed: Boolean(play.freezeAutoUsed),
    };
  }

  const now = nowDate.getTime();
  let freezeAutoUsed = Boolean(play?.freezeAutoUsed);
  let activePlay: PlayRecord;
  if (!play) {
    // Auto-apply a single freeze or Pro weekly shield if exactly 1 day was missed and user starts today's round directly
    const playedDatesSet = new Set(getUniqueFinishedPlays(store, params.uid).map((p) => p.date));
    const applied = computeFreezeApplication({
      user,
      today: date,
      nowIso: nowDate.toISOString(),
      auto: true,
      playedDatesSet,
    });
    if (applied.ok && !applied.noop) {
      user.freezes = applied.freezes;
      user.streakShieldUsedWeek = applied.streakShieldUsedWeek;
      user.frozenDates = normalizeFrozenDates(applied.frozenDates);
      user.freezeLedger = applied.freezeLedger;
      user.lastPlayedDate = applied.lastPlayedDate;
      user.freezeUsedYesterday = true;
      freezeAutoUsed = true;
      markUserDirty(user.uid);
    }

    activePlay = {
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
      freezeAutoUsed,
    };
    store.plays[playId] = activePlay;
    store.plays[`${params.uid}_${date}`] = activePlay;
  } else {
    activePlay = play;
    // If round was already started, advance any questions whose timer expired
    let curr = activePlay.items.find((i) => i.answeredAt === undefined);
    while (curr) {
      const resItem = resolved[curr.index]!;
      const limitMs = activePlay.relaxedTimer ? Math.round(resItem.limitMs * 1.5) : resItem.limitMs;
      const elapsedMs = now - curr.servedAt;
      if (elapsedMs >= limitMs) {
        // Expired! Mark as timed out / wrong and advance
        curr.answeredAt = curr.servedAt + limitMs;
        curr.choice = null;
        curr.correct = false;
        curr.points = 0;
        curr.timedOut = true;
        curr.emoji = '🟥';
        activePlay.totalMs += limitMs;

        const nextIndex = curr.index + 1;
        if (nextIndex < resolved.length) {
          activePlay.items.push({
            index: nextIndex,
            servedAt: curr.answeredAt,
            points: 0,
            timedOut: false,
          });
          curr = activePlay.items.find((i) => i.answeredAt === undefined);
        } else {
          // All questions finished — let finishRound finalize status & streak
          finishRound(params.uid, activePlay.playId, undefined, effectiveTz, nowDate);
          store.plays[playId] = activePlay;
          store.plays[`${params.uid}_${date}`] = activePlay;
          saveStoreToDisk(store);
          return {
            alreadyFinished: true as const,
            playId: activePlay.playId,
            freezeAutoUsed: Boolean(activePlay.freezeAutoUsed),
          };
        }
      } else {
        // Still has time
        break;
      }
    }
  }

  const currentItemState =
    activePlay.items.find((i) => i.answeredAt === undefined) ??
    activePlay.items[activePlay.items.length - 1]!;
  const resolvedItem = resolved[currentItemState.index]!;
  const clientItem = toClientItem(resolvedItem, activePlay.relaxedTimer);
  const elapsedMs = Math.max(0, now - currentItemState.servedAt);

  store.plays[playId] = activePlay;
  store.plays[`${params.uid}_${date}`] = activePlay;
  saveStoreToDisk(store);

  return {
    alreadyFinished: false as const,
    playId: activePlay.playId,
    roundNumber: meta.roundNumber,
    totalItems: resolved.length,
    item: clientItem,
    remainingMs: Math.max(0, clientItem.limitMs - elapsedMs),
    serverNow: now,
    freezeAutoUsed,
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
    throw new ApiError('PLAY_NOT_FOUND', 'Play not found', 404);
  }
  if (play.status === 'finished') {
    throw new ApiError('PLAY_ALREADY_FINISHED', 'Play already finished', 400);
  }

  const itemState = play.items.find((i) => i.index === params.index);
  if (!itemState) {
    throw new ApiError('ITEM_NOT_SERVED', 'Item not served yet', 400);
  }
  if (itemState.answeredAt !== undefined) {
    throw new ApiError('ITEM_ALREADY_ANSWERED', 'Item already answered', 400);
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

  store.plays[params.playId] = play;
  store.plays[`${play.uid}_${play.date}`] = play;
  store.plays[`${play.date}_${play.uid}`] = play;
  saveStoreToDisk(store);

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

export function finishRound(
  uid: string,
  playId: string,
  clientSummary?: {
    totalScore?: number;
    totalMs?: number;
    emojiLine?: string;
    items?: Array<{ index: number; points: number; emoji?: string }>;
  },
  tz?: string,
  nowDate: Date = new Date(),
) {
  const store = getStore();
  const userForLookup = getOrCreateUser({ uid, tz });
  const effectiveTz = userForLookup.tz || tz || 'UTC';

  let foundPlay: PlayRecord | undefined =
    store.plays[playId] ||
    Object.values(store.plays).find((p) => p.uid === uid && p.playId === playId);

  if (!foundPlay) {
    const parts = playId.split('_');
    let date = getLocalDateString(nowDate, effectiveTz);
    if (parts.length >= 2) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(parts[0]!)) date = parts[0]!;
      else if (/^\d{4}-\d{2}-\d{2}$/.test(parts[parts.length - 1]!))
        date = parts[parts.length - 1]!;
    }
    const meta = getRoundMeta(date);
    foundPlay = {
      playId,
      uid,
      date,
      roundNumber: meta.roundNumber,
      locale: userForLookup.locale || 'ro',
      relaxedTimer: userForLookup.relaxedTimer,
      status: 'in_progress',
      items: [],
      totalScore: 0,
      totalMs: 0,
      emojiLine: '',
    };
    store.plays[playId] = foundPlay;
    store.plays[`${foundPlay.date}_${uid}`] = foundPlay;
    store.plays[`${uid}_${foundPlay.date}`] = foundPlay;
  }

  const play: PlayRecord = foundPlay;

  // Compute score, totalMs and emojiLine ONLY from server-stored answers; ignore clientSummary overrides
  const answeredItems = play.items.filter((it) => it.answeredAt !== undefined);
  if (answeredItems.length > 0) {
    play.totalScore = answeredItems.reduce((sum, item) => sum + (item.points || 0), 0);
    play.totalMs = answeredItems.reduce(
      (sum, item) => sum + Math.max(0, (item.answeredAt || item.servedAt) - item.servedAt),
      0,
    );
    play.emojiLine = buildEmojiLine(
      answeredItems.map((i) => ({
        emoji: (i.emoji as '⚡' | '🟩' | '🟥') ?? (i.correct ? '🟩' : '🟥'),
      })),
    );
  } else {
    play.totalScore = 0;
    play.totalMs = 0;
    play.emojiLine = '';
  }

  // Invariant check: number of ⚡/🟩 must equal correct count and score >= 100 * correct
  const correctCount = play.items.filter((i) => i.correct || (i.points && i.points > 0)).length;
  const emojiCorrectCount = (play.emojiLine.match(/[⚡🟩]/gu) || []).length;
  if (
    correctCount !== emojiCorrectCount ||
    (correctCount > 0 && play.totalScore < 100 * correctCount)
  ) {
    if (answeredItems.length > 0) {
      play.emojiLine = buildEmojiLine(
        answeredItems.map((i) => ({
          emoji:
            i.points && i.points > 100
              ? '⚡'
              : i.correct || (i.points && i.points > 0)
                ? '🟩'
                : '🟥',
        })),
      );
    } else {
      play.emojiLine = '';
    }
  }

  let shieldTriggered = false;
  if (play.status !== 'finished') {
    play.status = 'finished';
    play.finishedAt = nowDate.toISOString();

    const user = getOrCreateUser({ uid, tz });
    const prevStreak = user.streakCurrent;

    // Auto-apply a single freeze or Pro weekly shield if missedDays === 1 and not already applied at round start
    if (!play.freezeAutoUsed) {
      const playedDatesSet = new Set(
        getUniqueFinishedPlays(store, uid)
          .filter((p) => p.playId !== play.playId)
          .map((p) => p.date),
      );
      const applied = computeFreezeApplication({
        user,
        today: play.date,
        nowIso: nowDate.toISOString(),
        auto: true,
        playedDatesSet,
      });
      if (applied.ok && !applied.noop) {
        user.freezes = applied.freezes;
        user.streakShieldUsedWeek = applied.streakShieldUsedWeek;
        user.frozenDates = normalizeFrozenDates(applied.frozenDates);
        user.freezeLedger = applied.freezeLedger;
        user.lastPlayedDate = applied.lastPlayedDate;
        user.freezeUsedYesterday = true;
        play.freezeAutoUsed = true;
        shieldTriggered = applied.source === 'weekly_shield';
      }
    }

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
    if (nextStreak.shieldTriggered) {
      shieldTriggered = true;
    }

    if (user.streakCurrent > prevStreak) {
      user.streakBeforeToday = prevStreak;
      user.streakIncreasedDate = play.date;
    } else if (prevStreak > 0 && user.streakCurrent < prevStreak) {
      // Streak reset due to 2+ missed days; do not trigger "+1" celebration
      user.streakBeforeToday = 0;
      user.streakIncreasedDate = undefined;
    }
    markUserDirty(user.uid);

    // Only update leagues if the player actually played answered questions
    if (answeredItems.length > 0) {
      for (const leagueId of user.leagueIds) {
        const league = store.leagues[leagueId];
        if (!league) continue;
        const member = league.members[uid];
        if (!member) continue;
        member.nickname = user.nickname;
        member.allTimeScore += play.totalScore;
        member.roundsPlayed += 1;
        member.bestStreak = Math.max(member.bestStreak, user.streakBest);
        member.lastFinishedDate = play.date;

        if (!league.days[play.date]) league.days[play.date] = {};
        league.days[play.date]![uid] = {
          uid,
          nickname: user.nickname,
          score: play.totalScore,
          totalMs: play.totalMs,
          emojiLine: play.emojiLine,
          relaxedTimer: play.relaxedTimer,
          finishedAt: play.finishedAt,
        };
      }
    }
  }

  const user = getOrCreateUser({ uid, tz });
  const resolved = resolveRoundItems(play.date, play.locale);
  const finishedPlaysCount = getUniqueFinishedPlays(store, uid).length;

  const result = {
    playId: play.playId,
    date: play.date,
    roundNumber: play.roundNumber,
    totalScore: play.totalScore ?? 0,
    totalMs: play.totalMs ?? 0,
    emojiLine: play.emojiLine || '',
    streakCurrent: user.streakCurrent,
    streakBest: user.streakBest,
    freezeAutoUsed: Boolean(play.freezeAutoUsed),
    shieldTriggered,
    finishedPlaysCount,
    review: resolved.map((r, idx) => {
      const itemState = play.items.find((i) => i.index === idx);
      const isCorrect = itemState
        ? Boolean(itemState.correct || (itemState.points && itemState.points > 0))
        : false;
      const isTimedOut = itemState ? Boolean(itemState.timedOut) : false;
      let userAnswer: string | null = null;
      if (itemState && itemState.choice !== undefined && itemState.choice !== null) {
        if (r.type === 'order' && Array.isArray(itemState.choice)) {
          userAnswer = itemState.choice.join(' → ');
        } else if (typeof itemState.choice === 'number') {
          userAnswer = r.options[itemState.choice] ?? null;
        }
      }
      return {
        index: idx,
        questionId: r.questionId,
        prompt: r.prompt,
        correctAnswer:
          r.type === 'order' ? (r.correctOrder ?? []).join(' → ') : r.options[r.correctIndex ?? 0]!,
        explanation: r.explanation,
        points: itemState?.points ?? 0,
        emoji: itemState?.emoji ?? (isCorrect ? '🟩' : '🟥'),
        correct: isCorrect,
        timedOut: isTimedOut,
        userAnswer,
      };
    }),
    leagueRanks: user.leagueIds
      .map((id) => store.leagues[id])
      .filter((l): l is LeagueRecord => Boolean(l))
      .map((lg) => {
        const todayEntries = Object.values(lg.days[play.date] ?? {})
          .filter((entry) => {
            if (!entry.finishedAt) return false;
            const correctCount = entry.emojiLine
              ? (entry.emojiLine.match(/[⚡🟩]/gu) || []).length
              : 0;
            if (correctCount > 0 && entry.score < 100 * correctCount) return false;
            return true;
          })
          .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.totalMs - b.totalMs));
        const rankIdx = todayEntries.findIndex((e) => e.uid === uid);
        return {
          id: lg.id,
          name: lg.name,
          inviteCode: lg.inviteCode,
          isWorld: lg.id === 'lg_world',
          rank: rankIdx >= 0 ? rankIdx + 1 : 1,
          totalMembers: Object.keys(lg.members).length,
          playedTodayCount: todayEntries.length,
        };
      }),
    primaryLeague: (() => {
      const pId = user.leagueIds.find((id) => id !== 'lg_world');
      const pLg = pId ? store.leagues[pId] : null;
      return pLg
        ? {
            id: pLg.id,
            inviteCode: pLg.inviteCode,
            name: pLg.name,
          }
        : null;
    })(),
  };

  store.plays[play.playId] = play;
  store.plays[`${play.date}_${uid}`] = play;
  store.plays[`${uid}_${play.date}`] = play;
  saveStoreToDisk(store);

  return result;
}

export function getPlayResult(playId: string) {
  const store = getStore();
  let foundPlay: PlayRecord | undefined =
    store.plays[playId] ||
    Object.values(store.plays).find((p) => p.playId === playId || playId.includes(p.playId));

  if (!foundPlay) {
    const parts = playId.split('_');
    if (parts.length >= 2) {
      let date = '';
      let uid = '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(parts[0]!)) {
        date = parts[0]!;
        uid = parts.slice(1).join('_');
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(parts[parts.length - 1]!)) {
        date = parts[parts.length - 1]!;
        uid = parts.slice(0, -1).join('_');
      }
      if (date && uid) {
        foundPlay =
          store.plays[`${date}_${uid}`] ||
          store.plays[`${uid}_${date}`] ||
          Object.values(store.plays).find((p) => p.uid === uid && p.date === date);
      }
    }
  }

  if (foundPlay) {
    return finishRound(foundPlay.uid, foundPlay.playId);
  }

  // Graceful recovery: Reconstruct play from playId so the user never receives 404 or a crash
  const parts = playId.split('_');
  if (parts.length >= 2) {
    let date = '';
    let uid = '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(parts[0]!)) {
      date = parts[0]!;
      uid = parts.slice(1).join('_');
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(parts[parts.length - 1]!)) {
      date = parts[parts.length - 1]!;
      uid = parts.slice(0, -1).join('_');
    }
    if (date && uid) {
      const user = getOrCreateUser({ uid });
      const meta = getRoundMeta(date);
      const recoveredPlay: PlayRecord = {
        playId: `${date}_${uid}`,
        uid,
        date,
        roundNumber: meta.roundNumber,
        locale: user.locale || 'ro',
        relaxedTimer: user.relaxedTimer,
        status: 'finished',
        items: [],
        totalScore: 0,
        totalMs: 0,
        emojiLine: '',
        finishedAt: new Date().toISOString(),
      };
      store.plays[`${date}_${uid}`] = recoveredPlay;
      store.plays[`${uid}_${date}`] = recoveredPlay;
      saveStoreToDisk(store);
      return finishRound(uid, `${date}_${uid}`);
    }
  }

  return null;
}

export function createLeague(params: {
  uid: string;
  name?: string;
  nickname?: string;
  tz: string;
  locale: Locale;
  themeEmoji?: string;
  themeColor?: string;
  plan?: 'free' | 'pro_trial' | 'pro';
}) {
  const store = getStore();
  const user = getOrCreateUser({
    uid: params.uid,
    nickname: params.nickname,
    tz: params.tz,
    locale: params.locale,
  });

  if (params.plan === 'pro_trial' && !user.pro.active) {
    const trialEndsAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    user.pro = {
      active: true,
      plan: 'yearly',
      until: trialEndsAt,
      isTrial: true,
      trialEndsAt,
    };
  }

  const ownedCount = Object.values(store.leagues).filter((l) => l.ownerUid === params.uid).length;
  const maxOwned = user.pro.active ? PRO_LIMITS.maxOwnedLeagues : FREE_LIMITS.maxOwnedLeagues;
  if (ownedCount >= maxOwned) {
    throw new ApiError('LEAGUE_LIMIT_REACHED', 'Free league cap reached', 400);
  }

  const trimmedName = params.name?.trim();
  if (trimmedName !== undefined && trimmedName.length > 0) {
    if (trimmedName.length < 2 || trimmedName.length > 30) {
      throw new ApiError(
        'LEAGUE_NAME_INVALID',
        'League name must be between 2 and 30 characters.',
        400,
      );
    }
  }

  let inviteCode = generateInviteCode();
  while (store.inviteCodes[inviteCode]) {
    inviteCode = generateInviteCode();
  }

  const id = `lg_${inviteCode.toLowerCase()}`;
  const name = trimmedName || suggestLeagueName(params.locale);
  const nameCheck = checkLeagueNameAvailable(name);
  if (!nameCheck.available) {
    throw new ApiError('LEAGUE_NAME_TAKEN', 'League name is already taken', 400);
  }

  // Client `plan: 'pro'` is not enough. Only an active Pro/trial on the user record raises the cap.
  const isProLeague = Boolean(user.pro?.active);
  const maxMembers = isProLeague ? PRO_LIMITS.maxMembersPerLeague : FREE_LIMITS.maxMembersPerLeague;

  const league: LeagueRecord = {
    id,
    name,
    inviteCode,
    ownerUid: params.uid,
    tz: params.tz,
    maxMembers,
    themeEmoji: params.themeEmoji || '🏆',
    themeColor: normalizeLeagueThemeColor(params.themeColor),
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
  markUserDirty(user.uid);

  saveStoreToDisk(store);
  return league;
}

export function getLeagueByCodeOrId(codeOrId: string, viewerUid?: string, countryFilter?: string) {
  const store = getStore();
  const id = store.inviteCodes[codeOrId.toUpperCase()] ?? codeOrId;
  const league = store.leagues[id];
  if (!league) return null;

  const today = getLocalDateString(new Date(), league.tz);
  const viewerMember = viewerUid ? league.members[viewerUid] : undefined;
  const globalPlay = viewerUid ? store.plays[`${today}_${viewerUid}`] : undefined;

  // Auto-sync today's play if viewer played globally but joined mid-day or wasn't synced
  if (viewerUid && viewerMember && globalPlay?.status === 'finished') {
    if (!league.days[today]) league.days[today] = {};
    if (!league.days[today]![viewerUid]) {
      league.days[today]![viewerUid] = {
        uid: viewerUid,
        nickname: resolveUserDisplayName(viewerUid, viewerMember.nickname),
        score: globalPlay.totalScore,
        totalMs: globalPlay.totalMs,
        emojiLine: globalPlay.emojiLine,
        relaxedTimer: globalPlay.relaxedTimer,
        finishedAt: globalPlay.finishedAt ?? new Date().toISOString(),
      };
      viewerMember.lastFinishedDate = today;
    }
  }

  const viewerFinishedToday = Boolean(
    viewerMember?.lastFinishedDate === today || globalPlay?.status === 'finished',
  );
  const viewerScoreToday =
    globalPlay?.status === 'finished'
      ? globalPlay.totalScore
      : viewerUid
        ? (league.days[today]?.[viewerUid]?.score ?? null)
        : null;
  const isWorld = league.id === 'lg_world';

  let rawToday = Object.values(league.days[today] ?? {})
    .filter((entry) => {
      if (!entry.finishedAt) return false;
      const correctCount = entry.emojiLine ? (entry.emojiLine.match(/[⚡🟩]/gu) || []).length : 0;
      if (correctCount > 0 && entry.score < 100 * correctCount) return false;
      return true;
    })
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.totalMs - b.totalMs));

  if (countryFilter) {
    rawToday = rawToday.filter((entry) => {
      const u = store.users[entry.uid];
      return u?.country === countryFilter;
    });
  }

  let viewerRankToday: number | null = null;
  if (viewerUid) {
    const vIdx = rawToday.findIndex((entry) => entry.uid === viewerUid);
    if (vIdx !== -1) {
      viewerRankToday = vIdx + 1;
    }
  }

  // For all players, compute ranks and keep all members in world league
  const filteredToday = rawToday;

  const todayScores = filteredToday.map((entry, idx) => ({
    rank: idx + 1,
    uid: entry.uid,
    nickname: resolveUserDisplayName(entry.uid, entry.nickname),
    score: viewerFinishedToday || !isWorld ? entry.score : null,
    totalMs: viewerFinishedToday || !isWorld ? entry.totalMs : null,
    emojiLine: viewerFinishedToday || !isWorld ? entry.emojiLine : null,
    relaxedTimer: entry.relaxedTimer,
    isCurrentUser: Boolean(viewerUid && entry.uid === viewerUid),
  }));

  let allTimeMembers = Object.values(league.members).sort(
    (a, b) => (b.allTimeScore || 0) - (a.allTimeScore || 0),
  );

  if (countryFilter) {
    allTimeMembers = allTimeMembers.filter((m) => {
      const u = store.users[m.uid];
      return u?.country === countryFilter;
    });
  }

  let viewerRankAllTime: number | null = null;
  if (viewerUid) {
    const vIdx = allTimeMembers.findIndex((m) => m.uid === viewerUid);
    if (vIdx !== -1) {
      viewerRankAllTime = vIdx + 1;
    }
  }

  const allTime = allTimeMembers.map((member, idx) => ({
    rank: idx + 1,
    uid: member.uid,
    nickname: resolveUserDisplayName(member.uid, member.nickname),
    allTimeScore: member.allTimeScore || 0,
    roundsPlayed: member.roundsPlayed || 0,
    joinedAt: member.joinedAt,
    scoreToday:
      viewerFinishedToday || !isWorld ? (league.days[today]?.[member.uid]?.score ?? null) : null,
    isCurrentUser: Boolean(viewerUid && member.uid === viewerUid),
  }));

  const adminMember = league.members[league.ownerUid];
  const adminName = league.ownerUid
    ? resolveUserDisplayName(league.ownerUid, adminMember?.nickname)
    : 'Admin';

  const leaguesLb = getLeagueLeaderboard(today);
  const intlRankIdx = leaguesLb.findIndex((l) => l.id === league.id);
  const intlRank = intlRankIdx >= 0 ? intlRankIdx + 1 : null;

  const isOwner = Boolean(viewerUid && league.ownerUid === viewerUid);
  const isMember = Boolean(viewerMember);
  const showInviteCode = isOwner || isMember || !league.privateApproval;

  return {
    id: league.id,
    name: resolveLeagueDisplayName(league as unknown as LeagueNameLike),
    inviteCode: showInviteCode ? league.inviteCode : '',
    ownerUid: league.ownerUid,
    adminName,
    themeEmoji: league.themeEmoji ?? '🏆',
    themeColor: league.themeColor ?? 'default',
    tz: league.tz,
    memberCount: Object.keys(league.members).length,
    maxMembers: isWorld ? 10_000_000 : league.maxMembers,
    createdAt: league.createdAt || '2026-11-01T00:00:00.000Z',
    viewerFinishedToday,
    viewerScoreToday,
    viewerRankToday,
    viewerRankAllTime,
    isWorld,
    intlRank,
    isOwner,
    isMember,
    privateApproval: Boolean(league.privateApproval),
    todayScores,
    allTime,
    feed: (league.feed ?? []).slice(-10).reverse(),
  };
}

export function renameLeague(params: {
  codeOrId: string;
  actorUid: string;
  name: string;
  isAdmin?: boolean;
}) {
  const store = getStore();
  const id = store.inviteCodes[params.codeOrId.toUpperCase()] ?? params.codeOrId;
  const league = store.leagues[id];
  if (!league) throw new ApiError('LEAGUE_NOT_FOUND', 'League not found', 404);
  if (!params.isAdmin && league.ownerUid !== params.actorUid) {
    throw new ApiError('LEAGUE_OWNER_ONLY', 'Only the league owner can rename the league', 403);
  }
  const trimmed = params.name.trim();
  if (trimmed.length < 2 || trimmed.length > 30 || trimmed.toLowerCase() === 'undefined') {
    throw new ApiError(
      'LEAGUE_NAME_INVALID',
      'League name must be between 2 and 30 characters',
      400,
    );
  }
  const nameCheck = checkLeagueNameAvailable(trimmed, league.id);
  if (!nameCheck.available) {
    throw new ApiError('LEAGUE_NAME_TAKEN', 'League name is already taken', 400);
  }
  league.name = trimmed;
  saveStoreToDisk(store);
  return league;
}

export function deleteLeague(params: { codeOrId: string; actorUid: string; isAdmin?: boolean }) {
  const store = getStore();
  const id = store.inviteCodes[params.codeOrId.toUpperCase()] ?? params.codeOrId;
  const league = store.leagues[id];
  if (!league) throw new ApiError('LEAGUE_NOT_FOUND', 'League not found', 404);
  if (!params.isAdmin && league.ownerUid !== params.actorUid) {
    throw new ApiError('LEAGUE_OWNER_ONLY', 'Only the league owner can delete the league', 403);
  }
  delete store.inviteCodes[league.inviteCode];
  for (const memberUid of Object.keys(league.members)) {
    const u = store.users[memberUid];
    if (u) {
      u.leagueIds = u.leagueIds.filter((lid) => lid !== league.id);
      markUserDirty(u.uid);
    }
  }
  delete store.leagues[id];
  return { deleted: true, leagueId: id };
}

export function leaveOrRemoveLeagueMember(params: {
  codeOrId: string;
  targetUid: string;
  actorUid: string;
  isAdmin?: boolean;
}) {
  const store = getStore();
  const id = store.inviteCodes[params.codeOrId.toUpperCase()] ?? params.codeOrId;
  const league = store.leagues[id];
  if (!league) throw new ApiError('LEAGUE_NOT_FOUND', 'League not found', 404);

  const isSelf = params.targetUid === params.actorUid;
  const isOwner = league.ownerUid === params.actorUid;
  if (!isSelf && !isOwner && !params.isAdmin) {
    throw new ApiError('FORBIDDEN', 'Not authorized to remove this member', 403);
  }

  delete league.members[params.targetUid];
  const user = store.users[params.targetUid];
  if (user) {
    user.leagueIds = user.leagueIds.filter((lid) => lid !== league.id);
    markUserDirty(user.uid);
  }

  const remainingMembers = Object.values(league.members);
  if (remainingMembers.length === 0) {
    delete store.inviteCodes[league.inviteCode];
    delete store.leagues[id];
    return { deletedLeague: true, leagueId: id };
  }

  if (league.ownerUid === params.targetUid) {
    const oldest = [...remainingMembers].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0]!;
    league.ownerUid = oldest.uid;
    oldest.role = 'owner';
  }

  return { deletedLeague: false, leagueId: id };
}

export function regenerateLeagueInviteCode(params: { codeOrId: string; actorUid: string }) {
  const store = getStore();
  const id = store.inviteCodes[params.codeOrId.toUpperCase()] ?? params.codeOrId;
  const league = store.leagues[id];
  if (!league) throw new ApiError('LEAGUE_NOT_FOUND', 'League not found', 404);
  if (league.ownerUid !== params.actorUid) {
    throw new ApiError('LEAGUE_OWNER_ONLY', 'Only the league owner can regenerate the code', 403);
  }
  const user = store.users[params.actorUid];
  if (!user?.pro.active) {
    throw new ApiError('LEAGUE_PRO_FEATURE', 'Regenerating invite code is a Pro feature', 403);
  }
  delete store.inviteCodes[league.inviteCode];
  let newCode = generateInviteCode();
  while (store.inviteCodes[newCode]) {
    newCode = generateInviteCode();
  }
  league.inviteCode = newCode;
  store.inviteCodes[newCode] = id;
  return { success: true, inviteCode: newCode };
}

export function setLeaguePrivateApproval(params: {
  codeOrId: string;
  actorUid: string;
  enabled: boolean;
}) {
  const store = getStore();
  const id = store.inviteCodes[params.codeOrId.toUpperCase()] ?? params.codeOrId;
  const league = store.leagues[id];
  if (!league) throw new ApiError('LEAGUE_NOT_FOUND', 'League not found', 404);
  if (league.ownerUid !== params.actorUid) {
    throw new ApiError('LEAGUE_OWNER_ONLY', 'Only the league owner can manage approval', 403);
  }
  const user = store.users[params.actorUid];
  if (!user?.pro.active) {
    throw new ApiError('LEAGUE_PRO_FEATURE', 'Private approval is a Pro feature', 403);
  }
  league.privateApproval = params.enabled;
  return { success: true, privateApproval: league.privateApproval };
}

export function joinLeague(params: {
  inviteCode?: string;
  codeOrId?: string;
  uid: string;
  nickname: string;
  tz: string;
}) {
  const store = getStore();
  const rawCode = (params.inviteCode || params.codeOrId || '').trim();
  const codeUpper = rawCode.toUpperCase();

  const idFromCode = store.inviteCodes[codeUpper];
  const targetLeague =
    (idFromCode ? store.leagues[idFromCode] : null) ||
    store.leagues[rawCode] ||
    (params.codeOrId ? store.leagues[params.codeOrId] : null);

  if (!targetLeague) throw new ApiError('CODE_INVALID', 'Invalid invite code', 404);

  // If private approval is active on this league, player must provide the exact secret invite code
  if (targetLeague.privateApproval) {
    if (!idFromCode || codeUpper !== targetLeague.inviteCode.toUpperCase()) {
      throw new ApiError(
        'PRIVATE_APPROVAL_CODE_REQUIRED',
        'Această ligă necesită codul de invitație corect pentru aprobare privată.',
        403,
      );
    }
  }

  const league = targetLeague;

  const nickCheck = validateNickname(params.nickname);
  if (!nickCheck.ok) {
    throw new ApiError('NICKNAME_INVALID', `Invalid nickname: ${nickCheck.reason}`, 400);
  }

  const user = getOrCreateUser({ uid: params.uid, nickname: nickCheck.value, tz: params.tz });
  const privateCount = user.leagueIds.filter((lId) => lId !== 'lg_world').length;
  if (
    !league.members[params.uid] &&
    !user.pro.active &&
    privateCount >= FREE_LIMITS.maxJoinedLeagues
  ) {
    throw new ApiError('LEAGUE_LIMIT_REACHED', 'Free league cap reached', 400);
  }

  if (!league.members[params.uid] && Object.keys(league.members).length >= league.maxMembers) {
    throw new ApiError('LEAGUE_FULL', 'League is full', 400);
  }

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
    const today = getLocalDateString(new Date(), params.tz || league.tz);
    const todayPlay = store.plays[`${today}_${params.uid}`];
    if (todayPlay?.status === 'finished') {
      if (!league.days[today]) league.days[today] = {};
      league.days[today]![params.uid] = {
        uid: params.uid,
        nickname: nickCheck.value,
        score: todayPlay.totalScore,
        totalMs: todayPlay.totalMs,
        emojiLine: todayPlay.emojiLine,
        relaxedTimer: todayPlay.relaxedTimer,
        finishedAt: todayPlay.finishedAt ?? new Date().toISOString(),
      };
      league.members[params.uid]!.allTimeScore = todayPlay.totalScore;
      league.members[params.uid]!.roundsPlayed = 1;
      league.members[params.uid]!.lastFinishedDate = today;
    }
  } else {
    league.members[params.uid]!.nickname = nickCheck.value;
  }

  if (!user.leagueIds.includes(league.id)) {
    user.leagueIds.push(league.id);
  }
  markUserDirty(user.uid);

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

  const userTz = params.tz || user.tz || 'Europe/Bucharest';
  const currentMonth = getLocalDateString(new Date(), userTz).slice(0, 7);
  const monthlyCount = Object.values(store.duels).filter((d) => {
    if (d.challengerUid !== params.challengerUid) return false;
    const dMonth = getLocalDateString(new Date(d.createdAt), userTz).slice(0, 7);
    return dMonth === currentMonth;
  }).length;
  const maxMonthly = user.pro.active ? PRO_LIMITS.maxMonthlyDuels : FREE_LIMITS.maxMonthlyDuels;
  if (monthlyCount >= maxMonthly) {
    throw new ApiError(
      'FORBIDDEN',
      `Free tier monthly limit reached (${FREE_LIMITS.maxMonthlyDuels} duels/month). Upgrade to Pro for unlimited duels.`,
      403,
    );
  }

  const activeCount = Object.values(store.duels).filter(
    (d) =>
      d.challengerUid === params.challengerUid && (d.status === 'pending' || d.status === 'active'),
  ).length;
  const maxDuels = user.pro.active ? PRO_LIMITS.maxActiveDuels : FREE_LIMITS.maxActiveDuels;
  if (activeCount >= maxDuels) {
    throw new ApiError(
      'FORBIDDEN',
      `Free tier limit reached (${FREE_LIMITS.maxActiveDuels} active duels). Upgrade to Pro for unlimited duels.`,
      403,
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

function resolveDuelItems(duel: DuelRecord, locale: Locale | string): ResolvedRoundItem[] {
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
    walkoverNote: duel.walkover ? 'c\u00e2\u0219tigat prin neprezentare' : undefined,
    rated: duel.rated ?? false,
    createdAt: duel.createdAt,
    sides: Object.fromEntries(
      Object.entries(duel.sides).map(([uid, s]) => [
        uid,
        {
          uid: s.uid,
          nickname: resolveUserDisplayName(s.uid, s.nickname),
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

export function getUserDuels(uid: string) {
  const store = getStore();
  const now = Date.now();
  const user = getOrCreateUser({ uid });

  const all = Object.values(store.duels).filter(
    (d) => d.challengerUid === uid || d.opponentUid === uid,
  );

  const yourTurn: Array<{
    id: string;
    status: string;
    isDuelHost: boolean;
    myNickname: string;
    opponentNickname: string;
    opponentUid: string | null;
    myScore: number;
    opponentScore: number;
    winnerUid: string | null;
    isWinner: boolean;
    isTie: boolean;
    myTurn: boolean;
    timeLeftMs: number;
    createdAt: string;
  }> = [];

  const waiting: Array<{
    id: string;
    status: string;
    isDuelHost: boolean;
    myNickname: string;
    opponentNickname: string;
    opponentUid: string | null;
    myScore: number;
    opponentScore: number;
    winnerUid: string | null;
    isWinner: boolean;
    isTie: boolean;
    myTurn: boolean;
    timeLeftMs: number;
    createdAt: string;
  }> = [];

  const finished: Array<{
    id: string;
    status: string;
    isDuelHost: boolean;
    myNickname: string;
    opponentNickname: string;
    opponentUid: string | null;
    myScore: number;
    opponentScore: number;
    winnerUid: string | null;
    isWinner: boolean;
    isTie: boolean;
    myTurn: boolean;
    timeLeftMs: number;
    createdAt: string;
  }> = [];

  for (const d of all) {
    const isHost = d.challengerUid === uid;
    const opponentUid = isHost ? d.opponentUid : d.challengerUid;
    const mySide = d.sides[uid];
    const oppSide = opponentUid ? d.sides[opponentUid] : null;

    const oppNickname = opponentUid ? resolveUserDisplayName(opponentUid, oppSide?.nickname) : '';
    const myNickname = resolveUserDisplayName(uid, mySide?.nickname);
    const createdAtMs = new Date(d.createdAt).getTime();
    const expiresAtMs = createdAtMs + 24 * 3600 * 1000;
    const timeLeftMs = Math.max(0, expiresAtMs - now);

    const rival = opponentUid ? user.rivals?.[opponentUid] : undefined;
    const h2h = rival
      ? {
          myWins: rival.wins,
          opponentWins: rival.losses,
          draws: rival.draws,
          winStreak: rival.currentWinStreak,
        }
      : null;

    const summary = {
      id: d.id,
      status: d.status,
      isDuelHost: isHost,
      myNickname,
      opponentNickname: oppNickname,
      opponentUid,
      myScore: mySide?.score ?? 0,
      opponentScore: oppSide?.score ?? 0,
      winnerUid: d.winnerUid,
      isWinner: d.winnerUid === uid,
      isTie: d.status === 'complete' && !d.winnerUid,
      walkover: d.walkover,
      walkoverNote: d.walkover ? 'walkover' : undefined,
      rated: d.rated ?? false,
      h2h,
      myTurn: !mySide?.finishedAt,
      timeLeftMs,
      createdAt: d.createdAt,
    };

    if (d.status === 'complete' || d.status === 'expired') {
      finished.push(summary);
    } else if (!opponentUid || mySide?.finishedAt) {
      waiting.push(summary);
    } else {
      yourTurn.push(summary);
    }
  }

  yourTurn.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  waiting.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  finished.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const activeCount = yourTurn.length + waiting.length;
  const maxActive = user.pro.active ? PRO_LIMITS.maxActiveDuels : FREE_LIMITS.maxActiveDuels;

  const userTz = user.tz || 'Europe/Bucharest';
  const currentMonth = getLocalDateString(new Date(), userTz).slice(0, 7);
  const monthlyCount = Object.values(store.duels).filter((d) => {
    if (d.challengerUid !== uid) return false;
    const dMonth = getLocalDateString(new Date(d.createdAt), userTz).slice(0, 7);
    return dMonth === currentMonth;
  }).length;
  const maxMonthly = user.pro.active ? PRO_LIMITS.maxMonthlyDuels : FREE_LIMITS.maxMonthlyDuels;

  let totalScore = 0;
  for (const d of finished) {
    totalScore += d.myScore ?? 0;
  }

  const finishedWins = finished.filter((d) => d.isWinner).length;
  const finishedDraws = finished.filter((d) => d.isTie).length;
  const finishedLosses = finished.filter((d) => !d.isWinner && !d.isTie).length;

  const wins = Math.max(user.duelStats?.wins ?? 0, finishedWins);
  const draws = Math.max(user.duelStats?.draws ?? 0, finishedDraws);
  const losses = Math.max(user.duelStats?.losses ?? 0, finishedLosses);

  return {
    yourTurn,
    waiting,
    finished,
    isPro: Boolean(user.pro?.active),
    activeCount,
    maxActive,
    monthlyCount,
    maxMonthly,
    stats: {
      totalScore,
      wins,
      losses,
      draws,
      played: wins + losses + draws,
    },
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
  if (!duel) throw new ApiError('DUEL_NOT_FOUND', 'Duel not found', 404);

  const user = getOrCreateUser({
    uid: params.uid,
    nickname: params.nickname,
    locale: params.locale,
  });

  if (params.uid !== duel.challengerUid && !duel.opponentUid) {
    duel.opponentUid = params.uid;
  }

  if (params.uid !== duel.challengerUid && params.uid !== duel.opponentUid) {
    throw new ApiError('DUEL_FULL', 'This duel already has two players', 400);
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
  if (!duel) throw new ApiError('DUEL_NOT_FOUND', 'Duel not found', 404);
  const side = duel.sides[params.uid];
  if (!side || side.finishedAt) throw new ApiError('DUEL_INACTIVE', 'Side not active', 400);

  const itemState = side.items.find((i) => i.index === params.index);
  if (!itemState || itemState.answeredAt !== undefined) {
    throw new ApiError('BAD_REQUEST', 'Invalid duel item state', 400);
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

    const challengerUser = store.users[duel.challengerUid];
    const opponentUser = duel.opponentUid ? store.users[duel.opponentUid] : undefined;
    const isHostAuth = Boolean(
      challengerUser &&
      !challengerUser.isAnonymous &&
      challengerUser.authProvider &&
      challengerUser.authProvider !== 'anonymous',
    );
    const isOpponentAuth = Boolean(
      opponentUser &&
      !opponentUser.isAnonymous &&
      opponentUser.authProvider &&
      opponentUser.authProvider !== 'anonymous',
    );
    const isRated = isHostAuth && isOpponentAuth;
    duel.rated = isRated;

    if (outcome.status === 'complete' && duel.opponentUid) {
      const oppUid = duel.opponentUid;
      const chUid = duel.challengerUid;

      if (isRated && challengerUser && opponentUser) {
        if (!challengerUser.duelStats) {
          challengerUser.duelStats = {
            played: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            bestWinStreak: 0,
            currentWinStreak: 0,
          };
        }
        if (!opponentUser.duelStats) {
          opponentUser.duelStats = {
            played: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            bestWinStreak: 0,
            currentWinStreak: 0,
          };
        }
        if (!challengerUser.rivals) challengerUser.rivals = {};
        if (!opponentUser.rivals) opponentUser.rivals = {};

        if (!challengerUser.rivals[oppUid]) {
          challengerUser.rivals[oppUid] = {
            opponentUid: oppUid,
            opponentNickname: opponentUser.nickname,
            wins: 0,
            losses: 0,
            draws: 0,
            lastDuelAt: new Date().toISOString(),
            currentWinStreak: 0,
          };
        }
        if (!opponentUser.rivals[chUid]) {
          opponentUser.rivals[chUid] = {
            opponentUid: chUid,
            opponentNickname: challengerUser.nickname,
            wins: 0,
            losses: 0,
            draws: 0,
            lastDuelAt: new Date().toISOString(),
            currentWinStreak: 0,
          };
        }

        challengerUser.duelStats.played += 1;
        opponentUser.duelStats.played += 1;
        markUserDirty(challengerUser.uid);
        markUserDirty(opponentUser.uid);
        challengerUser.rivals[oppUid].lastDuelAt = new Date().toISOString();
        opponentUser.rivals[chUid].lastDuelAt = new Date().toISOString();

        if (outcome.winnerUid === chUid) {
          challengerUser.duelStats.wins += 1;
          challengerUser.duelStats.currentWinStreak += 1;
          challengerUser.duelStats.bestWinStreak = Math.max(
            challengerUser.duelStats.bestWinStreak,
            challengerUser.duelStats.currentWinStreak,
          );
          challengerUser.rivals[oppUid].wins += 1;
          challengerUser.rivals[oppUid].currentWinStreak += 1;

          opponentUser.duelStats.losses += 1;
          opponentUser.duelStats.currentWinStreak = 0;
          opponentUser.rivals[chUid].losses += 1;
          opponentUser.rivals[chUid].currentWinStreak = 0;
        } else if (outcome.winnerUid === oppUid) {
          opponentUser.duelStats.wins += 1;
          opponentUser.duelStats.currentWinStreak += 1;
          opponentUser.duelStats.bestWinStreak = Math.max(
            opponentUser.duelStats.bestWinStreak,
            opponentUser.duelStats.currentWinStreak,
          );
          opponentUser.rivals[chUid].wins += 1;
          opponentUser.rivals[chUid].currentWinStreak += 1;

          challengerUser.duelStats.losses += 1;
          challengerUser.duelStats.currentWinStreak = 0;
          challengerUser.rivals[oppUid].losses += 1;
          challengerUser.rivals[oppUid].currentWinStreak = 0;
        } else {
          challengerUser.duelStats.draws += 1;
          challengerUser.duelStats.currentWinStreak = 0;
          challengerUser.rivals[oppUid].draws += 1;
          challengerUser.rivals[oppUid].currentWinStreak = 0;

          opponentUser.duelStats.draws += 1;
          opponentUser.duelStats.currentWinStreak = 0;
          opponentUser.rivals[chUid].draws += 1;
          opponentUser.rivals[chUid].currentWinStreak = 0;
        }
      }

      if (outcome.winnerUid) {
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

function toMergeUser(user: UserRecord): MergeUser {
  return {
    uid: user.uid,
    nickname: user.nickname,
    streakCurrent: user.streakCurrent,
    streakBest: user.streakBest,
    leagueIds: [...user.leagueIds],
    freezes: user.freezes ?? 0,
    email: user.email,
    isAnonymous: user.isAnonymous,
    authProvider: user.authProvider,
    pro: user.pro,
    duelStats: user.duelStats,
    expiresAt: user.expiresAt ?? null,
    upgradedAt: user.upgradedAt ?? null,
  };
}

function reassignPlay(store: StoreState, play: PlayRecord, newUid: string) {
  const keys = Object.entries(store.plays)
    .filter(([, value]) => value === play)
    .map(([key]) => key);
  for (const key of keys) delete store.plays[key];
  play.uid = newUid;
  play.playId = `${play.date}_${newUid}`;
  store.plays[play.playId] = play;
  store.plays[`${newUid}_${play.date}`] = play;
}

function repointUidInStore(fromUid: string, toUid: string): boolean {
  const store = getStore();
  const source = store.users[fromUid];
  if (!source) return false;
  store.users[toUid] = { ...source, uid: toUid };
  delete store.users[fromUid];
  const plays = Object.values(store.plays).filter((play) => play.uid === fromUid);
  for (const play of plays) reassignPlay(store, play, toUid);
  for (const duel of Object.values(store.duels)) {
    if (duel.challengerUid === fromUid) duel.challengerUid = toUid;
    if (duel.opponentUid === fromUid) duel.opponentUid = toUid;
    if (duel.sides[fromUid] && !duel.sides[toUid]) {
      duel.sides[toUid] = { ...duel.sides[fromUid]!, uid: toUid };
      delete duel.sides[fromUid];
    }
  }
  for (const league of Object.values(store.leagues)) {
    if (league.members[fromUid] && !league.members[toUid]) {
      league.members[toUid] = { ...league.members[fromUid]!, uid: toUid };
    }
    delete league.members[fromUid];
    for (const day of Object.values(league.days)) {
      if (day[fromUid] && !day[toUid]) {
        day[toUid] = { ...day[fromUid]!, uid: toUid };
      }
      delete day[fromUid];
    }
    if (league.ownerUid === fromUid) league.ownerUid = toUid;
  }
  markUserDirty(toUid);
  return true;
}

export function adoptAnonymousUid(fromUid: string, toUid: string): { uid: string; moved: boolean } {
  if (!fromUid || !toUid || fromUid === toUid) return { uid: toUid || fromUid, moved: false };
  const store = getStore();
  const source = store.users[fromUid];
  if (!source || source.email || source.isAnonymous === false)
    return { uid: fromUid, moved: false };
  const target = store.users[toUid];
  if (target?.email || target?.isAnonymous === false) return { uid: toUid, moved: false };
  if (!target) {
    return { uid: toUid, moved: repointUidInStore(fromUid, toUid) };
  }
  return { uid: fromUid, moved: false };
}

export function purgeAnonymousFromStore(uid: string) {
  const store = getStore();
  const user = store.users[uid];
  if (user?.email) return;
  delete store.users[uid];
  for (const [id, play] of Object.entries(store.plays)) {
    if (play.uid === uid) delete store.plays[id];
  }
  for (const [id, duel] of Object.entries(store.duels)) {
    if (duel.challengerUid === uid || duel.opponentUid === uid) delete store.duels[id];
  }
  for (const league of [...Object.values(store.leagues)]) {
    delete league.members[uid];
    for (const day of Object.values(league.days)) delete day[uid];
    if (league.ownerUid === uid && league.id !== 'lg_world') {
      const remaining = Object.values(league.members);
      if (remaining.length === 0) {
        delete store.inviteCodes[league.inviteCode];
        delete store.leagues[league.id];
      } else {
        const nextOwner = remaining[0]!;
        league.ownerUid = nextOwner.uid;
        nextOwner.role = 'owner';
      }
    }
  }
  for (const [id, report] of Object.entries(store.reports)) {
    if (report.reporterUid === uid) delete store.reports[id];
  }
  delete store.subscriptions[uid];
}

export function upgradeAccount(params: {
  uid: string;
  email: string;
  provider: 'email_link' | 'google' | 'google.com' | 'password' | 'email_password';
  nickname?: string;
  confirmMerge?: boolean;
  targetUid?: string;
}) {
  const store = getStore();
  const user = getOrCreateUser({ uid: params.uid });
  const targetEmail = params.email.trim().toLowerCase();
  const provider = normalizeAuthProvider(params.provider);
  if (params.nickname?.trim()) {
    user.nickname = params.nickname.trim();
    syncNicknameToLeagues(params.uid, user.nickname);
  }

  const namedTarget = params.targetUid ? store.users[params.targetUid] : undefined;
  const existingUser =
    namedTarget && namedTarget.uid !== params.uid
      ? namedTarget
      : Object.values(store.users).find(
          (candidate) => candidate.email === targetEmail && candidate.uid !== params.uid,
        );

  if (existingUser) {
    const shouldMerge = Boolean(params.confirmMerge) || provider === 'google.com';
    if (!shouldMerge) {
      return {
        accountExists: true as const,
        existingUid: existingUser.uid,
        message: 'Account already exists',
      };
    }

    if (!store.users[existingUser.uid]) {
      store.users[existingUser.uid] = existingUser;
    }
    const plan = planAccountMerge({
      source: toMergeUser(user),
      target: toMergeUser(existingUser),
      plays: Object.values(store.plays).map((play) => ({
        playId: play.playId,
        uid: play.uid,
        date: play.date,
      })),
      duels: Object.values(store.duels).map((duel) => ({
        id: duel.id,
        challengerUid: duel.challengerUid,
        opponentUid: duel.opponentUid,
      })),
      nowIso: new Date().toISOString(),
      provider,
    });
    const movingDates = new Set(plan.playReassignments.map((play) => play.date));
    for (const play of Object.values(store.plays)) {
      if (play.uid === user.uid && movingDates.has(play.date)) {
        reassignPlay(store, play, existingUser.uid);
      }
    }
    for (const update of plan.duelRepoints) {
      const duel = store.duels[update.id];
      if (!duel) continue;
      if (duel.sides[user.uid] && !duel.sides[existingUser.uid]) {
        duel.sides[existingUser.uid] = { ...duel.sides[user.uid]!, uid: existingUser.uid };
        delete duel.sides[user.uid];
      }
      duel.challengerUid = update.challengerUid;
      duel.opponentUid = update.opponentUid;
    }
    for (const leagueId of user.leagueIds) {
      const league = store.leagues[leagueId];
      if (!league) continue;
      if (league.members[user.uid] && !league.members[existingUser.uid]) {
        league.members[existingUser.uid] = { ...league.members[user.uid]!, uid: existingUser.uid };
      }
      delete league.members[user.uid];
      for (const day of Object.values(league.days)) {
        if (day[user.uid] && !day[existingUser.uid]) {
          day[existingUser.uid] = { ...day[user.uid]!, uid: existingUser.uid };
        }
        delete day[user.uid];
      }
      if (league.ownerUid === user.uid) league.ownerUid = existingUser.uid;
    }
    existingUser.nickname = plan.target.nickname;
    existingUser.streakCurrent = plan.target.streakCurrent;
    existingUser.streakBest = plan.target.streakBest;
    existingUser.leagueIds = plan.target.leagueIds;
    existingUser.freezes = plan.target.freezes;
    existingUser.email = plan.target.email || targetEmail;
    existingUser.isAnonymous = false;
    existingUser.authProvider = provider;
    existingUser.expiresAt = null;
    existingUser.upgradedAt = plan.target.upgradedAt;
    if (plan.target.pro) existingUser.pro = plan.target.pro;
    if (plan.target.duelStats) existingUser.duelStats = plan.target.duelStats;
    delete store.users[user.uid];
    markUserDirty(existingUser.uid);
    return {
      uid: existingUser.uid,
      merged: true as const,
      nickname: existingUser.nickname,
      email: existingUser.email,
      isAnonymous: false,
      authProvider: existingUser.authProvider,
      isAdmin: Boolean(existingUser.isAdmin),
      streakCurrent: existingUser.streakCurrent,
      streakBest: existingUser.streakBest,
      leagueIds: existingUser.leagueIds,
      expiresAt: null,
      upgradedAt: existingUser.upgradedAt,
    };
  }

  if (params.targetUid && params.targetUid !== user.uid) {
    repointUidInStore(user.uid, params.targetUid);
    const moved = getOrCreateUser({ uid: params.targetUid, nickname: user.nickname });
    moved.email = targetEmail;
    moved.isAnonymous = false;
    moved.authProvider = provider;
    moved.expiresAt = null;
    moved.upgradedAt = new Date().toISOString();
    markUserDirty(moved.uid);
    return {
      uid: moved.uid,
      merged: true as const,
      nickname: moved.nickname,
      email: moved.email,
      isAnonymous: false,
      authProvider: moved.authProvider,
      isAdmin: Boolean(moved.isAdmin),
      streakCurrent: moved.streakCurrent,
      streakBest: moved.streakBest,
      leagueIds: moved.leagueIds,
      expiresAt: null,
      upgradedAt: moved.upgradedAt,
    };
  }

  user.isAnonymous = false;
  user.email = targetEmail;
  user.authProvider = provider;
  user.expiresAt = null;
  user.upgradedAt = new Date().toISOString();
  if (PRO_BOOTSTRAP_EMAILS.includes(user.email)) {
    user.pro = {
      active: true,
      plan: 'yearly',
      until: '2099-12-31T23:59:59.999Z',
    };
  }

  if (isAdminBootstrapEmail(user.email)) {
    user.isAdmin = true;
  }
  markUserDirty(user.uid);

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
    expiresAt: null,
    upgradedAt: user.upgradedAt,
  };
}

export function getUserProfile(uid: string) {
  const store = getStore();
  const user = getOrCreateUser({ uid });
  const userPlays = getUniqueFinishedPlays(store, uid);

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
    isAdmin: Boolean(user.isAdmin) || (!user.isAnonymous && isAdminBootstrapEmail(user.email)),
    expiresAt: user.expiresAt ?? null,
    upgradedAt: user.upgradedAt ?? null,
    createdAt: user.createdAt,
    pro: user.pro,
    notif: user.notif,
    streakCurrent: user.streakCurrent,
    streakBest: user.streakBest,
    freezes: user.freezes ?? 0,
    duelStats: user.duelStats ?? {
      played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      bestWinStreak: 0,
      currentWinStreak: 0,
    },
    topRivals: Object.values(user.rivals ?? {})
      .sort((a, b) => b.wins + b.losses - (a.wins + a.losses))
      .slice(0, 3),
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
  plan?: 'monthly' | 'yearly' | 'freeze_1' | 'freeze_3';
  currentPeriodEnd?: string;
}) {
  const store = getStore();
  // Idempotency check (§5 & Phase 3 acceptance)
  if (store.stripeEvents[params.eventId]) {
    return { duplicate: true, processedAt: store.stripeEvents[params.eventId] };
  }
  store.stripeEvents[params.eventId] = new Date().toISOString();

  const user = getOrCreateUser({ uid: params.uid });
  markUserDirty(user.uid);

  // Handle Streak Freeze one-off purchases
  if (params.type === 'checkout.session.completed' && params.plan === 'freeze_1') {
    user.freezes = Math.min(5, (user.freezes ?? 0) + 1);
    if (!user.freezeLedger) user.freezeLedger = [];
    user.freezeLedger.push({
      date: new Date().toISOString(),
      action: 'purchased_1',
      freezesAfter: user.freezes,
    });
    return { duplicate: false, freezes: user.freezes, pro: user.pro };
  }

  if (params.type === 'checkout.session.completed' && params.plan === 'freeze_3') {
    user.freezes = Math.min(5, (user.freezes ?? 0) + 3);
    if (!user.freezeLedger) user.freezeLedger = [];
    user.freezeLedger.push({
      date: new Date().toISOString(),
      action: 'purchased_3',
      freezesAfter: user.freezes,
    });
    return { duplicate: false, freezes: user.freezes, pro: user.pro };
  }

  const plan = params.plan === 'yearly' ? 'yearly' : 'monthly';
  const until = params.currentPeriodEnd ?? new Date(Date.now() + 30 * 86_400_000).toISOString();

  if (
    params.type === 'checkout.session.completed' ||
    params.type === 'customer.subscription.updated'
  ) {
    user.pro = { active: true, plan, until };
    store.subscriptions[params.uid] = { plan, status: 'active', currentPeriodEnd: until };

    // Pro includes 2 free freezes per billing month
    user.freezes = Math.min(5, (user.freezes ?? 0) + 2);
    if (!user.freezeLedger) user.freezeLedger = [];
    user.freezeLedger.push({
      date: new Date().toISOString(),
      action: 'pro_monthly_credit',
      freezesAfter: user.freezes,
    });

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

  return { duplicate: false, freezes: user.freezes, pro: user.pro };
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
    const err = new Error('Email reminders require a linked email account.') as Error & {
      code?: string;
    };
    err.code = 'EMAIL_ACCOUNT_REQUIRED';
    throw err;
  }
  user.notif = {
    ...user.notif,
    pushEnabled: params.pushEnabled,
    emailEnabled: params.emailEnabled,
    reminderLocalTime: params.reminderLocalTime,
  };
  markUserDirty(user.uid);
  return user.notif;
}

export function unsubscribeUserEmail(uid: string) {
  const user = getOrCreateUser({ uid });
  user.notif.emailEnabled = false;
  markUserDirty(user.uid);
  return { ok: true, uid, emailEnabled: false };
}

// ==========================================
// Phase 5: Admin & AI-assisted Content
// ==========================================

export function logAdminAction(params: {
  actorUid: string;
  actorEmail?: string;
  action: string;
  targetType: 'question' | 'round' | 'league' | 'report';
  targetId: string;
  details: string;
}): AuditLogEntry {
  const store = getStore();
  const entry: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    action: params.action,
    targetType: params.targetType,
    targetId: params.targetId,
    details: params.details,
    createdAt: new Date().toISOString(),
  };
  store.auditLogs.unshift(entry);
  if (store.auditLogs.length > 500) {
    store.auditLogs.pop();
  }
  return entry;
}

export function validateQuestionForApproval(q: StoredQuestion): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required locales (RO, EN, ES, PT)
  const requiredLocales: ('ro' | 'en' | 'es' | 'pt')[] = ['ro', 'en', 'es', 'pt'];
  for (const loc of requiredLocales) {
    const c = q.content[loc];
    if (!c || !c.prompt?.trim()) {
      errors.push(`Locale ${loc.toUpperCase()} must have a non-empty prompt.`);
      continue;
    }
    if (q.type !== 'logic') {
      if (!c.options || c.options.length < 3) {
        errors.push(`Locale ${loc.toUpperCase()} must have at least 3 options.`);
      } else if (c.options.some((opt) => !opt?.trim())) {
        errors.push(`Locale ${loc.toUpperCase()} has empty option strings.`);
      }
    }
  }

  // Placeholder check (no [AI Draft], Option A (Correct), Verify facts, Generated draft)
  const placeholderRegex =
    /\[AI Draft\]|Option [A-D] \(Correct\)|Option [A-D]$|Verify facts|Generated draft/i;
  for (const loc of requiredLocales) {
    const c = q.content[loc];
    if (!c) continue;
    if (placeholderRegex.test(c.prompt)) {
      errors.push(`Placeholder text found in ${loc.toUpperCase()} prompt.`);
    }
    if (c.options?.some((opt) => placeholderRegex.test(opt))) {
      errors.push(`Placeholder text found in ${loc.toUpperCase()} options.`);
    }
    if (c.explanation && placeholderRegex.test(c.explanation)) {
      errors.push(`Placeholder text found in ${loc.toUpperCase()} explanation.`);
    }
  }

  // Order explanation check
  if (q.type === 'order' && q.content.ro?.explanation) {
    const expl = q.content.ro.explanation.toLowerCase();
    const opts = (q.content.ro.options ?? []).map((o) => o.toLowerCase());
    // if options exist, ensure explanation doesn't contain generic placeholder
    if (expl.includes('placeholder') || expl.includes('option a')) {
      errors.push('Order explanation contains invalid placeholder text.');
    }
  }

  return { ok: errors.length === 0, errors };
}

export function getAdminDashboard() {
  const store = getStore();
  const todayStr = new Date().toISOString().slice(0, 10);

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

  // Next 7 days empty warnings
  const upcomingWarnings: string[] = [];
  const todayMs = new Date(todayStr).getTime();
  for (let i = 1; i <= 7; i += 1) {
    const dStr = new Date(todayMs + i * 86400000).toISOString().slice(0, 10);
    const sched = store.scheduledRounds[dStr];
    if (!sched || sched.questionIds.length < 6) {
      upcomingWarnings.push(`No scheduled round for upcoming day ${dStr}!`);
    }
  }

  const leagues = Object.values(store.leagues).map((l) => ({
    id: l.id,
    name: l.name,
    inviteCode: l.inviteCode,
    ownerUid: l.ownerUid,
    memberCount: Object.keys(l.members).length,
    maxMembers: l.maxMembers,
    members: Object.values(l.members),
    createdAt: l.createdAt,
  }));

  return {
    questions,
    scheduledRounds: Object.values(store.scheduledRounds).map((r) => ({
      ...r,
      locked: r.locked ?? r.date <= todayStr,
    })),
    upcomingWarnings,
    leagues,
    reports: Object.values(store.reports),
    auditLogs: store.auditLogs.slice(0, 100),
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

export function createOrUpdateAdminQuestion(params: {
  id?: string;
  type: QuestionType;
  difficulty: 1 | 2 | 3;
  topics: string[];
  timerSec?: number;
  content: {
    ro?: { prompt: string; options: string[]; explanation?: string };
    en?: { prompt: string; options: string[]; explanation?: string };
    es?: { prompt: string; options: string[]; explanation?: string };
    pt?: { prompt: string; options: string[]; explanation?: string };
  };
  extraContent?: Record<string, { prompt: string; options: string[]; explanation?: string }>;
  answer?: {
    correctIndex?: number;
    correctOrder?: string[];
    oddIndex?: number;
    numericAnswer?: number;
  };
  reviewStatus?: 'draft' | 'approved';
  actorUid?: string;
  actorEmail?: string;
}) {
  const store = getStore();
  let q: StoredQuestion | undefined;
  if (params.id) {
    q = store.questions.find((item) => item.id === params.id);
  }

  const isNew = !q;
  const id = q?.id ?? `q-${params.type}-${Date.now()}`;

  if (!q) {
    q = {
      id,
      type: params.type,
      difficulty: params.difficulty,
      topics: params.topics,
      content: params.content,
      extraContent: params.extraContent,
      answer: params.answer ?? { correctIndex: 0 },
      translationStatus: {
        en: params.content.en ? 'reviewed' : 'missing',
        es: params.content.es ? 'reviewed' : 'missing',
        pt: params.content.pt ? 'reviewed' : 'missing',
        ro: params.content.ro ? 'reviewed' : 'missing',
      },
      source: 'human',
      reviewStatus: params.reviewStatus ?? 'draft',
      usageCount: 0,
      timerSec: params.timerSec ?? 15,
    };
    store.questions.unshift(q);
  } else {
    q.type = params.type;
    q.difficulty = params.difficulty;
    q.topics = params.topics;
    q.content = { ...q.content, ...params.content };
    if (params.extraContent) q.extraContent = { ...q.extraContent, ...params.extraContent };
    if (params.answer) q.answer = params.answer;
    if (params.timerSec) q.timerSec = params.timerSec;
    if (params.reviewStatus) q.reviewStatus = params.reviewStatus;
  }

  logAdminAction({
    actorUid: params.actorUid ?? 'admin',
    actorEmail: params.actorEmail,
    action: isNew ? 'create_question' : 'edit_question',
    targetType: 'question',
    targetId: id,
    details: `${isNew ? 'Created' : 'Updated'} question ${id} (${params.type})`,
  });

  return q;
}

export function generateAiQuestionDrafts(params: {
  topic: string;
  type: QuestionType;
  difficulty: 1 | 2 | 3;
  count: number;
  customTemplates?: GeneratedDraftTemplate[];
}) {
  const store = getStore();
  const safeCount = Math.min(5, Math.max(1, params.count));
  const templates =
    params.customTemplates && params.customTemplates.length >= safeCount
      ? params.customTemplates.slice(0, safeCount)
      : pickCuratedTemplates({
          topic: params.topic,
          type: params.type,
          count: safeCount,
          offsetSeed: store.questions.filter((q) => q.source === 'ai_draft').length,
        });

  const created: StoredQuestion[] = [];
  for (let i = 0; i < safeCount; i += 1) {
    const tpl = templates[i]!;
    const id = `q-ai-${Date.now()}-${i + 1}`;
    const draft: StoredQuestion = {
      id,
      type: params.type,
      difficulty: params.difficulty,
      topics: [params.topic.toLowerCase()],
      content: {
        ro: tpl.content.ro,
        en: tpl.content.en,
        es: tpl.content.es ?? tpl.content.en,
        pt: tpl.content.pt ?? tpl.content.en,
      },
      answer: params.type === 'order' ? {} : { correctIndex: tpl.correctIndex ?? 0 },
      translationStatus: {
        en: 'machine_draft',
        es: 'machine_draft',
        pt: 'machine_draft',
        ro: 'machine_draft',
      },
      source: 'ai_draft',
      reviewStatus: 'draft',
      usageCount: 0,
      timerSec: 15,
    };
    store.questions.unshift(draft);
    created.push(draft);
  }
  return created;
}

export function approveAdminQuestion(id: string, reviewer = 'admin', reviewerEmail?: string) {
  const store = getStore();
  const q = store.questions.find((item) => item.id === id);
  if (!q) throw new Error('Question not found');

  const validation = validateQuestionForApproval(q);
  if (!validation.ok) {
    throw new Error(`Cannot approve question: ${validation.errors.join('; ')}`);
  }

  q.reviewStatus = 'approved';
  q.translationStatus = {
    en: 'reviewed',
    es: q.content.es ? 'reviewed' : (q.translationStatus.es ?? 'missing'),
    pt: q.content.pt ? 'reviewed' : (q.translationStatus.pt ?? 'missing'),
    ro: q.content.ro ? 'reviewed' : (q.translationStatus.ro ?? 'missing'),
  };
  q.reviewedBy = reviewer;
  q.reviewedAt = new Date().toISOString();

  logAdminAction({
    actorUid: reviewer,
    actorEmail: reviewerEmail,
    action: 'approve_question',
    targetType: 'question',
    targetId: id,
    details: `Approved question ${id} (${q.type})`,
  });

  return q;
}

export function scheduleAdminRound(params: {
  date: string;
  questionIds: string[];
  topicOfTheDay: string;
  actorUid?: string;
  actorEmail?: string;
}) {
  const store = getStore();
  const todayStr = new Date().toISOString().slice(0, 10);

  const existing = store.scheduledRounds[params.date];
  if (existing?.locked || params.date < todayStr) {
    throw new Error('This round is locked because its day has already started.');
  }

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

  // 90-day reuse check
  const reuseWarnings: string[] = [];
  const targetDateMs = new Date(params.date).getTime();
  for (const q of picked) {
    if (q.lastUsedOn) {
      const usedMs = new Date(q.lastUsedOn).getTime();
      const diffDays = Math.round(Math.abs(targetDateMs - usedMs) / (1000 * 60 * 60 * 24));
      if (diffDays <= 90) {
        reuseWarnings.push(
          `Question ${q.id} was used on ${q.lastUsedOn} (${diffDays} days ago; recommend 90+ days).`,
        );
      }
    }
  }

  const launchDate = process.env.NEXT_PUBLIC_LAUNCH_DATE ?? '2026-11-01';
  const schedule: AdminRoundSchedule = {
    date: params.date,
    roundNumber: computeRoundNumber(params.date, launchDate),
    questionIds: params.questionIds,
    topicOfTheDay: params.topicOfTheDay,
    status: 'scheduled',
    explicitFallbackLocales: ['es', 'pt', 'ro'],
    locked: params.date <= todayStr,
  };
  store.scheduledRounds[params.date] = schedule;

  logAdminAction({
    actorUid: params.actorUid ?? 'admin',
    actorEmail: params.actorEmail,
    action: 'schedule_round',
    targetType: 'round',
    targetId: params.date,
    details: `Scheduled round for ${params.date} with ${params.questionIds.length} questions. Topic: ${params.topicOfTheDay}`,
  });

  return { schedule, warnings: [...validation.warnings, ...reuseWarnings] };
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

// ==========================================
// Phase 5: Daily Round Management & Question Reporting
// ==========================================

export function reportQuestion(params: {
  questionId: string;
  reason: 'wrong_answer' | 'ambiguous' | 'language_error' | string;
  reporterUid?: string;
}) {
  const store = getStore();
  if (!store.questionReports[params.questionId]) {
    store.questionReports[params.questionId] = {
      count: 0,
      reasons: {},
      flagged: false,
    };
  }

  const rep = store.questionReports[params.questionId]!;
  rep.count += 1;
  rep.reasons[params.reason] = (rep.reasons[params.reason] ?? 0) + 1;
  if (rep.count >= 3) {
    rep.flagged = true;
  }

  // Also flag across daily rounds if present
  for (const round of Object.values(store.dailyRounds)) {
    const q = round.questions.find((item) => item.id === params.questionId);
    if (q) {
      q.reportCount = rep.count;
      if (rep.flagged) {
        q.flagged = true;
      }
    }
  }

  return {
    questionId: params.questionId,
    reportCount: rep.count,
    flagged: rep.flagged,
  };
}

export function getQuestionReportStatus(questionId: string) {
  const store = getStore();
  const rep = store.questionReports[questionId];
  return {
    reportCount: rep?.count ?? 0,
    flagged: rep?.flagged ?? false,
    reasons: rep?.reasons ?? {},
  };
}

export function getAdminRounds(daysCount = 7) {
  const store = getStore();
  const now = new Date();
  const result: Array<{
    date: string;
    roundNumber: number;
    theme: string;
    status: 'ready' | 'reserve' | 'scheduled';
    promotedFromReserve?: boolean;
    questions: Array<{
      index: number;
      id: string;
      type: QuestionType;
      category: string;
      difficulty: 1 | 2 | 3;
      prompt: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
      reportCount: number;
      flagged: boolean;
    }>;
  }> = [];

  for (let i = 0; i < daysCount; i += 1) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const dateStr = getLocalDateString(d, 'Europe/Bucharest');
    const meta = getRoundMeta(dateStr);
    const daily = store.dailyRounds[dateStr];

    if (daily && daily.questions.length === 6) {
      result.push({
        date: dateStr,
        roundNumber: daily.roundNumber,
        theme: daily.theme,
        status: daily.status,
        promotedFromReserve: daily.promotedFromReserve,
        questions: daily.questions.map((q, idx) => {
          const rep = store.questionReports[q.id];
          const ro = (q.content.ro || q.content.en)!;
          const ansStr =
            q.type === 'order'
              ? (q.correctOrder ?? ro.options).join(' → ')
              : (ro.options[q.correctIndex ?? 0] ?? '');
          return {
            index: idx,
            id: q.id,
            type: q.type,
            category: q.category,
            difficulty: q.difficulty,
            prompt: ro.prompt,
            options: ro.options,
            correctAnswer: ansStr,
            explanation: ro.explanation,
            reportCount: rep?.count ?? q.reportCount ?? 0,
            flagged: Boolean(rep?.flagged || q.flagged),
          };
        }),
      });
    } else {
      // Fallback: resolve from seed or scheduled
      const resolved = resolveRoundItems(dateStr, 'ro');
      result.push({
        date: dateStr,
        roundNumber: meta.roundNumber,
        theme: meta.topicOfTheDay,
        status: 'scheduled',
        questions: resolved.map((r, idx) => {
          const rep = store.questionReports[r.questionId];
          const ansStr =
            r.type === 'order'
              ? (r.correctOrder ?? r.options).join(' → ')
              : (r.options[r.correctIndex ?? 0] ?? '');
          return {
            index: idx,
            id: r.questionId,
            type: r.type,
            category: r.topics[0] ?? 'General',
            difficulty: idx < 2 ? 1 : idx < 4 ? 2 : 3,
            prompt: r.prompt,
            options: r.options,
            correctAnswer: ansStr,
            explanation: r.explanation ?? '',
            reportCount: rep?.count ?? 0,
            flagged: rep?.flagged ?? false,
          };
        }),
      });
    }
  }

  return result;
}

export async function replaceQuestionInDailyRound(params: { date: string; questionIndex: number }) {
  const store = getStore();
  const daily = store.dailyRounds[params.date];
  if (!daily || !daily.questions[params.questionIndex]) {
    // If daily round wasn't generated yet, build it first
    const meta = getRoundMeta(params.date);
    const existing = Object.values(store.dailyRounds).flatMap((r) =>
      r.questions.map((q) => q.content.en.prompt),
    );
    const generated = await generateFullDailyRound({
      date: params.date,
      roundNumber: meta.roundNumber,
      theme: meta.topicOfTheDay,
      existingPrompts: existing,
    });
    if (generated) {
      store.dailyRounds[params.date] = generated;
    }
  }

  const round = store.dailyRounds[params.date];
  if (!round) throw new Error('Round not found');
  const target = round.questions[params.questionIndex]!;

  const existingPrompts = Object.values(store.dailyRounds).flatMap((r) =>
    r.questions.map((q) => q.content.en.prompt),
  );

  const newQuestion = await generateSingleQuestionWithGemini({
    type: target.type,
    difficulty: target.difficulty,
    category: target.category,
    themeOfTheDay: round.theme,
    existingPrompts,
  });

  if (!newQuestion) {
    throw new Error('Failed to generate replacement question with Gemini');
  }

  round.questions[params.questionIndex] = newQuestion;
  return newQuestion;
}

export async function ensureUpcomingDailyRounds(bufferDays = 7) {
  const store = getStore();
  const now = new Date();
  const createdRounds: string[] = [];

  const existingPrompts = Object.values(store.dailyRounds).flatMap((r) =>
    r.questions.map((q) => q.content.en.prompt),
  );

  for (let i = 0; i < bufferDays; i += 1) {
    const d = new Date(now.getTime() + i * 86_400_000);
    const dateStr = getLocalDateString(d, 'Europe/Bucharest');
    if (!store.dailyRounds[dateStr]) {
      const meta = getRoundMeta(dateStr);
      const round = await generateFullDailyRound({
        date: dateStr,
        roundNumber: meta.roundNumber,
        theme: meta.topicOfTheDay,
        existingPrompts,
      });
      if (round) {
        store.dailyRounds[dateStr] = round;
        createdRounds.push(dateStr);
        for (const q of round.questions) {
          existingPrompts.push(q.content.en.prompt);
        }
      }
    }
  }

  // Ensure reserve pool has at least 14 rounds
  const reserveRounds = Object.values(store.dailyRounds).filter((r) => r.status === 'reserve');
  const neededReserve = Math.max(0, 14 - reserveRounds.length);

  for (let j = 0; j < neededReserve; j += 1) {
    const reserveId = `reserve_${Date.now()}_${j}`;
    const round = await generateFullDailyRound({
      date: 'reserve',
      roundNumber: 9999 + j,
      existingPrompts,
    });
    if (round) {
      round.id = reserveId;
      round.status = 'reserve';
      store.dailyRounds[reserveId] = round;
      for (const q of round.questions) {
        existingPrompts.push(q.content.en.prompt);
      }
    }
  }

  return {
    createdRounds,
    totalReserve: Object.values(store.dailyRounds).filter((r) => r.status === 'reserve').length,
  };
}

export function promoteReserveRoundIfNeeded(targetDate: string) {
  const store = getStore();
  if (store.dailyRounds[targetDate]?.status === 'ready') {
    return { promoted: false, reason: 'Already ready' };
  }

  const reserveKey = Object.keys(store.dailyRounds).find(
    (k) => store.dailyRounds[k]?.status === 'reserve',
  );

  if (!reserveKey) {
    return { promoted: false, reason: 'No reserve round available' };
  }

  const reserve = store.dailyRounds[reserveKey]!;
  delete store.dailyRounds[reserveKey];

  reserve.id = `rounds/${targetDate}`;
  reserve.date = targetDate;
  reserve.status = 'ready';
  reserve.promotedFromReserve = true;
  store.dailyRounds[targetDate] = reserve;

  return { promoted: true, date: targetDate, round: reserve };
}
