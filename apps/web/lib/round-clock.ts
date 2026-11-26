/**
 * Timezone-accurate round countdown helpers.
 * Daily rounds roll over at local midnight (00:00:00) in the player's IANA time zone
 * (matching `getLocalDateString(now, tz)`), including 23-hour and 25-hour DST days.
 */

interface ZonedWallParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function resolveSafeTimeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date(0));
    return tz;
  } catch {
    return 'UTC';
  }
}

function getZonedWallParts(date: Date, timeZone: string): ZonedWallParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  let year = 0;
  let month = 1;
  let day = 1;
  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const part of parts) {
    if (part.type === 'year') year = Number(part.value);
    else if (part.type === 'month') month = Number(part.value);
    else if (part.type === 'day') day = Number(part.value);
    else if (part.type === 'hour') hour = Number(part.value) % 24;
    else if (part.type === 'minute') minute = Number(part.value);
    else if (part.type === 'second') second = Number(part.value);
  }

  return { year, month, day, hour, minute, second };
}

function zonedMidnightUtcMs(year: number, month: number, day: number, timeZone: string): number {
  const targetWallUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let candidate = targetWallUtc;

  // Two-pass fixed-point iteration converges accurately even across DST transitions
  for (let i = 0; i < 3; i += 1) {
    const parts = getZonedWallParts(new Date(candidate), timeZone);
    const actualWallUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const diff = actualWallUtc - targetWallUtc;
    if (diff === 0) break;
    candidate -= diff;
  }

  return candidate;
}

/**
 * Returns the YYYY-MM-DD calendar date in `tz` for `now`.
 */
export function getLocalDateKey(now: Date = new Date(), tz: string = 'UTC'): string {
  const safeTz = resolveSafeTimeZone(tz);
  const { year, month, day } = getZonedWallParts(now, safeTz);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Returns the whole number of seconds until the next 00:00:00 in `tz`.
 */
export function getSecondsUntilMidnight(now: Date = new Date(), tz: string = 'UTC'): number {
  const safeTz = resolveSafeTimeZone(tz);
  const current = getZonedWallParts(now, safeTz);
  const nextDateUtc = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
  const nextMidnightMs = zonedMidnightUtcMs(
    nextDateUtc.getUTCFullYear(),
    nextDateUtc.getUTCMonth() + 1,
    nextDateUtc.getUTCDate(),
    safeTz,
  );
  return Math.max(0, Math.floor((nextMidnightMs - now.getTime()) / 1000));
}

export function getCountdownParts(totalSeconds: number): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  return { hours, minutes, seconds };
}

export function formatCountdown(totalSeconds: number): string {
  const { hours, minutes, seconds } = getCountdownParts(totalSeconds);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
