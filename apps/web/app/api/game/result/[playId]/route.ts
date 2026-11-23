import { NextResponse } from 'next/server';

import { getPlayResult } from '@/lib/server-store';

export async function GET(_req: Request, context: { params: Promise<{ playId: string }> }) {
  const { playId } = await context.params;
  const result = getPlayResult(playId);
  if (!result) {
    return NextResponse.json({ error: 'Result not found', code: 'RESULT_NOT_FOUND' }, { status: 404 });
  }
  return NextResponse.json(result);
}
