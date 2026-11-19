import { LOCALES, type Locale } from '@ronduel/shared';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { startRound } from '@/lib/server-store';

const StartSchema = z.object({
  uid: z.string().min(3),
  tz: z.string().min(1).default('UTC'),
  locale: z.enum(LOCALES).default('en'),
  nickname: z.string().optional(),
  relaxedTimer: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const body = StartSchema.parse(await req.json());
    const result = startRound({
      uid: body.uid,
      tz: body.tz,
      locale: body.locale as Locale,
      nickname: body.nickname,
      relaxedTimer: body.relaxedTimer,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }
}
