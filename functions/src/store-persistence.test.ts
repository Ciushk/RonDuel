import { describe, expect, it } from 'vitest';

import {
  createStorePersistence,
  toDocId,
  type BatchLike,
  type CollectionLike,
  type FirestoreLike,
} from './store-persistence.js';

/** Minimal in-memory Firestore: enough to prove hydrate and flush behave. */
class FakeFirestore implements FirestoreLike {
  docs = new Map<string, Record<string, unknown>>();
  setCalls = 0;
  failGets = 0;

  collection(name: string): CollectionLike {
    return {
      get: async () => {
        if (this.failGets > 0) {
          this.failGets -= 1;
          throw new Error('firestore unavailable');
        }
        const prefix = `${name}/`;
        const docs = [...this.docs.entries()]
          .filter(([path]) => path.startsWith(prefix))
          .map(([path, data]) => ({ id: path.slice(prefix.length), data: () => data }));
        return { docs };
      },
      doc: (id: string) => `${name}/${id}`,
    };
  }

  batch(): BatchLike {
    const ops: Array<() => void> = [];
    return {
      set: (ref, data) => {
        ops.push(() => {
          this.setCalls += 1;
          this.docs.set(String(ref), data);
        });
      },
      delete: (ref) => {
        ops.push(() => {
          this.docs.delete(String(ref));
        });
      },
      commit: async () => {
        ops.forEach((op) => op());
      },
    };
  }
}

const silent = { info: () => {}, warn: () => {}, error: () => {} };

function newInstance(db: FirestoreLike, store: Record<string, unknown>) {
  return createStorePersistence({ getDb: () => db, getStore: () => store, log: silent });
}

describe('store persistence', () => {
  it('keeps a finished play after the instance restarts', async () => {
    const db = new FakeFirestore();
    const first: Record<string, unknown> = {};
    const a = newInstance(db, first);
    await a.ensureHydrated();
    first.plays = { p1: { playId: 'p1', uid: 'u1', totalScore: 993 } };
    first.leagues = {
      lg_world: { id: 'lg_world', inviteCode: 'WORLD1', members: { u1: { nickname: 'Owl' } } },
    };
    await a.flushNow();

    const second: Record<string, unknown> = {};
    const b = newInstance(db, second);
    await b.ensureHydrated();
    expect((second.plays as Record<string, { totalScore: number }>).p1?.totalScore).toBe(993);
    expect(second.inviteCodes).toEqual({ WORLD1: 'lg_world' });
  });

  it('shows one instance the changes saved by another when it starts', async () => {
    const db = new FakeFirestore();
    const x: Record<string, unknown> = {};
    const a = newInstance(db, x);
    await a.ensureHydrated();
    x.plays = { fromAndrei: { totalScore: 700 } };
    await a.flushNow();

    const y: Record<string, unknown> = {};
    const b = newInstance(db, y);
    await b.ensureHydrated();
    y.plays = { ...(y.plays as object), fromBot: { totalScore: 993 } };
    await b.flushNow();

    expect(Object.keys((y.plays as object) ?? {}).sort()).toEqual(['fromAndrei', 'fromBot']);
    expect(db.docs.has('store_plays/fromAndrei')).toBe(true);
    expect(db.docs.has('store_plays/fromBot')).toBe(true);
  });

  it('only writes records that changed', async () => {
    const db = new FakeFirestore();
    const store: Record<string, unknown> = {};
    const p = newInstance(db, store);
    await p.ensureHydrated();
    store.plays = { a: { n: 1 }, b: { n: 1 } };
    expect((await p.flushNow()).written).toBe(2);
    expect((await p.flushNow()).written).toBe(0);
    (store.plays as Record<string, { n: number }>).a = { n: 2 };
    expect((await p.flushNow()).written).toBe(1);
    expect(db.setCalls).toBe(3);
  });

  it('removes records deleted from memory', async () => {
    const db = new FakeFirestore();
    const store: Record<string, unknown> = {};
    const p = newInstance(db, store);
    await p.ensureHydrated();
    store.plays = { a: { n: 1 }, b: { n: 1 } };
    await p.flushNow();
    delete (store.plays as Record<string, unknown>).a;
    const result = await p.flushNow();
    expect(result.deleted).toBe(1);
    expect(db.docs.has('store_plays/a')).toBe(false);
    expect(db.docs.has('store_plays/b')).toBe(true);
  });

  it('never overwrites saved data before it has been loaded', async () => {
    const db = new FakeFirestore();
    db.docs.set('store_leagues/lg_world', {
      id: 'lg_world',
      v: JSON.stringify({ id: 'lg_world', members: { u1: {} } }),
    });
    const store: Record<string, unknown> = {
      leagues: { lg_world: { id: 'lg_world', members: {} } },
    };
    const p = newInstance(db, store);
    const early = await p.flushNow();
    expect(early.skipped).toBe(true);
    expect(JSON.parse(String(db.docs.get('store_leagues/lg_world')?.v)).members).toEqual({
      u1: {},
    });
  });

  it('retries loading after a Firestore error', async () => {
    const db = new FakeFirestore();
    db.failGets = 1;
    const store: Record<string, unknown> = {};
    const p = newInstance(db, store);
    await expect(p.ensureHydrated()).rejects.toThrow('firestore unavailable');
    await expect(p.ensureHydrated()).resolves.toBeUndefined();
  });

  it('skips records that are too large instead of failing the whole save', async () => {
    const db = new FakeFirestore();
    const store: Record<string, unknown> = {};
    const p = newInstance(db, store);
    await p.ensureHydrated();
    store.plays = { big: { text: 'x'.repeat(800_000) }, ok: { n: 1 } };
    const result = await p.flushNow();
    expect(result.written).toBe(1);
    expect(db.docs.has('store_plays/ok')).toBe(true);
    expect(db.docs.has('store_plays/big')).toBe(false);
  });

  it('turns any key into a valid document id', () => {
    expect(toDocId('a/b')).toBe('a%2Fb');
    expect(toDocId('.')).toBe('%2E');
    expect(toDocId('..')).toBe('%2E%2E');
    expect(toDocId('__x__')).toBe('%5F_x__');
    expect(toDocId('2026-11-22_u_834b')).toBe('2026-11-22_u_834b');
  });
});
