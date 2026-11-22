import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  deleteLeague,
  getLeagueByCodeOrId,
  leaveOrRemoveLeagueMember,
  regenerateLeagueInviteCode,
  renameLeague,
  setLeaguePrivateApproval,
} from '@/lib/server-store';

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

const PatchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('rename'),
    actorUid: z.string().min(1),
    name: z.string().min(2).max(30),
  }),
  z.object({
    action: z.literal('regenerate_code'),
    actorUid: z.string().min(1),
  }),
  z.object({
    action: z.literal('private_approval'),
    actorUid: z.string().min(1),
    enabled: z.boolean(),
  }),
]).or(
  z.object({
    actorUid: z.string().min(1),
    name: z.string().min(2).max(30),
  }),
);

export async function PATCH(req: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const body = PatchSchema.parse(await req.json());
    if ('action' in body && body.action === 'regenerate_code') {
      const res = regenerateLeagueInviteCode({
        codeOrId: code,
        actorUid: body.actorUid,
      });
      return NextResponse.json(res);
    }
    if ('action' in body && body.action === 'private_approval') {
      const res = setLeaguePrivateApproval({
        codeOrId: code,
        actorUid: body.actorUid,
        enabled: body.enabled,
      });
      return NextResponse.json(res);
    }
    const league = renameLeague({
      codeOrId: code,
      actorUid: body.actorUid,
      name: body.name,
    });
    return NextResponse.json({ success: true, name: league.name });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update league' },
      { status: 400 },
    );
  }
}

const DeleteSchema = z.object({
  actorUid: z.string().min(1),
});

export async function DELETE(req: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const body = DeleteSchema.parse(await req.json());
    const res = deleteLeague({
      codeOrId: code,
      actorUid: body.actorUid,
    });
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete league' },
      { status: 400 },
    );
  }
}

const MemberActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('leave'),
    actorUid: z.string().min(1),
  }),
  z.object({
    action: z.literal('remove_member'),
    actorUid: z.string().min(1),
    targetUid: z.string().min(1),
  }),
]);

export async function POST(req: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const body = MemberActionSchema.parse(await req.json());
    const targetUid = body.action === 'leave' ? body.actorUid : body.targetUid;
    const res = leaveOrRemoveLeagueMember({
      codeOrId: code,
      targetUid,
      actorUid: body.actorUid,
    });
    return NextResponse.json(res);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Member action failed' },
      { status: 400 },
    );
  }
}
