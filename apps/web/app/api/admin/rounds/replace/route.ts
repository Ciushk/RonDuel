import { NextResponse } from 'next/server';
import { z } from 'zod';

import { replaceQuestionInDailyRound } from '@/lib/server-store';

const ReplaceSchema = z.object({
  date: z.string().min(1),
  questionIndex: z.number().int().min(0).max(5),
});

export async function POST(req: Request) {
  try {
    const body = ReplaceSchema.parse(await req.json());
    const newQuestion = await replaceQuestionInDailyRound({
      date: body.date,
      questionIndex: body.questionIndex,
    });
    return NextResponse.json({ success: true, question: newQuestion });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to replace question' },
      { status: 500 },
    );
  }
}
