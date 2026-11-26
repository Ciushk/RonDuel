import { describe, expect, it } from 'vitest';

import { formatCountdown, getCountdownParts, getSecondsUntilMidnight } from '@/lib/round-clock';

describe('round-clock', () => {
  describe('getSecondsUntilMidnight', () => {
    it('computes exact seconds on a regular day in Europe/Oslo (CET, UTC+1)', () => {
      // 2026-01-15 10:30:15 CET == 09:30:15 UTC -> 13h 29m 45s until 2026-01-16 00:00:00 CET
      const now = new Date('2026-01-15T09:30:15Z');
      const sec = getSecondsUntilMidnight(now, 'Europe/Oslo');
      expect(sec).toBe(13 * 3600 + 29 * 60 + 45);
      expect(formatCountdown(sec)).toBe('13:29:45');
    });

    it('computes 1 second right before midnight in America/New_York (EST, UTC-5)', () => {
      // 2026-01-15 23:59:59 EST == 2026-01-16 04:59:59 UTC
      const now = new Date('2026-01-16T04:59:59Z');
      const sec = getSecondsUntilMidnight(now, 'America/New_York');
      expect(sec).toBe(1);
      expect(formatCountdown(sec)).toBe('00:00:01');
    });

    it('computes exact 23-hour day across Europe/Oslo spring-forward DST (2026-03-29)', () => {
      // 2026-03-29 00:00:00 CET (UTC+1) -> 2026-03-30 00:00:00 CEST (UTC+2) = 23 hours = 82,800s
      const startOfSpringDstDay = new Date('2026-03-28T23:00:00Z');
      const sec = getSecondsUntilMidnight(startOfSpringDstDay, 'Europe/Oslo');
      expect(sec).toBe(23 * 3600);
      expect(formatCountdown(sec)).toBe('23:00:00');

      // 00:30:00 CET -> 22h 30m 00s until midnight
      const halfHourIn = new Date('2026-03-28T23:30:00Z');
      expect(getSecondsUntilMidnight(halfHourIn, 'Europe/Oslo')).toBe(22 * 3600 + 30 * 60);
    });

    it('computes exact 25-hour day across Europe/Oslo fall-back DST (2026-10-25)', () => {
      // 2026-10-25 00:00:00 CEST (UTC+2) -> 2026-10-26 00:00:00 CET (UTC+1) = 25 hours = 90,000s
      const startOfFallDstDay = new Date('2026-10-24T22:00:00Z');
      const sec = getSecondsUntilMidnight(startOfFallDstDay, 'Europe/Oslo');
      expect(sec).toBe(25 * 3600);
      expect(formatCountdown(sec)).toBe('25:00:00');
    });

    it('computes exact 23-hour spring-forward and 25-hour fall-back days in America/New_York', () => {
      // 2026-03-08 00:00:00 EST (UTC-5) -> 2026-03-09 00:00:00 EDT (UTC-4) = 23 hours
      const nySpring = new Date('2026-03-08T05:00:00Z');
      expect(getSecondsUntilMidnight(nySpring, 'America/New_York')).toBe(23 * 3600);

      // 2026-11-01 00:00:00 EDT (UTC-4) -> 2026-11-02 00:00:00 EST (UTC-5) = 25 hours
      const nyFall = new Date('2026-11-01T04:00:00Z');
      expect(getSecondsUntilMidnight(nyFall, 'America/New_York')).toBe(25 * 3600);
    });

    it('falls back safely to UTC when given an invalid timezone string', () => {
      const now = new Date('2026-05-10T22:00:00Z');
      expect(getSecondsUntilMidnight(now, 'Mars/Olympus_Mons')).toBe(2 * 3600);
    });
  });

  describe('getCountdownParts & formatCountdown', () => {
    it('formats zero and negative values cleanly as 00:00:00', () => {
      expect(getCountdownParts(0)).toEqual({ hours: 0, minutes: 0, seconds: 0 });
      expect(formatCountdown(0)).toBe('00:00:00');
      expect(formatCountdown(-42)).toBe('00:00:00');
    });

    it('formats multi-digit hours, minutes, and seconds', () => {
      expect(getCountdownParts(3661)).toEqual({ hours: 1, minutes: 1, seconds: 1 });
      expect(formatCountdown(3661)).toBe('01:01:01');
      expect(formatCountdown(25 * 3600)).toBe('25:00:00');
    });
  });
});
