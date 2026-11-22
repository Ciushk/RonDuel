'use client';

import {
  ensureAnonymousAuth,
  linkAnonymousWithEmail,
  linkAnonymousWithGoogle,
  registerWithEmail,
  updateProfile,
} from '@/lib/firebase';
import { getLocalSession, saveLocalSession } from '@/lib/session';

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

async function postUpgrade(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/me/upgrade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const error = new Error(typeof data.error === 'string' ? data.error : 'upgrade failed');
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
  const nickname = linked.user.displayName || session.nickname;
  const data = await postUpgrade({
    uid: linked.merged ? linked.previousUid || session.uid : linked.user.uid,
    targetUid: linked.merged ? linked.user.uid : undefined,
    email: linked.user.email,
    nickname,
    provider: 'google.com',
    confirmMerge: true,
  });
  const saved = {
    uid: String(data.uid || linked.user.uid),
    email: String(data.email || linked.user.email),
    nickname: String(data.nickname || nickname),
    authProvider: 'google.com' as const,
  };
  persistSavedAccount(saved);
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
  const nickname = params.nickname || linked.user.displayName || session.nickname;
  const data = await postUpgrade({
    uid: linked.merged ? linked.previousUid || session.uid : linked.user.uid,
    targetUid: linked.merged ? linked.user.uid : undefined,
    email,
    nickname,
    provider: 'password',
    confirmMerge: true,
  });
  const saved = {
    uid: String(data.uid || linked.user.uid),
    email: String(data.email || email),
    nickname: String(data.nickname || nickname),
    authProvider: 'password' as const,
  };
  persistSavedAccount(saved);
  return saved;
}
