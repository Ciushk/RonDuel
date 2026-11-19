import { setGlobalOptions } from 'firebase-functions/v2';
import { onRequest } from 'firebase-functions/v2/https';

// EU data residency: all Cloud Functions run in europe-west1
setGlobalOptions({ region: 'europe-west1' });

export const health = onRequest((_req, res) => {
  res.status(200).json({ ok: true, service: 'ronduel-functions', region: 'europe-west1' });
});
