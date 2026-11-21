import { NextResponse } from 'next/server';
import { z } from 'zod';

import { runRonBotChat } from '@/lib/gemini-assistant';

const ChatSchema = z.object({
  message: z.string().min(1).max(1000),
  locale: z.string().optional(),
  isAdmin: z.boolean().optional(),
  previousInteractionId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = ChatSchema.parse(await req.json());
    const apiKeyOverride = req.headers.get('x-gemini-api-key') ?? undefined;
    const result = await runRonBotChat({
      ...body,
      apiKeyOverride,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chat error' },
      { status: 400 },
    );
  }
}
