import { FieldValue, type Firestore, Timestamp } from 'firebase-admin/firestore';
import {
  calculateLazyArrivals,
  calculateTownCapacities,
  calculateTownLevel,
  DEFAULT_TOWN_CATALOG,
  getGridSizeForLevel,
  getPlotPrice,
  type CatalogItem,
  type TownCatalogDoc,
  type TownDoc,
  type TownTileDoc,
} from '@ronduel/shared';
import { assertTownFeatureEnabled } from './town-economy.js';
import { creditWallet, debitWallet } from './town-wallet.js';
import { publishTownSnapshot } from './town-snapshots.js';

export async function getTownCatalog(db: Firestore): Promise<TownCatalogDoc> {
  try {
    const snap = await db.collection('config').doc('townCatalog').get();
    if (snap.exists) {
      return snap.data() as TownCatalogDoc;
    }
  } catch {
    // fallback to default
  }
  return DEFAULT_TOWN_CATALOG;
}

export interface BuildItemParams {
  itemId: string;
  x: number;
  y: number;
}

export async function buildItem(
  db: Firestore,
  uid: string,
  params: BuildItemParams,
): Promise<{ success: boolean; town: TownDoc; tile: TownTileDoc }> {
  const economy = await assertTownFeatureEnabled(db);
  const catalog = await getTownCatalog(db);
  const item: CatalogItem | undefined = catalog.items[params.itemId];

  if (!item) {
    throw new Error(`Invalid catalog item: ${params.itemId}`);
  }
  if (item.type === 'crop') {
    throw new Error('Crops must be planted on a farm plot, not built on ground');
  }
  if (params.itemId === 'starter_house') {
    throw new Error('Starter house cannot be purchased');
  }

  const townRef = db.collection('users').doc(uid).collection('town').doc('main');
  const userRef = db.collection('users').doc(uid);

  const result = await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const userData = userSnap.data() || {};
    const isPro = Boolean(userData.pro?.active);
    const currentStreak = Number(userData.streak?.length ?? 0);

    if (item.proOnly && !isPro) {
      throw new Error('Item requires an active Pro subscription');
    }
    if (item.streakUnlock && currentStreak < item.streakUnlock) {
      throw new Error(`Item requires a ${item.streakUnlock}-day streak`);
    }

    const townSnap = await tx.get(townRef);
    if (!townSnap.exists) {
      throw new Error('Town not initialized. Open town first.');
    }
    const townData = townSnap.data() as TownDoc;

    // Check level requirements (level never goes down: check maxLevelReached)
    if (item.unlockLevel > townData.maxLevelReached) {
      throw new Error(`Item requires Town Level ${item.unlockLevel}`);
    }

    // Footprint check
    const { w, h } = item.footprint;
    const gridSize = townData.gridSize;
    if (params.x < 0 || params.y < 0 || params.x + w > gridSize || params.y + h > gridSize) {
      throw new Error('Building placement out of bounds');
    }

    // Fetch existing tiles to check collision and count
    const tilesSnap = await tx.get(db.collection('users').doc(uid).collection('townTiles'));
    const existingTiles: TownTileDoc[] = [];
    let countOfThisItem = 0;

    for (const doc of tilesSnap.docs) {
      const t = doc.data() as TownTileDoc;
      existingTiles.push(t);
      if (t.itemId === params.itemId) {
        countOfThisItem += 1;
      }
    }

    if (item.maxCount && countOfThisItem >= item.maxCount) {
      throw new Error(`Maximum limit of ${item.maxCount} reached for this item`);
    }

    // Check collision for footprint
    const occupiedKeys = new Set(existingTiles.map((t) => `${t.x}_${t.y}`));
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const coordKey = `${params.x + dx}_${params.y + dy}`;
        if (occupiedKeys.has(coordKey)) {
          throw new Error(`Tile (${params.x + dx}, ${params.y + dy}) is already occupied`);
        }
      }
    }

    // Debit wallet if price > 0
    if (item.priceCoins > 0) {
      await debitWallet({
        transaction: tx,
        db,
        uid,
        amount: item.priceCoins,
        reason: 'spend',
        refId: params.itemId,
        idempotencyKey: `build:${uid}:${params.itemId}:${params.x}_${params.y}_${Date.now()}`,
      });
    }

    // Place new tile
    const newTileRef = db
      .collection('users')
      .doc(uid)
      .collection('townTiles')
      .doc(`${params.x}_${params.y}`);

    const newTile: TownTileDoc = {
      itemId: params.itemId,
      x: params.x,
      y: params.y,
      placedAt: FieldValue.serverTimestamp(),
    };
    tx.set(newTileRef, newTile);

    // If multi-tile (2x2), also place footprint child placeholders
    if (w > 1 || h > 1) {
      for (let dx = 0; dx < w; dx++) {
        for (let dy = 0; dy < h; dy++) {
          if (dx === 0 && dy === 0) continue;
          const childRef = db
            .collection('users')
            .doc(uid)
            .collection('townTiles')
            .doc(`${params.x + dx}_${params.y + dy}`);
          tx.set(childRef, {
            itemId: `part:${params.itemId}`,
            x: params.x + dx,
            y: params.y + dy,
            parentTile: `${params.x}_${params.y}`,
            placedAt: FieldValue.serverTimestamp(),
          });
        }
      }
    }

    // Recalculate town capacities
    const allTiles = [...existingTiles, newTile];
    const caps = calculateTownCapacities(allTiles, catalog, economy.baseServiceCapacity);

    // Lazy arrivals update
    const nowSeconds = Math.floor(Date.now() / 1000);
    const lastArrivalSeconds = townData.lastArrivalAt
      ? ((townData.lastArrivalAt as Timestamp).seconds ?? nowSeconds)
      : nowSeconds;

    const arrivalsCalc = calculateLazyArrivals({
      population: townData.population,
      populationCap: caps.populationCap,
      lastArrivalSeconds,
      nowSeconds,
      arrivalIntervalSeconds: economy.arrivalIntervalSeconds,
    });

    const newLevel = calculateTownLevel(arrivalsCalc.newPopulation);
    const maxLevel = Math.max(townData.maxLevelReached, newLevel);
    const newGridSize = getGridSizeForLevel(maxLevel);

    let tutorialStep = townData.tutorialStep ?? 0;
    if (tutorialStep === 1 && params.itemId === 'cottage') {
      tutorialStep = 2; // Advance tutorial
    }

    const updatedTown: TownDoc = {
      ...townData,
      housingCapacity: caps.housingCapacity,
      serviceCapacity: caps.serviceCapacity,
      populationCap: caps.populationCap,
      population: arrivalsCalc.newPopulation,
      lastArrivalAt: FieldValue.serverTimestamp(),
      level: newLevel,
      maxLevelReached: maxLevel,
      gridSize: newGridSize,
      tutorialStep,
      updatedAt: FieldValue.serverTimestamp(),
    };

    tx.update(townRef, { ...updatedTown });

    return {
      success: true,
      town: updatedTown,
      tile: newTile,
    };
  });

  await publishTownSnapshot(db, uid).catch(() => {});
  return result;
}

export async function removeTile(
  db: Firestore,
  uid: string,
  params: { x: number; y: number },
): Promise<{ success: boolean; refundCoins: number }> {
  const economy = await assertTownFeatureEnabled(db);
  const catalog = await getTownCatalog(db);

  const tileRef = db
    .collection('users')
    .doc(uid)
    .collection('townTiles')
    .doc(`${params.x}_${params.y}`);
  const townRef = db.collection('users').doc(uid).collection('town').doc('main');

  const result = await db.runTransaction(async (tx) => {
    const tileSnap = await tx.get(tileRef);
    if (!tileSnap.exists) {
      throw new Error(`No tile found at (${params.x}, ${params.y})`);
    }

    const tileData = tileSnap.data() as TownTileDoc & { parentTile?: string };
    if (tileData.parentTile) {
      throw new Error('Please select the main building tile to remove');
    }
    if (tileData.itemId === 'starter_house') {
      throw new Error('The Starter House cannot be removed');
    }

    const item = catalog.items[tileData.itemId];
    const refundCoins = item ? Math.floor(item.priceCoins * economy.removeRefundRate) : 0;

    // Delete tile
    tx.delete(tileRef);

    // Delete multi-tile parts if any
    if (item && (item.footprint.w > 1 || item.footprint.h > 1)) {
      for (let dx = 0; dx < item.footprint.w; dx++) {
        for (let dy = 0; dy < item.footprint.h; dy++) {
          if (dx === 0 && dy === 0) continue;
          const childRef = db
            .collection('users')
            .doc(uid)
            .collection('townTiles')
            .doc(`${params.x + dx}_${params.y + dy}`);
          tx.delete(childRef);
        }
      }
    }

    // Refund coins to 'town' bucket if applicable
    if (refundCoins > 0) {
      await creditWallet({
        transaction: tx,
        db,
        uid,
        amount: refundCoins,
        bucket: 'town',
        reason: 'remove_refund',
        refId: tileData.itemId,
        idempotencyKey: `remove_refund:${uid}:${params.x}_${params.y}_${Date.now()}`,
      });
    }

    // Recalculate town capacities
    const tilesSnap = await tx.get(db.collection('users').doc(uid).collection('townTiles'));
    const remainingTiles: TownTileDoc[] = [];
    for (const doc of tilesSnap.docs) {
      if (doc.id !== `${params.x}_${params.y}`) {
        remainingTiles.push(doc.data() as TownTileDoc);
      }
    }

    const caps = calculateTownCapacities(remainingTiles, catalog, economy.baseServiceCapacity);
    const townSnap = await tx.get(townRef);
    const townData = townSnap.data() as TownDoc;

    // If population exceeds new cap, immediately clamp to cap
    const newPopulation = Math.min(townData.population, caps.populationCap);
    const newLevel = calculateTownLevel(newPopulation);

    tx.update(townRef, {
      housingCapacity: caps.housingCapacity,
      serviceCapacity: caps.serviceCapacity,
      populationCap: caps.populationCap,
      population: newPopulation,
      level: newLevel,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      refundCoins,
    };
  });

  await publishTownSnapshot(db, uid).catch(() => {});
  return result;
}

export async function moveTile(
  db: Firestore,
  uid: string,
  params: { fromX: number; fromY: number; toX: number; toY: number },
): Promise<{ success: boolean }> {
  await assertTownFeatureEnabled(db);
  const catalog = await getTownCatalog(db);

  const fromRef = db
    .collection('users')
    .doc(uid)
    .collection('townTiles')
    .doc(`${params.fromX}_${params.fromY}`);
  const townRef = db.collection('users').doc(uid).collection('town').doc('main');

  const result = await db.runTransaction(async (tx) => {
    const fromSnap = await tx.get(fromRef);
    if (!fromSnap.exists) {
      throw new Error(`No tile at (${params.fromX}, ${params.fromY})`);
    }
    const tileData = fromSnap.data() as TownTileDoc & { parentTile?: string };
    if (tileData.parentTile) {
      throw new Error('Please select the main building tile to move');
    }

    const townSnap = await tx.get(townRef);
    const townData = townSnap.data() as TownDoc;
    const item = catalog.items[tileData.itemId];
    const w = item?.footprint.w ?? 1;
    const h = item?.footprint.h ?? 1;

    if (
      params.toX < 0 ||
      params.toY < 0 ||
      params.toX + w > townData.gridSize ||
      params.toY + h > townData.gridSize
    ) {
      throw new Error('Destination out of bounds');
    }

    // Check collision at destination
    const tilesSnap = await tx.get(db.collection('users').doc(uid).collection('townTiles'));
    for (const doc of tilesSnap.docs) {
      const t = doc.data() as TownTileDoc;
      // Exclude self footprint tiles
      const isSelf =
        t.x >= params.fromX &&
        t.x < params.fromX + w &&
        t.y >= params.fromY &&
        t.y < params.fromY + h;
      if (isSelf) continue;

      for (let dx = 0; dx < w; dx++) {
        for (let dy = 0; dy < h; dy++) {
          if (t.x === params.toX + dx && t.y === params.toY + dy) {
            throw new Error(
              `Destination tile (${params.toX + dx}, ${params.toY + dy}) is already occupied`,
            );
          }
        }
      }
    }

    // Delete old tile(s)
    tx.delete(fromRef);
    if (w > 1 || h > 1) {
      for (let dx = 0; dx < w; dx++) {
        for (let dy = 0; dy < h; dy++) {
          if (dx === 0 && dy === 0) continue;
          tx.delete(
            db
              .collection('users')
              .doc(uid)
              .collection('townTiles')
              .doc(`${params.fromX + dx}_${params.fromY + dy}`),
          );
        }
      }
    }

    // Place at new destination
    const toRef = db
      .collection('users')
      .doc(uid)
      .collection('townTiles')
      .doc(`${params.toX}_${params.toY}`);
    tx.set(toRef, {
      ...tileData,
      x: params.toX,
      y: params.toY,
    });

    if (w > 1 || h > 1) {
      for (let dx = 0; dx < w; dx++) {
        for (let dy = 0; dy < h; dy++) {
          if (dx === 0 && dy === 0) continue;
          tx.set(
            db
              .collection('users')
              .doc(uid)
              .collection('townTiles')
              .doc(`${params.toX + dx}_${params.toY + dy}`),
            {
              itemId: `part:${tileData.itemId}`,
              x: params.toX + dx,
              y: params.toY + dy,
              parentTile: `${params.toX}_${params.toY}`,
              placedAt: FieldValue.serverTimestamp(),
            },
          );
        }
      }
    }

    return { success: true };
  });

  await publishTownSnapshot(db, uid).catch(() => {});
  return result;
}

export async function buyFarmPlot(
  db: Firestore,
  uid: string,
  params: { x: number; y: number },
): Promise<{ success: boolean; cost: number; plotsOwned: number }> {
  await assertTownFeatureEnabled(db);

  const townRef = db.collection('users').doc(uid).collection('town').doc('main');
  const tileRef = db
    .collection('users')
    .doc(uid)
    .collection('townTiles')
    .doc(`${params.x}_${params.y}`);

  const result = await db.runTransaction(async (tx) => {
    const townSnap = await tx.get(townRef);
    if (!townSnap.exists) {
      throw new Error('Town not initialized');
    }
    const townData = townSnap.data() as TownDoc;
    const currentPlots = townData.plotsOwned ?? 2;

    if (currentPlots >= 12) {
      throw new Error('Maximum of 12 farm plots already reached');
    }

    if (
      params.x < 0 ||
      params.y < 0 ||
      params.x >= townData.gridSize ||
      params.y >= townData.gridSize
    ) {
      throw new Error('Plot placement out of bounds');
    }

    const tileSnap = await tx.get(tileRef);
    if (tileSnap.exists) {
      throw new Error('Tile is already occupied');
    }

    const cost = getPlotPrice(currentPlots);

    if (cost > 0) {
      await debitWallet({
        transaction: tx,
        db,
        uid,
        amount: cost,
        reason: 'spend',
        refId: 'plot',
        idempotencyKey: `buy_plot:${uid}:${params.x}_${params.y}_${Date.now()}`,
      });
    }

    const newPlot: TownTileDoc = {
      itemId: 'plot',
      x: params.x,
      y: params.y,
      placedAt: FieldValue.serverTimestamp(),
    };
    tx.set(tileRef, newPlot);

    const nextPlotsOwned = currentPlots + 1;
    tx.update(townRef, {
      plotsOwned: nextPlotsOwned,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      cost,
      plotsOwned: nextPlotsOwned,
    };
  });

  await publishTownSnapshot(db, uid).catch(() => {});
  return result;
}
