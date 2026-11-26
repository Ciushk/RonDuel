/**
 * Shared Firebase Auth error-to-localized-message mapper used by both AuthModal and PaymentAuthGate.
 */
export function getFriendlyAuthErrorMessage(err: unknown, tAuth: (key: string) => string): string {
  if (!err || typeof err !== 'object') return tAuth('errors.unexpectedError');
  const code = (err as { code?: string }).code || '';
  const message = (err as { message?: string }).message || '';

  if (code === 'auth/no-email' || message === 'google-no-email') {
    return tAuth('errors.googleNoEmail');
  }

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return tAuth('errors.invalidCredentials');
    case 'auth/email-already-in-use':
      return tAuth('errors.emailInUse');
    case 'auth/weak-password':
      return tAuth('errors.weakPassword');
    case 'auth/invalid-email':
      return tAuth('errors.invalidEmail');
    case 'auth/popup-closed-by-user':
      return tAuth('errors.googleClosed');
    case 'auth/network-request-failed':
      return tAuth('errors.networkError');
    default:
      return message || tAuth('errors.unexpectedError');
  }
}
