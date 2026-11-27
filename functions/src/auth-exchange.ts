import { extractBearerToken } from '../../apps/web/lib/ronbot-auth.js';
import type { UserRecord } from '../../apps/web/lib/server-store.js';

export interface AuthExchangeDecodedToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  firebase?: {
    sign_in_provider?: string;
  };
}

export interface AuthLinkDoc {
  ronduelUid: string;
  provider: string;
  linkedAt: string;
}

export interface AuthExchangeInput {
  authHeader?: string | null;
}

export interface AuthExchangeDeps {
  verifyIdToken: (token: string, checkRevoked?: boolean) => Promise<AuthExchangeDecodedToken>;
  getUser: (uid: string) => Promise<UserRecord | null>;
  findUserByEmail: (email: string) => Promise<UserRecord | null>;
  getAuthLink: (firebaseUid: string) => Promise<AuthLinkDoc | null>;
  setAuthLink: (firebaseUid: string, link: AuthLinkDoc) => Promise<void>;
  createCustomToken: (uid: string, developerClaims?: Record<string, unknown>) => Promise<string>;
  nowIso?: () => string;
}

export interface AuthExchangeHttpResult {
  status: number;
  body: Record<string, unknown>;
}

const VERIFIED_EMAIL_PROVIDERS = new Set(['google.com', 'password']);

/**
 * Exchanges a verified Firebase ID token for a Firebase Custom Token minted under the
 * matching RonDuel `uid`. Strictly ignores any request body so a caller can never choose
 * or spoof a target `uid`.
 */
export async function handleAuthExchange(
  input: AuthExchangeInput,
  deps: AuthExchangeDeps,
): Promise<AuthExchangeHttpResult> {
  const bearerToken = extractBearerToken(input.authHeader);
  if (!bearerToken) {
    return {
      status: 401,
      body: { error: 'Authentication required', code: 'UNAUTHENTICATED' },
    };
  }

  let decoded: AuthExchangeDecodedToken | null = null;
  try {
    const verified = await deps.verifyIdToken(bearerToken, true);
    if (verified?.uid) {
      decoded = verified;
    }
  } catch {
    decoded = null;
  }

  if (!decoded?.uid) {
    return {
      status: 401,
      body: { error: 'Invalid or expired authentication token', code: 'UNAUTHENTICATED' },
    };
  }

  const provider = decoded.firebase?.sign_in_provider ?? '';
  if (provider === 'anonymous') {
    return {
      status: 403,
      body: { error: 'Anonymous account not allowed', code: 'ANONYMOUS' },
    };
  }

  // 1. Direct uid match in RonDuel users store/Firestore
  const directUser = await deps.getUser(decoded.uid);
  if (directUser && !directUser.isAnonymous) {
    return {
      status: 200,
      body: { aligned: true, uid: decoded.uid },
    };
  }

  // 2. Existing verified authLinks/{firebaseUid} mapping
  let targetUid: string | null = null;
  const existingLink = await deps.getAuthLink(decoded.uid);
  if (existingLink?.ronduelUid) {
    const linkedUser = await deps.getUser(existingLink.ronduelUid);
    if (linkedUser && !linkedUser.isAnonymous) {
      if (linkedUser.uid === decoded.uid) {
        return {
          status: 200,
          body: { aligned: true, uid: decoded.uid },
        };
      }
      targetUid = linkedUser.uid;
    }
  }

  // 3. Verified email lookup for Google / password providers only
  if (!targetUid && VERIFIED_EMAIL_PROVIDERS.has(provider)) {
    if (provider === 'password' && decoded.email_verified !== true) {
      return {
        status: 403,
        body: { error: 'Email verification required', code: 'EMAIL_NOT_VERIFIED' },
      };
    }

    const tokenEmail = typeof decoded.email === 'string' ? decoded.email.trim().toLowerCase() : '';
    if (tokenEmail && decoded.email_verified === true) {
      const matchedUser = await deps.findUserByEmail(tokenEmail);
      if (matchedUser && !matchedUser.isAnonymous) {
        if (matchedUser.uid === decoded.uid) {
          return {
            status: 200,
            body: { aligned: true, uid: decoded.uid },
          };
        }
        targetUid = matchedUser.uid;
        await deps.setAuthLink(decoded.uid, {
          ronduelUid: targetUid,
          provider,
          linkedAt: (deps.nowIso ?? (() => new Date().toISOString()))(),
        });
      }
    }
  }

  if (!targetUid) {
    return {
      status: 404,
      body: { error: 'No RonDuel account found for this login', code: 'NO_ACCOUNT' },
    };
  }

  // 4. Mint a Firebase Custom Token under the resolved RonDuel uid
  try {
    const customToken = await deps.createCustomToken(targetUid, {
      rdLinkedFrom: decoded.uid,
    });
    return {
      status: 200,
      body: { customToken, uid: targetUid },
    };
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code)
        : 'unknown';
    console.error(`[AuthExchange] createCustomToken failed (code=${code})`);
    return {
      status: 503,
      body: { error: 'Token signing unavailable', code: 'TOKEN_SIGNING_UNAVAILABLE' },
    };
  }
}
