import { NextResponse } from 'next/server';
import { z } from 'zod';

import { verifyFirebaseIdToken } from '../../../lib/admin-auth';
import { runRonBotChat } from '../../../lib/gemini-assistant';
import { authorizeRonBotChat } from '../../../lib/ronbot-auth';
import { getStore } from '../../../lib/server-store';

const ChatSchema = z.object({
  message: z.string().min(1).max(1000),
  locale: z.string().optional(),
  uid: z.string().optional(),
  tz: z.string().optional(),
  nickname: z.string().optional(),
  isAdmin: z.boolean().optional(),
  previousInteractionId: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await authorizeRonBotChat({
    authHeader: req.headers.get('authorization'),
    testUidHeader: req.headers.get('x-test-uid'),
    verifyIdToken: verifyFirebaseIdToken,
    loadUser: (uid) => getStore().users[uid],
  });

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = ChatSchema.parse(await req.json());
    const result = await runRonBotChat({
      ...body,
      // Always use the cryptographically verified uid rather than trusting body.uid
      uid: auth.uid,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Chat error' },
      { status: 400 },
    );
  }
}
