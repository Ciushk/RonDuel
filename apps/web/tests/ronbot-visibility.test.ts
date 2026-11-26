import { beforeEach, describe, expect, it, vi } from 'vitest';

const runRonBotChatMock = vi.fn();

vi.mock('../lib/gemini-assistant', () => ({
  runRonBotChat: (...args: unknown[]) => runRonBotChatMock(...args),
}));

import { POST as chatPost } from '../app/api/chat/route';
import { canShowRonBot, shouldHideRonBot } from '../components/DeferredRonBot';
import { authorizeRonBotChat, isRonBotPro } from '../lib/ronbot-auth';
import { getOrCreateUser, getStore } from '../lib/server-store';

describe('shouldHideRonBot & canShowRonBot client visibility gates', () => {
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

  it('allows route check on non-town, non-play, non-admin routes', () => {
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

  it('requires Pro + finished loading + allowed route in canShowRonBot', () => {
    // Pro + allowed route -> may show
    expect(
      canShowRonBot({ pathname: '/en/leagues', locale: 'en', isPro: true, loading: false }),
    ).toBe(true);
    expect(
      canShowRonBot({ pathname: '/ro/me', locale: 'ro', isPro: true, loading: false }),
    ).toBe(true);

    // Pro + town / play / admin -> still hidden
    expect(
      canShowRonBot({ pathname: '/en/town', locale: 'en', isPro: true, loading: false }),
    ).toBe(false);
    expect(
      canShowRonBot({ pathname: '/en/play', locale: 'en', isPro: true, loading: false }),
    ).toBe(false);
    expect(
      canShowRonBot({ pathname: '/en/admin/rounds', locale: 'en', isPro: true, loading: false }),
    ).toBe(false);

    // Non-Pro or still loading -> hidden
    expect(
      canShowRonBot({ pathname: '/en/leagues', locale: 'en', isPro: false, loading: false }),
    ).toBe(false);
    expect(
      canShowRonBot({ pathname: '/en/leagues', locale: 'en', isPro: true, loading: true }),
    ).toBe(false);
    expect(
      canShowRonBot({ pathname: '/en/leagues', locale: 'en', isPro: false, loading: true }),
    ).toBe(false);
  });
});

describe('RonBot server-side Pro chat gate', () => {
  beforeEach(() => {
    runRonBotChatMock.mockReset();
    runRonBotChatMock.mockResolvedValue({ reply: 'Hi Pro!', mode: 'local-fallback' });
  });

  it('checks user.pro.active === true strictly in isRonBotPro', () => {
    expect(isRonBotPro({ pro: { active: true } })).toBe(true);
    expect(isRonBotPro({ pro: { active: false } })).toBe(false);
    expect(isRonBotPro({ pro: {} })).toBe(false);
    expect(isRonBotPro({ pro: null })).toBe(false);
    expect(isRonBotPro({})).toBe(false);
    expect(isRonBotPro(null)).toBe(false);
    expect(isRonBotPro(undefined)).toBe(false);
  });

  it('allows Pro user with verified Bearer token and ignores spoofed body.uid', async () => {
    const proUser = getOrCreateUser({ uid: 'u_pro_verified', nickname: 'ProVerified' });
    proUser.pro = { active: true, plan: 'yearly' };

    const res = await authorizeRonBotChat({
      authHeader: 'Bearer valid_pro_token',
      isProduction: true,
      verifyIdToken: async (token) =>
        token === 'valid_pro_token' ? { uid: 'u_pro_verified' } : null,
      loadUser: (uid) => getStore().users[uid],
    });
    expect(res).toEqual({ ok: true, uid: 'u_pro_verified' });
  });

  it('denies free user with verified Bearer token (403 pro_required)', async () => {
    const freeUser = getOrCreateUser({ uid: 'u_free_verified', nickname: 'FreeVerified' });
    freeUser.pro = { active: false };

    const res = await authorizeRonBotChat({
      authHeader: 'Bearer valid_free_token',
      isProduction: true,
      verifyIdToken: async (token) =>
        token === 'valid_free_token' ? { uid: 'u_free_verified' } : null,
      loadUser: (uid) => getStore().users[uid],
    });
    expect(res).toEqual({ ok: false, status: 403, error: 'pro_required' });
  });

  it('denies missing user or user without pro object', async () => {
    const missingRes = await authorizeRonBotChat({
      authHeader: 'Bearer ghost_token',
      isProduction: true,
      verifyIdToken: async () => ({ uid: 'u_does_not_exist_999' }),
      loadUser: (uid) => getStore().users[uid],
    });
    expect(missingRes).toEqual({ ok: false, status: 403, error: 'pro_required' });
  });

  it('ignores x-test-uid and spoofed body.uid in production when token is missing or invalid', async () => {
    const proUser = getOrCreateUser({ uid: 'u_pro_prod_spoof', nickname: 'ProProd' });
    proUser.pro = { active: true, plan: 'monthly' };

    const missingToken = await authorizeRonBotChat({
      authHeader: null,
      testUidHeader: 'u_pro_prod_spoof',
      isProduction: true,
      verifyIdToken: async () => null,
      loadUser: (uid) => getStore().users[uid],
    });
    expect(missingToken).toEqual({ ok: false, status: 403, error: 'pro_required' });

    const invalidToken = await authorizeRonBotChat({
      authHeader: 'Bearer bad.jwt.sig',
      testUidHeader: 'u_pro_prod_spoof',
      isProduction: true,
      verifyIdToken: async () => null,
      loadUser: (uid) => getStore().users[uid],
    });
    expect(invalidToken).toEqual({ ok: false, status: 403, error: 'pro_required' });
  });

  it('POST /api/chat rejects missing token even with spoofed Pro body.uid without calling runRonBotChat', async () => {
    const proUser = getOrCreateUser({ uid: 'u_pro_route_spoof', nickname: 'ProSpoof' });
    proUser.pro = { active: true, plan: 'yearly' };

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello', uid: 'u_pro_route_spoof', locale: 'en' }),
    });

    const res = await chatPost(req);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'pro_required' });
    expect(runRonBotChatMock).not.toHaveBeenCalled();
  });

  it('POST /api/chat non-prod x-test-uid still rejects free users and allows Pro users', async () => {
    const freeUser = getOrCreateUser({ uid: 'u_free_route_test', nickname: 'FreeRoute' });
    freeUser.pro = { active: false };

    const freeReq = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-uid': 'u_free_route_test' },
      body: JSON.stringify({ message: 'hello', uid: 'u_free_route_test', locale: 'en' }),
    });
    const freeRes = await chatPost(freeReq);
    expect(freeRes.status).toBe(403);
    expect(await freeRes.json()).toEqual({ error: 'pro_required' });
    expect(runRonBotChatMock).not.toHaveBeenCalled();

    const proUser = getOrCreateUser({ uid: 'u_pro_route_test', nickname: 'ProRoute' });
    proUser.pro = { active: true, plan: 'yearly' };

    const proReq = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-uid': 'u_pro_route_test' },
      body: JSON.stringify({ message: 'hello', uid: 'u_other_spoofed', locale: 'en' }),
    });
    const proRes = await chatPost(proReq);
    expect(proRes.status).toBe(200);
    expect(await proRes.json()).toEqual({ reply: 'Hi Pro!', mode: 'local-fallback' });
    // Verified uid is passed to runRonBotChat, not the spoofed body.uid
    expect(runRonBotChatMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'hello', uid: 'u_pro_route_test' }),
    );
  });
});
