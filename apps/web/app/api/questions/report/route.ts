import { NextResponse } from 'next/server';
import { z } from 'zod';

import { reportQuestion } from '@/lib/server-store';

const ReportSchema = z.object({
  questionId: z.string().min(1),
  reason: z.enum(['răspuns greșit', 'întrebare ambiguă', 'greșeală de limbă']).or(z.string().min(1)),
  reporterUid: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = ReportSchema.parse(await req.json());
    const res = reportQuestion({
      questionId: body.questionId,
      reason: body.reason,
      reporterUid: body.reporterUid,
    });
    return NextResponse.json({
      success: true,
      questionId: res.questionId,
      reportCount: res.reportCount,
      flagged: res.flagged,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }
}
