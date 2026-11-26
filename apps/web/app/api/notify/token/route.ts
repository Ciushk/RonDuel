import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ') || auth.slice(7).trim().length === 0) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { token?: string; platform?: string; locale?: string };
    if (!body?.token || typeof body.token !== 'string') {
      return NextResponse.json({ error: 'Invalid token', code: 'INVALID_TOKEN' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Bad request', code: 'BAD_REQUEST' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ') || auth.slice(7).trim().length === 0) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
