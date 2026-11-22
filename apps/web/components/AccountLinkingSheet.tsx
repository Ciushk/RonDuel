'use client';

import { EnvelopeSimple, GoogleLogo } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { AuthModal, type AuthMode } from '@/components/AuthModal';
import { Button, Sheet } from '@/components/ui';
import { apiErrorMessage } from '@/lib/api-error';
import { trackEvent } from '@/lib/analytics';
import { loginWithGoogle } from '@/lib/firebase';
import { getLocalSession, saveLocalSession } from '@/lib/session';

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
      const user = await loginWithGoogle();
      if (!user.email) {
        setError(t('auth.errors.googleNoEmail'));
        setLoading(false);
        return;
      }
      const session = getLocalSession();
      const userNick = user.displayName || session.nickname;

      const res = await fetch('/api/me/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: session.uid,
          email: user.email,
          nickname: userNick,
          provider: 'google',
          confirmMerge: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(apiErrorMessage(t, data, 'account.saveError'));
        return;
      }

      const finalUid = data.uid || data.existingUid || session.uid;
      saveLocalSession({
        ...session,
        uid: finalUid,
        email: data.email || user.email,
        isAnonymous: false,
        authProvider: 'google',
        nickname: data.nickname || userNick,
      });

      trackEvent('account_link_completed', { method: 'google' });
      trackEvent('account_linked', { provider: 'google', uid: finalUid });
      setAccountExistsConfirm(null);
      onLinked();
      onClose();
    } catch (err: unknown) {
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
    <Sheet
      open={open}
      onClose={handleDismiss}
      title={t('account.saveTitle')}
    >
      {accountExistsConfirm ? (
        <div className="space-y-4">
          <p className="text-sm font-bold text-ink">
            {t('account.mergeQuestion')}
          </p>
          <p className="text-muted text-xs font-medium">
            {t('account.mergeNote')}
          </p>
          {error && <p className="text-wrong text-xs font-bold">{error}</p>}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="primary"
              fullWidth
              size="lg"
              disabled={loading}
              onClick={() =>
                void handleLink(
                  accountExistsConfirm.provider,
                  accountExistsConfirm.email,
                  true,
                )
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

          <div className="rounded-xl border-2 border-ron-strong bg-ron/10 p-3 flex items-start gap-2.5">
            <span className="text-base shrink-0 mt-0.5" aria-hidden="true">⚠️</span>
            <p className="text-xs font-bold text-ink leading-snug">
              {t('account.anonExpiry')}
            </p>
          </div>

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
                className="font-black text-xs h-11 shadow-sm"
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
                className="font-black text-xs h-11 shadow-sm"
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
              className="font-bold text-xs h-11 flex items-center justify-center gap-2"
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
                className="text-xs font-bold text-muted hover:text-ink cursor-pointer hover:underline"
              >
                {t('auth.forgotPasswordLink')}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-muted hover:text-ink text-xs font-bold underline underline-offset-4 cursor-pointer"
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
