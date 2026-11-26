export interface RonBotProUserLike {
  pro?: {
    active?: boolean;
  } | null;
}

export type RonBotChatAuthResult =
  | { ok: true; uid: string }
  | { ok: false; status: 403; error: 'pro_required' };

/**
 * Shared Pro entitlement predicate for RonBot chat authorization.
 * Fails closed for missing users, missing `pro`, or any `active !== true`.
 */
export function isRonBotPro(user: RonBotProUserLike | null | undefined): boolean {
  return user?.pro?.active === true;
}

export function extractBearerToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token ? token : null;
}

export interface AuthorizeRonBotChatParams {
  authHeader?: string | null;
  /** Strictly non-production test harness header (`x-test-uid`); ignored when `isProduction` is true. */
  testUidHeader?: string | null;
  isProduction?: boolean;
  verifyIdToken: (token: string) => Promise<{ uid: string } | null>;
  loadUser: (
    uid: string,
  ) => Promise<RonBotProUserLike | null | undefined> | RonBotProUserLike | null | undefined;
}

/**
 * Authorizes a RonBot chat request using cryptographic Firebase ID token verification
 * (plus a strictly non-production `x-test-uid` bypass that still enforces `user.pro.active === true`).
 * Never trusts `body.uid` or any client-supplied Pro flag.
 */
export async function authorizeRonBotChat({
  authHeader,
  testUidHeader,
  isProduction = process.env.NODE_ENV === 'production',
  verifyIdToken,
  loadUser,
}: AuthorizeRonBotChatParams): Promise<RonBotChatAuthResult> {
  let verifiedUid: string | null = null;

  const bearerToken = extractBearerToken(authHeader);
  if (bearerToken) {
    try {
      const decoded = await verifyIdToken(bearerToken);
      if (decoded?.uid) {
        verifiedUid = decoded.uid;
      }
    } catch {
      verifiedUid = null;
    }
  }

  // Non-production test bypass only; completely disabled in production builds
  if (!verifiedUid && !isProduction) {
    const candidate = testUidHeader?.trim();
    if (candidate) {
      verifiedUid = candidate;
    }
  }

  if (!verifiedUid) {
    return { ok: false, status: 403, error: 'pro_required' };
  }

  const user = await loadUser(verifiedUid);
  if (!isRonBotPro(user)) {
    return { ok: false, status: 403, error: 'pro_required' };
  }

  return { ok: true, uid: verifiedUid };
}
