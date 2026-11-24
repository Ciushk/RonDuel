import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const describeRules = emulatorHost ? describe : describe.skip;

describeRules('Firestore Security Rules - RonTown', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const [host, portStr] = (emulatorHost ?? '127.0.0.1:8080').split(':');
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-ronduel',
      firestore: {
        rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
        host,
        port: Number(portStr ?? '8080'),
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();
    }
  });

  describe('users/{uid}/wallet', () => {
    it('allows owner to read wallet but forbids another user', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users/alice/wallet/main'), { balance: 100 });
      });

      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      const bobDb = testEnv.authenticatedContext('bob').firestore();

      await assertSucceeds(getDoc(doc(aliceDb, 'users/alice/wallet/main')));
      await assertFails(getDoc(doc(bobDb, 'users/alice/wallet/main')));
    });

    it('denies client writes to wallet', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      await assertFails(setDoc(doc(aliceDb, 'users/alice/wallet/main'), { balance: 9999 }));
    });
  });

  describe('users/{uid}/town subcollections (town, townTiles, townInventory, townOrders)', () => {
    it('allows owner to read own town subcollections', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users/alice/town/main'), { population: 2 });
        await setDoc(doc(adminDb, 'users/alice/townTiles/0_0'), { type: 'starter_house' });
        await setDoc(doc(adminDb, 'users/alice/townInventory/main'), { items: {} });
        await setDoc(doc(adminDb, 'users/alice/townOrders/2026-11-24'), { orders: [] });
      });

      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      await assertSucceeds(getDoc(doc(aliceDb, 'users/alice/town/main')));
      await assertSucceeds(getDoc(doc(aliceDb, 'users/alice/townTiles/0_0')));
      await assertSucceeds(getDoc(doc(aliceDb, 'users/alice/townInventory/main')));
      await assertSucceeds(getDoc(doc(aliceDb, 'users/alice/townOrders/2026-11-24')));
    });

    it('denies other users from reading alice town subcollections', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users/alice/town/main'), { population: 2 });
      });

      const bobDb = testEnv.authenticatedContext('bob').firestore();
      await assertFails(getDoc(doc(bobDb, 'users/alice/town/main')));
    });

    it('denies client writes to town subcollections', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      await assertFails(setDoc(doc(aliceDb, 'users/alice/town/main'), { population: 999 }));
      await assertFails(setDoc(doc(aliceDb, 'users/alice/townTiles/0_0'), { type: 'villa' }));
      await assertFails(
        setDoc(doc(aliceDb, 'users/alice/townInventory/main'), { items: { coins: 999 } }),
      );
      await assertFails(setDoc(doc(aliceDb, 'users/alice/townOrders/2026-11-24'), { orders: [] }));
    });
  });

  describe('ledger collection', () => {
    it('allows owner to read own ledger entry but denies others', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'ledger/tx_alice_1'), {
          uid: 'alice',
          delta: 50,
          bucket: 'trivia',
        });
      });

      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      const bobDb = testEnv.authenticatedContext('bob').firestore();

      await assertSucceeds(getDoc(doc(aliceDb, 'ledger/tx_alice_1')));
      await assertFails(getDoc(doc(bobDb, 'ledger/tx_alice_1')));
    });

    it('denies client writes to ledger', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      await assertFails(
        setDoc(doc(aliceDb, 'ledger/fake_entry'), {
          uid: 'alice',
          delta: 1000,
        }),
      );
    });
  });

  describe('townSnapshots collection', () => {
    it('allows owner and league members to read town snapshot, denies non-league users', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'users/alice'), { leagueIds: ['league_1'] });
        await setDoc(doc(adminDb, 'users/bob'), { leagueIds: ['league_1'] });
        await setDoc(doc(adminDb, 'users/charlie'), { leagueIds: ['league_2'] });

        await setDoc(doc(adminDb, 'townSnapshots/alice'), {
          hostUid: 'alice',
          leagueIds: ['league_1'],
          population: 10,
        });
      });

      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      const bobDb = testEnv.authenticatedContext('bob').firestore();
      const charlieDb = testEnv.authenticatedContext('charlie').firestore();

      await assertSucceeds(getDoc(doc(aliceDb, 'townSnapshots/alice')));
      await assertSucceeds(getDoc(doc(bobDb, 'townSnapshots/alice')));
      await assertFails(getDoc(doc(charlieDb, 'townSnapshots/alice')));
    });

    it('denies client writes to townSnapshots', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      await assertFails(setDoc(doc(aliceDb, 'townSnapshots/alice'), { population: 999 }));
    });
  });

  describe('config collection (townEconomy, townCatalog)', () => {
    it('allows signed-in users to read config, denies unauthenticated', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, 'config/townEconomy'), { enabled: true });
        await setDoc(doc(adminDb, 'config/townCatalog'), { version: 1, items: {} });
      });

      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      const unauthDb = testEnv.unauthenticatedContext().firestore();

      await assertSucceeds(getDoc(doc(aliceDb, 'config/townEconomy')));
      await assertSucceeds(getDoc(doc(aliceDb, 'config/townCatalog')));

      await assertFails(getDoc(doc(unauthDb, 'config/townEconomy')));
      await assertFails(getDoc(doc(unauthDb, 'config/townCatalog')));
    });

    it('denies client writes to config', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      await assertFails(setDoc(doc(aliceDb, 'config/townEconomy'), { enabled: true }));
      await assertFails(setDoc(doc(aliceDb, 'config/townCatalog'), { version: 99 }));
    });
  });
});
