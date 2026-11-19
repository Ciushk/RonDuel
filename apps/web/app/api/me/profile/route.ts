import { NextResponse } from 'next/server';

import { getUserProfile } from '@/lib/server-store';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get('uid');
  if (!uid) {
    return NextResponse.json({ error: 'uid required' }, { status: 400 });
  }
  return NextResponse.json(getUserProfile(uid));
}
