import { describe, expect, it } from 'vitest';

import { isAutoNickname, serverProfileToApply } from '../lib/onboarding-profile';
import {
  createLeague,
  getOrCreateUser,
  getStore,
  syncNicknameToLeagues,
} from '../lib/server-store';

describe('server profile onboarding', () => {
  it('adopts a confirmed server nickname when the session is still empty', () => {
    expect(
      serverProfileToApply({
        sessionNickname: '',
        sessionAgeConfirmed: false,
        serverNickname: 'Ciushk',
        serverAgeConfirmed: true,
      }),
    ).toEqual({ nickname: 'Ciushk', ageConfirmed16: true });
  });

  it('does not treat an auto nickname or a missing age confirmation as onboarding done', () => {
    expect(isAutoNickname('Player_ab12')).toBe(true);
    expect(isAutoNickname('Ciushk')).toBe(false);
    expect(
      serverProfileToApply({
        sessionNickname: '',
        sessionAgeConfirmed: false,
        serverNickname: 'Player_ab12',
        serverAgeConfirmed: true,
      }),
    ).toBeNull();
    expect(
      serverProfileToApply({
        sessionNickname: '',
        sessionAgeConfirmed: false,
        serverNickname: 'Ciushk',
        serverAgeConfirmed: false,
      }),
    ).toBeNull();
    expect(
      serverProfileToApply({
        sessionNickname: '',
        sessionAgeConfirmed: false,
        serverNickname: 'Ciushk',
        serverAgeConfirmed: undefined,
      }),
    ).toBeNull();
  });

  it('leaves a session that already has a nickname and age confirmation alone', () => {
    expect(
      serverProfileToApply({
        sessionNickname: 'Local',
        sessionAgeConfirmed: true,
        serverNickname: 'Server',
        serverAgeConfirmed: true,
      }),
    ).toBeNull();
  });
});

describe('league nickname sync and Pro member cap', () => {
  it('updates member and day nicknames only when the name changed', () => {
    const uid = `u_nick_${Date.now()}`;
    getOrCreateUser({ uid, nickname: 'Player_zz99' });
    const league = createLeague({
      uid,
      name: `Nick ${uid}`,
      tz: 'UTC',
      locale: 'en',
    });
    league.days['2026-11-01'] = {
      [uid]: {
        uid,
        nickname: 'Player_zz99',
        score: 100,
        totalMs: 1000,
        emojiLine: '🟩',
        relaxedTimer: false,
        finishedAt: '2026-11-01T12:00:00.000Z',
      },
    };
    const world = getStore().leagues['lg_world']!;
    world.members[uid]!.nickname = 'Player_zz99';

    getOrCreateUser({ uid, nickname: 'Ciushk' });
    expect(league.members[uid]?.nickname).toBe('Ciushk');
    expect(league.days['2026-11-01']?.[uid]?.nickname).toBe('Ciushk');
    expect(world.members[uid]?.nickname).toBe('Ciushk');

    expect(syncNicknameToLeagues(uid, 'Ciushk')).toBe(false);
  });

  it('gives Pro leagues 200 members and ignores a fake pro plan from a free user', () => {
    const freeUid = `u_free_${Date.now()}`;
    const free = getOrCreateUser({ uid: freeUid, nickname: 'FreePlayer' });
    free.pro = { active: false };
    const spoofed = createLeague({
      uid: freeUid,
      name: `Free ${freeUid}`,
      tz: 'UTC',
      locale: 'en',
      plan: 'pro',
    });
    expect(spoofed.maxMembers).toBe(5);

    const proUid = `u_pro_${Date.now()}`;
    const pro = getOrCreateUser({ uid: proUid, nickname: 'ProPlayer' });
    pro.pro = { active: true, plan: 'yearly' };
    const created = createLeague({
      uid: proUid,
      name: `Pro ${proUid}`,
      tz: 'UTC',
      locale: 'en',
      plan: 'free',
    });
    expect(created.maxMembers).toBe(200);

    const upgradeUid = `u_up_${Date.now()}`;
    const upgrading = getOrCreateUser({ uid: upgradeUid, nickname: 'LaterPro' });
    upgrading.pro = { active: false };
    const before = createLeague({
      uid: upgradeUid,
      name: `Later ${upgradeUid}`,
      tz: 'UTC',
      locale: 'en',
    });
    expect(before.maxMembers).toBe(5);
    upgrading.pro = { active: true, plan: 'monthly' };
    getOrCreateUser({ uid: upgradeUid });
    expect(before.maxMembers).toBe(200);
  });

  it('stores only known league theme colors', () => {
    const uid = `u_theme_${Date.now()}`;
    getOrCreateUser({ uid, nickname: 'ThemePlayer' });
    const league = createLeague({
      uid,
      name: `Theme ${uid}`,
      tz: 'UTC',
      locale: 'en',
      themeColor: 'javascript:alert(1)',
    });
    expect(league.themeColor).toBe('default');
  });
});
