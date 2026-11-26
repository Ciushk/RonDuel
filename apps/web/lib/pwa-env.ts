'use client';

import { canPromptInstall } from '@/lib/install-prompt';

export type InstallPlatform = 'chromium-prompt' | 'ios-howto' | 'none';

const IN_APP_BROWSER_RE =
  /\b(FBAN|FBAV|FB_IAB|Instagram|TikTok|BytedanceWebview|musical_ly|Line\/|Snapchat|MicroMessenger|LinkedInApp|WhatsApp)\b/i;

export function isStandalone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const navStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (navStandalone) return true;
  if (typeof window.matchMedia !== 'function') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

export function isIPad(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad/i.test(ua)) return true;
  // iPadOS 13+ desktop-class Safari reports MacIntel with touch points > 1
  return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const hasMsStream =
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { MSStream?: unknown }).MSStream);
  if (hasMsStream) return false;
  return /iPad|iPhone|iPod/.test(ua) || isIPad();
}

export function iosVersion(): number | null {
  if (typeof navigator === 'undefined' || !isIOS()) return null;
  const ua = navigator.userAgent || '';
  const osMatch = ua.match(/\bOS (\d+)(?:_(\d+))?/);
  if (osMatch) {
    const major = Number(osMatch[1]);
    const minor = osMatch[2] ? Number(osMatch[2]) : 0;
    if (Number.isFinite(major) && Number.isFinite(minor)) {
      return Number(`${major}.${minor}`);
    }
  }
  // iPadOS 13+ in desktop mode omits "OS XX_Y" and exposes Safari "Version/XX.Y"
  if (isIPad()) {
    const verMatch = ua.match(/Version\/(\d+)(?:\.(\d+))?/);
    if (verMatch) {
      const major = Number(verMatch[1]);
      const minor = verMatch[2] ? Number(verMatch[2]) : 0;
      if (Number.isFinite(major) && Number.isFinite(minor)) {
        return Number(`${major}.${minor}`);
      }
    }
  }
  return null;
}

export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
}

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return IN_APP_BROWSER_RE.test(navigator.userAgent || '');
}

export function getInstallPlatform(): InstallPlatform {
  if (isStandalone()) return 'none';
  if (canPromptInstall()) return 'chromium-prompt';
  if (isIOS() && !isInAppBrowser()) return 'ios-howto';
  return 'none';
}
