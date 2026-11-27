import { diffCalendarDays, getIsoWeekString, getLocalDateString } from '@ronduel/shared';

export type WeekStripDayState = 'played' | 'frozen' | 'missed' | 'today' | 'upcoming';

export interface WeekStripDay {
  date: string; // YYYY-MM-DD
  weekday: 'L' | 'M' | 'J' | 'V' | 'S' | 'D';
  state: WeekStripDayState;
}

export interface FreezeLedgerEntry {
  date: string;
  action: string;
  coveredDate?: string;
  source?: 'inventory' | 'weekly_shield';
  freezesAfter?: number;
}

export interface StreakUserLike {
  uid: string;
  tz?: string;
  pro?: { active: boolean };
  streakCurrent: number;
  streakBest: number;
  lastPlayedDate?: string;
  streakShieldUsedWeek?: string;
  freezes?: number;
  frozenDates?: string[];
  freezeLedger?: FreezeLedgerEntry[];
  freezeUsedYesterday?: boolean;
  streakBeforeToday?: number;
  streakIncreasedDate?: string;
}

export interface StreakSnapshot {
  today: string;
  diff: number;
  missedDays: number;
  uncoveredGapDates: string[];
  weeklyShieldAvailable: boolean;
  freezeAvailable: boolean;
  freezesNeeded: number;
  canCoverMiss: boolean;
  streakAlive: boolean;
  streakAtRisk: boolean;
  streakIncreasedToday: boolean;
  streakBeforeToday: number;
  weekStrip: WeekStripDay[];
}

export interface ApplyFreezeResult {
  ok: boolean;
  noop?: boolean;
  error?: 'TOO_MANY_MISSED_DAYS' | 'NOT_ENOUGH_FREEZES';
  status?: number;
  missedDays: number;
  coveredDate?: string;
  source?: 'inventory' | 'weekly_shield';
  freezes: number;
  weeklyShieldAvailable: boolean;
  streakCurrent: number;
  lastPlayedDate?: string;
  streakShieldUsedWeek?: string;
  frozenDates: string[];
  freezeLedger: FreezeLedgerEntry[];
}

const RO_WEEKDAY_LETTERS: readonly ('L' | 'M' | 'J' | 'V' | 'S' | 'D')[] = [
  'L',
  'M',
  'M',
  'J',
  'V',
  'S',
  'D',
];

const MAX_FROZEN_DATES = 60;

export function resolveSafeTimeZone(tz?: string | null): string {
  const candidate = typeof tz === 'string' && tz.trim() ? tz.trim() : 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date(0));
    return candidate;
  } catch {
    return 'UTC';
  }
}

/**
 * Returns local hour (0..23) in the given IANA timeZone without using `new Date(toLocaleString(...))`.
 */
export function getLocalHourInTz(now: Date = new Date(), tz?: string | null): number {
  const safeTz = resolveSafeTimeZone(tz);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTz,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  for (const part of parts) {
    if (part.type === 'hour') {
      const h = Number(part.value);
      if (Number.isFinite(h)) return h % 24;
    }
  }
  return 0;
}

/**
 * Shifts a YYYY-MM-DD calendar date by `deltaDays` purely in UTC calendar space (DST-safe).
 */
export function addCalendarDays(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + deltaDays));
  const yy = String(dt.getUTCFullYear()).padStart(4, '0');
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Returns ISO weekday index: 0 = Monday .. 6 = Sunday.
 */
export function getIsoWeekdayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  const day = dt.getUTCDay(); // 0 = Sun, 1 = Mon .. 6 = Sat
  return day === 0 ? 6 : day - 1;
}

export function normalizeFrozenDates(dates?: ReadonlyArray<string> | null): string[] {
  if (!Array.isArray(dates) || dates.length === 0) return [];
  const valid = new Set<string>();
  for (const d of dates) {
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      valid.add(d);
    }
  }
  const sorted = [...valid].sort();
  return sorted.length > MAX_FROZEN_DATES ? sorted.slice(-MAX_FROZEN_DATES) : sorted;
}

/**
 * Computes uncovered calendar days strictly between `lastPlayedDate` and `today`.
 */
export function getUncoveredGapDates(params: {
  lastPlayedDate?: string;
  today: string;
  frozenDates?: ReadonlyArray<string>;
  playedDatesSet?: ReadonlySet<string>;
}): string[] {
  const { lastPlayedDate, today, frozenDates, playedDatesSet } = params;
  if (!lastPlayedDate || !/^\d{4}-\d{2}-\d{2}$/.test(lastPlayedDate)) return [];
  const diff = diffCalendarDays(lastPlayedDate, today);
  if (diff <= 1) return [];

  const frozenSet = new Set(normalizeFrozenDates(frozenDates));
  const gap: string[] = [];
  for (let offset = 1; offset < diff; offset += 1) {
    const day = addCalendarDays(lastPlayedDate, offset);
    if (!frozenSet.has(day) && !playedDatesSet?.has(day)) {
      gap.push(day);
    }
  }
  return gap;
}

/**
 * Computes streak status, missedDays, freeze availability (strictly 1 missed day max),
 * and the 7-day Monday->Sunday week strip for `getTodayStatus`.
 */
export function computeStreakSnapshot(params: {
  today: string;
  currentHour: number;
  streakCurrent: number;
  streakBest: number;
  lastPlayedDate?: string;
  isPro: boolean;
  freezes: number;
  streakShieldUsedWeek?: string;
  frozenDates?: ReadonlyArray<string>;
  playedDatesSet: ReadonlySet<string>;
  playedToday: boolean;
  streakBeforeToday?: number;
  streakIncreasedDate?: string;
}): StreakSnapshot {
  const {
    today,
    currentHour,
    streakCurrent,
    lastPlayedDate,
    isPro,
    freezes,
    streakShieldUsedWeek,
    playedDatesSet,
    playedToday,
  } = params;

  const frozenList = normalizeFrozenDates(params.frozenDates);
  const frozenSet = new Set(frozenList);

  const effectiveLastPlayed =
    lastPlayedDate && /^\d{4}-\d{2}-\d{2}$/.test(lastPlayedDate) ? lastPlayedDate : undefined;

  const diff = effectiveLastPlayed ? Math.max(0, diffCalendarDays(effectiveLastPlayed, today)) : 0;

  const uncoveredGapDates =
    streakCurrent > 0 && effectiveLastPlayed && !playedToday
      ? getUncoveredGapDates({
          lastPlayedDate: effectiveLastPlayed,
          today,
          frozenDates: frozenList,
          playedDatesSet,
        })
      : [];

  const missedDays = uncoveredGapDates.length;
  const currentIsoWeek = getIsoWeekString(today);
  const weeklyShieldAvailable = Boolean(isPro && streakShieldUsedWeek !== currentIsoWeek);
  const safeFreezes = Math.max(0, Math.floor(freezes || 0));

  // Strict rule: a freeze or weekly shield covers ONLY 1 missed day, never 2+.
  const freezesNeeded = missedDays === 1 ? 1 : 0;
  const freezeAvailable = missedDays === 1 && (safeFreezes > 0 || weeklyShieldAvailable);
  const canCoverMiss = freezeAvailable;

  const streakAlive = streakCurrent > 0 && (playedToday || diff <= 1 || missedDays === 0);

  // Classic late-evening warning: only when streak is alive (missedDays === 0), not played today,
  // diff === 1, local hour >= 20, and no freeze/shield available.
  const streakAtRisk =
    missedDays === 0 &&
    !playedToday &&
    streakCurrent > 0 &&
    diff === 1 &&
    currentHour >= 20 &&
    safeFreezes === 0 &&
    !weeklyShieldAvailable;

  const streakIncreasedToday =
    playedToday &&
    (params.streakIncreasedDate === today || effectiveLastPlayed === today) &&
    streakCurrent >= 1;

  const streakBeforeToday = streakIncreasedToday
    ? typeof params.streakBeforeToday === 'number' && params.streakIncreasedDate === today
      ? params.streakBeforeToday
      : Math.max(0, streakCurrent - 1)
    : streakCurrent;

  // Build implied played dates from active streak when older store_plays aren't loaded in memory
  const impliedPlayed = new Set<string>(playedDatesSet);
  if (effectiveLastPlayed && streakCurrent > 0) {
    let cursor = effectiveLastPlayed;
    let remaining = Math.min(streakCurrent, 30);
    let safety = 0;
    while (remaining > 0 && safety < 60) {
      safety += 1;
      if (!frozenSet.has(cursor)) {
        impliedPlayed.add(cursor);
        remaining -= 1;
      }
      cursor = addCalendarDays(cursor, -1);
    }
  }

  // Earliest known activity date so days before the user started are never marked "missed"
  let firstActivityDate: string | null = null;
  for (const d of impliedPlayed) {
    if (!firstActivityDate || d < firstActivityDate) firstActivityDate = d;
  }
  for (const d of frozenSet) {
    if (!firstActivityDate || d < firstActivityDate) firstActivityDate = d;
  }

  // 7-day strip: current ISO week Monday (0) -> Sunday (6) containing `today`
  const todayDow = getIsoWeekdayIndex(today);
  const mondayDate = addCalendarDays(today, -todayDow);
  const weekStrip: WeekStripDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = addCalendarDays(mondayDate, i);
    const weekday = RO_WEEKDAY_LETTERS[i]!;
    let state: WeekStripDayState;
    if (d > today) {
      state = 'upcoming';
    } else if (d === today) {
      state = playedToday || playedDatesSet.has(d) ? 'played' : 'today';
    } else if (impliedPlayed.has(d)) {
      state = 'played';
    } else if (frozenSet.has(d)) {
      state = 'frozen';
    } else if (firstActivityDate && d >= firstActivityDate) {
      state = 'missed';
    } else {
      state = 'upcoming';
    }
    weekStrip.push({ date: d, weekday, state });
  }

  return {
    today,
    diff,
    missedDays,
    uncoveredGapDates,
    weeklyShieldAvailable,
    freezeAvailable,
    freezesNeeded,
    canCoverMiss,
    streakAlive,
    streakAtRisk,
    streakIncreasedToday,
    streakBeforeToday,
    weekStrip,
  };
}

/**
 * Pure state transition for consuming a single streak freeze (inventory preferred over Pro weekly shield).
 * Strictly enforces: 1 unit covers 1 missed day (`missedDays === 1`). Never covers 2+ missed days.
 */
export function computeFreezeApplication(params: {
  user: StreakUserLike;
  today: string;
  nowIso?: string;
  auto?: boolean;
  playedDatesSet?: ReadonlySet<string>;
}): ApplyFreezeResult {
  const { user, today, auto = false, playedDatesSet } = params;
  const nowIso = params.nowIso ?? new Date().toISOString();
  const safeFreezes = Math.max(0, Math.floor(user.freezes ?? 0));
  const frozenDates = normalizeFrozenDates(user.frozenDates);
  const freezeLedger = Array.isArray(user.freezeLedger) ? [...user.freezeLedger] : [];
  const currentIsoWeek = getIsoWeekString(today);
  const isPro = Boolean(user.pro?.active);
  const weeklyShieldAvailable = Boolean(isPro && user.streakShieldUsedWeek !== currentIsoWeek);

  if ((user.streakCurrent ?? 0) <= 0 || !user.lastPlayedDate) {
    return {
      ok: true,
      noop: true,
      missedDays: 0,
      freezes: safeFreezes,
      weeklyShieldAvailable,
      streakCurrent: user.streakCurrent ?? 0,
      lastPlayedDate: user.lastPlayedDate,
      streakShieldUsedWeek: user.streakShieldUsedWeek,
      frozenDates,
      freezeLedger,
    };
  }

  const gapDates = getUncoveredGapDates({
    lastPlayedDate: user.lastPlayedDate,
    today,
    frozenDates,
    playedDatesSet,
  });

  if (gapDates.length === 0) {
    return {
      ok: true,
      noop: true,
      missedDays: 0,
      freezes: safeFreezes,
      weeklyShieldAvailable,
      streakCurrent: user.streakCurrent,
      lastPlayedDate: user.lastPlayedDate,
      streakShieldUsedWeek: user.streakShieldUsedWeek,
      frozenDates,
      freezeLedger,
    };
  }

  if (gapDates.length >= 2) {
    return {
      ok: false,
      error: 'TOO_MANY_MISSED_DAYS',
      status: 409,
      missedDays: gapDates.length,
      freezes: safeFreezes,
      weeklyShieldAvailable,
      streakCurrent: user.streakCurrent,
      lastPlayedDate: user.lastPlayedDate,
      streakShieldUsedWeek: user.streakShieldUsedWeek,
      frozenDates,
      freezeLedger,
    };
  }

  // Exactly 1 missed day
  if (safeFreezes <= 0 && !weeklyShieldAvailable) {
    return {
      ok: false,
      error: 'NOT_ENOUGH_FREEZES',
      status: 409,
      missedDays: 1,
      freezes: safeFreezes,
      weeklyShieldAvailable: false,
      streakCurrent: user.streakCurrent,
      lastPlayedDate: user.lastPlayedDate,
      streakShieldUsedWeek: user.streakShieldUsedWeek,
      frozenDates,
      freezeLedger,
    };
  }

  const coveredDate = gapDates[0]!;
  // Prefer inventory freeze before weekly Pro shield so the weekly shield stays as a safety net
  const source: 'inventory' | 'weekly_shield' = safeFreezes > 0 ? 'inventory' : 'weekly_shield';
  const nextFreezes = source === 'inventory' ? safeFreezes - 1 : safeFreezes;
  const nextShieldWeek = source === 'weekly_shield' ? currentIsoWeek : user.streakShieldUsedWeek;
  const nextFrozenDates = normalizeFrozenDates([...frozenDates, coveredDate]);
  const nextLedger: FreezeLedgerEntry[] = [
    ...freezeLedger,
    {
      date: nowIso,
      action: auto ? 'auto_used' : 'used',
      coveredDate,
      source,
      freezesAfter: nextFreezes,
    },
  ];

  return {
    ok: true,
    noop: false,
    missedDays: 1,
    coveredDate,
    source,
    freezes: nextFreezes,
    weeklyShieldAvailable: Boolean(isPro && nextShieldWeek !== currentIsoWeek),
    streakCurrent: user.streakCurrent,
    lastPlayedDate: coveredDate,
    streakShieldUsedWeek: nextShieldWeek,
    frozenDates: nextFrozenDates,
    freezeLedger: nextLedger,
  };
}

export interface BackfillPlayLike {
  playId?: string;
  uid: string;
  date?: string;
  status?: string;
  finishedAt?: string;
}

export interface StreakBackfillResult {
  uid: string;
  lastPlayedDate: string | null;
  streakCurrent: number;
  streakBest: number;
  fromPlays: number;
  uniqueDates: string[];
}

/**
 * Pure backfill calculation from finished plays (deduplicated by playId / date).
 * Walks sorted local YYYY-MM-DD dates using the exact consecutive-day rule, respecting
 * existing `frozenDates` if present, without inventing past shields or freezes.
 */
export function computeStreakBackfillFromPlays(params: {
  uid: string;
  tz?: string | null;
  plays: ReadonlyArray<BackfillPlayLike>;
  existingStreakBest?: number;
  frozenDates?: ReadonlyArray<string>;
}): StreakBackfillResult {
  const safeTz = resolveSafeTimeZone(params.tz);
  const frozenSet = new Set(normalizeFrozenDates(params.frozenDates));
  const seenPlayKeys = new Set<string>();
  const uniqueDateSet = new Set<string>();

  for (const play of params.plays) {
    if (play.uid !== params.uid || play.status !== 'finished') continue;
    const dedupKey = play.playId || `${play.date ?? ''}_${play.uid}`;
    if (seenPlayKeys.has(dedupKey)) continue;
    seenPlayKeys.add(dedupKey);

    let localDate: string | null = null;
    if (play.finishedAt) {
      const parsed = new Date(play.finishedAt);
      if (!Number.isNaN(parsed.getTime())) {
        localDate = getLocalDateString(parsed, safeTz);
      }
    }
    if (!localDate && play.date && /^\d{4}-\d{2}-\d{2}$/.test(play.date)) {
      localDate = play.date;
    }
    if (localDate) {
      uniqueDateSet.add(localDate);
    }
  }

  const uniqueDates = [...uniqueDateSet].sort();
  if (uniqueDates.length === 0) {
    return {
      uid: params.uid,
      lastPlayedDate: null,
      streakCurrent: 0,
      streakBest: Math.max(0, params.existingStreakBest ?? 0),
      fromPlays: 0,
      uniqueDates: [],
    };
  }

  let streakCurrent = 0;
  let streakBest = Math.max(0, params.existingStreakBest ?? 0);
  let prevDate: string | null = null;

  for (const d of uniqueDates) {
    if (!prevDate) {
      streakCurrent = 1;
    } else {
      const diff = diffCalendarDays(prevDate, d);
      if (diff === 1) {
        streakCurrent += 1;
      } else if (diff === 2 && frozenSet.has(addCalendarDays(prevDate, 1))) {
        streakCurrent += 1;
      } else if (diff > 1) {
        streakCurrent = 1;
      }
    }
    if (streakCurrent > streakBest) streakBest = streakCurrent;
    prevDate = d;
  }

  return {
    uid: params.uid,
    lastPlayedDate: uniqueDates[uniqueDates.length - 1] ?? null,
    streakCurrent,
    streakBest,
    fromPlays: uniqueDates.length,
    uniqueDates,
  };
}

export interface BackfillCliOptions {
  uid?: string;
  all: boolean;
  apply: boolean;
}

export function parseBackfillArgs(argv: string[]): BackfillCliOptions {
  let uid: string | undefined;
  let all = false;
  let apply = false;

  for (const arg of argv) {
    if (arg === '--all') {
      all = true;
    } else if (arg === '--apply') {
      apply = true;
    } else if (arg.startsWith('--uid=')) {
      const value = arg.slice('--uid='.length).trim();
      if (value) uid = value;
    }
  }

  return { uid, all, apply };
}
