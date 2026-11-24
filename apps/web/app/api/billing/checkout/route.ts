import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getOrCreateUser, processStripeWebhook } from '@/lib/server-store';

const CheckoutSchema = z.object({
  uid: z.string().min(3),
  plan: z.enum(['monthly', 'yearly', 'freeze_1', 'freeze_3']),
  trial: z.boolean().optional(),
  euWithdrawalConsent: z.literal(true, {
    errorMap: () => ({
      message: 'EU immediate digital content access consent is required before checkout.',
    }),
  }),
});

export async function POST(req: Request) {
  try {
    const body = CheckoutSchema.parse(await req.json());
    const user = getOrCreateUser({ uid: body.uid });
    if (user.isAnonymous) {
      return NextResponse.json(
        {
          error:
            'Please upgrade your anonymous account before purchasing RonDuel Pro or Streak Freezes.',
        },
        { status: 403 },
      );
    }

    if (body.trial) {
      const trialDays = 7;
      const trialEndsAt = new Date(Date.now() + trialDays * 86_400_000).toISOString();
      user.pro = {
        active: true,
        plan: body.plan === 'yearly' ? 'yearly' : 'monthly',
        until: trialEndsAt,
        isTrial: true,
        trialEndsAt,
      };
      user.freezes = Math.min(5, (user.freezes ?? 0) + 1);
      return NextResponse.json({
        mode: 'trial_activated',
        pro: user.pro,
        freezes: user.freezes,
      });
    }

    // In local/test mode without a live STRIPE_SECRET_KEY, simulate the Stripe webhook callback
    if (!process.env.STRIPE_SECRET_KEY) {
      const eventId = `evt_local_${Date.now()}_${body.uid}`;
      const res = processStripeWebhook({
        eventId,
        type: 'checkout.session.completed',
        uid: body.uid,
        plan: body.plan,
      });
      return NextResponse.json({
        mode: 'local_test_webhook',
        eventId,
        pro: res.pro,
        freezes: res.freezes,
      });
    }

    return NextResponse.json({
      mode: 'stripe_redirect',
      checkoutUrl: `/en/pro?checkout=pending&plan=${body.plan}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }
}
