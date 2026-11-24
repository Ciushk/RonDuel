import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getUserDuels, createDuel } from '@/lib/server-store';

const CreateDuelSchema = z.object({
  challengerUid: z.string().min(3),
  opponentUid: z.string().nullable().optional(),
  leagueId: z.string().optional(),
  tz: z.string().default('UTC'),
  nickname: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    if (!uid) {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    }
    const data = getUserDuels(uid);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

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
