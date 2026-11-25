'use client';

import type { PostHog } from 'posthog-js';

import { getLocalSession } from '@/lib/session';

/**
 * Product analytics (PostHog Cloud EU).
 *
 * - Nothing is loaded or sent until the player accepts analytics (consent banner / Settings).
 * - Players are identified only by their RonDuel `uid`, never by email.
 * - Event names follow docs/kpis.md. Older call sites keep their names in code and are
 *   mapped to the KPI catalogue in `toKpiEventName` below.
 */

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
  | 'round_started'
  | 'round_finished'
  | 'account_link_prompt_shown'
  | 'account_link_completed'
  | 'account_merge_completed'
  | 'pro_upsell_viewed'
  | 'paywall_viewed'
  | 'checkout_started'
  | 'subscription_started'
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

const POSTHOG_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_sXBQwwVW8CX8AmyauB5e9PEeoWLuXZ3kqATZqEGk4cuy';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

/** Maps the event names used in the code to the catalogue in docs/kpis.md. */
function toKpiEventName(name: AnalyticsEvent, properties?: Record<string, unknown>): string {
  switch (name) {
    case 'splash_shown':
      return 'landing_viewed';
    case 'daily_round_started':
      return 'round_started';
    case 'daily_round_finished':
      return 'round_finished';
    case 'pro_upsell_viewed':
      return 'paywall_viewed';
    case 'pro_checkout_started':
      return 'checkout_started';
    case 'pro_activated':
      return 'subscription_started';
    case 'league_invite_shared':
    case 'invite_shared':
      return 'share_completed';
    case 'account_linked':
      return 'account_upgraded';
    case 'league_preview_viewed':
      return properties?.source === 'invite_link' ? 'invite_link_opened' : name;
    default:
      return name;
  }
}

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;
const pending: Array<{ name: string; properties?: Record<string, unknown> }> = [];

function hasConsent(): boolean {
  try {
    return getLocalSession().analyticsConsent === 'accepted';
  } catch {
    return false;
  }
}

function baseProperties(): Record<string, unknown> {
  const standalone =
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);
  return {
    locale: document.documentElement.lang || undefined,
    is_pwa: standalone,
    platform: 'web',
  };
}

function loadClient(): Promise<PostHog | null> {
  if (client) return Promise.resolve(client);
  if (loading) return loading;
  loading = import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: 'identified_only',
        capture_pageview: 'history_change',
        autocapture: false,
        persistence: 'localStorage+cookie',
        disable_session_recording: true,
        loaded: (ph) => {
          try {
            const { uid } = getLocalSession();
            if (uid && uid !== 'u_ssr') ph.identify(uid);
          } catch {
            // Ignore identify errors
          }
        },
      });
      client = posthog;
      for (const event of pending.splice(0)) {
        posthog.capture(event.name, { ...baseProperties(), ...event.properties });
      }
      return posthog;
    })
    .catch(() => {
      loading = null;
      return null;
    });
  return loading;
}

/**
 * Starts or stops PostHog according to the saved consent. Call after the consent changes and
 * once when the app shell loads.
 */
export function syncAnalyticsConsent(): void {
  if (typeof window === 'undefined') return;
  if (hasConsent()) {
    if (client) {
      client.opt_in_capturing();
    } else {
      void loadClient();
    }
  } else if (client) {
    client.opt_out_capturing();
    pending.length = 0;
  }
}

export function trackEvent(name: AnalyticsEvent, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  try {
    const kpiName = toKpiEventName(name, properties);
    if (hasConsent()) {
      if (client) {
        client.capture(kpiName, { ...baseProperties(), ...properties });
      } else {
        pending.push({ name: kpiName, properties });
        void loadClient();
      }
    }
    window.dispatchEvent(
      new CustomEvent('ronduel:analytics', {
        detail: { name: kpiName, properties },
      }),
    );
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug(`[PostHog Analytics] ${kpiName}`, properties);
    }
  } catch {
    // Ignore analytics errors
  }
}

const flagCallbacks = new Set<() => void>();

export function isPostHogFeatureEnabled(flag: string): boolean | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    if (client) {
      const enabled = client.isFeatureEnabled(flag);
      return typeof enabled === 'boolean' ? enabled : undefined;
    }
  } catch {
    // Ignore
  }
  return undefined;
}

export function onPostHogFeatureFlags(callback: () => void): () => void {
  flagCallbacks.add(callback);
  if (client) {
    try {
      client.onFeatureFlags(callback);
    } catch {
      // Ignore
    }
  }
  return () => {
    flagCallbacks.delete(callback);
  };
}
