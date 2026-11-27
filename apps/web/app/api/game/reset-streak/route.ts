import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ApiError, resetUserStreak } from '@/lib/server-store';

const ResetStreakSchema = z.object({
  uid: z.string().min(3),
});

export async function POST(req: Request) {
  try {
    const body = ResetStreakSchema.parse(await req.json());
    return NextResponse.json(resetUserStreak({ uid: body.uid }));
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
