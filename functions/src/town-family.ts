import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getFamilyEventTriggerAt, type TownDoc } from '@ronduel/shared';
import { assertTownFeatureEnabled } from './town-economy.js';
import { publishTownSnapshot } from './town-snapshots.js';

export interface CompleteFamilyEventResult {
  ok: true;
  childBorn: true;
  alreadyBorn: boolean;
}

function toMillis(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof val === 'object') {
    const obj = val as { toMillis?: () => number; seconds?: number; _seconds?: number };
    if (typeof obj.toMillis === 'function') return obj.toMillis();
    if (typeof obj.seconds === 'number') return obj.seconds * 1000;
    if (typeof obj._seconds === 'number') return obj._seconds * 1000;
  }
  return null;
}

/**
 * Idempotently completes the one-time RonTown family event revealing the single child villager.
 * - Rejects with `NOT_YET` (409) before `getFamilyEventTriggerAt(uid, clockStartMs)`.
 * - Does NOT touch wallet, ledger, score, or population counters.
 * - Strictly performs all Firestore reads before any write.
 */
export async function completeFamilyEvent(
  db: Firestore,
  uid: string,
  nowMs: number = Date.now(),
): Promise<CompleteFamilyEventResult> {
  await assertTownFeatureEnabled(db);

  const townRef = db.collection('users').doc(uid).collection('town').doc('main');

  const txResult = await db.runTransaction(async (tx) => {
    // ── READ PHASE ──
    const townSnap = await tx.get(townRef);
    if (!townSnap.exists) {
      throw new Error('TOWN_NOT_FOUND: Town has not been initialized.');
    }
    const town = townSnap.data() as TownDoc;
    if (town.childBorn === true) {
      return { ok: true as const, childBorn: true as const, alreadyBorn: true };
    }

    const clockStartMs = toMillis(town.createdAt) ?? toMillis(town.familyClockStartAt);
    if (clockStartMs === null) {
      throw new Error('NOT_YET: Town creation timestamp is not yet available.');
    }

    const triggerAtMs = getFamilyEventTriggerAt(uid, clockStartMs);
    if (nowMs < triggerAtMs) {
      throw new Error('NOT_YET: Family event is not yet eligible.');
    }

    // ── WRITE PHASE ──
    tx.update(townRef, {
      childBorn: true,
      familyEventSeenAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ok: true as const, childBorn: true as const, alreadyBorn: false };
  });

  if (!txResult.alreadyBorn) {
    try {
      await publishTownSnapshot(db, uid);
    } catch {
      // Snapshot publish is best-effort
    }
  }

  return txResult;
}
