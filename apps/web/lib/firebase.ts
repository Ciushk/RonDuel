import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyC1xcAcVnO71-zdXjQE_7RYurgGw-bnE0o',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'ronduel.firebaseapp.com',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ronduel',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:192428092772:web:16e2669fad3e7f599ade71',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '192428092772',
  };
}

function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  const config = getFirebaseConfig();
  if (!config.apiKey) return null;
  return getApps().length > 0 ? getApp() : initializeApp(config);
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  return getAuth(app);
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth nu este inițializat.');
  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), pass);
  return userCredential.user;
}

export async function registerWithEmail(
  email: string,
  pass: string,
  username: string,
): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth nu este inițializat.');
  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  const trimmedName = username.trim();
  if (trimmedName) {
    try {
      await updateProfile(userCredential.user, { displayName: trimmedName });
    } catch {
      // Ignorăm eroarea non-critică de profil
    }
  }
  return userCredential.user;
}

export async function loginWithGoogle(): Promise<User> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth nu este inițializat.');
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth nu este inițializat.');
  await sendPasswordResetEmail(auth, email.trim());
}

export async function logoutUser(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  await signOut(auth);
}

export { onAuthStateChanged, type User };
