import { LOCALES, QUESTION_TYPES, type Locale } from '@ronduel/shared';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  approveAdminQuestion,
  generateAiQuestionDrafts,
  getAdminDashboard,
  getOrCreateUser,
  publishAdminRound,
  scheduleAdminRound,
} from '@/lib/server-store';

function isAuthorizedAdmin(req: Request): boolean {
  const adminHeader = req.headers.get('x-admin-token');
  if (adminHeader === 'local-admin') return true;
  const uid = new URL(req.url).searchParams.get('uid');
  if (uid) {
    const user = getOrCreateUser({ uid });
    if (user.isAdmin) return true;
  }
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }
  return NextResponse.json(getAdminDashboard());
}

const AdminActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('generate_drafts'),
    topic: z.string().min(2),
    type: z.enum(QUESTION_TYPES),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    count: z.number().int().min(1).max(5).default(2),
  }),
  z.object({
    action: z.literal('approve_question'),
    questionId: z.string().min(1),
  }),
  z.object({
    action: z.literal('schedule_round'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    questionIds: z.array(z.string()).length(6),
    topicOfTheDay: z.string().min(2),
  }),
  z.object({
    action: z.literal('publish_round'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    explicitFallbackLocales: z.array(z.enum(LOCALES)).default(['es', 'pt', 'ro']),
  }),
]);

export async function POST(req: Request) {
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }
  try {
    const body = AdminActionSchema.parse(await req.json());
    if (body.action === 'generate_drafts') {
      const drafts = generateAiQuestionDrafts(body);
      return NextResponse.json({ drafts });
    }
    if (body.action === 'approve_question') {
      const q = approveAdminQuestion(body.questionId);
      return NextResponse.json({ question: q });
    }
    if (body.action === 'schedule_round') {
      const res = scheduleAdminRound(body);
      return NextResponse.json(res);
    }
    const published = publishAdminRound({
      date: body.date,
      explicitFallbackLocales: body.explicitFallbackLocales as Locale[],
    });
    return NextResponse.json({ round: published });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Admin action failed' },
      { status: 400 },
    );
  }
}
