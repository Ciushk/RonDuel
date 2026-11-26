import { beforeEach, describe, expect, it } from 'vitest';
import { createStrictMockFirestore } from './test-firestore-helper.js';
import { setTutorialStep } from './town-tutorial.js';

describe('town-tutorial server logic', () => {
  let store: Map<string, Record<string, unknown>>;
  let mockDb: any;

  beforeEach(() => {
    store = new Map();
    mockDb = createStrictMockFirestore(store);
  });

  it('advances tutorialStep monotonically and never decreases it', async () => {
    store.set('users/u1/town/main', { gridSize: 8, tutorialStep: 1 });
    store.set('users/u1/wallet/main', {
      balance: 100,
      buckets: { trivia: 0, town: 100, purchased: 0, gift: 0 },
    });

    const r1 = await setTutorialStep(mockDb, 'u1', 2);
    expect(r1).toEqual({ tutorialStep: 2 });
    expect((store.get('users/u1/town/main') as any).tutorialStep).toBe(2);

    const r2 = await setTutorialStep(mockDb, 'u1', 3);
    expect(r2).toEqual({ tutorialStep: 3 });
    expect((store.get('users/u1/town/main') as any).tutorialStep).toBe(3);

    // Passing 1 when stored value is 3 keeps 3
    const r3 = await setTutorialStep(mockDb, 'u1', 1);
    expect(r3).toEqual({ tutorialStep: 3 });
    expect((store.get('users/u1/town/main') as any).tutorialStep).toBe(3);

    // Wallet doc must remain completely untouched
    expect(store.get('users/u1/wallet/main')).toEqual({
      balance: 100,
      buckets: { trivia: 0, town: 100, purchased: 0, gift: 0 },
    });
  });

  it('clamps tutorialStep to 3', async () => {
    store.set('users/u2/town/main', { gridSize: 8, tutorialStep: 0 });
    const res = await setTutorialStep(mockDb, 'u2', 99);
    expect(res).toEqual({ tutorialStep: 3 });
    expect((store.get('users/u2/town/main') as any).tutorialStep).toBe(3);
  });

  it('throws TOWN_NOT_FOUND when town does not exist', async () => {
    await expect(setTutorialStep(mockDb, 'u_missing', 3)).rejects.toThrow('TOWN_NOT_FOUND');
  });

  it('never touches wallet docs when advancing tutorial', async () => {
    store.set('users/u3/town/main', { gridSize: 8, tutorialStep: 0 });
    await setTutorialStep(mockDb, 'u3', 2);
    expect(store.has('users/u3/wallet/main')).toBe(false);
    expect(store.has('ledger/tutorial:u3')).toBe(false);
  });
});
