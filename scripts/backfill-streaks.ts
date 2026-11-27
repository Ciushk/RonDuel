/**
 * Opt-in streak backfill utility.
 *
 * Dry-run by default (ZERO Firestore writes).
 * Writes ONLY `{ streakCurrent, streakBest, lastPlayedDate }` to `users/{uid}`
 * when explicitly invoked with `--apply` AND (`--uid=<uid>` or `--all`).
 *
 * Usage:
 *   pnpm exec tsx scripts/backfill-streaks.ts --uid=u_andrei89
 *   pnpm exec tsx scripts/backfill-streaks.ts --uid=u_andrei89 --apply
 *   pnpm exec tsx scripts/backfill-streaks.ts --all --apply
 */

import {
  computeStreakBackfillFromPlays,
  parseBackfillArgs,
  type BackfillCliOptions,
  type BackfillPlayLike,
} from '../apps/web/lib/streak-logic';

export { parseBackfillArgs, type BackfillCliOptions };

interface SimpleFirestoreLike {
  collection(name: string): {
    doc(id: string): {
      get(): Promise<{ id: string; exists: boolean; data(): Record<string, unknown> | undefined }>;
      set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
    };
    where(
      field: string,
      op: string,
      value: unknown,
    ): {
      get(): Promise<{ docs: Array<{ id: string; data(): Record<string, unknown> | undefined }> }>;
    };
    get(): Promise<{ docs: Array<{ id: string; data(): Record<string, unknown> | undefined }> }>;
  };
}

async function loadAllPlaysForUid(
  db: SimpleFirestoreLike,
  uid?: string,
): Promise<BackfillPlayLike[]> {
  const results: BackfillPlayLike[] = [];
  const collections = ['store_plays', 'plays'];

  for (const colName of collections) {
    try {
      const snap = uid
        ? await db.collection(colName).where('uid', '==', uid).get()
        : await db.collection(colName).get();
      for (const doc of snap.docs) {
        const data = doc.data() ?? {};
        if (typeof data.uid !== 'string') continue;
        results.push({
          playId: typeof data.playId === 'string' ? data.playId : doc.id,
          uid: data.uid,
          date: typeof data.date === 'string' ? data.date : undefined,
          status: typeof data.status === 'string' ? data.status : undefined,
          finishedAt: typeof data.finishedAt === 'string' ? data.finishedAt : undefined,
        });
      }
    } catch {
      // Collection may not exist in all environments
    }
  }

  return results;
}

async function main() {
  const opts = parseBackfillArgs(process.argv.slice(2));
  if (!opts.uid && !opts.all) {
    console.error('Usage: tsx scripts/backfill-streaks.ts (--uid=<uid> | --all) [--apply]');
    process.exit(1);
  }
  if (opts.uid && opts.all) {
    console.error('Specify either --uid=<uid> or --all, not both.');
    process.exit(1);
  }

  const { getApps, initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  if (getApps().length === 0) {
    initializeApp();
  }
  const db = getFirestore() as unknown as SimpleFirestoreLike;

  const targetDocs: Array<{ id: string; data: Record<string, unknown> }> = [];
  if (opts.uid) {
    const snap = await db.collection('users').doc(opts.uid).get();
    if (!snap.exists) {
      console.error(`User doc users/${opts.uid} not found.`);
      process.exit(1);
    }
    targetDocs.push({ id: snap.id, data: (snap.data() ?? {}) as Record<string, unknown> });
  } else {
    const snap = await db.collection('users').get();
    for (const doc of snap.docs) {
      targetDocs.push({ id: doc.id, data: (doc.data() ?? {}) as Record<string, unknown> });
    }
  }

  const allPlays = await loadAllPlaysForUid(db, opts.uid);
  const report: Array<Record<string, unknown>> = [];

  for (const userDoc of targetDocs) {
    const uid = userDoc.id;
    const data = userDoc.data;
    const current = {
      streakCurrent: typeof data.streakCurrent === 'number' ? data.streakCurrent : 0,
      streakBest: typeof data.streakBest === 'number' ? data.streakBest : 0,
      lastPlayedDate: typeof data.lastPlayedDate === 'string' ? data.lastPlayedDate : null,
    };

    const computed = computeStreakBackfillFromPlays({
      uid,
      tz: typeof data.tz === 'string' ? data.tz : 'UTC',
      plays: allPlays,
      existingStreakBest: current.streakBest,
      frozenDates: Array.isArray(data.frozenDates) ? (data.frozenDates as string[]) : undefined,
    });

    const changed =
      computed.fromPlays > 0 &&
      (computed.streakCurrent !== current.streakCurrent ||
        computed.streakBest !== current.streakBest ||
        computed.lastPlayedDate !== current.lastPlayedDate);

    let applied = false;
    if (opts.apply && changed) {
      await db.collection('users').doc(uid).set(
        {
          streakCurrent: computed.streakCurrent,
          streakBest: computed.streakBest,
          lastPlayedDate: computed.lastPlayedDate,
        },
        { merge: true },
      );
      applied = true;
    }

    report.push({
      uid,
      current,
      computed: {
        streakCurrent: computed.streakCurrent,
        streakBest: computed.streakBest,
        lastPlayedDate: computed.lastPlayedDate,
      },
      fromPlays: computed.fromPlays,
      changed,
      applied,
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: opts.apply ? 'apply' : 'dry-run',
        usersProcessed: report.length,
        results: report,
      },
      null,
      2,
    ),
  );
}

const isDirectExecution =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  process.argv[1].endsWith('backfill-streaks.ts');

if (isDirectExecution) {
  main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
}
