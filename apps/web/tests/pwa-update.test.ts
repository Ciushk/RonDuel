import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  clearAppCachesAndUnregisterSw,
  isNewerBuildId,
  isPlayFocusPath,
  shouldSuppressForReloadGuard,
  SW_SCRIPT_URL,
} from '../lib/pwa-update';

describe('pwa-update helpers', () => {
  it('registers sw.js with one-time ?v=2 query string', () => {
    expect(SW_SCRIPT_URL).toBe('/sw.js?v=2');
  });

  it('detects /play focus routes across locales', () => {
    expect(isPlayFocusPath('/en/play')).toBe(true);
    expect(isPlayFocusPath('/ro/play')).toBe(true);
    expect(isPlayFocusPath('/en/town')).toBe(false);
    expect(isPlayFocusPath('/en/leagues')).toBe(false);
    expect(isPlayFocusPath('/en/result/123')).toBe(false);
    expect(isPlayFocusPath(null)).toBe(false);
  });

  it('compares build ids safely without false positives', () => {
    expect(isNewerBuildId('sha-new', 'sha-old')).toBe(true);
    expect(isNewerBuildId('sha-same', 'sha-same')).toBe(false);
    expect(isNewerBuildId('', 'sha-old')).toBe(false);
    expect(isNewerBuildId('sha-new', '')).toBe(false);
    expect(isNewerBuildId(null, 'sha-old')).toBe(false);
  });

  it('suppresses repeated reloads for the same target build id', () => {
    expect(shouldSuppressForReloadGuard('sha-new', 'sha-new')).toBe(true);
    expect(shouldSuppressForReloadGuard('sha-newer', 'sha-new')).toBe(false);
    expect(shouldSuppressForReloadGuard('sha-new', null)).toBe(false);
  });

  it('unregisters service workers and clears Cache API without touching storage', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const deleteCache = vi.fn().mockResolvedValue(true);
    const origNav = globalThis.navigator;
    const origCaches = globalThis.caches;

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        serviceWorker: {
          getRegistrations: vi.fn().mockResolvedValue([{ unregister }]),
        },
      },
    });
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: {
        keys: vi.fn().mockResolvedValue(['ronduel-shell-old', 'ronduel-shell-v1']),
        delete: deleteCache,
      },
    });

    try {
      await clearAppCachesAndUnregisterSw();
      expect(unregister).toHaveBeenCalledTimes(1);
      expect(deleteCache).toHaveBeenCalledTimes(2);
      expect(deleteCache).toHaveBeenCalledWith('ronduel-shell-old');
      expect(deleteCache).toHaveBeenCalledWith('ronduel-shell-v1');
    } finally {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: origNav });
      Object.defineProperty(globalThis, 'caches', { configurable: true, value: origCaches });
    }
  });
});

describe('sw.js & firebase.json PWA caching contract', () => {
  const repoRoot = path.resolve(__dirname, '../../..');

  it('versions CACHE_NAME and activates immediately via skipWaiting + clients.claim while keeping SKIP_WAITING handler', () => {
    const sw = fs.readFileSync(path.join(repoRoot, 'apps/web/public/sw.js'), 'utf8');
    expect(sw).toContain("const BUILD_ID = '__RONDUEL_BUILD_ID__'");
    expect(sw).toContain('ronduel-shell-${BUILD_ID}');
    expect(sw).toContain("addEventListener('message'");
    expect(sw).toContain('SKIP_WAITING');

    const installMatch = sw.match(/addEventListener\('install'[\s\S]*?\}\);/);
    expect(installMatch).toBeTruthy();
    expect(installMatch?.[0]).toContain('skipWaiting');

    const activateMatch = sw.match(/addEventListener\('activate'[\s\S]*?\}\);/);
    expect(activateMatch).toBeTruthy();
    expect(activateMatch?.[0]).toContain('clients.claim');
  });

  it('defines expected Cache-Control headers in firebase.json', () => {
    const fb = JSON.parse(fs.readFileSync(path.join(repoRoot, 'firebase.json'), 'utf8'));
    const headers: Array<{
      source?: string;
      regex?: string;
      headers: Array<{ key: string; value: string }>;
    }> = fb.hosting.headers;
    const bySource = new Map(
      headers
        .filter((entry) => entry.source)
        .map((entry) => [
          entry.source!,
          entry.headers.find((h) => h.key.toLowerCase() === 'cache-control')?.value,
        ]),
    );

    expect(bySource.get('/api/**')).toContain('no-store');
    expect(bySource.get('/sw.js')).toBe('no-cache, no-store, must-revalidate, max-age=0');
    expect(bySource.get('/version.json')).toBe('no-cache, no-store, must-revalidate, max-age=0');
    expect(bySource.get('**/*.html')).toBe('no-cache, max-age=0, must-revalidate');
    expect(bySource.get('/_next/static/**')).toBe('public, max-age=31536000, immutable');
    expect(bySource.get('/rontown/**')).toBe('public, max-age=300, must-revalidate');
    expect(bySource.get('/manifest.webmanifest')).toBe('public, max-age=300, must-revalidate');
    expect(bySource.get('/manifest-*.webmanifest')).toBe('public, max-age=300, must-revalidate');
    expect(bySource.get('/manifest.json')).toBe('public, max-age=300, must-revalidate');

    const cleanHtmlRule = headers.find((entry) => entry.regex);
    expect(cleanHtmlRule).toBeTruthy();
    expect(cleanHtmlRule?.headers.find((h) => h.key.toLowerCase() === 'cache-control')?.value).toBe(
      'no-cache, max-age=0, must-revalidate',
    );
    const cleanRe = new RegExp(cleanHtmlRule!.regex!);
    expect(cleanRe.test('/')).toBe(true);
    expect(cleanRe.test('/en')).toBe(true);
    expect(cleanRe.test('/en/town')).toBe(true);
    expect(cleanRe.test('/ro/leagues')).toBe(true);
    expect(cleanRe.test('/offline')).toBe(true);
    expect(cleanRe.test('/rontown/basic-block.png')).toBe(false);
    expect(cleanRe.test('/_next/static/chunks/app.js')).toBe(false);
  });
});
