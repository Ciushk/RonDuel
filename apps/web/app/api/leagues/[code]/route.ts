import { NextResponse } from 'next/server';

import { getLeagueByCodeOrId } from '@/lib/server-store';

export async function GET(req: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const { searchParams } = new URL(req.url);
  const uid = searchParams.get('uid') ?? undefined;
  const league = getLeagueByCodeOrId(code, uid);
  if (!league) {
    return NextResponse.json({ error: 'League not found' }, { status: 404 });
  }
  return NextResponse.json(league);
}
