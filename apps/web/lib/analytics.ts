'use client';

export type AnalyticsEvent =
  | 'splash_shown'
  | 'splash_cta_clicked'
  | 'league_preview_viewed'
  | 'join_clicked'
  | 'league_joined'
  | 'league_created'
  | 'league_invite_shared'
  | 'daily_round_started'
  | 'daily_round_finished'
  | 'account_link_prompt_shown'
  | 'account_link_completed'
  | 'account_merge_completed'
  | 'pro_upsell_viewed'
  | 'duel_created'
  | 'league_full_prompt_shown'
  | 'upgrade_from_league_full'
  | 'public_round_to_league_created'
  | 'link_prompt_shown'
  | 'link_prompt_dismissed'
  | 'account_linked'
  | 'signin_for_league_completed'
  | 'league_name_step_viewed'
  | 'pro_trial_started'
  | 'pro_checkout_started'
  | 'pro_activated'
  | 'nav_tab_clicked'
  | 'language_changed'
  | 'theme_toggled'
  | 'settings_opened'
  | 'login_completed'
  | 'signup_completed'
  | 'logout_completed'
  | 'password_reset_requested'
  | 'invite_shared';

export function trackEvent(name: AnalyticsEvent, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  try {
    const w = window as unknown as {
      posthog?: { capture: (event: string, props?: Record<string, unknown>) => void };
    };
    if (w.posthog && typeof w.posthog.capture === 'function') {
      w.posthog.capture(name, properties);
    }
    window.dispatchEvent(
      new CustomEvent('ronduel:analytics', {
        detail: { name, properties },
      }),
    );
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug(`[PostHog Analytics] ${name}`, properties);
    }
  } catch {
    // Ignore analytics errors
  }
}
