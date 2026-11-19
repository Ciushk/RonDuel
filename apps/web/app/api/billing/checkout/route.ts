import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getOrCreateUser, processStripeWebhook } from '@/lib/server-store';

const CheckoutSchema = z.object({
  uid: z.string().min(3),
  plan: z.enum(['monthly', 'yearly']),
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
        { error: 'Please upgrade your anonymous account before purchasing RonDuel Pro.' },
        { status: 403 },
      );
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
