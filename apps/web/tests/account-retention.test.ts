import { describe, expect, it } from 'vitest';

import { planAccountMerge } from '../lib/account-merge';
import {
  ANON_RETENTION_DAYS,
  ANON_RETENTION_MS,
  runAnonymousPurge,
  shouldPurgeAnonymousUser,
} from '../lib/anon-retention';
import { formatUserDoc } from '../lib/user-doc';

const CREATED = '2026-01-01T00:00:00.000Z';
const CREATED_MS = new Date(CREATED).getTime();

describe('formatUserDoc expiry', () => {
  it('sets anonymous expiresAt to createdAt plus 7 days', () => {
    const doc = formatUserDoc(
      {
        uid: 'anon',
        isAnonymous: true,
        createdAt: CREATED,
        nickname: 'Guest',
      },
      CREATED_MS,
    );
    expect(ANON_RETENTION_DAYS).toBe(7);
    expect(doc.isAnonymous).toBe(true);
    expect(doc.expiresAt).toEqual(new Date(CREATED_MS + ANON_RETENTION_MS));
  });

  it('does not extend expiresAt when the user is active later', () => {
    const first = formatUserDoc({ uid: 'anon', isAnonymous: true, createdAt: CREATED }, CREATED_MS);
    const later = CREATED_MS + 3 * 24 * 60 * 60 * 1000;
    const second = formatUserDoc(
      {
        uid: 'anon',
        isAnonymous: true,
        createdAt: CREATED,
        expiresAt: (first.expiresAt as Date).toISOString(),
      },
      later,
    );
    expect(second.expiresAt).toEqual(first.expiresAt);
  });

  it('keeps an already expired anonymous expiresAt instead of renewing it', () => {
    const expired = new Date(CREATED_MS + ANON_RETENTION_MS).toISOString();
    const doc = formatUserDoc(
      {
        uid: 'anon',
        isAnonymous: true,
        createdAt: CREATED,
        expiresAt: expired,
      },
      CREATED_MS + 30 * 24 * 60 * 60 * 1000,
    );
    expect(doc.expiresAt).toEqual(new Date(expired));
  });

  it('clears expiresAt for an account with email', () => {
    const doc = formatUserDoc({
      uid: 'saved',
      isAnonymous: false,
      email: 'player@example.com',
      createdAt: CREATED,
      expiresAt: new Date(CREATED_MS + ANON_RETENTION_MS).toISOString(),
    });
    expect(doc.isAnonymous).toBe(false);
    expect(doc.expiresAt).toBeNull();
    expect(doc.email).toBe('player@example.com');
  });

  it('still reads a legacy string expiresAt', () => {
    const legacy = new Date(CREATED_MS + ANON_RETENTION_MS).toISOString();
    const doc = formatUserDoc({
      uid: 'anon',
      isAnonymous: true,
      createdAt: CREATED,
      expiresAt: legacy,
    });
    expect(doc.expiresAt).toEqual(new Date(legacy));
  });
});

describe('planAccountMerge', () => {
  const source = {
    uid: 'anon',
    nickname: 'Guest',
    streakCurrent: 4,
    streakBest: 9,
    leagueIds: ['lg_world', 'lg_friends'],
    freezes: 1,
    isAnonymous: true,
    pro: { active: true, isTrial: true, plan: 'yearly' as const },
  };
  const target = {
    uid: 'saved',
    nickname: 'Andrei',
    email: 'andrei@example.com',
    streakCurrent: 2,
    streakBest: 6,
    leagueIds: ['lg_world', 'lg_work'],
    freezes: 0,
    isAnonymous: false,
    pro: { active: false },
  };

  it('keeps the saved uid and combines plays, streak, leagues, and duels', () => {
    const plan = planAccountMerge({
      source,
      target,
      nowIso: '2026-01-08T00:00:00.000Z',
      provider: 'google',
      plays: [
        { playId: '2026-01-08_anon', uid: 'anon', date: '2026-01-08' },
        { playId: '2026-01-07_saved', uid: 'saved', date: '2026-01-07' },
        { playId: '2026-01-07_anon', uid: 'anon', date: '2026-01-07' },
      ],
      duels: [
        { id: 'd1', challengerUid: 'anon', opponentUid: 'other' },
        { id: 'd2', challengerUid: 'saved', opponentUid: 'anon' },
      ],
    });

    expect(plan.deleteUid).toBe('anon');
    expect(plan.target.uid).toBe('saved');
    expect(plan.target.nickname).toBe('Andrei');
    expect(plan.target.email).toBe('andrei@example.com');
    expect(plan.target.isAnonymous).toBe(false);
    expect(plan.target.authProvider).toBe('google.com');
    expect(plan.target.expiresAt).toBeNull();
    expect(plan.target.upgradedAt).toBe('2026-01-08T00:00:00.000Z');
    expect(plan.target.streakCurrent).toBe(4);
    expect(plan.target.streakBest).toBe(9);
    expect(plan.target.freezes).toBe(1);
    expect(plan.target.leagueIds.sort()).toEqual(['lg_friends', 'lg_work', 'lg_world']);
    expect(plan.target.pro?.isTrial).toBe(true);
    expect(plan.playReassignments).toEqual([
      { playId: '2026-01-08_anon', uid: 'saved', date: '2026-01-08' },
    ]);
    expect(plan.duelRepoints).toEqual([
      { id: 'd1', challengerUid: 'saved', opponentUid: 'other' },
      { id: 'd2', challengerUid: 'saved', opponentUid: 'saved' },
    ]);
  });
});

describe('anonymous purge query', () => {
  it('deletes an expired guest and their data, and never a user with email', async () => {
    const now = new Date('2026-01-08T12:00:00.000Z');
    const users: Record<
      string,
      { isAnonymous: boolean; email?: string; expiresAt: string; leagueIds?: string[] }
    > = {
      anon: {
        isAnonymous: true,
        expiresAt: '2026-01-08T00:00:00.000Z',
        leagueIds: ['lg_friends'],
      },
      fresh: {
        isAnonymous: true,
        expiresAt: '2026-01-20T00:00:00.000Z',
      },
      saved: {
        isAnonymous: false,
        email: 'player@example.com',
        expiresAt: '2020-01-01T00:00:00.000Z',
      },
      mislabeled: {
        isAnonymous: true,
        email: 'still@example.com',
        expiresAt: '2020-01-01T00:00:00.000Z',
      },
    };
    const plays: Record<string, { uid: string }> = {
      pAnon: { uid: 'anon' },
      pSaved: { uid: 'saved' },
    };
    const duels: Record<string, { challengerUid: string; opponentUid: string | null }> = {
      d1: { challengerUid: 'anon', opponentUid: 'saved' },
      d2: { challengerUid: 'saved', opponentUid: 'fresh' },
    };
    const reports: Record<string, { reporterUid: string }> = { r1: { reporterUid: 'anon' } };
    const shareCards: Record<string, { uid: string }> = { s1: { uid: 'anon' } };
    const members = new Set([
      'leagues/lg_friends/members/anon',
      'leagues/lg_friends/members/saved',
    ]);
    const auth = new Set(['anon', 'fresh', 'saved', 'mislabeled']);

    const result = await runAnonymousPurge({
      now,
      batchSize: 400,
      loadCandidates: async (clock) =>
        Object.entries(users)
          .filter(([, data]) => data.isAnonymous === true)
          .filter(([, data]) => new Date(data.expiresAt).getTime() <= clock.getTime())
          .map(([id, data]) => ({ id, data })),
      deleteUser: async (uid, data) => {
        expect(shouldPurgeAnonymousUser(data, now)).toBe(true);
        expect(data.email).toBeFalsy();
        delete users[uid];
        for (const [id, play] of Object.entries(plays)) {
          if (play.uid === uid) delete plays[id];
        }
        for (const [id, duel] of Object.entries(duels)) {
          if (duel.challengerUid === uid || duel.opponentUid === uid) delete duels[id];
        }
        for (const [id, report] of Object.entries(reports)) {
          if (report.reporterUid === uid) delete reports[id];
        }
        for (const [id, card] of Object.entries(shareCards)) {
          if (card.uid === uid) delete shareCards[id];
        }
        const leagueIds = Array.isArray(data.leagueIds) ? data.leagueIds.map(String) : [];
        for (const leagueId of leagueIds) {
          members.delete(`leagues/${leagueId}/members/${uid}`);
        }
        auth.delete(uid);
      },
    });

    expect(result.deletedCount).toBe(1);
    expect(result.skippedWithEmail).toBe(1);
    expect(users.anon).toBeUndefined();
    expect(users.fresh?.isAnonymous).toBe(true);
    expect(users.saved?.email).toBe('player@example.com');
    expect(users.mislabeled?.email).toBe('still@example.com');
    expect(plays.pAnon).toBeUndefined();
    expect(plays.pSaved?.uid).toBe('saved');
    expect(duels.d1).toBeUndefined();
    expect(duels.d2?.challengerUid).toBe('saved');
    expect(reports.r1).toBeUndefined();
    expect(shareCards.s1).toBeUndefined();
    expect(members.has('leagues/lg_friends/members/anon')).toBe(false);
    expect(members.has('leagues/lg_friends/members/saved')).toBe(true);
    expect(auth.has('anon')).toBe(false);
    expect(auth.has('saved')).toBe(true);
  });
});
