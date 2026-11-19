import { LOCALES, type Locale } from '@ronduel/shared';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { startDuelSide } from '@/lib/server-store';

const StartDuelSchema = z.object({
  uid: z.string().min(3),
  nickname: z.string().optional(),
  locale: z.enum(LOCALES).default('en'),
});

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = StartDuelSchema.parse(await req.json());
    const result = startDuelSide({
      duelId: id,
      uid: body.uid,
      nickname: body.nickname,
      locale: body.locale as Locale,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }
}
