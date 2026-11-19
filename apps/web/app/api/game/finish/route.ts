import { NextResponse } from 'next/server';
import { z } from 'zod';

import { finishRound } from '@/lib/server-store';

const FinishSchema = z.object({
  uid: z.string().min(3),
  playId: z.string().min(3),
});

export async function POST(req: Request) {
  try {
    const body = FinishSchema.parse(await req.json());
    const result = finishRound(body.uid, body.playId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }
}
