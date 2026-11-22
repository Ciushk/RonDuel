import { NextResponse } from 'next/server';

import { checkLeagueNameAvailable } from '@/lib/server-store';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name') ?? '';
  const excludeId = searchParams.get('excludeId') ?? undefined;

  const result = checkLeagueNameAvailable(name, excludeId);
  return NextResponse.json(result);
}
