import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ApiError, resetUserStreak, useStreakFreeze } from '@/lib/server-store';

const UseFreezeSchema = z.object({
  uid: z.string().min(3),
  tz: z.string().optional(),
  mode: z.enum(['freeze', 'reset']).optional(),
});

export async function POST(req: Request) {
  try {
    const body = UseFreezeSchema.parse(await req.json());
    if (body.mode === 'reset') {
      return NextResponse.json(resetUserStreak({ uid: body.uid }));
    }
    const result = useStreakFreeze({ uid: body.uid, tz: body.tz });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }
}
