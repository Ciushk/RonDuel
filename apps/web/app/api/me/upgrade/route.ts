import { NextResponse } from 'next/server';
import { z } from 'zod';

import { upgradeAccount } from '@/lib/server-store';

const UpgradeSchema = z.object({
  uid: z.string().min(3),
  email: z.string().email(),
  provider: z.enum(['email_link', 'google', 'google.com', 'password', 'email_password']),
  nickname: z.string().optional(),
  confirmMerge: z.boolean().optional(),
  targetUid: z.string().min(3).optional(),
});

export async function POST(req: Request) {
  try {
    const body = UpgradeSchema.parse(await req.json());
    return NextResponse.json(upgradeAccount(body));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }
}
