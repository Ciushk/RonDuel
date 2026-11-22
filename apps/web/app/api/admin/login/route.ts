import { NextResponse } from 'next/server';
import { z } from 'zod';

import { verifyFirebaseAdminIdToken } from '@/lib/admin-auth';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    const body = LoginSchema.parse(await req.json());
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: body.email,
          password: body.password,
          returnSecureToken: true,
        }),
      },
    );

    const data = (await res.json()) as { idToken?: string };
    if (!res.ok || !data.idToken) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const adminIdentity = await verifyFirebaseAdminIdToken(data.idToken);
    if (!adminIdentity) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      idToken: data.idToken,
      email: adminIdentity.email,
      uid: adminIdentity.uid,
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
