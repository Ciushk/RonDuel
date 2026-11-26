import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { calculateSpeedupCost, type TownTileDoc } from '@ronduel/shared';
import { assertTownFeatureEnabled } from './town-economy.js';
import { prepareDebitWallet } from './town-wallet.js';
import { publishTownSnapshot } from './town-snapshots.js';

export interface SpeedupCropParams {
  x: number;
  y: number;
  expectedCost?: number;
  nowMs?: number;
}

export interface SpeedupCropResult {
  ok: true;
  x: number;
  y: number;
  cropId: string;
  cost: number;
  alreadyReady: boolean;
  readyAt: string;
  balanceAfter: number | null;
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
 * Speeds up a growing crop plot for RonCoins so it is immediately ready to harvest.
 * Strictly gated behind `config/townEconomy.speedupEnabled` (default false).
 * Uses `prepareDebitWallet` + `apply()` so all Firestore reads execute before any write.
 */
export async function speedupCrop(
  db: Firestore,
  uid: string,
  params: SpeedupCropParams,
): Promise<SpeedupCropResult> {
  await assertTownFeatureEnabled(db, 'speedupEnabled');

  const { x, y, expectedCost } = params;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
    throw new Error('INVALID_COORDS: Tile coordinates must be non-negative integers.');
  }
  if (expectedCost !== undefined && (!Number.isFinite(expectedCost) || expectedCost < 0)) {
    throw new Error('INVALID_EXPECTED_COST: expectedCost must be a non-negative number.');
  }

  const nowMs = params.nowMs ?? Date.now();
  const tileKey = `${x}_${y}`;
  const tileRef = db.collection('users').doc(uid).collection('townTiles').doc(tileKey);

  const txResult = await db.runTransaction(async (tx) => {
    // ── READ PHASE ──
    const tileSnap = await tx.get(tileRef);
    if (!tileSnap.exists) {
      throw new Error('PLOT_NOT_FOUND: No tile exists at that coordinate.');
    }
    const tile = tileSnap.data() as TownTileDoc;
    if (tile.itemId !== 'plot' || !tile.cropId) {
      throw new Error('NO_GROWING_CROP: Tile does not have a growing crop.');
    }

    const readyAtMs = toMillis(tile.readyAt);
    if (readyAtMs === null) {
      throw new Error('NO_GROWING_CROP: Plot is missing readyAt timestamp.');
    }

    const remainingSeconds = Math.ceil((readyAtMs - nowMs) / 1000);
    if (remainingSeconds <= 0) {
      return {
        ok: true as const,
        x,
        y,
        cropId: tile.cropId,
        cost: 0,
        alreadyReady: true,
        readyAt: new Date(readyAtMs).toISOString(),
        balanceAfter: null,
      };
    }

    const cost = calculateSpeedupCost(remainingSeconds, tile.cropId);
    if (expectedCost !== undefined && cost > expectedCost) {
      throw new Error(`PRICE_CHANGED: Current speed-up cost is ${cost} coins.`);
    }

    const plantedAtMs = toMillis(tile.plantedAt);
    const plantedAtSeconds = plantedAtMs !== null ? Math.floor(plantedAtMs / 1000) : 0;
    const idempotencyKey = `speedup:${uid}:${tileKey}:${plantedAtSeconds}`;

    const debit = await prepareDebitWallet({
      transaction: tx,
      db,
      uid,
      amount: cost,
      reason: 'spend',
      refId: `speedup:${tile.cropId}:${tileKey}`,
      idempotencyKey,
    });

    if (debit.duplicate) {
      return {
        ok: true as const,
        x,
        y,
        cropId: tile.cropId,
        cost: 0,
        alreadyReady: true,
        readyAt: new Date(nowMs).toISOString(),
        balanceAfter: debit.balanceAfter ?? null,
      };
    }

    // ── WRITE PHASE ──
    debit.apply();
    const readyTs = Timestamp.fromMillis(nowMs);
    tx.update(tileRef, {
      readyAt: readyTs,
      speedupAt: FieldValue.serverTimestamp(),
    });

    return {
      ok: true as const,
      x,
      y,
      cropId: tile.cropId,
      cost,
      alreadyReady: false,
      readyAt: new Date(nowMs).toISOString(),
      balanceAfter: debit.balanceAfter ?? null,
    };
  });

  if (!txResult.alreadyReady) {
    try {
      await publishTownSnapshot(db, uid);
    } catch {
      // Snapshot publish is best-effort
    }
  }

  return txResult;
}
