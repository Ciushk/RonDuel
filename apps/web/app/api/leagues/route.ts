import { LOCALES, type Locale } from '@ronduel/shared';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createLeague } from '@/lib/server-store';

const CreateLeagueSchema = z.object({
  uid: z.string().min(3),
  name: z.string().max(40).optional(),
  tz: z.string().default('UTC'),
  locale: z.enum(LOCALES).default('en'),
});

export async function POST(req: Request) {
  try {
    const body = CreateLeagueSchema.parse(await req.json());
    const league = createLeague({
      uid: body.uid,
      name: body.name,
      tz: body.tz,
      locale: body.locale as Locale,
    });
    return NextResponse.json({
      leagueId: league.id,
      name: league.name,
      inviteCode: league.inviteCode,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }
}
