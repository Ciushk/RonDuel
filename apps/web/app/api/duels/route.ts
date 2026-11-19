import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createDuel } from '@/lib/server-store';

const CreateDuelSchema = z.object({
  challengerUid: z.string().min(3),
  opponentUid: z.string().nullable().optional(),
  leagueId: z.string().optional(),
  tz: z.string().default('UTC'),
  nickname: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = CreateDuelSchema.parse(await req.json());
    const duel = createDuel(body);
    return NextResponse.json({ duelId: duel.id, status: duel.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }
}
