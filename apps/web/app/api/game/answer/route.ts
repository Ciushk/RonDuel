import { NextResponse } from 'next/server';
import { z } from 'zod';

import { apiErrorResponse } from '@/lib/api-route';
import { submitAnswer } from '@/lib/server-store';

const AnswerSchema = z.object({
  uid: z.string().min(3),
  playId: z.string().min(3),
  index: z.number().int().min(0).max(5),
  choice: z.union([z.number().int().min(0).max(3), z.array(z.string()), z.null()]),
});

export async function POST(req: Request) {
  try {
    const body = AnswerSchema.parse(await req.json());
    const result = submitAnswer(body);
    return NextResponse.json(result);
  } catch (err) {
    return apiErrorResponse(err);
  }
}
