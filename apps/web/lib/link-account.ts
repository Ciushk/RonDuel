'use client';

import { alignFirebaseIdentity } from '@/lib/billing-identity';
import {
  ensureAnonymousAuth,
  getCurrentIdTokenSafe,
  getSignedInAccount,
  linkAnonymousWithEmail,
  linkAnonymousWithGoogle,
  registerWithEmail,
  updateProfile,
} from '@/lib/firebase';
import { isAutoNickname } from '@/lib/onboarding-profile';
import { getLocalSession, saveLocalSession, type LocalSession } from '@/lib/session';
import { ensureInactivityCheckOnce } from '@/lib/session-activity';

function choosePreferredNickname(
  explicit?: string,
  sessionNick?: string,
  authDisplayName?: string | null,
): string {
  const cleanExplicit = (explicit ?? '').trim();
  if (cleanExplicit) return cleanExplicit;

  const cleanSession = (sessionNick ?? '').trim();
  if (cleanSession && !isAutoNickname(cleanSession)) {
    return cleanSession;
  }

  const cleanAuth = (authDisplayName ?? '').trim();
  if (cleanAuth) return cleanAuth;

  return cleanSession || '';
}

export interface SavedAccount {
  uid: string;
  email: string;
  nickname: string;
  authProvider: 'password' | 'google.com' | 'email_link';
}

async function alignAnonymousUid() {
  const authUid = await ensureAnonymousAuth();
  if (!authUid) return getLocalSession();
  const session = getLocalSession();
  if (session.email || session.isAnonymous === false || session.uid === authUid) return session;
  try {
    await fetch('/api/me/adopt-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromUid: session.uid, toUid: authUid }),
    });
  } catch {
    // The local uid still switches so the next link keeps one identity.
  }
  const next = {
    ...session,
    uid: authUid,
    isAnonymous: true,
    authProvider: 'anonymous' as const,
  };
  saveLocalSession(next);
  return next;
}

async function postUpgrade(
  body: Record<string, unknown>,
  idToken?: string | null,
): Promise<Record<string, unknown>> {
  const token = idToken ?? (await getCurrentIdTokenSafe());
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch('/api/me/upgrade', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const error = new Error(typeof data.error === 'string' ? data.error : 'upgrade failed');
    if (typeof data.code === 'string') {
      (error as { code?: string }).code = data.code;
    }
    throw error;
  }
  return data;
}

function persistSavedAccount(input: {
  uid: string;
  email: string;
  nickname: string;
  authProvider: SavedAccount['authProvider'];
}) {
  const session = getLocalSession();
  saveLocalSession({
    ...session,
    uid: input.uid,
    email: input.email,
    nickname: input.nickname || session.nickname,
    isAnonymous: false,
    authProvider: input.authProvider,
    expiresAt: undefined,
  });
}

export async function linkSessionWithGoogle(): Promise<SavedAccount> {
  await alignAnonymousUid();
  const session = getLocalSession();
  const linked = await linkAnonymousWithGoogle();
  if (!linked.user.email) {
    const error = new Error('google-no-email');
    (error as { code?: string }).code = 'auth/no-email';
    throw error;
  }
  const nickname = choosePreferredNickname(undefined, session.nickname, linked.user.displayName);
  if (linked.user && nickname && linked.user.displayName !== nickname) {
    try {
      await updateProfile(linked.user, { displayName: nickname });
    } catch {}
  }
  let idToken: string | null = null;
  try {
    idToken = await linked.user.getIdToken();
  } catch {
    idToken = null;
  }
  const data = await postUpgrade(
    {
      uid: linked.merged ? linked.previousUid || session.uid : linked.user.uid,
      targetUid: linked.merged ? linked.user.uid : undefined,
      email: linked.user.email,
      nickname,
      provider: 'google.com',
      confirmMerge: true,
    },
    idToken,
  );
  const saved = {
    uid: String(data.uid || linked.user.uid),
    email: String(data.email || linked.user.email),
    nickname: String(data.nickname || nickname),
    authProvider: 'google.com' as const,
  };
  persistSavedAccount(saved);
  await alignFirebaseIdentity().catch(() => undefined);
  return saved;
}

export async function linkSessionWithPassword(params: {
  email: string;
  password: string;
  nickname?: string;
  mode: 'login' | 'signup';
}): Promise<SavedAccount> {
  await alignAnonymousUid();
  const session = getLocalSession();
  let linked;
  if (params.mode === 'signup' && !session.isAnonymous) {
    const created = await registerWithEmail(
      params.email,
      params.password,
      params.nickname || session.nickname,
    );
    linked = { user: created, merged: created.uid !== session.uid, previousUid: session.uid };
  } else {
    linked = await linkAnonymousWithEmail(params.email, params.password);
    if (
      params.mode === 'signup' &&
      params.nickname &&
      linked.user.displayName !== params.nickname
    ) {
      try {
        await updateProfile(linked.user, { displayName: params.nickname });
      } catch {
        // The nickname is still stored on the RonDuel profile.
      }
    }
  }
  const email = linked.user.email || params.email.trim();
  const nickname = choosePreferredNickname(
    params.nickname,
    session.nickname,
    linked.user.displayName,
  );
  if (linked.user && nickname && linked.user.displayName !== nickname) {
    try {
      await updateProfile(linked.user, { displayName: nickname });
    } catch {}
  }
  let idToken: string | null = null;
  try {
    idToken = await linked.user.getIdToken();
  } catch {
    idToken = null;
  }
  const data = await postUpgrade(
    {
      uid: linked.merged ? linked.previousUid || session.uid : linked.user.uid,
      targetUid: linked.merged ? linked.user.uid : undefined,
      email,
      nickname,
      provider: 'password',
      confirmMerge: true,
    },
    idToken,
  );
  const saved = {
    uid: String(data.uid || linked.user.uid),
    email: String(data.email || email),
    nickname: String(data.nickname || nickname),
    authProvider: 'password' as const,
  };
  persistSavedAccount(saved);
  await alignFirebaseIdentity().catch(() => undefined);
  return saved;
}

/**
 * Keeps the local session on the account Firebase Auth restored, so signing in (or coming back on
 * another browser) continues the same profile instead of starting a new guest.
 */
export async function syncSessionWithSignedInUser(): Promise<LocalSession> {
  await ensureInactivityCheckOnce();
  const account = await getSignedInAccount();
  const session = getLocalSession();
  if (!account || account.uid === session.uid) return session;
  // Only a guest session is adopted; a signed-in local account keeps its own uid
  // and silently aligns Firebase Auth to the RonDuel uid via custom token exchange.
  if (session.isAnonymous === false || session.email) {
    await alignFirebaseIdentity().catch(() => undefined);
    return session;
  }

  let adopted: { uid?: string; moved?: boolean } | null = null;
  try {
    const res = await fetch('/api/me/adopt-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromUid: session.uid, toUid: account.uid }),
    });
    if (!res.ok) return session;
    adopted = (await res.json().catch(() => null)) as { uid?: string; moved?: boolean } | null;
  } catch {
    return session;
  }

  if (adopted?.moved) {
    const next: LocalSession = {
      ...session,
      uid: account.uid,
      email: account.email ?? undefined,
      isAnonymous: !account.email,
      authProvider: account.email ? 'google.com' : session.authProvider,
      expiresAt: account.email ? undefined : session.expiresAt,
    };
    saveLocalSession(next);
    return next;
  }

  // The signed-in account already exists. Merge the guest into it instead of
  // dropping the guest uid (and its plays) when the request fails.
  if (adopted?.uid === account.uid && account.email) {
    try {
      const idToken = await getCurrentIdTokenSafe();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) {
        headers.Authorization = `Bearer ${idToken}`;
      }
      const upgrade = await fetch('/api/me/upgrade', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          uid: session.uid,
          targetUid: account.uid,
          email: account.email,
          nickname: session.nickname || undefined,
          provider: 'google.com',
          confirmMerge: true,
        }),
      });
      if (!upgrade.ok) return session;
      const data = (await upgrade.json().catch(() => ({}))) as {
        uid?: string;
        email?: string;
        nickname?: string;
      };
      const next: LocalSession = {
        ...session,
        uid: data.uid || account.uid,
        email: data.email || account.email,
        nickname: data.nickname || session.nickname,
        isAnonymous: false,
        authProvider: 'google.com',
        expiresAt: undefined,
      };
      saveLocalSession(next);
      await alignFirebaseIdentity().catch(() => undefined);
      return next;
    } catch {
      return session;
    }
  }

  // Nothing on the server belonged to this guest. Follow the restored account.
  if (adopted?.uid === session.uid) {
    const next: LocalSession = {
      ...session,
      uid: account.uid,
      email: account.email ?? undefined,
      isAnonymous: !account.email,
      authProvider: account.email ? 'google.com' : session.authProvider,
      expiresAt: account.email ? undefined : session.expiresAt,
    };
    saveLocalSession(next);
    return next;
  }

  return session;
}
