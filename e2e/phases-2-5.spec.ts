import { expect, test } from '@playwright/test';

import enMessages from '../apps/web/messages/en.json' with { type: 'json' };
import esMessages from '../apps/web/messages/es.json' with { type: 'json' };
import ptMessages from '../apps/web/messages/pt.json' with { type: 'json' };
import roMessages from '../apps/web/messages/ro.json' with { type: 'json' };

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null
      ? flattenKeys(v as Record<string, unknown>, key)
      : [key];
  });
}

test.describe('Phases 2–5: Duels, Account Upgrade, Pro Billing, Notifications, Admin & i18n parity', () => {
  test('all 4 locale files (en, es, pt, ro) have identical translation keys', () => {
    const enKeys = flattenKeys(enMessages).sort();
    expect(flattenKeys(esMessages).sort()).toEqual(enKeys);
    expect(flattenKeys(ptMessages).sort()).toEqual(enKeys);
    expect(flattenKeys(roMessages).sort()).toEqual(enKeys);
  });

  test('Phase 2: 1v1 duel completes end-to-end for 2 players and records winner', async ({
    request,
  }, testInfo) => {
    const suffix = `${testInfo.project.name}_${Date.now()}`;
    const challengerUid = `u_chal_${suffix}`;
    const opponentUid = `u_opp_${suffix}`;

    const createRes = await request.post('/api/duels', {
      data: {
        challengerUid,
        nickname: 'Ana',
        tz: 'Europe/Bucharest',
      },
    });
    expect(createRes.status()).toBe(200);
    const { duelId } = await createRes.json();

    // Challenger plays all 5 items
    await request.post(`/api/duels/${duelId}/start`, {
      data: { uid: challengerUid, nickname: 'Ana', locale: 'en' },
    });
    for (let i = 0; i < 5; i += 1) {
      const ans = await request.post(`/api/duels/${duelId}/answer`, {
        data: { uid: challengerUid, index: i, choice: 0, locale: 'en' },
      });
      expect(ans.status()).toBe(200);
    }

    // Opponent joins & plays all 5 items
    await request.post(`/api/duels/${duelId}/start`, {
      data: { uid: opponentUid, nickname: 'Mihai', locale: 'en' },
    });
    for (let i = 0; i < 5; i += 1) {
      const ans = await request.post(`/api/duels/${duelId}/answer`, {
        data: { uid: opponentUid, index: i, choice: null, locale: 'en' },
      });
      expect(ans.status()).toBe(200);
    }

    // Verify duel is complete and a winner is recorded
    const viewRes = await request.get(`/api/duels/${duelId}`);
    const duelView = await viewRes.json();
    expect(duelView.status).toBe('complete');
    expect([challengerUid, opponentUid]).toContain(duelView.winnerUid);
    expect(duelView.breakdown).toHaveLength(5);
  });

  test('Phase 2 & 3: Account upgrade preserves uid, and Stripe webhook activates Pro idempotently', async ({
    request,
  }, testInfo) => {
    const suffix = `${testInfo.project.name}_${Date.now()}`;
    const uid = `u_pro_${suffix}`;
    const eventId = `evt_stripe_${suffix}`;

    // Cannot checkout while anonymous
    const anonCheckout = await request.post('/api/billing/checkout', {
      data: { uid, plan: 'yearly', euWithdrawalConsent: true },
    });
    expect(anonCheckout.status()).toBe(403);

    // Upgrade anonymous account
    const upgRes = await request.post('/api/me/upgrade', {
      data: { uid, email: `ana_${suffix}@ronduel.eu`, provider: 'email_link' },
    });
    expect(upgRes.status()).toBe(200);
    const upg = await upgRes.json();
    expect(upg.uid).toBe(uid);
    expect(upg.isAnonymous).toBe(false);

    // Webhook activates Pro and replay is idempotent
    const wh1 = await request.post('/api/billing/webhook', {
      data: {
        id: eventId,
        type: 'checkout.session.completed',
        uid,
        plan: 'yearly',
      },
    });
    expect(wh1.status()).toBe(200);
    const wh1Data = await wh1.json();
    expect(wh1Data.duplicate).toBe(false);
    expect(wh1Data.pro.active).toBe(true);

    // Replayed event has no side effects
    const wh2 = await request.post('/api/billing/webhook', {
      data: {
        id: eventId,
        type: 'checkout.session.completed',
        uid,
        plan: 'yearly',
      },
    });
    const wh2Data = await wh2.json();
    expect(wh2Data.duplicate).toBe(true);
  });

  test('Phase 4: One-click email unsubscribe disables email notifications', async ({
    request,
  }, testInfo) => {
    const uid = `u_unsub_${testInfo.project.name}_${Date.now()}`;
    const res = await request.get(`/api/notify/unsubscribe?uid=${uid}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.emailEnabled).toBe(false);
  });

  test('Phase 5: Non-admins get 403 on /api/admin, and AI drafts cannot be scheduled before approval', async ({
    request,
  }, testInfo) => {
    // Non-admin gets 403
    const forbidden = await request.get('/api/admin');
    expect(forbidden.status()).toBe(403);

    // Authorized admin generates AI drafts
    const genRes = await request.post('/api/admin', {
      headers: { 'x-admin-token': 'local-admin' },
      data: {
        action: 'generate_drafts',
        topic: `Physics_${testInfo.project.name}`,
        type: 'mcq',
        difficulty: 2,
        count: 1,
      },
    });
    expect(genRes.status()).toBe(200);
    const { drafts } = await genRes.json();
    const draftId = drafts[0].id as string;
    expect(drafts[0].source).toBe('ai_draft');
    expect(drafts[0].reviewStatus).toBe('draft');

    const targetDate = testInfo.project.name.includes('mobile') ? '2026-12-21' : '2026-12-22';

    // Attempt to schedule unapproved AI draft -> blocked server-side (400)
    const schedFail = await request.post('/api/admin', {
      headers: { 'x-admin-token': 'local-admin' },
      data: {
        action: 'schedule_round',
        date: targetDate,
        questionIds: [draftId, 'q-mcq-01', 'q-mcq-02', 'q-order-01', 'q-odd-01', 'q-logic-01'],
        topicOfTheDay: 'Physics ⚡',
      },
    });
    expect(schedFail.status()).toBe(400);

    // Approve the AI draft, then schedule -> succeeds
    const appRes = await request.post('/api/admin', {
      headers: { 'x-admin-token': 'local-admin' },
      data: { action: 'approve_question', questionId: draftId },
    });
    expect(appRes.status()).toBe(200);

    const schedOk = await request.post('/api/admin', {
      headers: { 'x-admin-token': 'local-admin' },
      data: {
        action: 'schedule_round',
        date: targetDate,
        questionIds: [draftId, 'q-mcq-01', 'q-mcq-02', 'q-order-01', 'q-odd-01', 'q-logic-01'],
        topicOfTheDay: 'Physics ⚡',
      },
    });
    expect(schedOk.status()).toBe(200);
  });
});
