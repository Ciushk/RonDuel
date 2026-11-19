import { LOCALES, type Locale } from '@ronduel/shared';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { submitDuelAnswer } from '@/lib/server-store';

const DuelAnswerSchema = z.object({
  uid: z.string().min(3),
  index: z.number().int().min(0).max(4),
  choice: z.union([z.number().int().min(0).max(3), z.array(z.string()), z.null()]),
  locale: z.enum(LOCALES).optional(),
});

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = DuelAnswerSchema.parse(await req.json());
    const result = submitDuelAnswer({
      duelId: id,
      uid: body.uid,
      index: body.index,
      choice: body.choice,
      locale: body.locale as Locale | undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }
}
