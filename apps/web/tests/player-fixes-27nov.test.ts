import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { formatDurationShort } from '@/components/rontown/iso';
import { CATALOG_SPRITES, CROP_BUTTON_SPRITES } from '@/components/rontown/sprites';
import { NOT_FOUND_MESSAGES, resolveNotFoundLocale } from '@/lib/not-found-messages';
import {
  backfillLeagueNicknamesFromUsers,
  createDuel,
  createLeague,
  getGlobalPlayersLeaderboard,
  getLeagueByCodeOrId,
  getOrCreateUser,
  getUserDuels,
  syncNicknameToLeagues,
} from '@/lib/server-store';

describe('27 Nov player-test fixes regression suite', () => {
  it('formats remaining crop duration cleanly by rounding up minutes (e.g. 4h 0m right after planting oats)', () => {
    expect(formatDurationShort(14400)).toBe('4h 0m');
    expect(formatDurationShort(14399)).toBe('4h 0m');
    expect(formatDurationShort(14341)).toBe('4h 0m');
    expect(formatDurationShort(14340)).toBe('3h 59m');
    expect(formatDurationShort(3600)).toBe('1h 0m');
    expect(formatDurationShort(3541)).toBe('1h 0m');
    expect(formatDurationShort(59)).toBe('1m');
    expect(formatDurationShort(0)).toBe('0m');
  });

  it('ships real non-placeholder sprites for every RonTown catalog item and every crop button', () => {
    for (const [id, spec] of Object.entries(CATALOG_SPRITES)) {
      expect(spec.isPlaceholder, `${id} should not be a placeholder`).not.toBe(true);
      expect(spec.src, `${id} should have a sprite URL`).toMatch(/^\/rontown\/.+\.png/);
    }

    for (const cropId of ['oats', 'wheat', 'cabbage', 'carrots', 'sunflower', 'pumpkin']) {
      const btn = CROP_BUTTON_SPRITES[cropId];
      expect(btn, `${cropId} button sprite missing`).toBeDefined();
      expect(btn!.src).not.toContain('land-farm-one.png');
    }
  });

  it('uses user.nickname as single source of truth across league, admin, global ranking, and duels + backfills Player_xxxx rows', () => {
    const uid = `u_nick_fix_${Date.now()}`;
    // Simulate a guest created with a placeholder name who later gets a real nickname
    const user = getOrCreateUser({
      uid,
      tz: 'UTC',
      locale: 'ro',
      nickname: `Player_${uid.slice(-4)}`,
    });
    const league = createLeague({
      uid,
      name: `Backfill ${Date.now().toString(36).slice(-6)}`,
      tz: 'UTC',
      locale: 'ro',
    });

    // Simulate legacy stale Player_xxxx stored on member & day rows
    league.members[uid]!.nickname = 'Player_1234';
    user.nickname = 'CezarTester';

    const updated = backfillLeagueNicknamesFromUsers();
    expect(updated).toBeGreaterThanOrEqual(1);

    const view = getLeagueByCodeOrId(league.id, uid);
    expect(view?.adminName).toBe('CezarTester');
    expect(view?.allTime.find((m) => m.uid === uid)?.nickname).toBe('CezarTester');

    // Syncing again with placeholder never overwrites the real nickname
    syncNicknameToLeagues(uid, 'Player_9999');
    const viewAfter = getLeagueByCodeOrId(league.id, uid);
    expect(viewAfter?.adminName).toBe('CezarTester');

    // Global leaderboard resolves user.nickname too
    const lb = getGlobalPlayersLeaderboard(uid);
    const me = lb.allTime.find((p) => p.uid === uid);
    if (me) {
      expect(me.nickname).toBe('CezarTester');
    }
  });

  it('places newly created open duels without an opponent into waiting group instead of yourTurn', () => {
    const uid = `u_duel_wait_${Date.now()}`;
    getOrCreateUser({ uid, tz: 'UTC', locale: 'de', nickname: 'HansTester' });
    const duel = createDuel({ challengerUid: uid, tz: 'UTC', nickname: 'HansTester' });

    const list = getUserDuels(uid);
    expect(list.yourTurn.some((d) => d.id === duel.id)).toBe(false);
    const inWaiting = list.waiting.find((d) => d.id === duel.id);
    expect(inWaiting).toBeDefined();
    expect(inWaiting?.opponentUid).toBeNull();
    expect(inWaiting?.opponentNickname).toBe('');
  });

  it('localizes root 404 for every locale and matches messages/*.json', () => {
    expect(resolveNotFoundLocale('/ro/leagues/xxx')).toBe('ro');
    expect(resolveNotFoundLocale('/de/unknown-page')).toBe('de');
    expect(resolveNotFoundLocale('/no/something')).toBe('nb');
    expect(resolveNotFoundLocale('/unknown')).toBe('en');

    const messagesDir = path.resolve(process.cwd(), 'apps/web/messages');
    for (const file of fs.readdirSync(messagesDir)) {
      if (!file.endsWith('.json')) continue;
      const loc = file.replace('.json', '') as keyof typeof NOT_FOUND_MESSAGES;
      const msg = JSON.parse(fs.readFileSync(path.join(messagesDir, file), 'utf8'));
      expect(NOT_FOUND_MESSAGES[loc]).toEqual(msg.notFound);
    }
  });
});
