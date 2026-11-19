import { NextResponse } from 'next/server';
import { z } from 'zod';

import { deleteUserData } from '@/lib/server-store';

const DeleteSchema = z.object({
  uid: z.string().min(3),
});

export async function POST(req: Request) {
  try {
    const body = DeleteSchema.parse(await req.json());
    return NextResponse.json(deleteUserData(body.uid));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }
}
