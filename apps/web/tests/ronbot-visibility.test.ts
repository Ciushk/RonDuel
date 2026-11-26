import { describe, expect, it } from 'vitest';

import { shouldHideRonBot } from '../components/DeferredRonBot';

describe('shouldHideRonBot route gate', () => {
  it('hides RonBot on /[locale]/town and sub-routes across all locales', () => {
    expect(shouldHideRonBot('/en/town', 'en')).toBe(true);
    expect(shouldHideRonBot('/ro/town', 'ro')).toBe(true);
    expect(shouldHideRonBot('/uk/town', 'uk')).toBe(true);
    expect(shouldHideRonBot('/de/town/', 'de')).toBe(true);
    expect(shouldHideRonBot('/en/town/visit', 'en')).toBe(true);
    expect(shouldHideRonBot('/fr/town/friends/123', 'fr')).toBe(true);
  });

  it('respects path-segment boundaries (does not match /townhall)', () => {
    expect(shouldHideRonBot('/en/townhall', 'en')).toBe(false);
    expect(shouldHideRonBot('/ro/town-news', 'ro')).toBe(false);
  });

  it('keeps existing play and admin hides intact', () => {
    expect(shouldHideRonBot('/en/play', 'en')).toBe(true);
    expect(shouldHideRonBot('/ro/play', 'ro')).toBe(true);
    expect(shouldHideRonBot('/admin')).toBe(true);
    expect(shouldHideRonBot('/en/admin/rounds', 'en')).toBe(true);
    expect(shouldHideRonBot('/en/league/abc/admin', 'en')).toBe(true);
  });

  it('allows RonBot on non-town, non-play, non-admin routes', () => {
    expect(shouldHideRonBot('/en', 'en')).toBe(false);
    expect(shouldHideRonBot('/en/leagues', 'en')).toBe(false);
    expect(shouldHideRonBot('/ro/me', 'ro')).toBe(false);
    expect(shouldHideRonBot('/en/duels', 'en')).toBe(false);
    expect(shouldHideRonBot('/en/result/2026-11-25_u_1', 'en')).toBe(false);
  });

  it('hides when pathname is missing', () => {
    expect(shouldHideRonBot(null, 'en')).toBe(true);
    expect(shouldHideRonBot(undefined, 'en')).toBe(true);
    expect(shouldHideRonBot('', 'en')).toBe(true);
  });
});
