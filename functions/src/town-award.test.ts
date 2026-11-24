import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TOWN_ECONOMY } from '@ronduel/shared';
import { parseAndValidatePlayPayload, processAwardTriviaCoins } from './town-award.js';

describe('town-award payload validation', () => {
  it('rejects non-string payload', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseAndValidatePlayPayload(12345, 'doc_1')).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('rejects invalid JSON string', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseAndValidatePlayPayload('{ bad json', 'doc_1')).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('rejects missing or short uid', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const payload = JSON.stringify({ uid: 'ab', date: '2026-11-24', status: 'finished' });
    expect(parseAndValidatePlayPayload(payload, 'doc_1')).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('rejects invalid date format', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const payload = JSON.stringify({ uid: 'user_123', date: 'invalid-date', status: 'finished' });
    expect(parseAndValidatePlayPayload(payload, 'doc_1')).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('parses valid payload successfully', () => {
    const payload = JSON.stringify({
      playId: '2026-11-24_user_123',
      uid: 'user_123',
      date: '2026-11-24',
      roundNumber: 42,
      mode: 'daily',
      status: 'finished',
      totalScore: 850,
    });
    const parsed = parseAndValidatePlayPayload(payload, 'doc_1');
    expect(parsed).toEqual({
      playId: '2026-11-24_user_123',
      uid: 'user_123',
      date: '2026-11-24',
      roundNumber: 42,
      mode: 'daily',
      status: 'finished',
      totalScore: 850,
    });
  });
});

describe('processAwardTriviaCoins business rules', () => {
  let store: Map<string, Record<string, unknown>>;
  let mockDb: any;

  beforeEach(() => {
    store = new Map();
    mockDb = {
      collection: (col: string) => ({
        doc: (id: string) => ({
          collection: (subCol: string) => ({
            doc: (subId: string) => ({
              path: `${col}/${id}/${subCol}/${subId}`,
            }),
          }),
          path: `${col}/${id}`,
        }),
      }),
      runTransaction: async (updateFunction: (tx: any) => Promise<any>) => {
        const tx = {
          get: async (ref: { path: string }) => {
            const data = store.get(ref.path);
            return {
              exists: data !== undefined,
              data: () => data,
            };
          },
          set: (
            ref: { path: string },
            data: Record<string, unknown>,
            options?: { merge?: boolean },
          ) => {
            if (options?.merge && store.has(ref.path)) {
              store.set(ref.path, { ...store.get(ref.path), ...data });
            } else {
              store.set(ref.path, { ...data });
            }
          },
        };
        return updateFunction(tx);
      },
    };
  });

  it('skips award if status is not finished', async () => {
    const payload = JSON.stringify({
      uid: 'user_1',
      date: '2026-11-24',
      roundNumber: 1,
      status: 'in_progress',
      totalScore: 500,
    });
    const res = await processAwardTriviaCoins(mockDb, payload, 'doc_1');
    expect(res.skipped).toBe(true);
    expect(res.reason).toBe('not_finished');
  });

  it('skips award for non-daily round mode (e.g. duels)', async () => {
    const payload = JSON.stringify({
      uid: 'user_1',
      date: '2026-11-24',
      roundNumber: 1,
      mode: 'duel',
      status: 'finished',
      totalScore: 500,
    });
    const res = await processAwardTriviaCoins(mockDb, payload, 'doc_1');
    expect(res.skipped).toBe(true);
    expect(res.reason).toBe('not_daily_round_mode');
  });

  it('skips award if roundNumber is missing or <= 0', async () => {
    const payload = JSON.stringify({
      uid: 'user_1',
      date: '2026-11-24',
      status: 'finished',
      totalScore: 500,
    });
    const res = await processAwardTriviaCoins(mockDb, payload, 'doc_1');
    expect(res.skipped).toBe(true);
    expect(res.reason).toBe('missing_round_number');
  });

  it('skips award if town economy kill switch is OFF', async () => {
    const economyDisabled = { ...DEFAULT_TOWN_ECONOMY, enabled: false };
    const payload = JSON.stringify({
      uid: 'user_1',
      date: '2026-11-24',
      roundNumber: 10,
      mode: 'daily',
      status: 'finished',
      totalScore: 800,
    });
    const res = await processAwardTriviaCoins(mockDb, payload, 'doc_1', economyDisabled);
    expect(res.skipped).toBe(true);
    expect(res.reason).toBe('town_economy_disabled');
  });

  it('awards trivia coins to free player and unlocks daily orders', async () => {
    const economyEnabled = { ...DEFAULT_TOWN_ECONOMY, enabled: true };
    // Free player: pro.active is false/undefined
    store.set('users/user_free', { pro: { active: false } });

    const payload = JSON.stringify({
      uid: 'user_free',
      date: '2026-11-24',
      roundNumber: 10,
      mode: 'daily',
      status: 'finished',
      totalScore: 750, // floor(750/100) = 7 * 2 = 14 coins
    });

    const res = await processAwardTriviaCoins(mockDb, payload, 'doc_1', economyEnabled);
    expect(res.awarded).toBe(true);
    expect(res.coins).toBe(14);

    // Verify wallet in store
    const wallet = store.get('users/user_free/wallet/main') as any;
    expect(wallet.balance).toBe(14);
    expect(wallet.buckets.trivia).toBe(14);

    // Verify ledger in store
    const ledger = store.get('ledger/trivia%3Auser_free%3Around_10') as any;
    expect(ledger.delta).toBe(14);
    expect(ledger.bucket).toBe('trivia');
    expect(ledger.reason).toBe('trivia_award');

    // Verify town orders unlocked
    const orders = store.get('users/user_free/townOrders/2026-11-24') as any;
    expect(orders.unlocked).toBe(true);
  });

  it('awards trivia coins to Pro player based on Pro rate (10 coins per 100 pts)', async () => {
    const economyEnabled = { ...DEFAULT_TOWN_ECONOMY, enabled: true };
    store.set('users/user_pro', { pro: { active: true } });

    const payload = JSON.stringify({
      uid: 'user_pro',
      date: '2026-11-24',
      roundNumber: 10,
      mode: 'daily',
      status: 'finished',
      totalScore: 750, // floor(750/100) = 7 * 10 = 70 coins
    });

    const res = await processAwardTriviaCoins(mockDb, payload, 'doc_1', economyEnabled);
    expect(res.awarded).toBe(true);
    expect(res.coins).toBe(70);

    const wallet = store.get('users/user_pro/wallet/main') as any;
    expect(wallet.balance).toBe(70);
    expect(wallet.buckets.trivia).toBe(70);
  });

  it('enforces idempotency on roundId: second trigger with same roundId does not award again', async () => {
    const economyEnabled = { ...DEFAULT_TOWN_ECONOMY, enabled: true };
    store.set('users/user_pro', { pro: { active: true } });

    const payload = JSON.stringify({
      uid: 'user_pro',
      date: '2026-11-24',
      roundNumber: 10,
      mode: 'daily',
      status: 'finished',
      totalScore: 1000,
    });

    // First run
    const res1 = await processAwardTriviaCoins(mockDb, payload, 'doc_1', economyEnabled);
    expect(res1.awarded).toBe(true);
    expect(res1.coins).toBe(100);

    // Second run with same roundId
    const res2 = await processAwardTriviaCoins(mockDb, payload, 'doc_1', economyEnabled);
    expect(res2.awarded).toBe(false);
    expect(res2.duplicate).toBe(true);
    expect(res2.reason).toBe('already_awarded');

    // Wallet balance remains 100
    const wallet = store.get('users/user_pro/wallet/main') as any;
    expect(wallet.balance).toBe(100);
  });
});
