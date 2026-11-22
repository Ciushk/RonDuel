import { NextResponse } from 'next/server';
import { z } from 'zod';

import { adoptAnonymousUid } from '@/lib/server-store';

const AdoptSchema = z.object({
  fromUid: z.string().min(3),
  toUid: z.string().min(3),
});

export async function POST(req: Request) {
  try {
    const body = AdoptSchema.parse(await req.json());
    return NextResponse.json(adoptAnonymousUid(body.fromUid, body.toUid));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }
}
