import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { assertTownFeatureEnabled } from './town-economy.js';
import { creditWallet } from './town-wallet.js';
import type { TownEconomyConfig, WalletDoc } from '@ronduel/shared';

export interface CreateCoinCheckoutParams {
  uid: string;
  packId: string;
  successUrl?: string;
  cancelUrl?: string;
  simulateImmediately?: boolean;
}

export function getCurrentMonthKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Creates a Stripe Checkout Session for purchasing a RonCoins pack.
 * Enforces server kill switch, monthly €20 spending cap, and pack verification.
 */
export async function createCoinCheckoutSession(
  db: Firestore,
  params: CreateCoinCheckoutParams,
): Promise<{ checkoutUrl?: string; sessionId: string; mode: string }> {
  const economy = await assertTownFeatureEnabled(db, 'purchasesEnabled');

  const { uid, packId } = params;
  if (!uid || uid === 'anon' || uid === 'u_ssr') {
    throw new Error('Please sign in or link your account before purchasing coins');
  }

  // Find pack in economy config
  const pack = economy.purchase.packs.find((p) => p.id === packId);
  if (!pack) {
    throw new Error(`Invalid coin pack: ${packId}`);
  }

  // Check user monthly limit
  const walletRef = db.collection('users').doc(uid).collection('wallet').doc('main');
  const walletSnap = await walletRef.get();
  const walletData = (walletSnap.exists ? walletSnap.data() : null) as WalletDoc | null;

  const currentMonth = getCurrentMonthKey();
  let currentMonthSpent = 0;
  if (walletData && walletData.monthKey === currentMonth) {
    currentMonthSpent = walletData.monthPurchasedEUR ?? 0;
  }

  if (currentMonthSpent + pack.eur > economy.purchase.monthlyCapEUR) {
    const remaining = Math.max(0, economy.purchase.monthlyCapEUR - currentMonthSpent);
    throw new Error(
      `Monthly purchase limit reached. €${remaining.toFixed(2)} remaining of €${economy.purchase.monthlyCapEUR} limit.`,
    );
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (stripeSecretKey) {
    // Live Stripe integration via runtime dynamic load
    try {
      const stripePkg = await (Function('return import("stripe")')() as Promise<any>);
      const Stripe = stripePkg.default;
      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-12-18.acacia' as any });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        client_reference_id: uid,
        metadata: {
          type: 'town_coin_purchase',
          uid,
          packId: pack.id,
          coins: String(pack.coins),
          eur: String(pack.eur),
        },
        line_items: [
          {
            price_data: {
              currency: 'eur',
              unit_amount: Math.round(pack.eur * 100),
              product_data: {
                name: `${pack.coins.toLocaleString()} RonCoins`,
                description:
                  'RonTown in-game cosmetic currency. Non-refundable and non-convertible.',
              },
            },
            quantity: 1,
          },
        ],
        success_url:
          params.successUrl ||
          `https://ronduel.com/town?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: params.cancelUrl || `https://ronduel.com/town?checkout=canceled`,
      });

      return {
        mode: 'stripe_checkout',
        sessionId: session.id,
        checkoutUrl: session.url ?? undefined,
      };
    } catch {
      // Fallback to simulation if stripe module is unavailable
    }
  }

  // Local / test mode simulation
  const mockSessionId = `cs_test_${Date.now()}_${uid}`;

  if (params.simulateImmediately) {
    await processSuccessfulCoinPurchase(db, {
      sessionId: mockSessionId,
      uid,
      packId: pack.id,
      coins: pack.coins,
      eur: pack.eur,
    });
  }

  return {
    mode: 'test_simulation',
    sessionId: mockSessionId,
    checkoutUrl: `/town?checkout=success&session_id=${mockSessionId}`,
  };
}

/**
 * Atomic processing of a confirmed coin purchase (idempotent on sessionId).
 * Credits the wallet's 'purchased' bucket and increments monthly spending.
 */
export async function processSuccessfulCoinPurchase(
  db: Firestore,
  purchase: {
    sessionId: string;
    uid: string;
    packId: string;
    coins: number;
    eur: number;
  },
): Promise<{ processed: boolean; balanceAfter: number }> {
  const { sessionId, uid, packId, coins, eur } = purchase;
  const purchaseRef = db.collection('coinPurchases').doc(sessionId);
  const walletRef = db.collection('users').doc(uid).collection('wallet').doc('main');
  const currentMonth = getCurrentMonthKey();

  return await db.runTransaction(async (tx) => {
    const existing = await tx.get(purchaseRef);
    if (existing.exists) {
      const wSnap = await tx.get(walletRef);
      return { processed: false, balanceAfter: Number(wSnap.data()?.balance ?? 0) };
    }

    // Credit purchased coins
    const creditResult = await creditWallet({
      transaction: tx,
      db,
      uid,
      amount: coins,
      bucket: 'purchased',
      reason: 'purchase',
      refId: sessionId,
      idempotencyKey: `purchase:${sessionId}`,
    });

    // Update monthly purchased EUR tracking on wallet doc
    const walletSnap = await tx.get(walletRef);
    const walletData = walletSnap.data() || {};
    const previousSpent =
      walletData.monthKey === currentMonth ? walletData.monthPurchasedEUR || 0 : 0;
    const newMonthPurchasedEUR = previousSpent + eur;

    tx.set(
      walletRef,
      {
        monthPurchasedEUR: newMonthPurchasedEUR,
        monthKey: currentMonth,
      },
      { merge: true },
    );

    // Record purchase receipt
    tx.set(purchaseRef, {
      sessionId,
      uid,
      packId,
      coins,
      eur,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      processed: true,
      balanceAfter: creditResult.balanceAfter ?? 0,
    };
  });
}

/**
 * Dedicated webhook handler for Stripe RonTown coin purchases.
 * Completely separate from Pro subscription webhook.
 */
export async function handleTownStripeWebhook(
  db: Firestore,
  event: any,
): Promise<{ processed: boolean; reason?: string }> {
  if (event.type !== 'checkout.session.completed') {
    return { processed: false, reason: `Ignored event type: ${event.type}` };
  }

  const session = event.data?.object;
  if (!session) {
    return { processed: false, reason: 'Missing session in event payload' };
  }

  const metadata = session.metadata || {};
  if (metadata.type !== 'town_coin_purchase') {
    // Not a coin pack purchase event; ignore gracefully
    return { processed: false, reason: 'Not a town coin purchase event' };
  }

  const uid = metadata.uid;
  const packId = metadata.packId;
  const coins = parseInt(metadata.coins, 10);
  const eur = parseFloat(metadata.eur);

  if (!uid || !packId || isNaN(coins) || isNaN(eur) || coins <= 0) {
    throw new Error('Invalid metadata in coin purchase checkout session');
  }

  await processSuccessfulCoinPurchase(db, {
    sessionId: session.id,
    uid,
    packId,
    coins,
    eur,
  });

  return { processed: true };
}
