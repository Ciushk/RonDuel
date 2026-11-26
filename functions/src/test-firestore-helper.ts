export const FIRESTORE_READ_AFTER_WRITE_ERROR =
  'Firestore transactions require all reads to be executed before all writes.';

function clonePlainData<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => clonePlainData(item)) as unknown as T;
  }
  // Preserve non-plain objects such as Firestore Timestamp / FieldValue sentinels
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return value;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = clonePlainData(v);
  }
  return out as T;
}

/**
 * In-memory Firestore mock that strictly enforces the Firestore Admin SDK
 * transaction invariant: every `tx.get()` must happen before any `tx.set()`,
 * `tx.update()`, or `tx.delete()`. Writes are buffered and only committed if
 * the transaction callback resolves.
 */
export function createStrictMockFirestore(store: Map<string, Record<string, unknown>>) {
  const applySet = (path: string, data: Record<string, unknown>, options?: { merge?: boolean }) => {
    const cloned = clonePlainData(data);
    if (options?.merge && store.has(path)) {
      store.set(path, { ...store.get(path), ...cloned });
    } else {
      store.set(path, cloned);
    }
  };

  const applyUpdate = (path: string, data: Record<string, unknown>) => {
    const existing: Record<string, unknown> = { ...(store.get(path) || {}) };
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && v.constructor?.name?.includes('Delete')) {
        delete existing[k];
      } else {
        existing[k] = clonePlainData(v);
      }
    }
    store.set(path, existing);
  };

  const makeDocRef = (docPath: string): any => ({
    path: docPath,
    get: async () => {
      const data = store.get(docPath);
      return { exists: data !== undefined, data: () => clonePlainData(data) };
    },
    set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
      applySet(docPath, data, options);
    },
    update: async (data: Record<string, unknown>) => {
      applyUpdate(docPath, data);
    },
    delete: async () => {
      store.delete(docPath);
    },
    collection: (subCol: string) => makeCollectionRef(`${docPath}/${subCol}`),
  });

  const makeCollectionRef = (colPath: string): any => ({
    path: colPath,
    doc: (id: string) => makeDocRef(`${colPath}/${id}`),
    get: async () => {
      const docs: Array<{ id: string; data: () => Record<string, unknown> }> = [];
      const prefix = `${colPath}/`;
      for (const [p, d] of store.entries()) {
        if (p.startsWith(prefix) && !p.slice(prefix.length).includes('/')) {
          docs.push({
            id: p.slice(prefix.length),
            data: () => clonePlainData(d),
          });
        }
      }
      return { docs };
    },
  });

  return {
    collection: (col: string) => makeCollectionRef(col),
    runTransaction: async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
      let hasWritten = false;
      const pendingWrites: Array<() => void> = [];

      const tx = {
        get: async (ref: any) => {
          if (hasWritten) {
            throw new Error(FIRESTORE_READ_AFTER_WRITE_ERROR);
          }
          if (ref && ref.docs !== undefined) {
            return ref;
          }
          if (ref && typeof ref.get === 'function') {
            return ref.get();
          }
          const data = store.get(ref.path);
          return { exists: data !== undefined, data: () => clonePlainData(data) };
        },
        set: (
          ref: { path: string },
          data: Record<string, unknown>,
          options?: { merge?: boolean },
        ) => {
          hasWritten = true;
          pendingWrites.push(() => applySet(ref.path, data, options));
        },
        update: (ref: { path: string }, data: Record<string, unknown>) => {
          hasWritten = true;
          pendingWrites.push(() => applyUpdate(ref.path, data));
        },
        delete: (ref: { path: string }) => {
          hasWritten = true;
          pendingWrites.push(() => {
            store.delete(ref.path);
          });
        },
      };

      const result = await fn(tx);
      for (const write of pendingWrites) {
        write();
      }
      return result;
    },
  };
}
