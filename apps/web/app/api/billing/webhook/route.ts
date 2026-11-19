import { NextResponse } from 'next/server';
import { z } from 'zod';

import { processStripeWebhook } from '@/lib/server-store';

const WebhookSchema = z.object({
  id: z.string().min(3),
  type: z.enum([
    'checkout.session.completed',
    'customer.subscription.updated',
    'customer.subscription.deleted',
  ]),
  uid: z.string().min(3),
  plan: z.enum(['monthly', 'yearly']).optional(),
  currentPeriodEnd: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = WebhookSchema.parse(await req.json());
    const result = processStripeWebhook({
      eventId: body.id,
      type: body.type,
      uid: body.uid,
      plan: body.plan,
      currentPeriodEnd: body.currentPeriodEnd,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid webhook payload' },
      { status: 400 },
    );
  }
}
