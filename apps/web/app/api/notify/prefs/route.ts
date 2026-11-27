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
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ') || auth.slice(7).trim().length === 0) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  try {
    const body = PrefsSchema.parse(await req.json());
    return NextResponse.json(updateNotificationPrefs(body));
  } catch (err) {
    const code = (err as { code?: string })?.code || 'BAD_REQUEST';
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request', code },
      { status: 400 },
    );
  }
}
