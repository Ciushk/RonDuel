import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { assertTownFeatureEnabled } from './town-economy.js';
import { creditWallet } from './town-wallet.js';
import { publishTownSnapshot } from './town-snapshots.js';
import { getTodayDateString } from './town-transfer.js';
import type { TownTileDoc } from '@ronduel/shared';

export interface WaterCropParams {
  helperUid: string;
  hostUid: string;
  tileX: number;
  tileY: number;
  now?: Date;
}

/**
 * Waters a friend's growing crop plot in their town.
 * Reduces grow time by 30 minutes (1,800s) and grants helper 1 coin (up to daily cap).
 */
export async function waterFriendCrop(
  db: Firestore,
  params: WaterCropParams,
): Promise<{
  success: boolean;
  reducedSeconds: number;
  helperRewarded: boolean;
  newReadyAtSeconds: number;
}> {
  const economy = await assertTownFeatureEnabled(db, 'helpEnabled');
  const helpCfg = economy.help;

  const { helperUid, hostUid, tileX, tileY, now = new Date() } = params;

  if (!helperUid || !hostUid || helperUid === 'anon' || hostUid === 'anon') {
    throw new Error('Invalid helper or host');
  }
  if (helperUid === hostUid) {
    throw new Error('You cannot water your own crops for helper rewards');
  }

  // Verify league membership
  const [helperUserSnap, hostUserSnap] = await Promise.all([
    db.collection('users').doc(helperUid).get(),
    db.collection('users').doc(hostUid).get(),
  ]);

  if (!helperUserSnap.exists || !hostUserSnap.exists) {
    throw new Error('User profile not found');
  }

  const helperLeagues: string[] = helperUserSnap.data()?.leagueIds || [];
  const hostLeagues: string[] = hostUserSnap.data()?.leagueIds || [];
  const sharesLeague = helperLeagues.some((lg) => hostLeagues.includes(lg));
  if (!sharesLeague) {
    throw new Error('You can only help friends in the same league');
  }

  const todayStr = getTodayDateString(now);
  const nowSeconds = Math.floor(now.getTime() / 1000);

  const helperDailyRef = db
    .collection('users')
    .doc(helperUid)
    .collection('townHelpDaily')
    .doc(todayStr);

  const friendHelpKey = `${hostUid}_${todayStr}`;
  const friendDailyRef = db
    .collection('users')
    .doc(helperUid)
    .collection('townHelpFriends')
    .doc(friendHelpKey);

  const tileRef = db
    .collection('users')
    .doc(hostUid)
    .collection('townTiles')
    .doc(`${tileX}_${tileY}`);

  const result = await db.runTransaction(async (tx) => {
    // 1. Check helper daily cap across all friends
    const helperDailySnap = await tx.get(helperDailyRef);
    const helperDailyTotal =
      (helperDailySnap.exists ? helperDailySnap.data()?.rewardCount : 0) || 0;

    // 2. Check actions on this specific friend today
    const friendDailySnap = await tx.get(friendDailyRef);
    const friendActionsCount =
      (friendDailySnap.exists ? friendDailySnap.data()?.actionCount : 0) || 0;

    if (friendActionsCount >= helpCfg.actionsPerFriendPerDay) {
      throw new Error(
        `You have reached the daily limit of ${helpCfg.actionsPerFriendPerDay} helps for this friend today`,
      );
    }

    // 3. Inspect target tile on host town
    const tileSnap = await tx.get(tileRef);
    if (!tileSnap.exists) {
      throw new Error(`Tile at (${tileX}, ${tileY}) not found`);
    }

    const tileData = tileSnap.data() as TownTileDoc;
    if (tileData.itemId !== 'plot' || !tileData.cropId) {
      throw new Error('This tile does not contain a growing crop to water');
    }

    const readyAtSeconds = tileData.readyAt ? (tileData.readyAt as Timestamp).seconds : 0;
    if (readyAtSeconds <= nowSeconds) {
      throw new Error('This crop is already fully grown and ready to harvest');
    }

    // 4. Reduce grow time by waterReducesSeconds (1800s / 30m)
    const newReadyAtSeconds = Math.max(nowSeconds, readyAtSeconds - helpCfg.waterReducesSeconds);
    const newWaterCount = (tileData.waterCount ?? 0) + 1;

    tx.update(tileRef, {
      readyAt: Timestamp.fromMillis(newReadyAtSeconds * 1000),
      waterCount: newWaterCount,
    });

    // 5. Update helper friend counter
    tx.set(
      friendDailyRef,
      {
        hostUid,
        date: todayStr,
        actionCount: friendActionsCount + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // 6. Reward helper if under helperDailyCap (5 coins/day)
    let helperRewarded = false;
    if (helperDailyTotal < helpCfg.helperDailyCap) {
      helperRewarded = true;
      tx.set(
        helperDailyRef,
        {
          date: todayStr,
          rewardCount: helperDailyTotal + helpCfg.helperRewardCoins,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      await creditWallet({
        transaction: tx,
        db,
        uid: helperUid,
        amount: helpCfg.helperRewardCoins,
        bucket: 'town',
        reason: 'help_reward',
        refId: `${hostUid}_${tileX}_${tileY}`,
        idempotencyKey: `help_reward:${helperUid}:${hostUid}:${tileX}_${tileY}:${todayStr}_${friendActionsCount}`,
      });
    }

    return {
      success: true,
      reducedSeconds: readyAtSeconds - newReadyAtSeconds,
      helperRewarded,
      newReadyAtSeconds,
    };
  });

  // Re-publish host town snapshot
  await publishTownSnapshot(db, hostUid).catch(() => {});

  return result;
}

/**
 * Returns friend watering status: how many times current user helped this friend today.
 */
export async function getFriendWaterStatus(
  db: Firestore,
  helperUid: string,
  hostUid: string,
  now: Date = new Date(),
): Promise<{
  actionsUsed: number;
  actionsMax: number;
  remaining: number;
}> {
  const economy = await assertTownFeatureEnabled(db, 'helpEnabled');
  const maxActions = economy.help.actionsPerFriendPerDay;
  const todayStr = getTodayDateString(now);

  const friendHelpKey = `${hostUid}_${todayStr}`;
  const friendDailyDoc = await db
    .collection('users')
    .doc(helperUid)
    .collection('townHelpFriends')
    .doc(friendHelpKey)
    .get();

  const actionsUsed = (friendDailyDoc.exists ? friendDailyDoc.data()?.actionCount : 0) || 0;
  return {
    actionsUsed,
    actionsMax: maxActions,
    remaining: Math.max(0, maxActions - actionsUsed),
  };
}
