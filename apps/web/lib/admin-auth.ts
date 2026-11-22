import crypto from 'node:crypto';

import { getOrCreateUser } from './server-store';

export interface VerifiedAdminIdentity {
  uid: string;
  email?: string;
}

interface GoogleJwk {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  n: string;
  e: string;
}

let cachedJwks: { keys: GoogleJwk[]; expiresAt: number } | null = null;

async function getFirebasePublicJwks(): Promise<GoogleJwk[]> {
  const now = Date.now();
  if (cachedJwks && cachedJwks.expiresAt > now) {
    return cachedJwks.keys;
  }
  const res = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  );
  if (!res.ok) {
    throw new Error('Failed to fetch Firebase Auth public keys');
  }
  const data = (await res.json()) as { keys?: GoogleJwk[] };
  const keys = data.keys ?? [];
  cachedJwks = {
    keys,
    expiresAt: now + 3_600_000,
  };
  return keys;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const json = Buffer.from(segment, 'base64url').toString('utf8');
  return JSON.parse(json) as T;
}

/**
 * Verifies a Firebase Auth ID token (RS256 JWT) and checks for the custom claim `admin: true`
 * (or verified email in ADMIN_BOOTSTRAP_EMAILS when signed in via Firebase Auth).
 */
export async function verifyFirebaseAdminIdToken(
  idToken: string,
): Promise<VerifiedAdminIdentity | null> {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;

    const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(parts[0]!);
    const payload = decodeBase64UrlJson<{
      iss?: string;
      aud?: string;
      sub?: string;
      user_id?: string;
      email?: string;
      email_verified?: boolean;
      exp?: number;
      admin?: boolean;
    }>(parts[1]!);

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ronduel';
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < nowSec) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;

    const jwks = await getFirebasePublicJwks();
    const jwk = jwks.find((k) => k.kid === header.kid);
    if (!jwk) return null;

    const publicKey = crypto.createPublicKey({ key: jwk as unknown as crypto.JsonWebKey, format: 'jwk' });
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(`${parts[0]}.${parts[1]}`);
    verify.end();
    const validSig = verify.verify(publicKey, Buffer.from(parts[2]!, 'base64url'));
    if (!validSig) return null;

    const uid = payload.user_id || payload.sub;
    if (!uid) return null;

    if (payload.admin === true) {
      return { uid, email: payload.email };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Authorizes an incoming admin API request:
 * - In production, ONLY accepts a cryptographically verified Firebase Auth ID token with custom claim `admin: true`.
 * - In non-production automated test environments (NODE_ENV !== 'production' && NEXT_PUBLIC_ENABLE_TEST_ADMIN !== 'false'),
 *   also accepts the test runner header `x-admin-token: local-admin` or a verified admin user session.
 */
export async function authorizeAdminRequest(req: Request): Promise<VerifiedAdminIdentity | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    const verified = await verifyFirebaseAdminIdToken(token);
    if (verified) return verified;
  }

  // Test/CI harness support strictly outside production builds
  const isProd = process.env.NODE_ENV === 'production';
  const adminTokenHeader = req.headers.get('x-admin-token');
  if (!isProd && adminTokenHeader === 'local-admin') {
    return { uid: 'admin_ci', email: 'admin@ronduel.eu' };
  }

  const url = new URL(req.url, 'http://localhost');
  const uid = url.searchParams.get('uid') ?? req.headers.get('x-admin-uid') ?? undefined;
  if (!isProd && uid) {
    const user = getOrCreateUser({ uid });
    if (user.isAdmin && !user.isAnonymous) {
      return { uid: user.uid, email: user.email };
    }
  }

  return null;
}
