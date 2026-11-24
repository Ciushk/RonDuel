import { calculateTriviaCoins, type TownEconomyConfig } from '@ronduel/shared';
import type { Firestore } from 'firebase-admin/firestore';
import { getTownEconomyConfig } from './town-economy.js';
import { creditWallet, type CreditWalletResult } from './town-wallet.js';

export interface RawPlayPayload {
  playId?: string;
  uid?: string;
  date?: string;
  roundNumber?: number;
  mode?: string;
  status?: string;
  totalScore?: number;
}

export interface AwardTriviaResult {
  awarded: boolean;
  skipped: boolean;
  duplicate?: boolean;
  coins?: number;
  reason?: string;
}

/**
 * Validates the raw JSON payload from store_plays/{playId}.
 * Returns null and logs an error if invalid.
 */
export function parseAndValidatePlayPayload(rawV: unknown, docId: string): RawPlayPayload | null {
  if (typeof rawV !== 'string') {
    console.error(`[awardTriviaCoins] docId=${docId} payload 'v' is not a string.`);
    return null;
  }

  try {
    const parsed = JSON.parse(rawV);
    if (!parsed || typeof parsed !== 'object') {
      console.error(`[awardTriviaCoins] docId=${docId} JSON parsed is not an object.`);
      return null;
    }

    const { playId, uid, date, roundNumber, mode, status, totalScore } = parsed;

    if (typeof uid !== 'string' || uid.length < 3) {
      console.error(`[awardTriviaCoins] docId=${docId} invalid or missing uid: ${uid}`);
      return null;
    }

    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error(`[awardTriviaCoins] docId=${docId} invalid or missing date: ${date}`);
      return null;
    }

    return {
      playId: typeof playId === 'string' ? playId : docId,
      uid,
      date,
      roundNumber: typeof roundNumber === 'number' ? roundNumber : undefined,
      mode: typeof mode === 'string' ? mode : undefined,
      status: typeof status === 'string' ? status : undefined,
      totalScore: typeof totalScore === 'number' ? totalScore : 0,
    };
  } catch (err) {
    console.error(`[awardTriviaCoins] docId=${docId} JSON parse failed:`, err);
    return null;
  }
}

/**
 * Core business logic for awarding trivia coins from a verified daily play.
 * Decoupled from Firebase function trigger for easy unit & emulator testing.
 */
export async function processAwardTriviaCoins(
  db: Firestore,
  rawV: unknown,
  docId: string,
  forcedEconomyConfig?: TownEconomyConfig,
): Promise<AwardTriviaResult> {
  // 1. Safe JSON parse and validation
  const play = parseAndValidatePlayPayload(rawV, docId);
  if (!play) {
    return { awarded: false, skipped: true, reason: 'invalid_payload' };
  }

  // 2. Play must be finished
  if (play.status !== 'finished') {
    return { awarded: false, skipped: true, reason: 'not_finished' };
  }

  // 3. Filter strictly to official daily round: ignore duels, practice, or unnumbered rounds
  if (play.mode && play.mode !== 'daily') {
    return { awarded: false, skipped: true, reason: 'not_daily_round_mode' };
  }

  if (typeof play.roundNumber !== 'number' || play.roundNumber <= 0) {
    return { awarded: false, skipped: true, reason: 'missing_round_number' };
  }

  // 4. Server-side kill switch check
  const economy = forcedEconomyConfig || (await getTownEconomyConfig(db));
  if (!economy.enabled) {
    return { awarded: false, skipped: true, reason: 'town_economy_disabled' };
  }

  const uid = play.uid!;
  const roundId = `round_${play.roundNumber}`;
  const idempotencyKey = `trivia:${uid}:${roundId}`;

  // 5. Atomic transaction: read server-side Pro entitlement from users/{uid}, compute coins, credit wallet
  let creditRes: CreditWalletResult;
  try {
    creditRes = await db.runTransaction(async (transaction) => {
      // Server-side entitlement check
      const userRef = db.collection('users').doc(uid);
      const userSnap = await transaction.get(userRef);
      const isPro = userSnap.exists && userSnap.data()?.pro?.active === true;

      // Compute coins
      const totalScore = play.totalScore ?? 0;
      const coins = calculateTriviaCoins(totalScore, isPro, economy);

      if (coins <= 0) {
        // Unlock orders even if 0 coins awarded
        const ordersRef = db.collection('users').doc(uid).collection('townOrders').doc(play.date!);
        transaction.set(ordersRef, { unlocked: true }, { merge: true });
        return { duplicate: false, amount: 0 };
      }

      // Credit wallet
      const res = await creditWallet({
        transaction,
        db,
        uid,
        amount: coins,
        bucket: 'trivia',
        reason: 'trivia_award',
        refId: roundId,
        idempotencyKey,
      });

      if (!res.duplicate) {
        // Unlock town orders for that day
        const ordersRef = db.collection('users').doc(uid).collection('townOrders').doc(play.date!);
        transaction.set(ordersRef, { unlocked: true }, { merge: true });
      }

      return res;
    });
  } catch (err) {
    console.error(`[awardTriviaCoins] Transaction error for uid=${uid}:`, err);
    throw err;
  }

  if (creditRes.duplicate) {
    return { awarded: false, skipped: true, duplicate: true, reason: 'already_awarded' };
  }

  console.info(
    `[awardTriviaCoins] Awarded ${creditRes.amount ?? 0} coins to ${uid} for ${roundId}`,
  );

  return {
    awarded: true,
    skipped: false,
    coins: creditRes.amount ?? 0,
  };
}
