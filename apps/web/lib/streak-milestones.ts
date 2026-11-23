/** Streak lengths that get a small celebration on the result screen. */
export const STREAK_MILESTONES = [3, 7, 30] as const;

export function isStreakMilestone(days: number): boolean {
  return (STREAK_MILESTONES as readonly number[]).includes(days);
}

/** Next milestone strictly above `days`, or null once the last one is reached. */
export function nextStreakMilestone(days: number): number | null {
  return STREAK_MILESTONES.find((m) => m > days) ?? null;
}

/** Milliseconds until the next local midnight (when the next round unlocks). */
export function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(total / 3600)).padStart(2, '0');
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/** Removes emoji from a theme label so it renders as plain text on every device. */
export function stripEmoji(text: string): string {
  return text.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s+/g, ' ').trim();
}
