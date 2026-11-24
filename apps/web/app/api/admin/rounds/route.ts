import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ensureUpcomingDailyRounds,
  getAdminRounds,
  promoteReserveRoundIfNeeded,
} from '@/lib/server-store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Number(searchParams.get('days') ?? 7);
    const rounds = getAdminRounds(days);
    return NextResponse.json({ rounds });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch admin rounds' },
      { status: 500 },
    );
  }
}

const ActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('ensure_buffer'),
    bufferDays: z.number().int().min(1).max(30).optional(),
  }),
  z.object({
    action: z.literal('promote_reserve'),
    date: z.string().min(1),
  }),
]);

export async function POST(req: Request) {
  try {
    const body = ActionSchema.parse(await req.json());
    if (body.action === 'ensure_buffer') {
      const res = await ensureUpcomingDailyRounds(body.bufferDays ?? 7);
      return NextResponse.json({ success: true, ...res });
    }
    if (body.action === 'promote_reserve') {
      const res = promoteReserveRoundIfNeeded(body.date);
      return NextResponse.json({ success: true, ...res });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process admin action' },
      { status: 400 },
    );
  }
}
