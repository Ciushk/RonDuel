import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserRecord } from '../../apps/web/lib/server-store.js';
import { handleAuthExchange, type AuthExchangeDeps, type AuthLinkDoc } from './auth-exchange.js';

function makeUser(uid: string, overrides?: Partial<UserRecord>): UserRecord {
  return {
    uid,
    nickname: `User_${uid}`,
    locale: 'ro',
    tz: 'Europe/Bucharest',
    ageConfirmed16: true,
    relaxedTimer: false,
    isAnonymous: false,
    email: `${uid}@ronduel.test`,
    authProvider: 'google.com',
    isAdmin: false,
    pro: { active: false },
    notif: {
      pushEnabled: false,
      emailEnabled: false,
      reminderLocalTime: '20:00',
      sentTodayCount: 0,
    },
    streakCurrent: 3,
    streakBest: 5,
    leagueIds: ['lg_world'],
    freezes: 0,
    rivals: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
    upgradedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createDeps(overrides?: Partial<AuthExchangeDeps>) {
  const users = new Map<string, UserRecord>();
  const authLinks = new Map<string, AuthLinkDoc>();

  const verifyIdToken = vi.fn();
  const getUser = vi.fn(async (uid: string) => users.get(uid) ?? null);
  const findUserByEmail = vi.fn(async (email: string) => {
    const clean = email.trim().toLowerCase();
    for (const user of users.values()) {
      if (user.email?.toLowerCase() === clean) return user;
    }
    return null;
  });
  const getAuthLink = vi.fn(async (firebaseUid: string) => authLinks.get(firebaseUid) ?? null);
  const setAuthLink = vi.fn(async (firebaseUid: string, link: AuthLinkDoc) => {
    authLinks.set(firebaseUid, link);
  });
  const createCustomToken = vi.fn(async (uid: string) => `custom_token_for_${uid}`);

  const deps: AuthExchangeDeps = {
    verifyIdToken,
    getUser,
    findUserByEmail,
    getAuthLink,
    setAuthLink,
    createCustomToken,
    nowIso: () => '2026-06-01T12:00:00.000Z',
    ...overrides,
  };

  return {
    deps,
    users,
    authLinks,
    verifyIdToken,
    getUser,
    findUserByEmail,
    getAuthLink,
    setAuthLink,
    createCustomToken,
  };
}

describe('POST /auth/exchange (handleAuthExchange)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 UNAUTHENTICATED when Authorization header is missing, invalid, or revoked', async () => {
    const { deps, verifyIdToken } = createDeps();

    const missing = await handleAuthExchange({ authHeader: null }, deps);
    expect(missing.status).toBe(401);
    expect(missing.body.code).toBe('UNAUTHENTICATED');

    verifyIdToken.mockRejectedValueOnce(new Error('auth/id-token-revoked'));
    const revoked = await handleAuthExchange({ authHeader: 'Bearer revoked_jwt' }, deps);
    expect(revoked.status).toBe(401);
    expect(revoked.body.code).toBe('UNAUTHENTICATED');
    expect(verifyIdToken).toHaveBeenCalledWith('revoked_jwt', true);
  });

  it('returns 403 ANONYMOUS for anonymous Firebase tokens', async () => {
    const { deps, verifyIdToken, createCustomToken } = createDeps();
    verifyIdToken.mockResolvedValue({
      uid: 'fb_anon_1',
      firebase: { sign_in_provider: 'anonymous' },
    });

    const res = await handleAuthExchange({ authHeader: 'Bearer anon_jwt' }, deps);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ANONYMOUS');
    expect(createCustomToken).not.toHaveBeenCalled();
  });

  it('resolves Google email_verified=true user by email, writes authLinks, and issues custom token under RonDuel uid', async () => {
    const { deps, users, authLinks, verifyIdToken, setAuthLink, createCustomToken } = createDeps();
    users.set('u_andrei89', makeUser('u_andrei89', { email: 'eu.andrei89@gmail.com' }));
    verifyIdToken.mockResolvedValue({
      uid: 'fb_google_uid_999',
      email: 'eu.andrei89@gmail.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    });

    // Even if caller tried to smuggle targetUid/uid in body, handleAuthExchange takes no body
    const res = await handleAuthExchange({ authHeader: 'Bearer google_jwt' }, deps);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      customToken: 'custom_token_for_u_andrei89',
      uid: 'u_andrei89',
    });
    expect(setAuthLink).toHaveBeenCalledWith('fb_google_uid_999', {
      ronduelUid: 'u_andrei89',
      provider: 'google.com',
      linkedAt: '2026-06-01T12:00:00.000Z',
    });
    expect(authLinks.get('fb_google_uid_999')?.ronduelUid).toBe('u_andrei89');
    expect(createCustomToken).toHaveBeenCalledWith('u_andrei89', {
      rdLinkedFrom: 'fb_google_uid_999',
    });
  });

  it('returns 403 EMAIL_NOT_VERIFIED for password provider when email_verified is false', async () => {
    const { deps, users, verifyIdToken, setAuthLink, createCustomToken } = createDeps();
    users.set('u_victim', makeUser('u_victim', { email: 'victim@example.com' }));
    verifyIdToken.mockResolvedValue({
      uid: 'fb_pw_unverified',
      email: 'victim@example.com',
      email_verified: false,
      firebase: { sign_in_provider: 'password' },
    });

    const res = await handleAuthExchange({ authHeader: 'Bearer pw_jwt' }, deps);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(setAuthLink).not.toHaveBeenCalled();
    expect(createCustomToken).not.toHaveBeenCalled();
  });

  it('resolves via existing authLinks without querying email', async () => {
    const { deps, users, authLinks, verifyIdToken, findUserByEmail, createCustomToken } =
      createDeps();
    users.set('u_real_42', makeUser('u_real_42', { email: 'real42@example.com' }));
    authLinks.set('fb_linked_uid', {
      ronduelUid: 'u_real_42',
      provider: 'google.com',
      linkedAt: '2026-05-01T00:00:00.000Z',
    });
    verifyIdToken.mockResolvedValue({
      uid: 'fb_linked_uid',
      email: 'real42@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    });

    const res = await handleAuthExchange({ authHeader: 'Bearer linked_jwt' }, deps);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      customToken: 'custom_token_for_u_real_42',
      uid: 'u_real_42',
    });
    expect(findUserByEmail).not.toHaveBeenCalled();
    expect(createCustomToken).toHaveBeenCalledWith('u_real_42', {
      rdLinkedFrom: 'fb_linked_uid',
    });
  });

  it('returns aligned=true when decoded.uid already matches a non-anonymous RonDuel user (e.g. custom token)', async () => {
    const { deps, users, verifyIdToken, createCustomToken } = createDeps();
    users.set('u_real_42', makeUser('u_real_42'));
    verifyIdToken.mockResolvedValue({
      uid: 'u_real_42',
      firebase: { sign_in_provider: 'custom' },
    });

    const res = await handleAuthExchange({ authHeader: 'Bearer custom_jwt' }, deps);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ aligned: true, uid: 'u_real_42' });
    expect(createCustomToken).not.toHaveBeenCalled();
  });

  it('returns 404 NO_ACCOUNT when no RonDuel user or link exists', async () => {
    const { deps, verifyIdToken, createCustomToken } = createDeps();
    verifyIdToken.mockResolvedValue({
      uid: 'fb_unknown',
      email: 'nobody@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    });

    const res = await handleAuthExchange({ authHeader: 'Bearer unknown_jwt' }, deps);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NO_ACCOUNT');
    expect(createCustomToken).not.toHaveBeenCalled();
  });

  it('returns 503 TOKEN_SIGNING_UNAVAILABLE when createCustomToken fails and never logs token or email', async () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { deps, users, verifyIdToken, createCustomToken } = createDeps();
    users.set('u_real_1', makeUser('u_real_1', { email: 'secret.user@example.com' }));
    verifyIdToken.mockResolvedValue({
      uid: 'fb_google_fail',
      email: 'secret.user@example.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    });
    const signErr = Object.assign(new Error('IAM signBlob denied'), {
      code: 'auth/insufficient-permission',
    });
    createCustomToken.mockRejectedValueOnce(signErr);

    const res = await handleAuthExchange({ authHeader: 'Bearer super_secret_jwt_value' }, deps);

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('TOKEN_SIGNING_UNAVAILABLE');
    const loggedText = consoleErr.mock.calls.flat().join(' ');
    expect(loggedText).toContain('auth/insufficient-permission');
    expect(loggedText).not.toContain('super_secret_jwt_value');
    expect(loggedText).not.toContain('secret.user@example.com');
    consoleErr.mockRestore();
  });
});
