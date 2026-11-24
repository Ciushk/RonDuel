import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getTodayStatus, joinLeague } from '@/lib/server-store';

const JoinSchema = z.object({
  uid: z.string().min(3),
  nickname: z.string().min(2).max(20),
  tz: z.string().default('UTC'),
});

export async function POST(req: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const body = JoinSchema.parse(await req.json());
    const league = joinLeague({
      inviteCode: code,
      uid: body.uid,
      nickname: body.nickname,
      tz: body.tz,
    });
    if (league.joinRequestPending) {
      return NextResponse.json({
        leagueId: league.id,
        name: league.name,
        inviteCode: league.inviteCode,
        requestPending: true,
        playedToday: false,
      });
    }
    const state = getTodayStatus(body.uid, body.tz);
    return NextResponse.json({
      leagueId: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
      requestPending: false,
      playedToday: Boolean(state.played),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }
}
