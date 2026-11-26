import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export interface SetTutorialStepResult {
  tutorialStep: number;
}

/**
 * Monotonically advances a player's town onboarding tutorialStep (clamped to 0..3).
 * Never decreases the stored value and never touches wallets, coins, XP, or orders.
 */
export async function setTutorialStep(
  db: Firestore,
  uid: string,
  step: number,
): Promise<SetTutorialStepResult> {
  if (!Number.isFinite(step)) {
    throw new Error('INVALID_STEP: Tutorial step must be a finite number');
  }

  const townRef = db.collection('users').doc(uid).collection('town').doc('main');

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(townRef);
    if (!snap.exists) {
      throw new Error('TOWN_NOT_FOUND: Town not initialized');
    }

    const rawCurrent = Number(snap.data()?.tutorialStep ?? 0);
    const current = Number.isFinite(rawCurrent) ? Math.max(0, Math.floor(rawCurrent)) : 0;
    const requested = Math.floor(step);
    const next = Math.min(3, Math.max(current, requested));

    if (next > current) {
      tx.update(townRef, {
        tutorialStep: next,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return { tutorialStep: next };
  });
}
