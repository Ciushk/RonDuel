'use client';

import {
  ArrowLeft,
  CheckCircle,
  CircleNotch,
  EnvelopeSimple,
  Lock,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import { Button, Chip, Sheet } from '@/components/ui';
import { hasRealAccount, useIsRealAccount } from '@/lib/account-state';
import { trackEvent } from '@/lib/analytics';
import { getFriendlyAuthErrorMessage } from '@/lib/auth-errors';
import { alignFirebaseIdentity, type AlignIdentityResult } from '@/lib/billing-identity';
import { loginWithEmail, loginWithGoogle, resendEmailVerificationSafe } from '@/lib/firebase';
import { getLocalSession } from '@/lib/session';

const AuthModal = dynamic(() => import('@/components/AuthModal').then((m) => m.AuthModal), {
  ssr: false,
});

export type PaymentIntentKind = 'pro_checkout' | 'pro_trial' | 'town_coins' | 'shield_pack';

export type PaymentGateMode = 'guest' | 'reauth';

export interface PaymentIntent {
  kind: PaymentIntentKind;
  label?: string;
}

export interface OpenGateOptions {
  mode?: PaymentGateMode;
  action?: () => void | Promise<void>;
  email?: string;
  initialErrorCode?: string;
}

export const PENDING_PAYMENT_STORAGE_KEY = 'rd_pending_payment';
const PENDING_PAYMENT_MAX_AGE_MS = 10 * 60_000;
const GATE_CLOSE_ANIM_MS = 180;
const GATE_SUCCESS_HOLD_MS = 400;

interface StoredPendingPayment {
  kind: PaymentIntentKind;
  label?: string;
  path: string;
  ts: number;
}

interface PaymentAuthGateContextValue {
  requireAccount: (intent: PaymentIntent, action?: () => void | Promise<void>) => Promise<boolean>;
  openGate: (intent?: PaymentIntent, options?: OpenGateOptions) => void;
}

const PaymentAuthGateContext = createContext<PaymentAuthGateContextValue | null>(null);

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function writePendingPayment(intent: PaymentIntent, path: string): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredPendingPayment = {
      kind: intent.kind,
      label: intent.label,
      path,
      ts: Date.now(),
    };
    window.sessionStorage.setItem(PENDING_PAYMENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
}

function clearPendingPaymentStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

function readPendingPayment(currentPath: string): StoredPendingPayment | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_PAYMENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPendingPayment>;
    if (
      !parsed ||
      typeof parsed.kind !== 'string' ||
      typeof parsed.path !== 'string' ||
      typeof parsed.ts !== 'number'
    ) {
      return null;
    }
    if (Date.now() - parsed.ts > PENDING_PAYMENT_MAX_AGE_MS) {
      clearPendingPaymentStorage();
      return null;
    }
    if (parsed.path !== currentPath) return null;
    return parsed as StoredPendingPayment;
  } catch {
    return null;
  }
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.54-5.17 3.54-8.89Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.92l-3.88-3.02c-1.08.72-2.45 1.16-4.06 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.26A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.26V6.63H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.37l3.99-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.78c1.76 0 3.35.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.63l3.99 3.11c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

export function PaymentAuthGateProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('paymentGate');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const pathname = usePathname() || '/';

  const titleId = useId();
  const bodyId = useId();
  const emailInputId = useId();
  const passwordInputId = useId();

  const accountState = useIsRealAccount();
  const accountStateRef = useRef(accountState);
  accountStateRef.current = accountState;

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [mode, setMode] = useState<PaymentGateMode>('guest');
  const [reauthEmail, setReauthEmail] = useState('');
  const [step, setStep] = useState<'choose' | 'email'>('choose');
  const [emailMode, setEmailMode] = useState<'signup' | 'login'>('signup');
  const [intent, setIntent] = useState<PaymentIntent>({ kind: 'pro_checkout' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingMethod, setLoadingMethod] = useState<'google' | 'email' | null>(null);
  const [error, setError] = useState('');
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [verificationResent, setVerificationResent] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [success, setSuccess] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [reloadResume, setReloadResume] = useState<StoredPendingPayment | null>(null);

  const pendingActionRef = useRef<(() => void | Promise<void>) | null>(null);
  const googleBtnRef = useRef<HTMLButtonElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkingAuthRef = useRef(false);
  const mountedRef = useRef(true);
  const readyWaitersRef = useRef<Array<() => void>>([]);

  const clearTimers = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    if (!accountState.ready || readyWaitersRef.current.length === 0) return;
    const waiters = readyWaitersRef.current.splice(0);
    for (const resolve of waiters) {
      resolve();
    }
  }, [accountState.ready]);

  const waitForAccountReady = useCallback((): Promise<void> => {
    if (accountStateRef.current.ready) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      readyWaitersRef.current.push(resolve);
    });
  }, []);

  // If the page reloaded mid-flow (ref lost, sessionStorage still has fresh item for this path),
  // never auto-charge; show an inline "Continue to payment" button instead once Auth is ready.
  useEffect(() => {
    if (pendingActionRef.current) return;
    const stored = readPendingPayment(pathname);
    if (!stored) {
      setReloadResume(null);
      return;
    }
    if (!accountState.ready) return;
    setReloadResume(accountState.isReal ? stored : null);
  }, [pathname, accountState.ready, accountState.isReal]);

  const finishClose = useCallback(() => {
    setOpen(false);
    setClosing(false);
    setMode('guest');
    setReauthEmail('');
    setStep('choose');
    setEmailMode('signup');
    setEmail('');
    setPassword('');
    setError('');
    setNeedsEmailVerification(false);
    setVerificationResent(false);
    setResendingVerification(false);
    setLoadingMethod(null);
    setSuccess(false);
  }, []);

  const dismissGate = useCallback(() => {
    if (loadingMethod !== null || success) return;
    pendingActionRef.current = null;
    clearPendingPaymentStorage();
    setReloadResume(null);

    if (prefersReducedMotion()) {
      finishClose();
      return;
    }

    setClosing(true);
    clearTimers();
    closeTimerRef.current = setTimeout(finishClose, GATE_CLOSE_ANIM_MS);
  }, [loadingMethod, success, finishClose, clearTimers]);

  const openGateModal = useCallback(
    (nextIntent: PaymentIntent, options?: OpenGateOptions) => {
      clearTimers();
      const nextMode: PaymentGateMode = options?.mode ?? 'guest';
      const sessionEmail = options?.email || getLocalSession().email || '';
      pendingActionRef.current = options?.action ?? null;
      setIntent(nextIntent);
      setMode(nextMode);
      setReauthEmail(nextMode === 'reauth' ? sessionEmail : '');
      setStep('choose');
      setEmailMode(nextMode === 'reauth' ? 'login' : 'signup');
      setEmail(nextMode === 'reauth' ? sessionEmail : '');
      setPassword('');
      setVerificationResent(false);
      setResendingVerification(false);
      if (options?.initialErrorCode === 'EMAIL_NOT_VERIFIED') {
        setError(t('emailNotVerified'));
        setNeedsEmailVerification(true);
      } else if (options?.initialErrorCode === 'TOKEN_SIGNING_UNAVAILABLE') {
        setError(t('signingUnavailable'));
        setNeedsEmailVerification(false);
      } else {
        setError('');
        setNeedsEmailVerification(false);
      }
      setLoadingMethod(null);
      setSuccess(false);
      setClosing(false);
      setReloadResume(null);
      if (options?.action) {
        writePendingPayment(nextIntent, pathname);
      }
      setOpen(true);
    },
    [clearTimers, pathname, t],
  );

  const requireAccount = useCallback(
    async (nextIntent: PaymentIntent, action?: () => void | Promise<void>): Promise<boolean> => {
      if (checkingAuthRef.current) {
        return false;
      }
      checkingAuthRef.current = true;
      setCheckingAuth(true);
      try {
        if (!accountStateRef.current.ready) {
          await waitForAccountReady();
        }
        if (!mountedRef.current) {
          return false;
        }
        const real = await hasRealAccount();
        if (!mountedRef.current) {
          return false;
        }
        checkingAuthRef.current = false;
        setCheckingAuth(false);
        if (real) {
          setReloadResume(null);
          clearPendingPaymentStorage();
          if (action) {
            void action();
          }
          return true;
        }
        openGateModal(nextIntent, { mode: 'guest', action });
        return false;
      } catch {
        if (mountedRef.current) {
          checkingAuthRef.current = false;
          setCheckingAuth(false);
        }
        return false;
      }
    },
    [openGateModal, waitForAccountReady],
  );

  const openGate = useCallback(
    (nextIntent?: PaymentIntent, options?: OpenGateOptions) => {
      openGateModal(nextIntent ?? { kind: 'pro_checkout' }, options);
    },
    [openGateModal],
  );

  const handleAlignmentFailure = useCallback(
    (alignment: AlignIdentityResult) => {
      const code = alignment.status === 'aligned' ? '' : (alignment.code ?? '');
      if (code === 'EMAIL_NOT_VERIFIED') {
        setNeedsEmailVerification(true);
        setError(t('emailNotVerified'));
        return;
      }
      if (code === 'TOKEN_SIGNING_UNAVAILABLE') {
        setNeedsEmailVerification(false);
        setError(t('signingUnavailable'));
        return;
      }
      setNeedsEmailVerification(false);
      const targetEmail = reauthEmail || getLocalSession().email || '';
      if (targetEmail) {
        setError(t('reauthBody', { email: targetEmail }));
      } else {
        setError(tAuth('errors.invalidCredentials'));
      }
    },
    [reauthEmail, t, tAuth],
  );

  const handleAuthSuccess = useCallback(() => {
    try {
      window.localStorage.setItem('rd_last_active_at', String(Date.now()));
    } catch {
      // ignore
    }
    setLoadingMethod(null);
    setError('');
    setNeedsEmailVerification(false);
    setSuccess(true);
    clearPendingPaymentStorage();
    setReloadResume(null);

    const actionToRun = pendingActionRef.current;
    pendingActionRef.current = null;

    clearTimers();
    successTimerRef.current = setTimeout(() => {
      finishClose();
      if (actionToRun) {
        void actionToRun();
      }
    }, GATE_SUCCESS_HOLD_MS);
  }, [clearTimers, finishClose]);

  const handleResendVerification = async () => {
    if (resendingVerification || verificationResent) return;
    setResendingVerification(true);
    try {
      const sent = await resendEmailVerificationSafe();
      if (sent) {
        setVerificationResent(true);
      }
    } catch {
      // Keep button enabled on transient error
    } finally {
      setResendingVerification(false);
    }
  };

  const handleGoogleContinue = async () => {
    if (loadingMethod || success) return;
    setError('');
    setNeedsEmailVerification(false);
    setLoadingMethod('google');
    try {
      if (mode === 'reauth') {
        await loginWithGoogle();
        const alignment = await alignFirebaseIdentity();
        if (alignment.status !== 'aligned') {
          setLoadingMethod(null);
          handleAlignmentFailure(alignment);
          return;
        }
        trackEvent('login_completed', { method: 'google', source: 'payment_gate_reauth' });
        handleAuthSuccess();
        return;
      }

      const { linkSessionWithGoogle } = await import('@/lib/link-account');
      await linkSessionWithGoogle();
      const alignment = await alignFirebaseIdentity();
      if (alignment.status !== 'aligned') {
        setLoadingMethod(null);
        handleAlignmentFailure(alignment);
        return;
      }
      trackEvent('login_completed', { method: 'google', source: 'payment_gate' });
      handleAuthSuccess();
    } catch (err) {
      setLoadingMethod(null);
      const errCode =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code ?? '')
          : '';
      if (errCode === 'EMAIL_NOT_VERIFIED') {
        setNeedsEmailVerification(true);
        setError(t('emailNotVerified'));
        return;
      }
      if (errCode === 'TOKEN_SIGNING_UNAVAILABLE') {
        setError(t('signingUnavailable'));
        return;
      }
      setError(
        getFriendlyAuthErrorMessage(err, (key) => tAuth(key as Parameters<typeof tAuth>[0])),
      );
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loadingMethod || success) return;
    setError('');
    setNeedsEmailVerification(false);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError(tAuth('errors.invalidEmail'));
      return;
    }
    if (!password || password.length < 6) {
      setError(tAuth('errors.passwordTooShort'));
      return;
    }

    setLoadingMethod('email');
    try {
      if (mode === 'reauth') {
        await loginWithEmail(cleanEmail, password);
        const alignment = await alignFirebaseIdentity();
        if (alignment.status !== 'aligned') {
          setLoadingMethod(null);
          handleAlignmentFailure(alignment);
          return;
        }
        trackEvent('login_completed', {
          method: 'email_password',
          source: 'payment_gate_reauth',
        });
        handleAuthSuccess();
        return;
      }

      const { linkSessionWithPassword } = await import('@/lib/link-account');
      await linkSessionWithPassword({
        email: cleanEmail,
        password,
        mode: emailMode,
      });
      const alignment = await alignFirebaseIdentity();
      if (alignment.status !== 'aligned') {
        setLoadingMethod(null);
        handleAlignmentFailure(alignment);
        return;
      }
      trackEvent(emailMode === 'signup' ? 'signup_completed' : 'login_completed', {
        method: 'email_password',
        source: 'payment_gate',
      });
      handleAuthSuccess();
    } catch (err) {
      setLoadingMethod(null);
      const errCode =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code ?? '')
          : '';
      if (errCode === 'EMAIL_NOT_VERIFIED') {
        setNeedsEmailVerification(true);
        setError(t('emailNotVerified'));
        return;
      }
      if (errCode === 'TOKEN_SIGNING_UNAVAILABLE') {
        setError(t('signingUnavailable'));
        return;
      }
      setError(
        getFriendlyAuthErrorMessage(err, (key) => tAuth(key as Parameters<typeof tAuth>[0])),
      );
    }
  };

  const handleReloadContinue = () => {
    const resume = reloadResume;
    clearPendingPaymentStorage();
    setReloadResume(null);
    if (resume && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronduel_resume_payment', { detail: resume }));
    }
  };

  const isLoading = loadingMethod !== null;
  const isReauth = mode === 'reauth';
  const dialogTitle =
    step === 'choose'
      ? isReauth
        ? t('reauthTitle')
        : t('title')
      : emailMode === 'signup'
        ? t('emailTitleSignup')
        : t('emailTitleLogin');
  const dialogBody = isReauth
    ? t('reauthBody', { email: reauthEmail || getLocalSession().email || '' })
    : t('body');

  return (
    <PaymentAuthGateContext.Provider value={{ requireAccount, openGate }}>
      {children}

      {reloadResume && (
        <div
          role="status"
          aria-live="polite"
          data-testid="payment-gate-resume-banner"
          className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-[440px] items-center justify-between gap-3 rounded-[16px] border-2 border-[var(--border-color,#0E0D15)] bg-[var(--rd-surface,#FFF7EC)] px-4 py-3 text-sm font-bold text-[var(--rd-ink,#0E0D15)] shadow-[var(--rd-shadow-sheet)] lg:bottom-6"
        >
          <span className="min-w-0 truncate">
            {reloadResume.label
              ? t('nextStep', { label: reloadResume.label })
              : t('continueToPayment')}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" variant="volt" onClick={handleReloadContinue} className="min-h-11">
              {t('continueToPayment')}
            </Button>
            <button
              type="button"
              onClick={() => {
                clearPendingPaymentStorage();
                setReloadResume(null);
              }}
              aria-label={tCommon('close')}
              className="border-border-subtle bg-surface-2 text-ink inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border"
            >
              <X size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {checkingAuth && (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          data-testid="payment-gate-auth-loading"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/25 p-4"
        >
          <div className="rd-gate-auth-loading border-border bg-surface text-ink inline-flex items-center gap-2.5 rounded-[16px] border-2 px-5 py-3.5 text-sm font-extrabold shadow-[3px_3px_0px_0px_#0E0D15]">
            <CircleNotch
              size={20}
              weight="bold"
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
            <span>{tCommon('loading')}</span>
          </div>
        </div>
      )}

      <Sheet
        open={open}
        onClose={dismissGate}
        title={dialogTitle}
        labelledBy={titleId}
        describedBy={bodyId}
        trapFocus
        initialFocusRef={googleBtnRef}
        closeOnScrimClick={!isLoading && !success}
        closeOnEscape={!isLoading && !success}
        ariaBusy={isLoading}
        hideHeader
        animate
        closing={closing}
        className="max-h-[92dvh] overflow-y-auto"
      >
        <div data-testid="payment-auth-gate" data-mode={mode} className="space-y-4">
          {/* Header with sticker icon tile, title, and close button */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                aria-hidden="true"
                className="border-border bg-volt flex h-12 w-12 shrink-0 -rotate-3 items-center justify-center rounded-[14px] border-2 text-xl text-[#0E0D15] shadow-[3px_3px_0px_0px_#0E0D15]"
              >
                {success ? (
                  <CheckCircle size={26} weight="fill" className="text-[#0E0D15]" />
                ) : (
                  <Lock size={24} weight="fill" className="text-[#0E0D15]" />
                )}
              </div>
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="font-display text-ink text-xl font-extrabold leading-tight sm:text-2xl"
                >
                  {dialogTitle}
                </h2>
                <p id={bodyId} className="text-muted mt-1 text-sm leading-snug">
                  {dialogBody}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissGate}
              disabled={isLoading || success}
              aria-label={tCommon('close')}
              className="border-border-subtle bg-surface-2 text-ink inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={20} weight="bold" aria-hidden="true" />
            </button>
          </div>

          {/* Success confirmation state (400ms before running pending payment action) */}
          {success ? (
            <div
              role="status"
              aria-live="polite"
              data-testid="payment-gate-success"
              className="border-border bg-volt flex items-center gap-3 rounded-[16px] border-2 px-4 py-4 text-sm font-extrabold text-[#0E0D15] shadow-[3px_3px_0px_0px_#0E0D15]"
            >
              <CheckCircle size={22} weight="fill" aria-hidden="true" className="shrink-0" />
              <span>{t('success')}</span>
            </div>
          ) : (
            <>
              {/* "What you keep" chips — shown only when upgrading from guest mode */}
              {!isReauth && (
                <div className="flex flex-wrap gap-1.5" aria-hidden="false">
                  <Chip tone="neutral" className="px-2.5 py-1 text-xs font-bold">
                    {t('keepStreak')}
                  </Chip>
                  <Chip tone="neutral" className="px-2.5 py-1 text-xs font-bold">
                    {t('keepScore')}
                  </Chip>
                  <Chip tone="neutral" className="px-2.5 py-1 text-xs font-bold">
                    {t('keepTown')}
                  </Chip>
                  <Chip tone="volt" className="px-2.5 py-1 text-xs font-bold">
                    {t('keepPro')}
                  </Chip>
                </div>
              )}

              {/* Error alert */}
              {error && (
                <div
                  role="alert"
                  className="border-wrong bg-wrong/10 text-wrong space-y-2 rounded-xl border-2 p-3 text-xs font-bold leading-snug"
                >
                  <div className="flex items-start gap-2">
                    <WarningCircle
                      size={18}
                      weight="fill"
                      aria-hidden="true"
                      className="mt-0.5 shrink-0"
                    />
                    <span>{error}</span>
                  </div>
                  {needsEmailVerification && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      fullWidth
                      data-testid="payment-gate-resend-verification-btn"
                      disabled={resendingVerification || verificationResent}
                      onClick={() => void handleResendVerification()}
                      className="min-h-11"
                    >
                      {verificationResent ? '✓ ' : ''}
                      {t('resendVerification')}
                    </Button>
                  )}
                </div>
              )}

              {/* Step 1: Choose Google or Email */}
              {step === 'choose' && (
                <div key="choose" className="rd-gate-step space-y-3">
                  <button
                    ref={googleBtnRef}
                    type="button"
                    data-testid="payment-gate-google-btn"
                    disabled={isLoading}
                    onClick={() => void handleGoogleContinue()}
                    className="border-border bg-surface text-ink hover:bg-surface-2 focus-visible:outline-3 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-[14px] border-2 px-5 py-3 text-base font-extrabold shadow-[var(--rd-shadow-key)] transition-[transform,opacity] duration-150 focus-visible:outline-offset-2 focus-visible:outline-[var(--rd-blue-strong)] active:translate-x-[2px] active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingMethod === 'google' ? (
                      <>
                        <CircleNotch
                          size={20}
                          weight="bold"
                          aria-hidden="true"
                          className="animate-spin motion-reduce:animate-none"
                        />
                        <span>{tAuth('loggingIn')}</span>
                      </>
                    ) : (
                      <>
                        <GoogleMark />
                        <span>{t('google')}</span>
                      </>
                    )}
                  </button>

                  <div className="relative flex items-center justify-center py-0.5">
                    <div className="absolute inset-0 flex items-center">
                      <div className="border-border/30 w-full border-t-2" />
                    </div>
                    <span className="bg-surface text-muted relative px-3 text-xs font-bold uppercase tracking-wider">
                      {t('or')}
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="blue"
                    size="lg"
                    fullWidth
                    data-testid="payment-gate-email-btn"
                    disabled={isLoading}
                    onClick={() => {
                      setError('');
                      setNeedsEmailVerification(false);
                      setStep('email');
                    }}
                    className="min-h-12"
                  >
                    <EnvelopeSimple size={20} weight="bold" aria-hidden="true" />
                    <span>{t('email')}</span>
                  </Button>

                  {intent.label && (
                    <p className="text-muted text-center text-xs font-bold">
                      {t('nextStep', { label: intent.label })}
                    </p>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    fullWidth
                    data-testid="payment-gate-not-now-btn"
                    disabled={isLoading}
                    onClick={dismissGate}
                    className="min-h-11"
                  >
                    {t('notNow')}
                  </Button>

                  {!isReauth && (
                    <p className="text-muted text-center text-[11px] leading-relaxed">
                      {t('note')}
                    </p>
                  )}
                </div>
              )}

              {/* Step 2: Email + Password */}
              {step === 'email' && (
                <form
                  key="email"
                  onSubmit={(e) => void handleEmailSubmit(e)}
                  className="rd-gate-step space-y-3"
                >
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      setError('');
                      setStep('choose');
                    }}
                    className="text-muted hover:text-ink inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-xs font-bold disabled:opacity-50"
                  >
                    <ArrowLeft size={16} weight="bold" aria-hidden="true" />
                    <span>{t('back')}</span>
                  </button>

                  <div>
                    <label
                      htmlFor={emailInputId}
                      className="text-muted mb-1 block text-xs font-black uppercase"
                    >
                      {tAuth('emailLabel')}
                    </label>
                    <input
                      id={emailInputId}
                      type="email"
                      autoComplete="email"
                      required
                      disabled={isLoading}
                      placeholder={tAuth('emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="border-border bg-surface-2 text-ink placeholder:text-muted/60 focus:border-duel-strong min-h-12 w-full rounded-[14px] border-2 px-4 text-sm font-bold focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <label
                        htmlFor={passwordInputId}
                        className="text-muted text-xs font-black uppercase"
                      >
                        {tAuth('passwordLabel')}
                      </label>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => setForgotOpen(true)}
                        className="text-duel-strong inline-flex min-h-11 cursor-pointer items-center text-xs font-bold hover:underline"
                      >
                        {tAuth('forgotPasswordLink')}
                      </button>
                    </div>
                    <input
                      id={passwordInputId}
                      type="password"
                      minLength={6}
                      autoComplete={emailMode === 'signup' ? 'new-password' : 'current-password'}
                      required
                      disabled={isLoading}
                      placeholder={tAuth('passwordPlaceholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-border bg-surface-2 text-ink placeholder:text-muted/60 focus:border-duel-strong min-h-12 w-full rounded-[14px] border-2 px-4 text-sm font-bold focus:outline-none"
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="volt"
                    size="lg"
                    fullWidth
                    data-testid="payment-gate-email-submit"
                    disabled={isLoading}
                    className="min-h-12 font-black"
                  >
                    {loadingMethod === 'email' ? (
                      <>
                        <CircleNotch
                          size={20}
                          weight="bold"
                          aria-hidden="true"
                          className="animate-spin motion-reduce:animate-none"
                        />
                        <span>{tAuth('loggingIn')}</span>
                      </>
                    ) : emailMode === 'signup' ? (
                      t('submitSignup')
                    ) : (
                      t('submitLogin')
                    )}
                  </Button>

                  {intent.label && (
                    <p className="text-muted text-center text-xs font-bold">
                      {t('nextStep', { label: intent.label })}
                    </p>
                  )}

                  {!isReauth && (
                    <div className="text-muted flex items-center justify-center gap-1.5 text-xs font-medium">
                      <span>{emailMode === 'signup' ? t('haveAccount') : t('noAccount')}</span>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => {
                          setError('');
                          setEmailMode((m) => (m === 'signup' ? 'login' : 'signup'));
                        }}
                        className="text-ink hover:text-ron-strong inline-flex min-h-11 cursor-pointer items-center font-black underline"
                      >
                        {emailMode === 'signup' ? t('logIn') : t('signUp')}
                      </button>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    fullWidth
                    disabled={isLoading}
                    onClick={dismissGate}
                    className="min-h-11"
                  >
                    {t('notNow')}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </Sheet>

      {forgotOpen && (
        <AuthModal open={forgotOpen} onClose={() => setForgotOpen(false)} initialMode="forgot" />
      )}
    </PaymentAuthGateContext.Provider>
  );
}

export function usePaymentAuthGate(): PaymentAuthGateContextValue {
  const ctx = useContext(PaymentAuthGateContext);
  if (ctx) return ctx;

  // Graceful fallback when a component is rendered outside AppShell (e.g. isolated unit tests)
  return {
    requireAccount: async (_intent, action) => {
      const real = await hasRealAccount();
      if (real && action) {
        void action();
      }
      return real;
    },
    openGate: () => {},
  };
}
