import { beforeEach, describe, expect, it } from 'vitest';
import { clearEconomyConfigCache } from './town-economy.js';
import { notifyCropsReady, type MessagingSender } from './town-notifications.js';

describe('town-notifications FCM crops ready', () => {
  let store: Map<string, Record<string, unknown>>;
  let mockDb: any;
  let sentMessages: any[];
  let mockMessaging: MessagingSender;

  beforeEach(() => {
    clearEconomyConfigCache();
    store = new Map();
    sentMessages = [];

    mockMessaging = {
      sendEachForMulticast: async (payload) => {
        sentMessages.push(payload);
        return { successCount: payload.tokens.length, failureCount: 0 };
      },
    };

    store.set('config/townEconomy', {
      enabled: true,
      purchasesEnabled: false,
      transfersEnabled: false,
      helpEnabled: false,
    });

    mockDb = {
      collection: (col: string) => ({
        doc: (id: string) => {
          const docPath = `${col}/${id}`;
          return {
            path: docPath,
            get: async () => {
              const data = store.get(docPath);
              return { exists: data !== undefined, data: () => data };
            },
            collection: (subCol: string) => {
              const subPrefix = `${docPath}/${subCol}`;
              return {
                get: async () => {
                  const docs: any[] = [];
                  for (const [key, val] of store.entries()) {
                    if (key.startsWith(`${subPrefix}/`)) {
                      const subId = key.slice(subPrefix.length + 1);
                      docs.push({ id: subId, data: () => val });
                    }
                  }
                  return { empty: docs.length === 0, docs };
                },
              };
            },
          };
        },
      }),
    };
  });

  it('rejects invalid or anonymous uid', async () => {
    const res = await notifyCropsReady(mockDb, 'anon', 'Wheat', mockMessaging);
    expect(res.sent).toBe(false);
    expect(res.reason).toBe('invalid_uid');
  });

  it('refuses when townEconomy is disabled', async () => {
    store.set('config/townEconomy', { enabled: false });
    const res = await notifyCropsReady(mockDb, 'user1', 'Wheat', mockMessaging);
    expect(res.sent).toBe(false);
    expect(res.reason).toBe('town_economy_disabled');
  });

  it('returns user_not_found if user doc does not exist', async () => {
    const res = await notifyCropsReady(mockDb, 'nonexistent', 'Wheat', mockMessaging);
    expect(res.sent).toBe(false);
    expect(res.reason).toBe('user_not_found');
  });

  it('respects user opting out of push notifications', async () => {
    store.set('users/user1', {
      pushTokens: ['fcm_token_123'],
      notificationPrefs: { pushEnabled: false },
    });
    const res = await notifyCropsReady(mockDb, 'user1', 'Wheat', mockMessaging);
    expect(res.sent).toBe(false);
    expect(res.reason).toBe('user_opted_out');
    expect(sentMessages.length).toBe(0);
  });

  it('reports no_tokens_found if user has no tokens', async () => {
    store.set('users/user1', {
      pushTokens: [],
      notificationPrefs: { pushEnabled: true },
    });
    const res = await notifyCropsReady(mockDb, 'user1', 'Wheat', mockMessaging);
    expect(res.sent).toBe(false);
    expect(res.reason).toBe('no_tokens_found');
    expect(sentMessages.length).toBe(0);
  });

  it('successfully sends notification when tokens exist on user doc', async () => {
    store.set('users/user1', {
      pushTokens: ['fcm_token_abc', 'fcm_token_xyz'],
      notificationPrefs: { pushEnabled: true },
    });
    const res = await notifyCropsReady(mockDb, 'user1', 'Carrots', mockMessaging);
    expect(res.sent).toBe(true);
    expect(res.count).toBe(2);
    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].tokens).toEqual(['fcm_token_abc', 'fcm_token_xyz']);
    expect(sentMessages[0].webpush.data.body).toContain('Carrots');
  });

  it('reads tokens from pushTokens subcollection if array not present on user doc', async () => {
    store.set('users/user2', {
      notificationPrefs: { pushEnabled: true },
    });
    store.set('users/user2/pushTokens/token_device_1', { token: 'device_token_val' });

    const res = await notifyCropsReady(mockDb, 'user2', 'Oats', mockMessaging);
    expect(res.sent).toBe(true);
    expect(res.count).toBe(1);
    expect(sentMessages[0].tokens).toEqual(['device_token_val']);
  });
});
