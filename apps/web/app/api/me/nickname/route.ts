import { NextResponse } from 'next/server';
import { z } from 'zod';

import { changeUserNickname, checkNicknameAvailable } from '@/lib/server-store';

const NicknameRequestSchema = z.object({
  uid: z.string().min(1),
  nickname: z.string().min(1),
  checkOnly: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const body = NicknameRequestSchema.parse(json);

    if (body.checkOnly) {
      const result = checkNicknameAvailable(body.nickname, body.uid);
      return NextResponse.json(result);
    }

    const updated = changeUserNickname({
      uid: body.uid,
      newNickname: body.nickname,
    });

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Eroare la schimbarea numelui' },
      { status: 400 },
    );
  }
}
