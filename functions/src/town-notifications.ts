import type { Firestore } from 'firebase-admin/firestore';
import { getTownEconomyConfig } from './town-economy.js';

export interface MessagingSender {
  sendEachForMulticast(message: {
    tokens: string[];
    notification: { title: string; body: string };
    data?: Record<string, string>;
  }): Promise<{ successCount: number; failureCount: number }>;
}

export interface NotifyCropsReadyResult {
  sent: boolean;
  reason?: string;
  count?: number;
}

/**
 * Sends an FCM push notification to a player when their crops are ready to harvest.
 * Respects the server kill switch and user notification preferences.
 */
export async function notifyCropsReady(
  db: Firestore,
  uid: string,
  cropName: string,
  customMessaging?: MessagingSender,
): Promise<NotifyCropsReadyResult> {
  if (!uid || uid === 'anon' || uid === 'u_ssr') {
    return { sent: false, reason: 'invalid_uid' };
  }

  // 1. Check server kill switch
  const economy = await getTownEconomyConfig(db);
  if (!economy.enabled) {
    return { sent: false, reason: 'town_economy_disabled' };
  }

  // 2. Fetch user preferences
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) {
    return { sent: false, reason: 'user_not_found' };
  }

  const userData = userSnap.data() || {};

  // Check notification preferences
  const notifPrefs = userData.notificationPrefs || userData.notifications;
  if (notifPrefs && notifPrefs.pushEnabled === false) {
    return { sent: false, reason: 'user_opted_out' };
  }
  if (userData.notif === false) {
    return { sent: false, reason: 'user_opted_out' };
  }

  // 3. Collect push tokens (from user doc pushTokens array or users/{uid}/pushTokens subcollection)
  let tokens: string[] = [];
  if (Array.isArray(userData.pushTokens)) {
    tokens = userData.pushTokens.filter((t: unknown) => typeof t === 'string' && t.length > 0);
  }

  if (tokens.length === 0) {
    const tokensSubSnap = await db.collection('users').doc(uid).collection('pushTokens').get();
    if (!tokensSubSnap.empty) {
      tokens = tokensSubSnap.docs
        .map((d) => d.data()?.token || d.id)
        .filter((t) => typeof t === 'string' && t.length > 0);
    }
  }

  if (tokens.length === 0) {
    return { sent: false, reason: 'no_tokens_found' };
  }

  // 4. Send notification
  const notification = {
    title: '🌾 Your crops are ready to harvest!',
    body: `Your ${cropName} in RonTown has finished growing.`,
  };

  const messagePayload = {
    tokens,
    notification,
    data: {
      type: 'town_crops_ready',
      uid,
      cropName,
    },
  };

  try {
    let messaging = customMessaging;
    if (!messaging) {
      const { getMessaging } = await import('firebase-admin/messaging');
      messaging = getMessaging() as MessagingSender;
    }

    const response = await messaging.sendEachForMulticast(messagePayload);
    return {
      sent: response.successCount > 0,
      count: response.successCount,
      reason: response.successCount > 0 ? undefined : 'all_deliveries_failed',
    };
  } catch (err: any) {
    console.error(`[notifyCropsReady] Failed to send push notification for uid=${uid}:`, err);
    return { sent: false, reason: err.message || 'send_failed' };
  }
}
