/**
 * Durable storage for the game store.
 *
 * The game logic in apps/web/lib/server-store.ts keeps everything in memory. On Cloud Functions
 * that memory is wiped on every cold start and is separate per instance, so plays, leagues,
 * duels and subscriptions used to disappear. This module keeps the in-memory store as the fast
 * working copy and mirrors it to Firestore:
 *
 * - hydrate: on start, load every record from Firestore into the in-memory store.
 * - flush: diff the in-memory records against what was last written and save only changes.
 *
 * Each record is one Firestore document in `store_<collection>`, holding its JSON in field `v`
 * (JSON avoids Firestore limits on nested arrays and undefined values). Users are not handled
 * here: they already sync through firestore-users.ts.
 *
 * This is the first step towards a full Firestore data model. It assumes a single writer for the
 * HTTP api (see maxInstances in index.ts), because each instance trusts its own memory for reads.
 */

export const PERSISTED_COLLECTIONS = [
  'plays',
  'leagues',
  'duels',
  'subscriptions',
  'stripeEvents',
  'pairRecords',
  'dailyRounds',
  'scheduledRounds',
  'questionReports',
  'reports',
] as const;

export type PersistedCollection = (typeof PERSISTED_COLLECTIONS)[number];

export interface DocSnapshotLike {
  id: string;
  data(): Record<string, unknown> | undefined;
}

export interface CollectionLike {
  get(): Promise<{ docs: DocSnapshotLike[] }>;
  doc(id: string): unknown;
}

export interface BatchLike {
  set(ref: unknown, data: Record<string, unknown>): unknown;
  delete(ref: unknown): unknown;
  commit(): Promise<unknown>;
}

export interface FirestoreLike {
  collection(name: string): CollectionLike;
  batch(): BatchLike;
}

export interface FlushResult {
  written: number;
  deleted: number;
  skipped?: boolean;
  failed?: boolean;
}

export interface StorePersistenceOptions {
  getDb: () => FirestoreLike;
  getStore: () => Record<string, unknown>;
  now?: () => Date;
  log?: Pick<Console, 'info' | 'warn' | 'error'>;
}

const COLLECTION_PREFIX = 'store_';
/** Firestore documents are limited to about 1 MiB; keep a safety margin for multi-byte text. */
const MAX_DOC_JSON_CHARS = 700_000;
/** Firestore allows 500 operations per batch. */
const BATCH_SIZE = 400;

/** Deterministic, valid Firestore document id for any record key. */
export function toDocId(id: string): string {
  const encoded = encodeURIComponent(id);
  if (encoded === '.') return '%2E';
  if (encoded === '..') return '%2E%2E';
  if (encoded.startsWith('__') && encoded.endsWith('__')) return `%5F${encoded.slice(1)}`;
  return encoded;
}

function asRecordMap(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function createStorePersistence(options: StorePersistenceOptions) {
  const log = options.log ?? console;
  const now = options.now ?? (() => new Date());
  /** `${collection}/${docId}` -> JSON last confirmed in Firestore. */
  const lastWritten = new Map<string, string>();
  let hydration: Promise<void> | null = null;
  let flushChain: Promise<unknown> = Promise.resolve();

  const keyOf = (collection: string, docId: string) => `${collection}/${docId}`;

  function rebuildInviteCodes(store: Record<string, unknown>): void {
    const codes: Record<string, string> = {};
    for (const league of Object.values(asRecordMap(store.leagues))) {
      const l = asRecordMap(league);
      if (typeof l.inviteCode === 'string' && typeof l.id === 'string') {
        codes[l.inviteCode] = l.id;
      }
    }
    store.inviteCodes = codes;
  }

  async function hydrateOnce(): Promise<void> {
    const db = options.getDb();
    const store = options.getStore();
    let total = 0;
    for (const name of PERSISTED_COLLECTIONS) {
      const snap = await db.collection(COLLECTION_PREFIX + name).get();
      const loaded: Record<string, unknown> = {};
      for (const doc of snap.docs) {
        const data = doc.data();
        if (!data || typeof data.id !== 'string' || typeof data.v !== 'string') continue;
        try {
          loaded[data.id] = JSON.parse(data.v);
          lastWritten.set(keyOf(name, doc.id), data.v);
          total += 1;
        } catch (err) {
          log.error(`[store] Skipping unreadable ${name}/${doc.id}`, err);
        }
      }
      store[name] = loaded;
    }
    rebuildInviteCodes(store);
    log.info(`[store] Loaded ${total} records from Firestore`);
  }

  /** Load saved records once per instance. Safe to call on every request. */
  function ensureHydrated(): Promise<void> {
    if (!hydration) {
      hydration = hydrateOnce().catch((err) => {
        hydration = null;
        log.error('[store] Hydration failed', err);
        throw err;
      });
    }
    return hydration;
  }

  async function flushOnce(): Promise<FlushResult> {
    // Never write before the saved data is loaded, or an empty in-memory seed would overwrite it.
    if (!hydration) return { written: 0, deleted: 0, skipped: true };
    await hydration;

    const db = options.getDb();
    const store = options.getStore();
    const writes: Array<{ name: string; docId: string; id: string; json: string }> = [];
    const seen = new Set<string>();

    for (const name of PERSISTED_COLLECTIONS) {
      for (const [id, record] of Object.entries(asRecordMap(store[name]))) {
        const docId = toDocId(id);
        const key = keyOf(name, docId);
        seen.add(key);
        let json: string | undefined;
        try {
          json = JSON.stringify(record);
        } catch (err) {
          log.error(`[store] Cannot serialize ${name}/${id}`, err);
          continue;
        }
        if (json === undefined || lastWritten.get(key) === json) continue;
        if (json.length > MAX_DOC_JSON_CHARS) {
          log.error(`[store] ${name}/${id} is too large to save (${json.length} chars)`);
          continue;
        }
        writes.push({ name, docId, id, json });
      }
    }

    const deletes: Array<{ name: string; docId: string; key: string }> = [];
    for (const key of lastWritten.keys()) {
      if (seen.has(key)) continue;
      const slash = key.indexOf('/');
      deletes.push({ name: key.slice(0, slash), docId: key.slice(slash + 1), key });
    }

    if (writes.length === 0 && deletes.length === 0) return { written: 0, deleted: 0 };

    const stamp = now().toISOString();
    let batch = db.batch();
    let inBatch = 0;
    const commits: Array<() => void> = [];
    const flushBatch = async () => {
      if (inBatch === 0) return;
      await batch.commit();
      for (const done of commits) done();
      commits.length = 0;
      batch = db.batch();
      inBatch = 0;
    };

    for (const w of writes) {
      const ref = db.collection(COLLECTION_PREFIX + w.name).doc(w.docId);
      batch.set(ref, { id: w.id, v: w.json, updatedAt: stamp });
      commits.push(() => lastWritten.set(keyOf(w.name, w.docId), w.json));
      inBatch += 1;
      if (inBatch >= BATCH_SIZE) await flushBatch();
    }
    for (const d of deletes) {
      batch.delete(db.collection(COLLECTION_PREFIX + d.name).doc(d.docId));
      commits.push(() => lastWritten.delete(d.key));
      inBatch += 1;
      if (inBatch >= BATCH_SIZE) await flushBatch();
    }
    await flushBatch();

    return { written: writes.length, deleted: deletes.length };
  }

  /**
   * Save changes. Calls are queued so they never overlap. Errors are logged and returned instead of
   * thrown, so a Firestore problem never turns a played round into an error for the player.
   */
  function flushNow(): Promise<FlushResult> {
    const run = flushChain
      .then(() => flushOnce())
      .catch((err): FlushResult => {
        log.error('[store] Flush failed', err);
        return { written: 0, deleted: 0, failed: true };
      });
    flushChain = run;
    return run;
  }

  return { ensureHydrated, flushNow };
}
