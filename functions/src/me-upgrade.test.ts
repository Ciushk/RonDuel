import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockVerifyIdToken = vi.fn();
const mockDeleteUserFromFirestore = vi.fn();
const mockSyncUserToFirestore = vi.fn();
const mockFindUserByEmail = vi.fn();
const mockCreateCoinCheckoutSession = vi.fn();

vi.mock('firebase-admin/app', () => ({
  getApps: () => [{ name: '[DEFAULT]' }],
  initializeApp: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    getUser: mockGetUser,
    deleteUser: mockDeleteUser,
    verifyIdToken: mockVerifyIdToken,
  }),
}));

vi.mock('firebase-functions/v2', () => ({
  setGlobalOptions: vi.fn(),
}));

vi.mock('firebase-functions/v2/https', () => ({
  HttpsError: class HttpsError extends Error {},
  onCall: (_opts: unknown, fn?: unknown) => fn ?? _opts,
  onRequest: (_opts: unknown, fn?: unknown) => fn ?? _opts,
}));

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (_opts: unknown, fn?: unknown) => fn ?? _opts,
}));

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentWritten: (_opts: unknown, fn?: unknown) => fn ?? _opts,
}));

vi.mock('firebase-functions/params', () => ({
  defineSecret: () => ({ value: () => '' }),
  defineString: () => ({ value: () => '' }),
}));

vi.mock('./firestore-users.js', () => ({
  adoptAuthUid: vi.fn(),
  deleteUserFromFirestore: (...args: unknown[]) => mockDeleteUserFromFirestore(...args),
  ensureUsersHydratedFromFirestore: vi.fn().mockResolvedValue(undefined),
  findUserByEmail: (...args: unknown[]) => mockFindUserByEmail(...args),
  flushDirtyUsersToFirestore: vi.fn().mockResolvedValue(undefined),
  getDb: vi.fn(),
  getUserFromFirestore: vi.fn().mockResolvedValue(null),
  purgeExpiredAnonymousUsers: vi.fn().mockResolvedValue(0),
  syncUserToFirestore: (...args: unknown[]) => mockSyncUserToFirestore(...args),
}));

vi.mock('./store-persistence.js', () => ({
  createStorePersistence: () => ({
    ensureHydrated: vi.fn().mockResolvedValue(undefined),
    flushNow: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('./town-purchase.js', () => ({
  createCoinCheckoutSession: (...args: unknown[]) => mockCreateCoinCheckoutSession(...args),
  handleTownStripeWebhook: vi.fn().mockResolvedValue({ processed: false }),
}));

import { getOrCreateUser, getStore } from '../../apps/web/lib/server-store.js';
import { api } from './index.js';

function createMockReqRes(
  body: Record<string, unknown>,
  options?: { url?: string; authorization?: string },
) {
  let statusCode = 200;
  let jsonPayload: unknown = null;
  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const headers: Record<string, string> = { host: 'localhost' };
  if (options?.authorization) {
    headers.authorization = options.authorization;
  }

  const req = {
    method: 'POST',
    url: options?.url ?? '/api/me/upgrade',
    headers,
    body,
  };

  const res = {
    setHeader: vi.fn(),
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      jsonPayload = payload;
      resolveDone();
      return this;
    },
  };

  return {
    req,
    res,
    done,
    getStatus: () => statusCode,
    getPayload: () => jsonPayload,
  };
}

describe('POST /me/upgrade & POST /town/checkout security and Auth cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FUNCTIONS_EMULATOR;
    mockDeleteUserFromFirestore.mockResolvedValue(undefined);
    mockSyncUserToFirestore.mockResolvedValue(undefined);
    mockFindUserByEmail.mockResolvedValue(null);
    mockVerifyIdToken.mockResolvedValue({
      uid: 'fb_google_uid_1',
      email: 'eu.andrei89@gmail.com',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    });
    mockCreateCoinCheckoutSession.mockResolvedValue({
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_town_123',
      sessionId: 'cs_town_123',
    });

    const store = getStore();
    for (const key of Object.keys(store.users)) delete store.users[key];
    for (const key of Object.keys(store.plays)) delete store.plays[key];

    // Existing RonDuel account that the incoming sign-in merges into
    const target = getOrCreateUser({
      uid: 'u_andrei89',
      nickname: 'Andrei',
      tz: 'Europe/Bucharest',
    });
    target.email = 'eu.andrei89@gmail.com';
    target.isAnonymous = false;
    target.authProvider = 'google';
  });

  it('does NOT delete Firebase Auth user when oldUid has a real provider (google.com)', async () => {
    mockGetUser.mockResolvedValue({
      uid: 'fb_google_uid_1',
      providerData: [{ providerId: 'google.com' }],
    });

    const { req, res, done, getStatus, getPayload } = createMockReqRes(
      {
        uid: 'fb_google_uid_1',
        email: 'eu.andrei89@gmail.com',
        provider: 'google',
        confirmMerge: true,
      },
      { authorization: 'Bearer verified_google_token' },
    );

    await (api as unknown as (r: unknown, s: unknown) => Promise<void>)(req, res);
    await done;

    expect(getStatus()).toBe(200);
    expect((getPayload() as { uid?: string })?.uid).toBe('u_andrei89');
    expect(mockDeleteUserFromFirestore).toHaveBeenCalledWith('fb_google_uid_1');
    expect(mockGetUser).toHaveBeenCalledWith('fb_google_uid_1');
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it('DOES delete Firebase Auth user when oldUid is anonymous (providerData empty)', async () => {
    mockGetUser.mockResolvedValue({
      uid: 'fb_anon_uid_1',
      providerData: [],
    });
    mockDeleteUser.mockResolvedValue(undefined);

    const { req, res, done, getStatus, getPayload } = createMockReqRes(
      {
        uid: 'fb_anon_uid_1',
        email: 'eu.andrei89@gmail.com',
        provider: 'google',
        confirmMerge: true,
      },
      { authorization: 'Bearer verified_google_token' },
    );

    await (api as unknown as (r: unknown, s: unknown) => Promise<void>)(req, res);
    await done;

    expect(getStatus()).toBe(200);
    expect((getPayload() as { uid?: string })?.uid).toBe('u_andrei89');
    expect(mockDeleteUserFromFirestore).toHaveBeenCalledWith('fb_anon_uid_1');
    expect(mockGetUser).toHaveBeenCalledWith('fb_anon_uid_1');
    expect(mockDeleteUser).toHaveBeenCalledWith('fb_anon_uid_1');
  });

  it('does NOT call deleteUser when getUser throws (e.g. local guest uid not in Auth)', async () => {
    mockGetUser.mockRejectedValue(new Error('auth/user-not-found'));

    const { req, res, done, getStatus, getPayload } = createMockReqRes(
      {
        uid: 'u_local_only_guest',
        email: 'eu.andrei89@gmail.com',
        provider: 'google',
        confirmMerge: true,
      },
      { authorization: 'Bearer verified_google_token' },
    );

    await (api as unknown as (r: unknown, s: unknown) => Promise<void>)(req, res);
    await done;

    expect(getStatus()).toBe(200);
    expect((getPayload() as { uid?: string })?.uid).toBe('u_andrei89');
    expect(mockDeleteUserFromFirestore).toHaveBeenCalledWith('u_local_only_guest');
    expect(mockGetUser).toHaveBeenCalledWith('u_local_only_guest');
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it('returns 403 AUTH_REQUIRED when POST /me/upgrade with google/password has no Bearer token', async () => {
    const { req, res, done, getStatus, getPayload } = createMockReqRes({
      uid: 'u_attacker',
      email: 'eu.andrei89@gmail.com',
      provider: 'google',
      confirmMerge: true,
    });

    await (api as unknown as (r: unknown, s: unknown) => Promise<void>)(req, res);
    await done;

    expect(getStatus()).toBe(403);
    expect((getPayload() as { code?: string })?.code).toBe('AUTH_REQUIRED');
    expect(mockDeleteUserFromFirestore).not.toHaveBeenCalled();
  });

  it('returns 403 EMAIL_MISMATCH when body.email differs from verified Bearer token email', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'fb_attacker',
      email: 'attacker@evil.test',
      email_verified: true,
      firebase: { sign_in_provider: 'google.com' },
    });

    const { req, res, done, getStatus, getPayload } = createMockReqRes(
      {
        uid: 'u_attacker',
        email: 'eu.andrei89@gmail.com',
        provider: 'google',
        confirmMerge: true,
      },
      { authorization: 'Bearer attacker_token' },
    );

    await (api as unknown as (r: unknown, s: unknown) => Promise<void>)(req, res);
    await done;

    expect(getStatus()).toBe(403);
    expect((getPayload() as { code?: string })?.code).toBe('EMAIL_MISMATCH');
  });

  it('returns 403 EMAIL_NOT_VERIFIED when trying to merge into an existing account with an unverified password token', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'fb_pw_unverified',
      email: 'eu.andrei89@gmail.com',
      email_verified: false,
      firebase: { sign_in_provider: 'password' },
    });

    const { req, res, done, getStatus, getPayload } = createMockReqRes(
      {
        uid: 'u_guest_unverified',
        email: 'eu.andrei89@gmail.com',
        provider: 'password',
        confirmMerge: true,
      },
      { authorization: 'Bearer pw_unverified_token' },
    );

    await (api as unknown as (r: unknown, s: unknown) => Promise<void>)(req, res);
    await done;

    expect(getStatus()).toBe(403);
    expect((getPayload() as { code?: string })?.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('blocks email_link merge into an existing non-anonymous account with 409 SIGN_IN_REQUIRED', async () => {
    const { req, res, done, getStatus, getPayload } = createMockReqRes({
      uid: 'u_guest_email_link',
      email: 'eu.andrei89@gmail.com',
      provider: 'email_link',
      confirmMerge: true,
    });

    await (api as unknown as (r: unknown, s: unknown) => Promise<void>)(req, res);
    await done;

    expect(getStatus()).toBe(409);
    expect(getPayload()).toMatchObject({
      accountExists: true,
      code: 'SIGN_IN_REQUIRED',
    });
    expect(mockDeleteUserFromFirestore).not.toHaveBeenCalled();
  });

  it('POST /town/checkout returns 401 without Bearer token and 401 for anonymous tokens', async () => {
    const missing = createMockReqRes(
      { uid: 'u_andrei89', packId: 'pack_1000', locale: 'ro' },
      { url: '/api/town/checkout' },
    );
    await (api as unknown as (r: unknown, s: unknown) => Promise<void>)(missing.req, missing.res);
    await missing.done;
    expect(missing.getStatus()).toBe(401);
    expect(mockCreateCoinCheckoutSession).not.toHaveBeenCalled();

    mockVerifyIdToken.mockResolvedValueOnce({
      uid: 'u_anon_1',
      firebase: { sign_in_provider: 'anonymous' },
    });
    const anon = createMockReqRes(
      { uid: 'u_anon_1', packId: 'pack_1000', locale: 'ro' },
      { url: '/api/town/checkout', authorization: 'Bearer anon_token' },
    );
    await (api as unknown as (r: unknown, s: unknown) => Promise<void>)(anon.req, anon.res);
    await anon.done;
    expect(anon.getStatus()).toBe(401);
    expect(mockCreateCoinCheckoutSession).not.toHaveBeenCalled();
  });

  it('POST /town/checkout returns 403 UID_MISMATCH when body.uid differs from decoded token uid', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'u_real_owner',
      firebase: { sign_in_provider: 'custom' },
    });

    const { req, res, done, getStatus, getPayload } = createMockReqRes(
      { uid: 'u_other_victim', packId: 'pack_2800', locale: 'ro' },
      { url: '/api/town/checkout', authorization: 'Bearer valid_custom_token' },
    );

    await (api as unknown as (r: unknown, s: unknown) => Promise<void>)(req, res);
    await done;

    expect(getStatus()).toBe(403);
    expect((getPayload() as { code?: string })?.code).toBe('UID_MISMATCH');
    expect(mockCreateCoinCheckoutSession).not.toHaveBeenCalled();
  });

  it('POST /town/checkout calls createCoinCheckoutSession with verified token uid', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'u_andrei89',
      firebase: { sign_in_provider: 'custom' },
    });

    const { req, res, done, getStatus } = createMockReqRes(
      { uid: 'u_andrei89', packId: 'pack_2800', locale: 'ro' },
      { url: '/api/town/checkout', authorization: 'Bearer valid_custom_token' },
    );

    await (api as unknown as (r: unknown, s: unknown) => Promise<void>)(req, res);
    await done;

    expect(getStatus()).toBe(200);
    expect(mockCreateCoinCheckoutSession).toHaveBeenCalledTimes(1);
    expect(mockCreateCoinCheckoutSession.mock.calls[0][1]).toMatchObject({
      uid: 'u_andrei89',
      packId: 'pack_2800',
      locale: 'ro',
    });
  });
});
