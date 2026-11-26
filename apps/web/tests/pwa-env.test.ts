// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetInstallPromptForTests,
  __setDeferredPromptForTests,
  type BeforeInstallPromptEvent,
} from '@/lib/install-prompt';
import {
  getInstallPlatform,
  iosVersion,
  isAndroid,
  isIOS,
  isIPad,
  isStandalone,
} from '@/lib/pwa-env';

function mockNavigator(props: {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
}) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: props.userAgent,
  });
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: props.platform ?? '',
  });
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    configurable: true,
    value: props.maxTouchPoints ?? 0,
  });
  Object.defineProperty(window.navigator, 'standalone', {
    configurable: true,
    value: props.standalone,
  });
}

function mockDisplayModes(modes: Record<string, boolean>) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: Boolean(modes[query]),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe('pwa-env helpers', () => {
  beforeEach(() => {
    __resetInstallPromptForTests();
    mockDisplayModes({});
  });

  afterEach(() => {
    __resetInstallPromptForTests();
  });

  it('detects standalone mode via display-mode standalone, fullscreen, or navigator.standalone', () => {
    mockNavigator({ userAgent: 'Mozilla/5.0' });
    expect(isStandalone()).toBe(false);

    mockDisplayModes({ '(display-mode: standalone)': true });
    expect(isStandalone()).toBe(true);

    mockDisplayModes({ '(display-mode: fullscreen)': true });
    expect(isStandalone()).toBe(true);

    mockDisplayModes({});
    mockNavigator({ userAgent: 'Mozilla/5.0', standalone: true });
    expect(isStandalone()).toBe(true);
  });

  it('detects iPhone as iOS (not iPad) and parses iOS version', () => {
    mockNavigator({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5,
    });
    expect(isIOS()).toBe(true);
    expect(isIPad()).toBe(false);
    expect(isAndroid()).toBe(false);
    expect(iosVersion()).toBe(16.4);
    expect(getInstallPlatform()).toBe('ios-howto');
  });

  it('detects iPadOS 13+ (MacIntel with maxTouchPoints > 1) as iOS and iPad', () => {
    mockNavigator({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    });
    expect(isIOS()).toBe(true);
    expect(isIPad()).toBe(true);
    expect(iosVersion()).toBe(17.4);
    expect(getInstallPlatform()).toBe('ios-howto');
  });

  it('does NOT detect desktop macOS (MacIntel with 0 touch points) as iOS', () => {
    mockNavigator({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    });
    expect(isIOS()).toBe(false);
    expect(isIPad()).toBe(false);
    expect(iosVersion()).toBeNull();
    expect(getInstallPlatform()).toBe('none');
  });

  it('parses older iOS versions accurately (< 16.4)', () => {
    mockNavigator({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5,
    });
    expect(iosVersion()).toBe(15.6);
  });

  it('detects Android and returns chromium-prompt only when beforeinstallprompt is held', () => {
    mockNavigator({
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      maxTouchPoints: 5,
    });
    expect(isAndroid()).toBe(true);
    expect(isIOS()).toBe(false);
    expect(getInstallPlatform()).toBe('none');

    const fakeEvent = {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
    } as unknown as BeforeInstallPromptEvent;
    __setDeferredPromptForTests(fakeEvent);
    expect(getInstallPlatform()).toBe('chromium-prompt');
  });

  it('returns none when already standalone or inside an iOS in-app browser', () => {
    mockNavigator({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E219 Instagram 321.0.0',
      platform: 'iPhone',
      maxTouchPoints: 5,
    });
    expect(isIOS()).toBe(true);
    expect(getInstallPlatform()).toBe('none');

    mockNavigator({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: true,
    });
    expect(getInstallPlatform()).toBe('none');
  });
});
