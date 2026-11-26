import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { assertTownFeatureEnabled } from './town-economy.js';
import { prepareCreditWallet, prepareDebitWallet } from './town-wallet.js';
import type { WalletDoc } from '@ronduel/shared';

export interface TransferCoinsParams {
  senderUid: string;
  receiverUid: string;
  amount: number;
  now?: Date;
}

export function getTodayDateString(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getMonthString(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Executes a RonCoins transfer from a Pro sender to a league friend.
 * Enforces all anti-fraud / economy invariants:
 * - transfersEnabled kill switch
 * - Sender is Pro
 * - Source bucket is strictly 'trivia'
 * - Both users share at least one league
 * - Sender account age >= 7 days
 * - Daily sender cap (50 coins)
 * - Monthly receiver cap (500 coins)
 * - Atomic sender debit ('transfer_out') & receiver credit to 'gift' bucket ('transfer_in')
 */
export async function transferCoins(
  db: Firestore,
  params: TransferCoinsParams,
): Promise<{ success: boolean; senderBalanceAfter: number; receiverUid: string; amount: number }> {
  const economy = await assertTownFeatureEnabled(db, 'transfersEnabled');
  const transferCfg = economy.transfer;

  const { senderUid, receiverUid, amount, now = new Date() } = params;

  if (!senderUid || !receiverUid || senderUid === 'anon' || receiverUid === 'anon') {
    throw new Error('Invalid sender or receiver');
  }
  if (senderUid === receiverUid) {
    throw new Error('Cannot transfer coins to yourself');
  }
  if (amount <= 0 || !Number.isInteger(amount)) {
    throw new Error('Transfer amount must be a positive integer');
  }

  // 1. Fetch sender and receiver profiles
  const [senderUserSnap, receiverUserSnap] = await Promise.all([
    db.collection('users').doc(senderUid).get(),
    db.collection('users').doc(receiverUid).get(),
  ]);

  if (!senderUserSnap.exists) {
    throw new Error('Sender user profile not found');
  }
  if (!receiverUserSnap.exists) {
    throw new Error('Recipient user profile not found');
  }

  const senderUser = senderUserSnap.data() || {};
  const receiverUser = receiverUserSnap.data() || {};

  // 2. Sender must be Pro (if proSenderOnly is true)
  if (transferCfg.proSenderOnly && !senderUser.pro?.active) {
    throw new Error('Transferring RonCoins requires an active Pro subscription');
  }

  // 3. Sender account age must be >= minAccountAgeDays (7 days)
  const createdAtMs = senderUser.createdAt
    ? typeof senderUser.createdAt?.toMillis === 'function'
      ? senderUser.createdAt.toMillis()
      : typeof senderUser.createdAt === 'number'
        ? senderUser.createdAt
        : typeof senderUser.createdAt === 'string'
          ? new Date(senderUser.createdAt).getTime()
          : 0
    : 0;

  const accountAgeDays = (now.getTime() - createdAtMs) / (1000 * 60 * 60 * 24);
  if (createdAtMs > 0 && accountAgeDays < transferCfg.minAccountAgeDays) {
    throw new Error(
      `Your account must be at least ${transferCfg.minAccountAgeDays} days old to transfer coins`,
    );
  }

  // 4. Same league verification
  if (transferCfg.sameLeagueOnly) {
    const senderLeagues: string[] = Array.isArray(senderUser.leagueIds) ? senderUser.leagueIds : [];
    const receiverLeagues: string[] = Array.isArray(receiverUser.leagueIds)
      ? receiverUser.leagueIds
      : [];
    const sharesLeague = senderLeagues.some((lg) => receiverLeagues.includes(lg));
    if (!sharesLeague) {
      throw new Error('You can only transfer RonCoins to friends in the same league');
    }
  }

  const todayStr = getTodayDateString(now);
  const monthStr = getMonthString(now);

  const senderDailyRef = db
    .collection('users')
    .doc(senderUid)
    .collection('townTransferDaily')
    .doc(todayStr);

  const receiverMonthlyRef = db
    .collection('users')
    .doc(receiverUid)
    .collection('townTransferMonthly')
    .doc(monthStr);

  const senderWalletRef = db.collection('users').doc(senderUid).collection('wallet').doc('main');
  const transferDocId = `tr_${senderUid}_${receiverUid}_${now.getTime()}`;
  const transferRecordRef = db.collection('townTransfers').doc(transferDocId);

  return await db.runTransaction(async (tx) => {
    // Read phase: all tx.get calls (caps + sender debit + receiver credit) before any writes
    // 5. Check sender trivia bucket balance
    const senderWalletSnap = await tx.get(senderWalletRef);
    const senderWallet = (senderWalletSnap.exists ? senderWalletSnap.data() : {}) as WalletDoc;
    const triviaCoins = senderWallet?.buckets?.trivia ?? 0;

    if (triviaCoins < amount) {
      throw new Error(
        `Insufficient trivia coins: you have ${triviaCoins} trivia coins available to transfer (only trivia-earned coins can be shared)`,
      );
    }

    // 6. Check sender daily limit
    const senderDailySnap = await tx.get(senderDailyRef);
    const senderDailySent = (senderDailySnap.exists ? senderDailySnap.data()?.totalSent : 0) || 0;
    if (senderDailySent + amount > transferCfg.dailyCapSender) {
      const remaining = Math.max(0, transferCfg.dailyCapSender - senderDailySent);
      throw new Error(
        `Daily transfer cap reached: you have ${remaining} coins left to send today (max ${transferCfg.dailyCapSender}/day)`,
      );
    }

    // 7. Check receiver monthly limit
    const receiverMonthlySnap = await tx.get(receiverMonthlyRef);
    const receiverMonthlyReceived =
      (receiverMonthlySnap.exists ? receiverMonthlySnap.data()?.totalReceived : 0) || 0;
    if (receiverMonthlyReceived + amount > transferCfg.monthlyCapReceiver) {
      const remaining = Math.max(0, transferCfg.monthlyCapReceiver - receiverMonthlyReceived);
      throw new Error(
        `Friend's monthly gift cap reached: friend can receive up to ${remaining} more coins this month (max ${transferCfg.monthlyCapReceiver}/month)`,
      );
    }

    // 8. Prepare atomic Debit from sender's 'trivia' bucket ONLY
    const debitPrepared = await prepareDebitWallet({
      transaction: tx,
      db,
      uid: senderUid,
      amount,
      bucketPriority: ['trivia'], // strictly trivia coins
      reason: 'transfer_out',
      refId: receiverUid,
      idempotencyKey: `transfer_out:${transferDocId}`,
    });

    // 9. Prepare atomic Credit to receiver's 'gift' bucket
    const creditPrepared = await prepareCreditWallet({
      transaction: tx,
      db,
      uid: receiverUid,
      amount,
      bucket: 'gift',
      reason: 'transfer_in',
      refId: senderUid,
      idempotencyKey: `transfer_in:${transferDocId}`,
    });

    // Write phase
    debitPrepared.apply();
    creditPrepared.apply();

    // 10. Update sender daily sent tracker
    tx.set(
      senderDailyRef,
      {
        totalSent: senderDailySent + amount,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // 11. Update receiver monthly received tracker
    tx.set(
      receiverMonthlyRef,
      {
        totalReceived: receiverMonthlyReceived + amount,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // 12. Record transfer receipt
    tx.set(transferRecordRef, {
      id: transferDocId,
      senderUid,
      receiverUid,
      amount,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      senderBalanceAfter: debitPrepared.balanceAfter ?? 0,
      receiverUid,
      amount,
    };
  });
}

/**
 * Returns sender's transfer eligibility and remaining daily allowance.
 */
export async function getTransferStatus(
  db: Firestore,
  uid: string,
  now: Date = new Date(),
): Promise<{
  isPro: boolean;
  triviaBalance: number;
  dailySent: number;
  dailyCap: number;
  dailyRemaining: number;
}> {
  const economy = await assertTownFeatureEnabled(db, 'transfersEnabled');
  const transferCfg = economy.transfer;

  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data() || {};
  const isPro = Boolean(userData.pro?.active);

  const walletDoc = await db.collection('users').doc(uid).collection('wallet').doc('main').get();
  const walletData = (walletDoc.exists ? walletDoc.data() : {}) as WalletDoc;
  const triviaBalance = walletData?.buckets?.trivia ?? 0;

  const todayStr = getTodayDateString(now);
  const dailyDoc = await db
    .collection('users')
    .doc(uid)
    .collection('townTransferDaily')
    .doc(todayStr)
    .get();
  const dailySent = (dailyDoc.exists ? dailyDoc.data()?.totalSent : 0) || 0;
  const dailyRemaining = Math.max(0, transferCfg.dailyCapSender - dailySent);

  return {
    isPro,
    triviaBalance,
    dailySent,
    dailyCap: transferCfg.dailyCapSender,
    dailyRemaining,
  };
}
