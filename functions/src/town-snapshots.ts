import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { assertTownFeatureEnabled } from './town-economy.js';
import type { TownSnapshotDoc, TownTileDoc } from '@ronduel/shared';

/**
 * Publishes an up-to-date snapshot of the user's town to `townSnapshots/{uid}`.
 * This public document allows league members to view the town without reading private user docs.
 */
export async function publishTownSnapshot(db: Firestore, uid: string): Promise<void> {
  const [userSnap, townSnap, tilesSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('users').doc(uid).collection('town').doc('main').get(),
    db.collection('users').doc(uid).collection('townTiles').get(),
  ]);

  if (!townSnap.exists) {
    return;
  }

  const userData = userSnap.data() || {};
  const townData = townSnap.data() || {};
  const nowMs = Date.now();

  const tiles = tilesSnap.docs.map((d) => {
    const t = d.data() as TownTileDoc;
    let ready = false;
    if (t.readyAt) {
      const readyMs =
        typeof (t.readyAt as any)?.toMillis === 'function'
          ? (t.readyAt as any).toMillis()
          : typeof t.readyAt === 'number'
            ? t.readyAt
            : 0;
      ready = readyMs > 0 && nowMs >= readyMs;
    }

    return {
      itemId: t.itemId,
      x: t.x,
      y: t.y,
      ...(t.rot ? { rot: t.rot } : {}),
      ...(t.cropId ? { cropId: t.cropId } : {}),
      ...(t.readyAt ? { ready } : {}),
    };
  });

  const snapshot: TownSnapshotDoc = {
    uid,
    displayName: userData.nickname || userData.displayName || 'Town Mayor',
    level: townData.level ?? 1,
    population: townData.population ?? 2,
    likesCount: townData.likesCount ?? 0,
    leagueIds: Array.isArray(userData.leagueIds) ? userData.leagueIds : [],
    tiles,
    ...(townData.land ? { land: townData.land } : {}),
    ...(townData.landRot ? { landRot: townData.landRot } : {}),
    ...(townData.childBorn ? { childBorn: true } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection('townSnapshots').doc(uid).set(snapshot, { merge: true });
}

/**
 * Fetches a town snapshot for visiting, enforcing that the viewer is either the owner or shares a league.
 */
export async function getTownVisit(
  db: Firestore,
  hostUid: string,
  viewerUid: string,
): Promise<{ snapshot: TownSnapshotDoc; hasLiked: boolean }> {
  await assertTownFeatureEnabled(db, 'enabled');

  if (!hostUid) throw new Error('Missing hostUid');
  if (!viewerUid) throw new Error('Missing viewerUid');

  const snapshotDoc = await db.collection('townSnapshots').doc(hostUid).get();
  if (!snapshotDoc.exists) {
    // If snapshot doesn't exist yet, try publishing it now
    await publishTownSnapshot(db, hostUid);
    const retrySnap = await db.collection('townSnapshots').doc(hostUid).get();
    if (!retrySnap.exists) {
      throw new Error('Town not found');
    }
  }

  const snapshot = (
    await db.collection('townSnapshots').doc(hostUid).get()
  ).data() as TownSnapshotDoc;

  // Authorization check: viewer must be owner or share at least one league
  if (viewerUid !== hostUid) {
    const viewerDoc = await db.collection('users').doc(viewerUid).get();
    const viewerLeagues: string[] = viewerDoc.data()?.leagueIds || [];
    const hostLeagues: string[] = snapshot.leagueIds || [];
    const sharesLeague = viewerLeagues.some((lg) => hostLeagues.includes(lg));

    if (!sharesLeague) {
      throw new Error('Forbidden: You do not share a league with this player');
    }
  }

  // Check if viewer has liked this town
  const visitRef = db.collection('townVisits').doc(`${hostUid}_${viewerUid}`);
  const visitSnap = await visitRef.get();
  const hasLiked = visitSnap.exists && visitSnap.data()?.liked === true;

  return { snapshot, hasLiked };
}

/**
 * Likes a friend's town idempotently. Increments likesCount on town/main and townSnapshots.
 */
export async function likeTown(
  db: Firestore,
  hostUid: string,
  viewerUid: string,
): Promise<{ ok: boolean; likesCount: number }> {
  await assertTownFeatureEnabled(db, 'enabled');

  if (!hostUid) throw new Error('Missing hostUid');
  if (!viewerUid) throw new Error('Missing viewerUid');
  if (hostUid === viewerUid) {
    throw new Error('Cannot like your own town');
  }

  // Verify league membership
  const [hostSnap, viewerDoc] = await Promise.all([
    db.collection('townSnapshots').doc(hostUid).get(),
    db.collection('users').doc(viewerUid).get(),
  ]);

  if (!hostSnap.exists) {
    throw new Error('Town not found');
  }

  const hostLeagues: string[] = hostSnap.data()?.leagueIds || [];
  const viewerLeagues: string[] = viewerDoc.data()?.leagueIds || [];
  const sharesLeague = viewerLeagues.some((lg) => hostLeagues.includes(lg));
  if (!sharesLeague) {
    throw new Error('Forbidden: You do not share a league with this player');
  }

  const visitRef = db.collection('townVisits').doc(`${hostUid}_${viewerUid}`);
  const townRef = db.collection('users').doc(hostUid).collection('town').doc('main');
  const snapshotRef = db.collection('townSnapshots').doc(hostUid);

  return await db.runTransaction(async (tx) => {
    const visitSnap = await tx.get(visitRef);
    if (visitSnap.exists && visitSnap.data()?.liked) {
      const currentCount = hostSnap.data()?.likesCount ?? 0;
      return { ok: true, likesCount: currentCount };
    }

    tx.set(
      visitRef,
      {
        hostUid,
        viewerUid,
        liked: true,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    tx.update(townRef, {
      likesCount: FieldValue.increment(1),
    });

    tx.update(snapshotRef, {
      likesCount: FieldValue.increment(1),
    });

    const currentCount = hostSnap.data()?.likesCount ?? 0;
    return { ok: true, likesCount: currentCount + 1 };
  });
}
