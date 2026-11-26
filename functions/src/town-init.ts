import { FieldValue, type Firestore, Timestamp } from 'firebase-admin/firestore';
import {
  generateStarterLand,
  type TownDoc,
  type TownTileDoc,
  type TownInventoryDoc,
} from '@ronduel/shared';
import { assertTownFeatureEnabled } from './town-economy.js';
import { prepareCreditWallet } from './town-wallet.js';

export interface InitTownResult {
  created: boolean;
  town: TownDoc;
  features: {
    speedupEnabled: boolean;
  };
}

/**
 * Idempotently initializes a player's starting town.
 * If town already exists, returns existing town without modifications.
 * If not, provisions starting 8x8 town with 1 Starter House, 2 villagers,
 * 2 farm plots, 5-8 edge-connected starter grass tiles, and credits 100 starter coins to the 'town' bucket.
 */
export async function initPlayerTown(db: Firestore, uid: string): Promise<InitTownResult> {
  const economy = await assertTownFeatureEnabled(db);

  const townRef = db.collection('users').doc(uid).collection('town').doc('main');
  const inventoryRef = db.collection('users').doc(uid).collection('townInventory').doc('main');
  const starterHouseRef = db.collection('users').doc(uid).collection('townTiles').doc('3_3');
  const plot1Ref = db.collection('users').doc(uid).collection('townTiles').doc('3_4');
  const plot2Ref = db.collection('users').doc(uid).collection('townTiles').doc('4_4');

  const result = await db.runTransaction(async (tx) => {
    // Read phase: read town doc and prepare starter coin credit before any writes
    const existingSnap = await tx.get(townRef);
    if (existingSnap.exists) {
      const existingTown = existingSnap.data() as TownDoc;
      if (!existingTown.createdAt && !existingTown.familyClockStartAt) {
        const nowTs = Timestamp.now();
        tx.update(townRef, { familyClockStartAt: nowTs });
        return {
          created: false,
          town: { ...existingTown, familyClockStartAt: nowTs },
        };
      }
      return {
        created: false,
        town: existingTown,
      };
    }

    // Prepare 100 starter coins to 'town' bucket (one-time idempotent) before writes
    const starterCredit = await prepareCreditWallet({
      transaction: tx,
      db,
      uid,
      amount: economy.starterCoins,
      bucket: 'town',
      reason: 'starter',
      refId: 'starter_grant',
      idempotencyKey: `starter:${uid}`,
    });

    const starterLand = generateStarterLand(
      [
        { x: 3, y: 3 },
        { x: 3, y: 4 },
        { x: 4, y: 4 },
      ],
      8,
    );

    const newTown: TownDoc = {
      gridSize: 8,
      population: 2,
      housingCapacity: 2,
      serviceCapacity: economy.baseServiceCapacity,
      populationCap: Math.min(2, economy.baseServiceCapacity),
      lastArrivalAt: FieldValue.serverTimestamp(),
      level: 1,
      maxLevelReached: 1,
      tutorialStep: 0,
      likesCount: 0,
      plotsOwned: 2,
      land: starterLand,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Write phase
    tx.set(townRef, newTown);

    const starterHouse: TownTileDoc = {
      itemId: 'starter_house',
      x: 3,
      y: 3,
      placedAt: FieldValue.serverTimestamp(),
    };
    tx.set(starterHouseRef, starterHouse);

    const plot1: TownTileDoc = {
      itemId: 'plot',
      x: 3,
      y: 4,
      placedAt: FieldValue.serverTimestamp(),
    };
    tx.set(plot1Ref, plot1);

    const plot2: TownTileDoc = {
      itemId: 'plot',
      x: 4,
      y: 4,
      placedAt: FieldValue.serverTimestamp(),
    };
    tx.set(plot2Ref, plot2);

    const inventory: TownInventoryDoc = {
      crops: {},
    };
    tx.set(inventoryRef, inventory);

    starterCredit.apply();

    return {
      created: true,
      town: newTown,
    };
  });

  if (result.created) {
    try {
      const { publishTownSnapshot } = await import('./town-snapshots.js');
      await publishTownSnapshot(db, uid);
    } catch (e) {
      // Snapshot publishing failure shouldn't abort init
    }
  }

  return {
    ...result,
    features: {
      speedupEnabled: Boolean(economy.speedupEnabled),
    },
  };
}
