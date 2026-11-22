/** Guest profiles stay for this many days from creation, then they are deleted. */
export const ANON_RETENTION_DAYS = 7;

export const ANON_RETENTION_MS = ANON_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function anonExpiresAtIso(createdAtIso: string): string {
  const createdMs = new Date(createdAtIso).getTime();
  const base = Number.isFinite(createdMs) ? createdMs : Date.now();
  return new Date(base + ANON_RETENTION_MS).toISOString();
}

export function parseExpiresAt(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value === 'object') {
    const record = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof record.toDate === 'function') {
      const date = record.toDate();
      return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
    }
    const seconds = record.seconds ?? record._seconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      return new Date(seconds * 1000);
    }
  }
  return null;
}

export interface ExpiryUser {
  isAnonymous?: boolean;
  email?: string | null;
  createdAt?: string | null;
  expiresAt?: unknown;
}

/**
 * Anonymous users expire at createdAt + ANON_RETENTION_DAYS.
 * An existing expiresAt is kept as-is (activity never extends it).
 * Accounts with an email, or explicitly registered users, do not expire.
 */
export function computeAnonExpiry(user: ExpiryUser, now = Date.now()): Date | null {
  const anonymous = user.isAnonymous !== false && !user.email;
  if (!anonymous) return null;
  const existing = parseExpiresAt(user.expiresAt);
  if (existing) return existing;
  const created = parseExpiresAt(user.createdAt) ?? new Date(now);
  return new Date(created.getTime() + ANON_RETENTION_MS);
}

export function shouldPurgeAnonymousUser(
  data: ExpiryUser,
  now: Date | number = Date.now(),
): boolean {
  if (data.isAnonymous !== true) return false;
  if (data.email) return false;
  const expiry = parseExpiresAt(data.expiresAt);
  if (!expiry) return false;
  const nowMs = now instanceof Date ? now.getTime() : now;
  return expiry.getTime() <= nowMs;
}

export interface PurgeCandidate {
  id: string;
  data: ExpiryUser & Record<string, unknown>;
}

/**
 * Walks anonymous-user query pages (max `batchSize`) and deletes only expired
 * guests. Callers own the query and the delete side effects.
 */
export async function runAnonymousPurge(options: {
  now: Date;
  loadCandidates: (now: Date) => Promise<PurgeCandidate[]>;
  deleteUser: (uid: string, data: PurgeCandidate['data']) => Promise<void>;
  batchSize?: number;
}): Promise<{ deletedCount: number; skippedWithEmail: number }> {
  const batchSize = options.batchSize ?? 400;
  let deletedCount = 0;
  let skippedWithEmail = 0;
  const skippedIds = new Set<string>();

  for (;;) {
    const batch = (await options.loadCandidates(options.now)).slice(0, batchSize);
    if (batch.length === 0) break;
    let progress = false;
    for (const doc of batch) {
      if (!shouldPurgeAnonymousUser(doc.data, options.now)) {
        if (doc.data.email && !skippedIds.has(doc.id)) {
          skippedWithEmail += 1;
          skippedIds.add(doc.id);
        }
        continue;
      }
      await options.deleteUser(doc.id, doc.data);
      deletedCount += 1;
      progress = true;
    }
    if (!progress) break;
  }

  return { deletedCount, skippedWithEmail };
}
