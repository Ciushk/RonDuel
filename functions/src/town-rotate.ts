import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { getRotationKind, type TownDoc, type TownTileDoc } from '@ronduel/shared';
import { assertTownFeatureEnabled } from './town-economy.js';
import { publishTownSnapshot } from './town-snapshots.js';

export interface RotateTownElementParams {
  x: number;
  y: number;
  layer: 'item' | 'ground';
  rot: number;
}

/**
 * Sets the absolute rotation (0..3) of a rotatable item tile or owned ground cell.
 * Idempotent, owner-only, strictly reads-before-writes, and never touches wallets,
 * ledger, XP, score, or prices.
 */
export async function rotateTownElement(
  db: Firestore,
  uid: string,
  params: RotateTownElementParams,
): Promise<{ success: boolean; rot: 0 | 1 | 2 | 3 }> {
  await assertTownFeatureEnabled(db);

  if (!uid || uid === 'anon' || uid === 'u_ssr') {
    throw new Error('Missing uid');
  }
  const { x, y, layer, rot } = params;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
    throw new Error('Invalid coordinates');
  }
  if (layer !== 'item' && layer !== 'ground') {
    throw new Error('Invalid layer');
  }
  if (!Number.isInteger(rot) || rot < 0 || rot > 3) {
    throw new Error('Invalid rotation');
  }

  const key = `${x}_${y}`;
  const townRef = db.collection('users').doc(uid).collection('town').doc('main');
  const tileRef = db.collection('users').doc(uid).collection('townTiles').doc(key);

  const nextRot = await db.runTransaction(async (tx) => {
    // 1. All reads before any writes
    const townSnap = await tx.get(townRef);
    const tileSnap = layer === 'item' ? await tx.get(tileRef) : null;

    if (!townSnap.exists) {
      throw new Error('Town not initialized');
    }
    const townData = townSnap.data() as TownDoc;

    if (layer === 'ground') {
      const ground = townData.land?.[key];
      if (!ground) {
        throw new Error(`Tile (${x}, ${y}) is not owned land`);
      }
      const kind = getRotationKind('ground', ground);
      if (kind === 'none') {
        throw new Error('NOT_ROTATABLE');
      }
      const normalized = (kind === 'flip2' ? rot % 2 : rot % 4) as 0 | 1 | 2 | 3;

      const nextLandRot: Record<string, 1 | 2 | 3> = { ...(townData.landRot ?? {}) };
      if (normalized === 0) {
        delete nextLandRot[key];
      } else {
        nextLandRot[key] = normalized as 1 | 2 | 3;
      }

      tx.update(townRef, {
        landRot: nextLandRot,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return normalized;
    }

    // layer === 'item'
    if (!tileSnap || !tileSnap.exists) {
      throw new Error(`No item at (${x}, ${y})`);
    }
    const tileData = tileSnap.data() as TownTileDoc;
    const kind = getRotationKind('item', tileData.itemId);
    if (kind === 'none') {
      throw new Error('NOT_ROTATABLE');
    }
    const normalized = (kind === 'flip2' ? rot % 2 : rot % 4) as 0 | 1 | 2 | 3;

    tx.update(tileRef, {
      rot: normalized === 0 ? FieldValue.delete() : normalized,
    });
    return normalized;
  });

  publishTownSnapshot(db, uid).catch(() => {});
  return { success: true, rot: nextRot };
}
