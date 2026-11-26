import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ') || auth.slice(7).trim().length === 0) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, sent: true });
}
