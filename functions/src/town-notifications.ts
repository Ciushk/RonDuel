import type { Firestore } from 'firebase-admin/firestore';

import { sendPushToUser, type PushMessagingSender, type SendPushResult } from './push.js';

export type MessagingSender = PushMessagingSender;
export type NotifyCropsReadyResult = SendPushResult;

/**
 * Sends a data-only webpush notification to a player when their crops are ready to harvest.
 * Delegates to `sendPushToUser` which enforces the RonTown kill switch, user opt-in,
 * per-day notification cap, and invalid-token pruning.
 */
export async function notifyCropsReady(
  db: Firestore,
  uid: string,
  cropName: string,
  customMessaging?: MessagingSender,
): Promise<NotifyCropsReadyResult> {
  return sendPushToUser(
    db,
    uid,
    {
      title: '🌾 Your crops are ready to harvest!',
      body: `Your ${cropName} in RonTown has finished growing.`,
      url: '/town',
      tag: 'town-crops-ready',
      type: 'town_crops_ready',
      extraData: {
        uid,
        cropName,
      },
    },
    { customMessaging },
  );
}
