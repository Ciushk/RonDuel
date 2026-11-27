'use client';

import { EnvelopeSimple, GoogleLogo } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { AuthModal, type AuthMode } from '@/components/AuthModal';
import { Button, Sheet } from '@/components/ui';
import { apiErrorMessage } from '@/lib/api-error';
import { trackEvent } from '@/lib/analytics';
import { linkSessionWithGoogle } from '@/lib/link-account';
import { getLocalSession, saveLocalSession } from '@/lib/session';
import { GuestAccountNotice } from '@/components/GuestAccountNotice';

interface AccountLinkingSheetProps {
  open: boolean;
  onClose: () => void;
  score: number;
  streak: number;
  onLinked: () => void;
}

export function AccountLinkingSheet({
  open,
  onClose,
  score,
  streak,
  onLinked,
}: AccountLinkingSheetProps) {
  const t = useTranslations();
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthMode>('login');
  const [accountExistsConfirm, setAccountExistsConfirm] = useState<{
    email: string;
    provider: 'email_link';
  } | null>(null);

  const handleGoogleLink = async () => {
    setLoading(true);
    setError('');
    try {
      const saved = await linkSessionWithGoogle();
      trackEvent('account_link_completed', { method: 'google' });
      trackEvent('account_linked', { provider: 'google.com', uid: saved.uid });
      setAccountExistsConfirm(null);
      onLinked();
      onClose();
    } catch (err: unknown) {
      if ((err as { message?: string }).message === 'google-no-email') {
        setError(t('auth.errors.googleNoEmail'));
        return;
      }
      const authErr = err as { code?: string; message?: string };
      if (authErr?.code === 'auth/popup-closed-by-user') {
        setError(t('auth.errors.googleClosed'));
      } else {
        setError(t('auth.errors.googleFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (
    provider: 'email_link',
    targetEmail?: string,
    confirmMerge?: boolean,
  ) => {
    const session = getLocalSession();
    const finalEmail = targetEmail || email.trim();

    if (!finalEmail) {
      setError(t('account.invalidEmail'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/me/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: session.uid,
          email: finalEmail,
          provider,
          confirmMerge: Boolean(confirmMerge),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data?.code === 'SIGN_IN_REQUIRED') {
          setError(t('auth.errors.emailInUse'));
          return;
        }
        setError(apiErrorMessage(t, data, 'account.saveError'));
        return;
      }

      if (data.accountExists) {
        setAccountExistsConfirm({ email: finalEmail, provider });
        return;
      }

      // Success
      saveLocalSession({
        ...session,
        uid: data.uid,
        email: data.email,
        isAnonymous: false,
        authProvider: data.authProvider,
        nickname: data.nickname || session.nickname,
      });

      trackEvent('account_link_completed', { method: 'email' });
      if (confirmMerge) {
        trackEvent('account_merge_completed');
      }
      trackEvent('account_linked', { provider, uid: data.uid });
      setAccountExistsConfirm(null);
      onLinked();
      onClose();
    } catch {
      setError(t('common.networkErrorRetry'));
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    trackEvent('link_prompt_dismissed', { score, streak });
    onClose();
  };

  return (
    <Sheet open={open} onClose={handleDismiss} title={t('account.saveTitle')}>
      {accountExistsConfirm ? (
        <div className="space-y-4">
          <p className="text-ink text-sm font-bold">{t('account.mergeQuestion')}</p>
          <p className="text-muted text-xs font-medium">{t('account.mergeNote')}</p>
          {error && <p className="text-wrong text-xs font-bold">{error}</p>}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="primary"
              fullWidth
              size="lg"
              disabled={loading}
              onClick={() =>
                void handleLink(accountExistsConfirm.provider, accountExistsConfirm.email, true)
              }
            >
              {loading ? t('auth.loggingIn') : t('account.mergeConfirm')}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              size="md"
              disabled={loading}
              onClick={() => setAccountExistsConfirm(null)}
            >
              {t('account.mergeDecline')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-muted text-sm font-medium leading-relaxed">
            {t('account.anonWarning')}
          </p>

          <GuestAccountNotice
            onSave={() => {
              setAuthModalMode('signup');
              setAuthModalOpen(true);
            }}
          />

          {error && <p className="text-wrong text-xs font-bold">{error}</p>}

          <div className="space-y-2.5 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="volt"
                size="md"
                disabled={loading}
                onClick={() => {
                  setAuthModalMode('login');
                  setAuthModalOpen(true);
                }}
                className="h-11 text-xs font-black shadow-sm"
              >
                {t('auth.loginButton')}
              </Button>
              <Button
                variant="primary"
                size="md"
                disabled={loading}
                onClick={() => {
                  setAuthModalMode('signup');
                  setAuthModalOpen(true);
                }}
                className="h-11 text-xs font-black shadow-sm"
              >
                {t('account.createAccountBtn')}
              </Button>
            </div>

            <Button
              variant="secondary"
              fullWidth
              size="md"
              disabled={loading}
              onClick={() => void handleGoogleLink()}
              className="flex h-11 items-center justify-center gap-2 text-xs font-bold"
            >
              <GoogleLogo size={20} weight="bold" aria-hidden="true" />
              <span>{t('auth.continueWithGoogle')}</span>
            </Button>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('forgot');
                  setAuthModalOpen(true);
                }}
                className="text-muted hover:text-ink cursor-pointer text-xs font-bold hover:underline"
              >
                {t('auth.forgotPasswordLink')}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-muted hover:text-ink cursor-pointer text-xs font-bold underline underline-offset-4"
              >
                {t('account.later')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onSuccess={() => {
          onLinked();
          onClose();
        }}
      />
    </Sheet>
  );
}
