import { getAuth } from 'firebase-admin/auth';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { getStore, isAdminBootstrapEmail, markUserDirty } from '../../apps/web/lib/server-store.js';

export interface TownActorAuth {
  verified: boolean;
  decodedUid?: string;
  hasAdminClaim: boolean;
}

export interface DecodedIdTokenLike {
  uid: string;
  admin?: unknown;
}

export type VerifyIdTokenFn = (idToken: string) => Promise<DecodedIdTokenLike>;

interface RequestHeadersLike {
  headers?: Record<string, string | string[] | undefined>;
}

function extractBearerToken(req: RequestHeadersLike): string | null {
  const raw = req.headers?.authorization ?? req.headers?.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return null;
  if (!value.toLowerCase().startsWith('bearer ')) return null;
  const token = value.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Verifies the caller's Firebase Auth ID token and ensures `decoded.uid === targetUid`.
 * Never trusts client-supplied `isAdmin` flags or unverified `body.uid`.
 */
export async function authorizeTownActor(
  req: RequestHeadersLike,
  targetUid: string,
  verifyTokenFn?: VerifyIdTokenFn,
): Promise<TownActorAuth> {
  if (!targetUid || targetUid === 'anon' || targetUid === 'u_ssr') {
    return { verified: false, hasAdminClaim: false };
  }

  const token = extractBearerToken(req);
  if (!token) {
    return { verified: false, hasAdminClaim: false };
  }

  try {
    const verify = verifyTokenFn ?? ((idToken: string) => getAuth().verifyIdToken(idToken));
    const decoded = await verify(token);
    if (!decoded || typeof decoded.uid !== 'string' || decoded.uid !== targetUid) {
      return { verified: false, hasAdminClaim: false };
    }
    return {
      verified: true,
      decodedUid: decoded.uid,
      hasAdminClaim: decoded.admin === true,
    };
  } catch {
    return { verified: false, hasAdminClaim: false };
  }
}

export interface PreparedTownAdminCheck {
  isAdmin: boolean;
  needsBootstrapWrite: boolean;
  applyBootstrap: () => void;
}

/**
 * Read-only phase of checking whether `uid` is a RonTown admin inside (or outside) a transaction.
 * Admin iff:
 * - Firebase custom claim `admin: true` (from a verified token for `uid`), OR
 * - Firestore `users/{uid}.isAdmin === true`, OR
 * - `users/{uid}` is non-anonymous and `email` (lowercase, trim) is in `ADMIN_BOOTSTRAP_EMAILS`.
 *
 * When `bootstrapOnVerified` is true and the user qualifies via `ADMIN_BOOTSTRAP_EMAILS`
 * while `isAdmin` is still false on the Firestore doc, `applyBootstrap()` persists `isAdmin: true`
 * via `{ merge: true }` in the write phase.
 */
export async function prepareTownAdminCheck(params: {
  db: Firestore;
  transaction?: Transaction;
  uid: string;
  hasAdminClaim?: boolean;
  bootstrapOnVerified?: boolean;
}): Promise<PreparedTownAdminCheck> {
  const { db, transaction, uid, hasAdminClaim = false, bootstrapOnVerified = false } = params;
  if (!uid || uid === 'anon' || uid === 'u_ssr') {
    return { isAdmin: false, needsBootstrapWrite: false, applyBootstrap: () => {} };
  }

  const userRef = db.collection('users').doc(uid);
  const userSnap = transaction ? await transaction.get(userRef) : await userRef.get();
  const data = userSnap.exists ? ((userSnap.data() ?? {}) as Record<string, unknown>) : null;

  const docIsAdmin = data?.isAdmin === true;
  const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
  const isAnon = data ? Boolean(data.isAnonymous) && !email : true;
  const emailBootstrapped = Boolean(data) && !isAnon && isAdminBootstrapEmail(email);

  const isAdmin = Boolean(hasAdminClaim) || docIsAdmin || emailBootstrapped;
  const needsBootstrapWrite = Boolean(bootstrapOnVerified && emailBootstrapped && !docIsAdmin);

  const syncMemoryAdmin = () => {
    const store = getStore();
    if (store.users[uid]) {
      store.users[uid]!.isAdmin = true;
      markUserDirty(uid);
    }
  };

  const applyBootstrap = () => {
    if (!needsBootstrapWrite) return;
    if (transaction) {
      transaction.set(userRef, { isAdmin: true }, { merge: true });
    }
    syncMemoryAdmin();
  };

  return { isAdmin, needsBootstrapWrite, applyBootstrap };
}

/**
 * Non-transactional server-side admin check (e.g. for `/town/init`).
 * Bootstraps `users/{uid}.isAdmin = true` ONLY when `bootstrapOnVerified` is true.
 */
export async function isTownAdmin(
  db: Firestore,
  uid: string,
  options?: { hasAdminClaim?: boolean; bootstrapOnVerified?: boolean },
): Promise<boolean> {
  const check = await prepareTownAdminCheck({
    db,
    uid,
    hasAdminClaim: options?.hasAdminClaim,
    bootstrapOnVerified: options?.bootstrapOnVerified,
  });

  if (check.needsBootstrapWrite) {
    try {
      await db.collection('users').doc(uid).set({ isAdmin: true }, { merge: true });
      const store = getStore();
      if (store.users[uid]) {
        store.users[uid]!.isAdmin = true;
        markUserDirty(uid);
      }
    } catch (err) {
      console.error(`[TownAdmin] Failed to bootstrap isAdmin for ${uid}:`, err);
    }
  }

  return check.isAdmin;
}
