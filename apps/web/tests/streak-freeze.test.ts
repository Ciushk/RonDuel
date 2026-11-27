import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  finishRound,
  getOrCreateUser,
  getStore,
  getTodayStatus,
  getUserProfile,
  resetUserStreak,
  startRound,
  useStreakFreeze,
  type PlayRecord,
} from '../lib/server-store';
import {
  computeStreakBackfillFromPlays,
  computeStreakSnapshot,
  getLocalHourInTz,
  parseBackfillArgs,
} from '../lib/streak-logic';

function resetTestStore() {
  const store = getStore();
  for (const key of Object.keys(store.users)) delete store.users[key];
  for (const key of Object.keys(store.plays)) delete store.plays[key];
}

describe('Streak, freeze, timezone, deduplication, and backfill logic', () => {
  beforeEach(() => {
    resetTestStore();
  });

  afterEach(() => {
    resetTestStore();
  });

  it('getStore() never seeds demo user u_andrei89', () => {
    const store = getStore();
    expect(store.users['u_andrei89']).toBeUndefined();
  });

  it('useStreakFreeze covers 1 missed day from inventory and is idempotent on repeat calls', () => {
    const uid = 'u_freeze_inv_1';
    const user = getOrCreateUser({ uid, tz: 'Europe/Bucharest', nickname: 'Ana' });
    user.streakCurrent = 5;
    user.streakBest = 10;
    user.lastPlayedDate = '2026-11-25';
    user.freezes = 2;

    const now = new Date('2026-11-27T10:00:00+02:00');
    const first = useStreakFreeze({ uid, tz: 'Europe/Bucharest', now });
    expect(first.ok).toBe(true);
    expect(first.noop).toBe(false);
    expect(first.source).toBe('inventory');
    expect(first.coveredDate).toBe('2026-11-26');
    expect(first.freezes).toBe(1);
    expect(first.streakCurrent).toBe(5); // Does not increment streak until today is played
    expect(first.lastPlayedDate).toBe('2026-11-26');
    expect(first.frozenDates).toContain('2026-11-26');

    // Second call is an idempotent no-op and does NOT consume a second freeze
    const second = useStreakFreeze({ uid, tz: 'Europe/Bucharest', now });
    expect(second.ok).toBe(true);
    expect(second.noop).toBe(true);
    expect(second.freezes).toBe(1);
    expect(user.freezes).toBe(1);
  });

  it('useStreakFreeze uses Pro weekly shield when inventory freezes === 0', () => {
    const uid = 'u_freeze_pro_shield';
    const user = getOrCreateUser({ uid, tz: 'Europe/Bucharest', nickname: 'ProPlayer' });
    user.pro = { active: true, plan: 'monthly' };
    user.streakCurrent = 7;
    user.streakBest = 7;
    user.lastPlayedDate = '2026-11-25';
    user.freezes = 0;
    user.streakShieldUsedWeek = undefined;

    const now = new Date('2026-11-27T10:00:00+02:00');
    const res = useStreakFreeze({ uid, tz: 'Europe/Bucharest', now });
    expect(res.ok).toBe(true);
    expect(res.noop).toBe(false);
    expect(res.source).toBe('weekly_shield');
    expect(res.freezes).toBe(0);
    expect(res.weeklyShieldAvailable).toBe(false);
    expect(res.lastPlayedDate).toBe('2026-11-26');
    expect(user.streakShieldUsedWeek).toBe('2026-W48');
    expect(user.frozenDates).toContain('2026-11-26');
  });

  it('useStreakFreeze returns 409 NOT_ENOUGH_FREEZES when 1 day missed and no freeze/shield', () => {
    const uid = 'u_freeze_empty';
    const user = getOrCreateUser({ uid, tz: 'Europe/Bucharest', nickname: 'NoFreeze' });
    user.streakCurrent = 4;
    user.lastPlayedDate = '2026-11-25';
    user.freezes = 0;

    const now = new Date('2026-11-27T10:00:00+02:00');
    expect(() => useStreakFreeze({ uid, tz: 'Europe/Bucharest', now })).toThrowError(
      /NOT_ENOUGH_FREEZES/,
    );
    expect(user.lastPlayedDate).toBe('2026-11-25');
    expect(user.freezes).toBe(0);
    expect(user.frozenDates ?? []).toEqual([]);
  });

  it('useStreakFreeze strictly rejects 2+ missed days (409 TOO_MANY_MISSED_DAYS) and consumes 0 freezes/shields', () => {
    const uid = 'u_freeze_two_missed';
    const user = getOrCreateUser({ uid, tz: 'Europe/Bucharest', nickname: 'MissedTwo' });
    user.pro = { active: true, plan: 'monthly' };
    user.streakCurrent = 8;
    user.streakBest = 12;
    user.lastPlayedDate = '2026-11-24'; // missed Nov 25 & Nov 26
    user.freezes = 5;
    user.streakShieldUsedWeek = undefined;

    const now = new Date('2026-11-27T10:00:00+02:00');
    expect(() => useStreakFreeze({ uid, tz: 'Europe/Bucharest', now })).toThrowError(
      /TOO_MANY_MISSED_DAYS/,
    );
    expect(user.freezes).toBe(5);
    expect(user.streakShieldUsedWeek).toBeUndefined();
    expect(user.frozenDates ?? []).toEqual([]);
    expect(user.lastPlayedDate).toBe('2026-11-24');
  });

  it('auto-applies 1 freeze when player starts and finishes today directly after 1 missed day', () => {
    const uid = 'u_auto_apply';
    const user = getOrCreateUser({ uid, tz: 'Europe/Bucharest', nickname: 'AutoPlayer' });
    user.streakCurrent = 5;
    user.streakBest = 5;
    user.lastPlayedDate = '2026-11-25';
    user.freezes = 2;

    const now = new Date('2026-11-27T11:00:00+02:00');
    const started = startRound({
      uid,
      tz: 'Europe/Bucharest',
      locale: 'ro',
      now,
    });
    expect(started.alreadyFinished).toBe(false);
    expect(started.freezeAutoUsed).toBe(true);
    expect(user.freezes).toBe(1);
    expect(user.lastPlayedDate).toBe('2026-11-26');
    expect(user.frozenDates).toContain('2026-11-26');

    const finished = finishRound(uid, started.playId, undefined, 'Europe/Bucharest', now);
    expect(finished.streakCurrent).toBe(6);
    expect(finished.streakBest).toBe(6);
    expect(finished.freezeAutoUsed).toBe(true);
    expect(user.freezes).toBe(1); // Never double-consumed on finish!

    const status = getTodayStatus(uid, 'Europe/Bucharest', undefined, now);
    expect(status.freezeAutoUsed).toBe(true);
    expect(status.streakCurrent).toBe(6);
    expect(status.streakIncreasedToday).toBe(true);
    expect(status.streakBeforeToday).toBe(5);
    expect(status.missedDays).toBe(0);

    // One-shot toast flag cleared after first read
    const statusSecondRead = getTodayStatus(uid, 'Europe/Bucharest', undefined, now);
    expect(statusSecondRead.freezeAutoUsed).toBe(false);
  });

  it('manual useStreakFreeze followed by startRound + finishRound never consumes a second freeze', () => {
    const uid = 'u_manual_then_play';
    const user = getOrCreateUser({ uid, tz: 'Europe/Bucharest', nickname: 'ManualPlayer' });
    user.streakCurrent = 5;
    user.streakBest = 5;
    user.lastPlayedDate = '2026-11-25';
    user.freezes = 2;

    const now = new Date('2026-11-27T11:00:00+02:00');
    useStreakFreeze({ uid, tz: 'Europe/Bucharest', now });
    expect(user.freezes).toBe(1);

    const started = startRound({ uid, tz: 'Europe/Bucharest', locale: 'ro', now });
    expect(started.freezeAutoUsed).toBe(false);
    expect(user.freezes).toBe(1);

    const finished = finishRound(uid, started.playId, undefined, 'Europe/Bucharest', now);
    expect(finished.streakCurrent).toBe(6);
    expect(user.freezes).toBe(1);
  });

  it('playing today after 2+ missed days resets streak to 1 and consumes 0 freezes or shields', () => {
    const uid = 'u_two_missed_play';
    const user = getOrCreateUser({ uid, tz: 'Europe/Bucharest', nickname: 'TwoMissed' });
    user.pro = { active: true, plan: 'monthly' };
    user.streakCurrent = 9;
    user.streakBest = 9;
    user.lastPlayedDate = '2026-11-24'; // missed 25 and 26
    user.freezes = 4;
    user.streakShieldUsedWeek = undefined;

    const now = new Date('2026-11-27T12:00:00+02:00');
    const started = startRound({ uid, tz: 'Europe/Bucharest', locale: 'ro', now });
    expect(started.freezeAutoUsed).toBe(false);
    expect(user.freezes).toBe(4);
    expect(user.streakShieldUsedWeek).toBeUndefined();

    const finished = finishRound(uid, started.playId, undefined, 'Europe/Bucharest', now);
    expect(finished.streakCurrent).toBe(1);
    expect(finished.streakBest).toBe(9);
    expect(user.freezes).toBe(4);
    expect(user.streakShieldUsedWeek).toBeUndefined();
    expect(user.frozenDates ?? []).toEqual([]);
  });

  it('finishRound without existing play uses user.tz instead of UTC near midnight', () => {
    const uid = 'u_bucharest_midnight';
    const user = getOrCreateUser({ uid, tz: 'Europe/Bucharest', nickname: 'NightOwl' });
    user.streakCurrent = 4;
    user.streakBest = 4;
    user.lastPlayedDate = '2026-11-27';

    // 2026-11-28 00:30 in Europe/Bucharest is still 2026-11-27 22:30 UTC!
    const bucharestJustAfterMidnight = new Date('2026-11-28T00:30:00+02:00');
    const res = finishRound(
      uid,
      'play_cold_instance_no_date',
      undefined,
      'Europe/Bucharest',
      bucharestJustAfterMidnight,
    );
    expect(res.date).toBe('2026-11-28');
    expect(res.streakCurrent).toBe(5);
    expect(user.lastPlayedDate).toBe('2026-11-28');
  });

  it('resetUserStreak resets current streak to 0 while preserving streakBest and freezes', () => {
    const uid = 'u_reset_1';
    const user = getOrCreateUser({ uid, tz: 'Europe/Bucharest', nickname: 'Resetter' });
    user.streakCurrent = 6;
    user.streakBest = 14;
    user.lastPlayedDate = '2026-11-24';
    user.freezes = 3;

    const res = resetUserStreak({ uid });
    expect(res.ok).toBe(true);
    expect(res.streakCurrent).toBe(0);
    expect(res.streakBest).toBe(14);
    expect(res.freezes).toBe(3);
    expect(user.lastPlayedDate).toBeUndefined();
  });

  it('computeStreakSnapshot handles weekStrip, DST boundaries, and missedDays accurately', () => {
    // Spring-forward DST Sunday in Europe/Oslo (2026-03-29) & Europe/Bucharest (2026-03-29)
    const dstDate = new Date('2026-03-29T03:30:00+02:00');
    expect(getLocalHourInTz(dstDate, 'Europe/Oslo')).toBe(3);
    expect(getLocalHourInTz(dstDate, 'Europe/Bucharest')).toBe(4);

    const snap = computeStreakSnapshot({
      today: '2026-11-27', // Friday
      currentHour: 21,
      streakCurrent: 3,
      streakBest: 5,
      lastPlayedDate: '2026-11-25', // Wednesday (missed Thursday Nov 26)
      isPro: false,
      freezes: 1,
      frozenDates: [],
      playedDatesSet: new Set(['2026-11-23', '2026-11-24', '2026-11-25']),
      playedToday: false,
    });

    expect(snap.missedDays).toBe(1);
    expect(snap.canCoverMiss).toBe(true);
    expect(snap.freezesNeeded).toBe(1);
    expect(snap.streakAtRisk).toBe(false); // Missed-day card owns recovery, not late-evening risk banner
    expect(snap.weekStrip).toHaveLength(7);
    expect(snap.weekStrip.map((d) => d.state)).toEqual([
      'played', // Mon Nov 23
      'played', // Tue Nov 24
      'played', // Wed Nov 25
      'missed', // Thu Nov 26
      'today', // Fri Nov 27
      'upcoming', // Sat Nov 28
      'upcoming', // Sun Nov 29
    ]);
  });

  it('deduplicates dual-keyed plays (date_uid and uid_date) in getTodayStatus and getUserProfile', () => {
    const uid = 'u_dedup_1';
    const store = getStore();
    getOrCreateUser({ uid, tz: 'Europe/Bucharest', nickname: 'DedupUser' });

    const play: PlayRecord = {
      playId: `2026-11-27_${uid}`,
      uid,
      date: '2026-11-27',
      roundNumber: 42,
      locale: 'ro',
      relaxedTimer: false,
      status: 'finished',
      items: [],
      totalScore: 500,
      totalMs: 12000,
      emojiLine: '⚡🟩🟩🟩🟩🟥',
      finishedAt: '2026-11-27T09:00:00Z',
    };
    store.plays[`2026-11-27_${uid}`] = play;
    store.plays[`${uid}_2026-11-27`] = play;

    const status = getTodayStatus(
      uid,
      'Europe/Bucharest',
      undefined,
      new Date('2026-11-27T10:00:00+02:00'),
    );
    expect(status.finishedPlaysCount).toBe(1);

    const profile = getUserProfile(uid);
    expect(profile.playedDates).toHaveLength(1);
  });

  it('computeStreakBackfillFromPlays reconstructs u_andrei89 fixture (Nov 23-27 duplicate plays -> streak 5, best 12)', () => {
    const uid = 'u_andrei89';
    const fixturePlays = [
      // Dual-keyed duplicates + UTC timestamps around Europe/Bucharest timezone
      {
        playId: `2026-11-23_${uid}`,
        uid,
        date: '2026-11-23',
        status: 'finished',
        finishedAt: '2026-11-23T08:15:00Z',
      },
      {
        playId: `2026-11-23_${uid}`,
        uid,
        date: '2026-11-23',
        status: 'finished',
        finishedAt: '2026-11-23T08:15:00Z',
      },
      {
        playId: `2026-11-24_${uid}`,
        uid,
        date: '2026-11-24',
        status: 'finished',
        finishedAt: '2026-11-24T09:00:00Z',
      },
      {
        playId: `2026-11-25_${uid}`,
        uid,
        date: '2026-11-25',
        status: 'finished',
        finishedAt: '2026-11-25T10:00:00Z',
      },
      {
        playId: `2026-11-26_${uid}`,
        uid,
        date: '2026-11-26',
        status: 'finished',
        finishedAt: '2026-11-26T21:45:00Z',
      },
      {
        playId: `2026-11-27_${uid}`,
        uid,
        date: '2026-11-27',
        status: 'finished',
        finishedAt: '2026-11-26T22:15:00Z',
      }, // 00:15 Europe/Bucharest on Nov 27!
      { playId: `2026-11-27_${uid}`, uid, date: '2026-11-27', status: 'in_progress' },
    ];

    const result = computeStreakBackfillFromPlays({
      uid,
      tz: 'Europe/Bucharest',
      plays: fixturePlays,
      existingStreakBest: 12,
    });

    expect(result.lastPlayedDate).toBe('2026-11-27');
    expect(result.streakCurrent).toBe(5);
    expect(result.streakBest).toBe(12);
    expect(result.fromPlays).toBe(5);
  });

  it('parseBackfillArgs defaults to dry-run and requires explicit --apply', () => {
    expect(parseBackfillArgs(['--uid=u_andrei89'])).toEqual({
      uid: 'u_andrei89',
      all: false,
      apply: false,
    });
    expect(parseBackfillArgs(['--uid=u_andrei89', '--apply'])).toEqual({
      uid: 'u_andrei89',
      all: false,
      apply: true,
    });
    expect(parseBackfillArgs(['--all'])).toEqual({
      uid: undefined,
      all: true,
      apply: false,
    });
  });
});
