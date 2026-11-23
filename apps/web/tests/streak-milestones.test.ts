import { describe, expect, it } from 'vitest';

import {
  formatCountdown,
  isStreakMilestone,
  msUntilNextLocalMidnight,
  nextStreakMilestone,
  stripEmoji,
} from '../lib/streak-milestones';

describe('streak milestones', () => {
  it('detects milestones 3, 7 and 30', () => {
    expect([1, 2, 3, 4, 7, 29, 30, 31].filter(isStreakMilestone)).toEqual([3, 7, 30]);
  });
  it('finds the next milestone', () => {
    expect(nextStreakMilestone(0)).toBe(3);
    expect(nextStreakMilestone(3)).toBe(7);
    expect(nextStreakMilestone(7)).toBe(30);
    expect(nextStreakMilestone(30)).toBeNull();
  });
});

describe('countdown helpers', () => {
  it('formats hh:mm:ss', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(3_661_000)).toBe('01:01:01');
    expect(formatCountdown(-5)).toBe('00:00:00');
  });
  it('counts to the next local midnight', () => {
    const now = new Date(2026, 10, 23, 23, 0, 0);
    expect(msUntilNextLocalMidnight(now)).toBe(3_600_000);
  });
  it('strips emoji from theme labels', () => {
    expect(stripEmoji('Numbers & Nature 🔢')).toBe('Numbers & Nature');
    expect(stripEmoji('Speed & Space 🚀')).toBe('Speed & Space');
  });
});
