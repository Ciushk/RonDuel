import { z } from 'zod';

import { LOCALES, QUESTION_TYPES, type Locale, type QuestionType } from './scoring.js';

export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;

export const FREE_LIMITS = {
  maxOwnedLeagues: 3,
  maxMembersPerLeague: 25,
  maxJoinedLeagues: 10,
  maxActiveDuels: 3,
} as const;

export const PRO_LIMITS = {
  maxOwnedLeagues: 50,
  maxMembersPerLeague: 200,
  maxJoinedLeagues: 100,
  maxActiveDuels: 100,
} as const;

export const QuestionLocaleContentSchema = z.object({
  prompt: z.string().min(3),
  options: z.array(z.string().min(1)).length(4),
  explanation: z.string().optional(),
});

export const QuestionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(QUESTION_TYPES),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  topics: z.array(z.string().min(1)).min(1),
  content: z.record(z.enum(LOCALES), QuestionLocaleContentSchema).or(
    z.object({
      en: QuestionLocaleContentSchema.optional(),
      es: QuestionLocaleContentSchema.optional(),
      pt: QuestionLocaleContentSchema.optional(),
      ro: QuestionLocaleContentSchema.optional(),
    }),
  ),
  answer: z.object({
    correctIndex: z.number().int().min(0).max(3).optional(),
  }),
  translationStatus: z.record(z.string(), z.enum(['missing', 'machine_draft', 'reviewed'])),
  source: z.enum(['human', 'ai_draft']),
  reviewStatus: z.enum(['draft', 'in_review', 'approved', 'rejected']),
  usageCount: z.number().int().min(0),
});

export type Question = z.infer<typeof QuestionSchema>;

// Multilingual blocklist (EN/ES/PT/RO) + common leetspeak normalization
const BLOCKLIST = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'nigger',
  'faggot',
  'nazi',
  'hitler',
  'puta',
  'mierda',
  'cabron',
  'caralho',
  'porra',
  'pula',
  'muie',
  'curva',
  'cacat',
  'fututi',
  'pizda',
];

function normalizeForModeration(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/[@$]/g, 'a')
    .replace(/[^a-z\p{L}]/gu, '');
}

const NICKNAME_REGEX = /^[\p{L}\p{N} _-]{2,20}$/u;

export function validateNickname(
  raw: string,
): { ok: true; value: string } | { ok: false; reason: string } {
  const normalized = raw.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 20) {
    return { ok: false, reason: 'length' };
  }
  if (!NICKNAME_REGEX.test(normalized)) {
    return { ok: false, reason: 'characters' };
  }
  const check = normalizeForModeration(normalized);
  for (const bad of BLOCKLIST) {
    if (check.includes(bad)) {
      return { ok: false, reason: 'blocked' };
    }
  }
  return { ok: true, value: normalized };
}

/** Deterministic PRNG (Mulberry32) from string seed */
export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function deterministicShuffle<T>(items: readonly T[], seed: string): T[] {
  const arr = [...items];
  let state = hashSeed(seed);
  const nextRand = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

export function generateInviteCode(randomFn: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    const idx = Math.floor(randomFn() * INVITE_CODE_ALPHABET.length);
    code += INVITE_CODE_ALPHABET[idx]!;
  }
  return code;
}

const LEAGUE_NAMES: Record<Locale, readonly string[]> = {
  en: [
    'Thursday Thunder',
    'Coffee Duelists',
    'Split Court Squad',
    'Midnight Sparks',
    'Brainy Bunch',
  ],
  es: ['Trueno Diario', 'Duelo de Café', 'Equipo Relámpago', 'Mentes Rápidas', 'Liga del Grupo'],
  pt: ['Trovão Diário', 'Duelo do Café', 'Esquadrão Relâmpago', 'Mentes Rápidas', 'Liga da Galera'],
  ro: ['Fulgerul Zilei', 'Duelul de Cafea', 'Gașca de Aur', 'Minți Rapide', 'Liga Prietenilor'],
};

export function suggestLeagueName(
  locale: Locale = 'en',
  randomFn: () => number = Math.random,
): string {
  const list = LEAGUE_NAMES[locale] ?? LEAGUE_NAMES.en;
  return list[Math.floor(randomFn() * list.length)]!;
}

/** Formats a Date into YYYY-MM-DD in the given IANA timezone. */
export function getLocalDateString(now: Date, tz: string): string {
  const safeTz = isValidTimeZone(tz) ? tz : 'UTC';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const y = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Days between two YYYY-MM-DD calendar dates (DST-safe using UTC noon). */
export function diffCalendarDays(dateA: string, dateB: string): number {
  const [ya, ma, da] = dateA.split('-').map(Number);
  const [yb, mb, db] = dateB.split('-').map(Number);
  const utcA = Date.UTC(ya!, ma! - 1, da!, 12, 0, 0);
  const utcB = Date.UTC(yb!, mb! - 1, db!, 12, 0, 0);
  return Math.round((utcB - utcA) / 86_400_000);
}

export function computeRoundNumber(date: string, launchDate = '2026-12-01'): number {
  const diff = diffCalendarDays(launchDate, date);
  return Math.max(1, diff + 1);
}

export function updateStreak(params: {
  lastPlayedDate?: string;
  currentDate: string;
  streakCurrent: number;
  streakBest: number;
}): { streakCurrent: number; streakBest: number } {
  const { lastPlayedDate, currentDate, streakCurrent, streakBest } = params;
  if (!lastPlayedDate) {
    return { streakCurrent: 1, streakBest: Math.max(streakBest, 1) };
  }
  const diff = diffCalendarDays(lastPlayedDate, currentDate);
  if (diff === 0) {
    return { streakCurrent, streakBest };
  }
  if (diff === 1) {
    const next = streakCurrent + 1;
    return { streakCurrent: next, streakBest: Math.max(streakBest, next) };
  }
  return { streakCurrent: 1, streakBest: Math.max(streakBest, 1) };
}

export interface ShareCardParams {
  roundNumber: number;
  totalScore: number;
  emojiLine: string;
  streak: number;
  inviteUrl: string;
}

export function buildShareCardText(params: ShareCardParams): string {
  const scoreFormatted = params.totalScore.toLocaleString('en-US');
  const lines = [
    `RonDuel #${params.roundNumber} ⚔️ ${scoreFormatted}`,
    params.emojiLine,
    `🔥 ${params.streak}-day streak`,
    `Beat me → ${params.inviteUrl}`,
  ];
  return lines.join('\n');
}

export function pickWeeklyWinner(
  entries: ReadonlyArray<{ uid: string; score: number; totalMs: number }>,
): { uid: string; score: number; totalMs: number } | null {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.totalMs - b.totalMs;
  });
  return sorted[0] ?? null;
}

export function getQuestionTypeLabel(type: QuestionType): string {
  return type;
}
