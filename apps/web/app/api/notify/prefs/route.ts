import { NextResponse } from 'next/server';
import { z } from 'zod';

import { updateNotificationPrefs } from '@/lib/server-store';

const PrefsSchema = z.object({
  uid: z.string().min(3),
  pushEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  reminderLocalTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default('18:00'),
});

export async function POST(req: Request) {
  try {
    const body = PrefsSchema.parse(await req.json());
    return NextResponse.json(updateNotificationPrefs(body));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }
}
