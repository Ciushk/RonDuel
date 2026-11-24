import { beforeEach, describe, expect, it } from 'vitest';
import {
  batchReconcileLedgers,
  creditWallet,
  debitWallet,
  reconcileUserLedger,
} from './town-wallet.js';

describe('town-wallet transaction functions', () => {
  let store: Map<string, Record<string, unknown>>;
  let mockDb: any;

  beforeEach(() => {
    store = new Map();
    mockDb = {
      collection: (col: string) => {
        const colHandler = {
          doc: (id: string) => ({
            collection: (subCol: string) => ({
              doc: (subId: string) => ({
                path: `${col}/${id}/${subCol}/${subId}`,
                get: async () => {
                  const data = store.get(`${col}/${id}/${subCol}/${subId}`);
                  return { exists: data !== undefined, data: () => data };
                },
              }),
            }),
            path: `${col}/${id}`,
            get: async () => {
              const data = store.get(`${col}/${id}`);
              return { exists: data !== undefined, data: () => data };
            },
          }),
          where: (field: string, op: string, val: string) => ({
            get: async () => {
              const docs: any[] = [];
              for (const [p, d] of store.entries()) {
                if (p.startsWith(`${col}/`) && d[field] === val) {
                  docs.push({ id: p.split('/')[1], data: () => d });
                }
              }
              return { docs };
            },
          }),
          orderBy: () => ({
            limit: (n: number) => ({
              startAfter: (afterId: string) => ({
                get: async () => {
                  const sorted = Array.from(
                    new Set(
                      Array.from(store.keys())
                        .filter((k) => k.startsWith(`${col}/`) && k.split('/').length === 2)
                        .map((k) => k.split('/')[1]!),
                    ),
                  ).sort();
                  const afterIndex = sorted.indexOf(afterId);
                  const sliced =
                    afterIndex >= 0 ? sorted.slice(afterIndex + 1, afterIndex + 1 + n) : [];
                  return {
                    docs: sliced.map((id) => ({
                      id,
                      data: () => store.get(`${col}/${id}`),
                    })),
                  };
                },
              }),
              get: async () => {
                const sorted = Array.from(
                  new Set(
                    Array.from(store.keys())
                      .filter((k) => k.startsWith(`${col}/`) && k.split('/').length === 2)
                      .map((k) => k.split('/')[1]!),
                  ),
                )
                  .sort()
                  .slice(0, n);
                return {
                  docs: sorted.map((id) => ({
                    id,
                    data: () => store.get(`${col}/${id}`),
                  })),
                };
              },
            }),
          }),
        };
        return colHandler;
      },
      runTransaction: async (fn: (tx: any) => Promise<any>) => {
        const tx = {
          get: async (ref: { path: string }) => {
            const data = store.get(ref.path);
            return { exists: data !== undefined, data: () => data };
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
        return fn(tx);
      },
    };
  });

  it('credits wallet, updates balance, and appends unique ledger entry', async () => {
    const res = await mockDb.runTransaction(async (tx: any) => {
      return creditWallet({
        transaction: tx,
        db: mockDb,
        uid: 'user_1',
        amount: 50,
        bucket: 'trivia',
        reason: 'trivia_award',
        refId: 'round_1',
        idempotencyKey: 'trivia:user_1:round_1',
      });
    });

    expect(res.duplicate).toBe(false);
    expect(res.balanceAfter).toBe(50);

    const wallet = store.get('users/user_1/wallet/main') as any;
    expect(wallet.balance).toBe(50);
    expect(wallet.buckets.trivia).toBe(50);

    const ledger = store.get('ledger/trivia%3Auser_1%3Around_1') as any;
    expect(ledger.delta).toBe(50);
    expect(ledger.balanceAfter).toBe(50);
    expect(ledger.uid).toBe('user_1');
  });

  it('second credit with identical idempotencyKey returns duplicate without changing balance', async () => {
    // First credit
    await mockDb.runTransaction(async (tx: any) => {
      return creditWallet({
        transaction: tx,
        db: mockDb,
        uid: 'user_1',
        amount: 50,
        bucket: 'trivia',
        reason: 'trivia_award',
        refId: 'round_1',
        idempotencyKey: 'trivia:user_1:round_1',
      });
    });

    // Second credit with same key
    const res2 = await mockDb.runTransaction(async (tx: any) => {
      return creditWallet({
        transaction: tx,
        db: mockDb,
        uid: 'user_1',
        amount: 50,
        bucket: 'trivia',
        reason: 'trivia_award',
        refId: 'round_1',
        idempotencyKey: 'trivia:user_1:round_1',
      });
    });

    expect(res2.duplicate).toBe(true);
    const wallet = store.get('users/user_1/wallet/main') as any;
    expect(wallet.balance).toBe(50);
  });

  it('debits wallet according to bucket priority', async () => {
    // Initial funding: 30 town coins, 50 purchased coins
    store.set('users/user_2/wallet/main', {
      balance: 80,
      buckets: { trivia: 0, town: 30, purchased: 50, gift: 0 },
      monthPurchasedEUR: 0,
      monthKey: '2026-11',
      locked: false,
    });

    // Debit 40 coins with priority [town, purchased]
    const res = await mockDb.runTransaction(async (tx: any) => {
      return debitWallet({
        transaction: tx,
        db: mockDb,
        uid: 'user_2',
        amount: 40,
        bucketPriority: ['town', 'purchased'],
        reason: 'spend',
        refId: 'item_house',
        idempotencyKey: 'spend:user_2:item_house_1',
      });
    });

    expect(res.duplicate).toBe(false);
    expect(res.balanceAfter).toBe(40);
    expect(res.spentBuckets).toEqual({ town: 30, purchased: 10 });

    const wallet = store.get('users/user_2/wallet/main') as any;
    expect(wallet.balance).toBe(40);
    expect(wallet.buckets.town).toBe(0);
    expect(wallet.buckets.purchased).toBe(40);
  });

  it('rejects debit if balance is insufficient', async () => {
    store.set('users/user_3/wallet/main', {
      balance: 20,
      buckets: { trivia: 20, town: 0, purchased: 0, gift: 0 },
      monthPurchasedEUR: 0,
      monthKey: '2026-11',
      locked: false,
    });

    await expect(
      mockDb.runTransaction(async (tx: any) => {
        return debitWallet({
          transaction: tx,
          db: mockDb,
          uid: 'user_3',
          amount: 50,
          bucketPriority: ['trivia'],
          reason: 'spend',
          refId: 'item_1',
          idempotencyKey: 'spend:user_3:item_1',
        });
      }),
    ).rejects.toThrow('INSUFFICIENT_FUNDS');
  });

  it('rejects transactions if wallet is locked', async () => {
    store.set('users/user_locked/wallet/main', {
      balance: 50,
      buckets: { trivia: 50, town: 0, purchased: 0, gift: 0 },
      monthPurchasedEUR: 0,
      monthKey: '2026-11',
      locked: true,
    });

    await expect(
      mockDb.runTransaction(async (tx: any) => {
        return creditWallet({
          transaction: tx,
          db: mockDb,
          uid: 'user_locked',
          amount: 10,
          bucket: 'trivia',
          reason: 'trivia_award',
          refId: 'r',
          idempotencyKey: 'k',
        });
      }),
    ).rejects.toThrow('WALLET_LOCKED');
  });

  it('reconcileUserLedger verifies balance matches sum of ledger deltas', async () => {
    store.set('users/user_audit/wallet/main', {
      balance: 85,
      buckets: { trivia: 85, town: 0, purchased: 0, gift: 0 },
      monthPurchasedEUR: 0,
      monthKey: '2026-11',
      locked: false,
    });
    // Add 3 ledger entries: +50, +45, -10 = 85
    store.set('ledger/entry_1', { uid: 'user_audit', delta: 50 });
    store.set('ledger/entry_2', { uid: 'user_audit', delta: 45 });
    store.set('ledger/entry_3', { uid: 'user_audit', delta: -10 });

    const audit = await reconcileUserLedger(mockDb, 'user_audit');
    expect(audit.matches).toBe(true);
    expect(audit.balance).toBe(85);
    expect(audit.ledgerSum).toBe(85);

    // If wallet is modified illegally to 100:
    store.set('users/user_audit/wallet/main', {
      balance: 100,
      buckets: { trivia: 100, town: 0, purchased: 0, gift: 0 },
      monthPurchasedEUR: 0,
      monthKey: '2026-11',
      locked: false,
    });
    const mismatchAudit = await reconcileUserLedger(mockDb, 'user_audit');
    expect(mismatchAudit.matches).toBe(false);
    expect(mismatchAudit.balance).toBe(100);
    expect(mismatchAudit.ledgerSum).toBe(85);
  });

  it('batchReconcileLedgers iterates paginated users and reports mismatch count', async () => {
    store.set('users/u1', { id: 'u1' });
    store.set('users/u1/wallet/main', { balance: 20 });
    store.set('ledger/u1_1', { uid: 'u1', delta: 20 });

    store.set('users/u2', { id: 'u2' });
    store.set('users/u2/wallet/main', { balance: 50 });
    store.set('ledger/u2_1', { uid: 'u2', delta: 30 }); // Mismatch!

    const page1 = await batchReconcileLedgers(mockDb, 1);
    expect(page1.results).toHaveLength(1);
    expect(page1.lastUid).toBe('u1');
    expect(page1.mismatchCount).toBe(0);

    const page2 = await batchReconcileLedgers(mockDb, 1, page1.lastUid!);
    expect(page2.results).toHaveLength(1);
    expect(page2.lastUid).toBe('u2');
    expect(page2.mismatchCount).toBe(1);
  });
});
