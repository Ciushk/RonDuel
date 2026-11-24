import {
  type CoinBucket,
  type LedgerEntry,
  type LedgerReason,
  type WalletDoc,
} from '@ronduel/shared';
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';

function getCurrentMonthKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export interface CreditWalletParams {
  transaction: Transaction;
  db: Firestore;
  uid: string;
  amount: number;
  bucket: CoinBucket;
  reason: LedgerReason;
  refId: string;
  idempotencyKey: string;
}

export interface CreditWalletResult {
  duplicate: boolean;
  balanceBefore?: number;
  balanceAfter?: number;
  amount?: number;
}

/**
 * Transaction-safe wallet credit. Idempotency is enforced by the ledger document id.
 */
export async function creditWallet(params: CreditWalletParams): Promise<CreditWalletResult> {
  const { transaction, db, uid, amount, bucket, reason, refId, idempotencyKey } = params;

  if (amount <= 0) {
    return { duplicate: false, amount: 0 };
  }

  // Idempotency check via unique document ID in ledger
  const safeKey = encodeURIComponent(idempotencyKey);
  const ledgerRef = db.collection('ledger').doc(safeKey);
  const existingLedger = await transaction.get(ledgerRef);
  if (existingLedger.exists) {
    return { duplicate: true };
  }

  const walletRef = db.collection('users').doc(uid).collection('wallet').doc('main');
  const walletSnap = await transaction.get(walletRef);

  const monthKey = getCurrentMonthKey();
  let walletData: WalletDoc;
  if (!walletSnap.exists) {
    walletData = {
      balance: 0,
      buckets: { trivia: 0, town: 0, purchased: 0, gift: 0 },
      monthPurchasedEUR: 0,
      monthKey,
      locked: false,
    };
  } else {
    walletData = walletSnap.data() as WalletDoc;
    if (walletData.locked) {
      throw new Error(`WALLET_LOCKED: Wallet for ${uid} is locked.`);
    }
  }

  const balanceBefore = walletData.balance;
  const balanceAfter = balanceBefore + amount;

  walletData.balance = balanceAfter;
  walletData.buckets[bucket] = (walletData.buckets[bucket] || 0) + amount;
  if (walletData.monthKey !== monthKey) {
    walletData.monthKey = monthKey;
    walletData.monthPurchasedEUR = 0;
  }

  transaction.set(
    walletRef,
    {
      ...walletData,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const ledgerEntry: LedgerEntry = {
    uid,
    delta: amount,
    bucket,
    reason,
    refId,
    idempotencyKey,
    balanceAfter,
    createdAt: FieldValue.serverTimestamp(),
  };

  transaction.set(ledgerRef, ledgerEntry);

  return {
    duplicate: false,
    balanceBefore,
    balanceAfter,
    amount,
  };
}

export interface DebitWalletParams {
  transaction: Transaction;
  db: Firestore;
  uid: string;
  amount: number;
  bucketPriority?: CoinBucket[];
  reason: LedgerReason;
  refId: string;
  idempotencyKey: string;
}

export interface DebitWalletResult {
  duplicate: boolean;
  balanceBefore?: number;
  balanceAfter?: number;
  spentBuckets?: Partial<Record<CoinBucket, number>>;
}

const DEFAULT_BUCKET_PRIORITY: CoinBucket[] = ['gift', 'town', 'purchased', 'trivia'];

/**
 * Transaction-safe wallet debit. Deducts from buckets based on specified priority order.
 */
export async function debitWallet(params: DebitWalletParams): Promise<DebitWalletResult> {
  const {
    transaction,
    db,
    uid,
    amount,
    bucketPriority = DEFAULT_BUCKET_PRIORITY,
    reason,
    refId,
    idempotencyKey,
  } = params;

  if (amount <= 0) {
    return { duplicate: false };
  }

  const safeKey = encodeURIComponent(idempotencyKey);
  const ledgerRef = db.collection('ledger').doc(safeKey);
  const existingLedger = await transaction.get(ledgerRef);
  if (existingLedger.exists) {
    return { duplicate: true };
  }

  const walletRef = db.collection('users').doc(uid).collection('wallet').doc('main');
  const walletSnap = await transaction.get(walletRef);
  if (!walletSnap.exists) {
    throw new Error('INSUFFICIENT_FUNDS: Wallet does not exist.');
  }

  const walletData = walletSnap.data() as WalletDoc;
  if (walletData.locked) {
    throw new Error(`WALLET_LOCKED: Wallet for ${uid} is locked.`);
  }

  if (walletData.balance < amount) {
    throw new Error(
      `INSUFFICIENT_FUNDS: Required ${amount} coins, balance is ${walletData.balance}.`,
    );
  }

  const balanceBefore = walletData.balance;
  let remainingToDebit = amount;
  const spentBuckets: Partial<Record<CoinBucket, number>> = {};
  let primaryBucket: CoinBucket = bucketPriority[0] || 'town';

  for (const b of bucketPriority) {
    if (remainingToDebit <= 0) break;
    const available = walletData.buckets[b] || 0;
    if (available > 0) {
      const spend = Math.min(available, remainingToDebit);
      walletData.buckets[b] -= spend;
      spentBuckets[b] = spend;
      remainingToDebit -= spend;
      primaryBucket = b;
    }
  }

  if (remainingToDebit > 0) {
    throw new Error('INSUFFICIENT_FUNDS: Could not fulfill debit from specified buckets.');
  }

  const balanceAfter = balanceBefore - amount;
  walletData.balance = balanceAfter;

  transaction.set(
    walletRef,
    {
      ...walletData,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const ledgerEntry: LedgerEntry = {
    uid,
    delta: -amount,
    bucket: primaryBucket,
    reason,
    refId,
    idempotencyKey,
    balanceAfter,
    createdAt: FieldValue.serverTimestamp(),
  };

  transaction.set(ledgerRef, ledgerEntry);

  return {
    duplicate: false,
    balanceBefore,
    balanceAfter,
    spentBuckets,
  };
}

export interface ReconcileResult {
  uid: string;
  balance: number;
  ledgerSum: number;
  matches: boolean;
}

/**
 * Reconciles a single user's wallet against their ledger entries.
 */
export async function reconcileUserLedger(db: Firestore, uid: string): Promise<ReconcileResult> {
  const walletRef = db.collection('users').doc(uid).collection('wallet').doc('main');
  const walletSnap = await walletRef.get();
  const balance = walletSnap.exists ? ((walletSnap.data()?.balance as number) ?? 0) : 0;

  const ledgerSnap = await db.collection('ledger').where('uid', '==', uid).get();
  let ledgerSum = 0;
  for (const doc of ledgerSnap.docs) {
    const delta = doc.data()?.delta;
    if (typeof delta === 'number') {
      ledgerSum += delta;
    }
  }

  const matches = balance === ledgerSum;
  if (!matches) {
    console.error(
      `[RECONCILIATION_MISMATCH] uid=${uid} walletBalance=${balance} ledgerSum=${ledgerSum}`,
    );
  }

  return { uid, balance, ledgerSum, matches };
}

/**
 * Paginated batch reconciliation of wallets across users.
 */
export async function batchReconcileLedgers(
  db: Firestore,
  batchSize = 50,
  startAfterUid?: string,
): Promise<{
  results: ReconcileResult[];
  lastUid: string | null;
  mismatchCount: number;
}> {
  let query = db.collection('users').orderBy('__name__').limit(batchSize);
  if (startAfterUid) {
    query = query.startAfter(startAfterUid);
  }

  const snap = await query.get();
  const results: ReconcileResult[] = [];
  let mismatchCount = 0;
  let lastUid: string | null = null;

  for (const doc of snap.docs) {
    lastUid = doc.id;
    const res = await reconcileUserLedger(db, doc.id);
    results.push(res);
    if (!res.matches) {
      mismatchCount += 1;
    }
  }

  return {
    results,
    lastUid: snap.docs.length === batchSize ? lastUid : null,
    mismatchCount,
  };
}
