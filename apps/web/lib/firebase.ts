import { initializeApp, getApps, getApp, FirebaseError, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInAnonymously,
  createUserWithEmailAndPassword,
  linkWithPopup,
  linkWithCredential,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyC1xcAcVnO71-zdXjQE_7RYurgGw-bnE0o',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'ronduel.firebaseapp.com',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ronduel',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:192428092772:web:16e2669fad3e7f599ade71',
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_MESSAGING_SENDER_ID || '192428092772',
  };
}

function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  const config = getFirebaseConfig();
  if (!config.apiKey) return null;
  return getApps().length > 0 ? getApp() : initializeApp(config);
}

let cachedAuth: Auth | null = null;

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (cachedAuth) return cachedAuth;
  try {
    cachedAuth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    cachedAuth = getAuth(app);
  }
  return cachedAuth;
}

export function getFirebaseFirestore(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;
  return getFirestore(app);
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return userCredential.user;
}

export async function registerWithEmail(
  email: string,
  pass: string,
  username: string,
): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  const trimmedName = username.trim();
  if (trimmedName) {
    try {
      await updateProfile(userCredential.user, { displayName: trimmedName });
    } catch {
      // Ignore non-critical profile error
    }
  }
  return userCredential.user;
}

export async function loginWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth is not initialized');
  await sendPasswordResetEmail(auth, email.trim());
}

export interface LinkedAuthResult {
  user: User;
  merged: boolean;
  previousUid: string;
}

function authErrorCode(err: unknown): string {
  return err && typeof err === 'object' && 'code' in err
    ? String((err as { code?: string }).code ?? '')
    : '';
}

export async function ensureAnonymousAuth(): Promise<string | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }
    let user = auth.currentUser;
    if (!user) {
      const cred = await signInAnonymously(auth);
      user = cred.user;
    }
    return user.uid;
  } catch {
    return null;
  }
}

export async function linkAnonymousWithGoogle(): Promise<LinkedAuthResult> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const current = auth.currentUser;
  if (current?.isAnonymous) {
    try {
      const result = await linkWithPopup(current, googleProvider);
      return { user: result.user, merged: false, previousUid: current.uid };
    } catch (err) {
      const code = authErrorCode(err);
      if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
        const credential =
          err instanceof FirebaseError ? GoogleAuthProvider.credentialFromError(err) : null;
        if (!credential) throw err;
        const previousUid = current.uid;
        const signed = await signInWithCredential(auth, credential);
        return { user: signed.user, merged: true, previousUid };
      }
      throw err;
    }
  }
  const result = await signInWithPopup(auth, googleProvider);
  const previousUid = current?.uid ?? '';
  return {
    user: result.user,
    merged: Boolean(previousUid && previousUid !== result.user.uid),
    previousUid,
  };
}

export async function linkAnonymousWithEmail(
  email: string,
  password: string,
): Promise<LinkedAuthResult> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const current = auth.currentUser;
  const trimmed = email.trim();
  if (current?.isAnonymous) {
    const credential = EmailAuthProvider.credential(trimmed, password);
    try {
      const result = await linkWithCredential(current, credential);
      return { user: result.user, merged: false, previousUid: current.uid };
    } catch (err) {
      const code = authErrorCode(err);
      if (
        code === 'auth/credential-already-in-use' ||
        code === 'auth/email-already-in-use' ||
        code === 'auth/provider-already-linked'
      ) {
        const previousUid = current.uid;
        const signed = await signInWithEmailAndPassword(auth, trimmed, password);
        return { user: signed.user, merged: true, previousUid };
      }
      throw err;
    }
  }
  const signed = await signInWithEmailAndPassword(auth, trimmed, password);
  return {
    user: signed.user,
    merged: Boolean(current?.uid && current.uid !== signed.user.uid),
    previousUid: current?.uid ?? '',
  };
}

export async function logoutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
}

export interface SignedInAccount {
  uid: string;
  email: string | null;
}

/**
 * Account Firebase Auth restored. Anonymous guests and a hung Auth restore resolve to null.
 * Waits for authStateReady so the first null callback during persistence load is not treated
 * as "signed out".
 */
export async function getSignedInAccount(): Promise<SignedInAccount | null> {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  try {
    if (typeof auth.authStateReady === 'function') {
      await Promise.race([
        auth.authStateReady(),
        new Promise<void>((resolve) => {
          setTimeout(resolve, 4000);
        }),
      ]);
    }
  } catch {
    return null;
  }
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return null;
  return { uid: user.uid, email: user.email };
}

export async function getSignedInUid(): Promise<string | null> {
  const account = await getSignedInAccount();
  return account?.uid ?? null;
}

export { onAuthStateChanged, updateProfile, type User };
