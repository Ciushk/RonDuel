import { describe, expect, it } from 'vitest';

import {
  buildShareCardText,
  computeRoundNumber,
  deterministicShuffle,
  generateInviteCode,
  getLocalDateString,
  INVITE_CODE_ALPHABET,
  pickWeeklyWinner,
  updateStreak,
  validateNickname,
} from './schemas.js';

describe('validateNickname', () => {
  it('accepts valid Unicode nicknames and normalizes whitespace', () => {
    expect(validateNickname('  Ștefan_99  ')).toEqual({ ok: true, value: 'Ștefan_99' });
  });

  it('rejects too short or too long nicknames', () => {
    expect(validateNickname('a').ok).toBe(false);
    expect(validateNickname('a'.repeat(21)).ok).toBe(false);
  });

  it('rejects multilingual blocklist and leetspeak variants', () => {
    expect(validateNickname('sh1t_happens').ok).toBe(false);
    expect(validateNickname('p1zda').ok).toBe(false);
    expect(validateNickname('C4C4T').ok).toBe(false);
  });
});

describe('deterministicShuffle', () => {
  it('produces identical order for the same seed', () => {
    const a = deterministicShuffle(['A', 'B', 'C', 'D'], '2026-12-01:q-mcq-01');
    const b = deterministicShuffle(['A', 'B', 'C', 'D'], '2026-12-01:q-mcq-01');
    expect(a).toEqual(b);
  });
});

describe('streak & timezone logic', () => {
  it('increments streak across consecutive days including DST transitions', () => {
    const res = updateStreak({
      lastPlayedDate: '2026-03-28',
      currentDate: '2026-03-29',
      streakCurrent: 4,
      streakBest: 4,
    });
    expect(res).toEqual({ streakCurrent: 5, streakBest: 5 });
  });

  it('resets streak when a day is missed', () => {
    const res = updateStreak({
      lastPlayedDate: '2026-03-28',
      currentDate: '2026-03-30',
      streakCurrent: 4,
      streakBest: 7,
    });
    expect(res).toEqual({ streakCurrent: 1, streakBest: 7 });
  });

  it('computes local date across timezones accurately', () => {
    const instant = new Date('2026-12-01T23:30:00Z');
    expect(getLocalDateString(instant, 'Europe/Bucharest')).toBe('2026-12-02');
    expect(getLocalDateString(instant, 'America/Sao_Paulo')).toBe('2026-12-01');
  });

  it('computes round number from launch date', () => {
    expect(computeRoundNumber('2026-12-01', '2026-12-01')).toBe(1);
    expect(computeRoundNumber('2026-12-05', '2026-12-01')).toBe(5);
  });
});

describe('invite code, share card, and weekly winner', () => {
  it('generates 6-char invite codes from the allowed alphabet', () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(6);
    for (const ch of code) {
      expect(INVITE_CODE_ALPHABET).toContain(ch);
    }
  });

  it('formats spoiler-free share card', () => {
    const text = buildShareCardText({
      roundNumber: 142,
      totalScore: 1040,
      emojiLine: '⚡🟩⚡🟥🟩⚡',
      streak: 12,
      inviteUrl: 'https://ronduel.eu/l/K7Q2XM?r=u_ab12',
    });
    expect(text).toContain('RonDuel #142 ⚔️ 1,040');
    expect(text).toContain('⚡🟩⚡🟥🟩⚡');
    expect(text).toContain('🔥 12-day streak');
  });

  it('breaks weekly winner ties by lower totalMs', () => {
    const winner = pickWeeklyWinner([
      { uid: 'u1', score: 6420, totalMs: 42_000 },
      { uid: 'u2', score: 6420, totalMs: 38_500 },
      { uid: 'u3', score: 5900, totalMs: 30_000 },
    ]);
    expect(winner?.uid).toBe('u2');
  });
});
