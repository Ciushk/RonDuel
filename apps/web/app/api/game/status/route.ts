import { NextResponse } from 'next/server';

import { getTodayStatus } from '@/lib/server-store';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get('uid') ?? 'anon';
  const tz = searchParams.get('tz') ?? 'UTC';
  return NextResponse.json(getTodayStatus(uid, tz));
}
