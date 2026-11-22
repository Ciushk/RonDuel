'use client';

import { EnvelopeSimple, GoogleLogo, Key, Lock, User } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button, Sheet } from '@/components/ui';
import { trackEvent } from '@/lib/analytics';
import {
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail,
  requestPasswordReset,
} from '@/lib/firebase';
import { getLocalSession, saveLocalSession } from '@/lib/session';

export type AuthMode = 'login' | 'signup' | 'forgot';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
  onSuccess?: (user: { uid: string; email: string; nickname?: string }) => void;
}

export function AuthModal({ open, onClose, initialMode = 'login', onSuccess }: AuthModalProps) {
  const t = useTranslations('auth');
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const getFriendlyErrorMessage = (err: unknown): string => {
    if (!err || typeof err !== 'object') return t('errors.unexpectedError');
    const code = (err as { code?: string }).code || '';
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return t('errors.invalidCredentials');
      case 'auth/email-already-in-use':
        return t('errors.emailInUse');
      case 'auth/weak-password':
        return t('errors.weakPassword');
      case 'auth/invalid-email':
        return t('errors.invalidEmail');
      case 'auth/popup-closed-by-user':
        return t('errors.googleClosed');
      case 'auth/network-request-failed':
        return t('errors.networkError');
      default:
        return (err as { message?: string }).message || t('errors.unexpectedError');
    }
  };
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Reset state when opening
  const handleOpenChange = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setResetSent(false);
  };

  const syncBackend = async (uid: string, userEmail: string, userNickname?: string, provider: 'google' | 'password' = 'password') => {
    try {
      const res = await fetch('/api/me/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          email: userEmail,
          nickname: userNickname || undefined,
          provider,
          confirmMerge: true,
        }),
      });
      return await res.json().catch(() => null);
    } catch {
      return null;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError(t('errors.fillFields'));
      return;
    }

    setLoading(true);
    try {
      const user = await loginWithEmail(email, password);
      const session = getLocalSession();
      const updatedNick = user.displayName || session.nickname;

      const upgraded = await syncBackend(session.uid, user.email || email.trim(), updatedNick, 'password');
      const finalUid = upgraded?.uid || user.uid;
      const finalEmail = upgraded?.email || user.email || email.trim();
      const finalNick = upgraded?.nickname || updatedNick;

      saveLocalSession({
        ...session,
        uid: finalUid,
        email: finalEmail,
        nickname: finalNick,
        isAnonymous: false,
        authProvider: 'password',
      });

      trackEvent('login_completed', { method: 'email_password' });

      onSuccess?.({ uid: finalUid, email: finalEmail, nickname: finalNick });
      onClose();
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim();
    if (!cleanUsername || cleanUsername.length < 2) {
      setError(t('errors.fillUsername'));
      return;
    }
    if (cleanUsername.length > 20) {
      setError(t('errors.fillUsername'));
      return;
    }
    if (!email.trim()) {
      setError(t('errors.invalidEmail'));
      return;
    }
    if (!password || password.length < 6) {
      setError(t('errors.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('errors.passwordsMismatch'));
      return;
    }

    setLoading(true);
    try {
      const user = await registerWithEmail(email, password, cleanUsername);
      const session = getLocalSession();

      const upgraded = await syncBackend(session.uid, user.email || email.trim(), cleanUsername, 'password');
      const finalUid = upgraded?.uid || user.uid;
      const finalEmail = upgraded?.email || user.email || email.trim();
      const finalNick = upgraded?.nickname || cleanUsername;

      saveLocalSession({
        ...session,
        uid: finalUid,
        email: finalEmail,
        nickname: finalNick,
        isAnonymous: false,
        authProvider: 'password',
      });

      trackEvent('signup_completed', { method: 'email_password' });

      onSuccess?.({ uid: finalUid, email: finalEmail, nickname: finalNick });
      onClose();
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const user = await loginWithGoogle();
      if (!user.email) {
        setError(t('errors.googleNoEmail'));
        setLoading(false);
        return;
      }
      const session = getLocalSession();
      const userNick = user.displayName || session.nickname;

      const upgraded = await syncBackend(session.uid, user.email, userNick, 'google');
      const finalUid = upgraded?.uid || upgraded?.existingUid || user.uid;
      const finalEmail = upgraded?.email || user.email;
      const finalNick = upgraded?.nickname || userNick;

      saveLocalSession({
        ...session,
        uid: finalUid,
        email: finalEmail,
        nickname: finalNick,
        isAnonymous: false,
        authProvider: 'google',
      });

      trackEvent('login_completed', { method: 'google' });

      onSuccess?.({ uid: finalUid, email: finalEmail, nickname: finalNick });
      onClose();
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError(t('errors.invalidEmail'));
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(email);
      setResetSent(true);
      trackEvent('password_reset_requested');
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<AuthMode, string> = {
    login: t('loginTitle'),
    signup: t('signupTitle'),
    forgot: t('forgotTitle'),
  };

  return (
    <Sheet open={open} onClose={onClose} title={titles[mode]}>
      <div className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="rounded-xl border-2 border-wrong bg-wrong/10 p-3 text-xs font-bold text-wrong leading-snug">
            {error}
          </div>
        )}

        {/* 1. LOGIN MODE */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-black uppercase text-muted mb-1">
                {t('emailLabel')}
              </label>
              <div className="relative">
                <EnvelopeSimple
                  size={18}
                  weight="bold"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 rounded-[14px] border-2 border-border bg-surface-2 pl-10 pr-4 text-sm font-bold text-ink placeholder:text-muted/60 focus:border-border-subtle focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-black uppercase text-muted">
                  {t('passwordLabel')}
                </label>
                <button
                  type="button"
                  onClick={() => handleOpenChange('forgot')}
                  className="text-xs font-bold text-blue hover:underline cursor-pointer"
                >
                  {t('forgotPasswordLink')}
                </button>
              </div>
              <div className="relative">
                <Lock
                  size={18}
                  weight="bold"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 rounded-[14px] border-2 border-border bg-surface-2 pl-10 pr-4 text-sm font-bold text-ink placeholder:text-muted/60 focus:border-border-subtle focus:outline-none"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="volt"
              fullWidth
              size="lg"
              disabled={loading}
              className="mt-2 font-black shadow-[var(--rd-shadow-key)]"
            >
              {loading ? t('loggingIn') : t('loginButton')}
            </Button>

            {/* OR separator */}
            <div className="relative my-3 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-border/40" />
              </div>
              <span className="relative bg-surface px-3 text-xs font-bold uppercase tracking-wider text-muted">
                {t('orDivider')}
              </span>
            </div>

            {/* Google button below */}
            <Button
              type="button"
              variant="secondary"
              fullWidth
              size="lg"
              disabled={loading}
              onClick={() => void handleGoogleAuth()}
              className="font-bold flex items-center justify-center gap-2"
            >
              <GoogleLogo size={20} weight="bold" />
              <span>{t('continueWithGoogle')}</span>
            </Button>

            {/* Footer link to Sign Up */}
            <div className="pt-2 text-center text-xs font-medium text-muted">
              {t('noAccountYet')}{' '}
              <button
                type="button"
                onClick={() => handleOpenChange('signup')}
                className="font-black text-ink underline hover:text-ron-strong cursor-pointer"
              >
                {t('createOne')}
              </button>
            </div>
          </form>
        )}

        {/* 2. SIGN UP MODE */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3">
            <div>
              <label className="block text-xs font-black uppercase text-muted mb-1">
                {t('usernameLabel')}
              </label>
              <div className="relative">
                <User
                  size={18}
                  weight="bold"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="text"
                  autoComplete="username"
                  required
                  placeholder={t('usernamePlaceholder')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-11 rounded-[14px] border-2 border-border bg-surface-2 pl-10 pr-4 text-sm font-bold text-ink placeholder:text-muted/60 focus:border-border-subtle focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-muted mb-1">
                {t('emailLabel')}
              </label>
              <div className="relative">
                <EnvelopeSimple
                  size={18}
                  weight="bold"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 rounded-[14px] border-2 border-border bg-surface-2 pl-10 pr-4 text-sm font-bold text-ink placeholder:text-muted/60 focus:border-border-subtle focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-muted mb-1">
                {t('passwordLabel')}
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  weight="bold"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder={t('passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 rounded-[14px] border-2 border-border bg-surface-2 pl-10 pr-4 text-sm font-bold text-ink placeholder:text-muted/60 focus:border-border-subtle focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-muted mb-1">
                {t('confirmPasswordLabel')}
              </label>
              <div className="relative">
                <Key
                  size={18}
                  weight="bold"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder={t('confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-11 rounded-[14px] border-2 border-border bg-surface-2 pl-10 pr-4 text-sm font-bold text-ink placeholder:text-muted/60 focus:border-border-subtle focus:outline-none"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="volt"
              fullWidth
              size="lg"
              disabled={loading}
              className="mt-1 font-black shadow-[var(--rd-shadow-key)]"
            >
              {loading ? t('creatingAccount') : t('signupButton')}
            </Button>

            {/* OR separator */}
            <div className="relative my-2 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-border/40" />
              </div>
              <span className="relative bg-surface px-3 text-xs font-bold uppercase tracking-wider text-muted">
                {t('orDivider')}
              </span>
            </div>

            {/* Google button */}
            <Button
              type="button"
              variant="secondary"
              fullWidth
              size="lg"
              disabled={loading}
              onClick={() => void handleGoogleAuth()}
              className="font-bold flex items-center justify-center gap-2"
            >
              <GoogleLogo size={20} weight="bold" />
              <span>{t('continueWithGoogle')}</span>
            </Button>

            {/* Footer link to Login */}
            <div className="pt-1 text-center text-xs font-medium text-muted">
              {t('haveAccount')}{' '}
              <button
                type="button"
                onClick={() => handleOpenChange('login')}
                className="font-black text-ink underline hover:text-ron-strong cursor-pointer"
              >
                {t('loginButton')}
              </button>
            </div>
          </form>
        )}

        {/* 3. FORGOT PASSWORD MODE */}
        {mode === 'forgot' && (
          <div className="space-y-4">
            {resetSent ? (
              <div className="space-y-3 text-center py-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-volt border-2 border-border text-2xl shadow-sm">
                  ✉️
                </div>
                <div className="space-y-1">
                  <h3 className="font-display font-extrabold text-base text-ink">
                    {t('resetSentMessage')}
                  </h3>
                </div>
                <Button
                  variant="secondary"
                  fullWidth
                  size="md"
                  onClick={() => handleOpenChange('login')}
                  className="font-bold mt-2"
                >
                  {t('backToLogin')}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-3.5">
                <p className="text-muted text-xs leading-relaxed">
                  {t('resetIntro')}
                </p>

                <div>
                  <label className="block text-xs font-black uppercase text-muted mb-1">
                    {t('emailLabel')}
                  </label>
                  <div className="relative">
                    <EnvelopeSimple
                      size={18}
                      weight="bold"
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      placeholder={t('emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-12 rounded-[14px] border-2 border-border bg-surface-2 pl-10 pr-4 text-sm font-bold text-ink placeholder:text-muted/60 focus:border-border-subtle focus:outline-none"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="volt"
                  fullWidth
                  size="lg"
                  disabled={loading}
                  className="font-black shadow-[var(--rd-shadow-key)]"
                >
                  {loading ? t('sendingReset') : t('resetButton')}
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => handleOpenChange('login')}
                    className="text-xs font-bold text-muted hover:text-ink cursor-pointer"
                  >
                    ← {t('backToLogin')}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
