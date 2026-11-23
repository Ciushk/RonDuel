import { LOCALES, type Locale } from '@ronduel/shared';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiErrorResponse } from '@/lib/api-route';
import { startRound } from '@/lib/server-store';

const StartSchema = z.object({
  uid: z.string().min(3),
  tz: z.string().min(1).default('UTC'),
  locale: z.string().min(2).default('ro'),
  nickname: z.string().optional(),
  relaxedTimer: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const body = StartSchema.parse(await req.json());
    const normalizedLocale = (body.locale.split(/[-_]/)[0]?.toLowerCase() || 'ro') as Locale;
    const activeLocale = LOCALES.includes(normalizedLocale) ? normalizedLocale : 'ro';
    const result = startRound({
      uid: body.uid,
      tz: body.tz,
      locale: activeLocale,
      nickname: body.nickname,
      relaxedTimer: body.relaxedTimer,
    });
    if ('alreadyFinished' in result && result.alreadyFinished) {
      return NextResponse.json(result, { status: 409 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
