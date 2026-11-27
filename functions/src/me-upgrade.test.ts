import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockDeleteUserFromFirestore = vi.fn();
const mockSyncUserToFirestore = vi.fn();
const mockFindUserByEmail = vi.fn();

vi.mock('firebase-admin/app', () => ({
  getApps: () => [{ name: '[DEFAULT]' }],
  initializeApp: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    getUser: mockGetUser,
    deleteUser: mockDeleteUser,
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

import { getOrCreateUser, getStore } from '../../apps/web/lib/server-store.js';
import { api } from './index.js';

function createMockReqRes(body: Record<string, unknown>) {
  let statusCode = 200;
  let jsonPayload: unknown = null;
  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const req = {
    method: 'POST',
    url: '/api/me/upgrade',
    headers: { host: 'localhost' },
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

describe('POST /me/upgrade Auth cleanup on merge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteUserFromFirestore.mockResolvedValue(undefined);
    mockSyncUserToFirestore.mockResolvedValue(undefined);
    mockFindUserByEmail.mockResolvedValue(null);

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

    const { req, res, done, getStatus, getPayload } = createMockReqRes({
      uid: 'fb_google_uid_1',
      email: 'eu.andrei89@gmail.com',
      provider: 'google',
      confirmMerge: true,
    });

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

    const { req, res, done, getStatus, getPayload } = createMockReqRes({
      uid: 'fb_anon_uid_1',
      email: 'eu.andrei89@gmail.com',
      provider: 'google',
      confirmMerge: true,
    });

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

    const { req, res, done, getStatus, getPayload } = createMockReqRes({
      uid: 'u_local_only_guest',
      email: 'eu.andrei89@gmail.com',
      provider: 'google',
      confirmMerge: true,
    });

    await (api as unknown as (r: unknown, s: unknown) => Promise<void>)(req, res);
    await done;

    expect(getStatus()).toBe(200);
    expect((getPayload() as { uid?: string })?.uid).toBe('u_andrei89');
    expect(mockDeleteUserFromFirestore).toHaveBeenCalledWith('u_local_only_guest');
    expect(mockGetUser).toHaveBeenCalledWith('u_local_only_guest');
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});
