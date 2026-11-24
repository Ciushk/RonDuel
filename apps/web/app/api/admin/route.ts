import { LOCALES, QUESTION_TYPES, type Locale, type QuestionType } from '@ronduel/shared';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { generateLiveGeminiTemplates } from '@/lib/ai-question-bank';
import { authorizeAdminRequest } from '@/lib/admin-auth';
import {
  approveAdminQuestion,
  createOrUpdateAdminQuestion,
  deleteLeague,
  generateAiQuestionDrafts,
  getAdminDashboard,
  leaveOrRemoveLeagueMember,
  publishAdminRound,
  renameLeague,
  scheduleAdminRound,
} from '@/lib/server-store';

export async function GET(req: Request) {
  const admin = await authorizeAdminRequest(req);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }
  return NextResponse.json(getAdminDashboard());
}

const ContentPerLocaleSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string()).min(1),
  explanation: z.string().optional(),
});

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
    action: z.literal('save_question'),
    id: z.string().optional(),
    type: z.enum(QUESTION_TYPES),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    topics: z.array(z.string()),
    timerSec: z.number().int().min(8).max(20).default(15),
    content: z.object({
      ro: ContentPerLocaleSchema.optional(),
      en: ContentPerLocaleSchema.optional(),
      es: ContentPerLocaleSchema.optional(),
      pt: ContentPerLocaleSchema.optional(),
    }),
    extraContent: z.record(z.string(), ContentPerLocaleSchema).optional(),
    answer: z
      .object({
        correctIndex: z.number().optional(),
        correctOrder: z.array(z.string()).optional(),
        oddIndex: z.number().optional(),
        numericAnswer: z.number().optional(),
      })
      .optional(),
    reviewStatus: z.enum(['draft', 'approved']).optional(),
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
  z.object({
    action: z.literal('rename_league'),
    codeOrId: z.string().min(1),
    name: z.string().min(2).max(30),
  }),
  z.object({
    action: z.literal('delete_league'),
    codeOrId: z.string().min(1),
  }),
  z.object({
    action: z.literal('remove_league_member'),
    codeOrId: z.string().min(1),
    targetUid: z.string().min(1),
  }),
]);

export async function POST(req: Request) {
  const admin = await authorizeAdminRequest(req);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  try {
    const body = AdminActionSchema.parse(await req.json());

    if (body.action === 'generate_drafts') {
      const liveTemplates = await generateLiveGeminiTemplates(body);
      const drafts = generateAiQuestionDrafts({
        ...body,
        customTemplates: liveTemplates ?? undefined,
      });
      return NextResponse.json({ drafts });
    }

    if (body.action === 'approve_question') {
      const q = approveAdminQuestion(body.questionId, admin.uid, admin.email);
      return NextResponse.json({ question: q });
    }

    if (body.action === 'save_question') {
      const q = createOrUpdateAdminQuestion({
        id: body.id,
        type: body.type,
        difficulty: body.difficulty,
        topics: body.topics,
        timerSec: body.timerSec,
        content: body.content,
        extraContent: body.extraContent,
        answer: body.answer,
        reviewStatus: body.reviewStatus,
        actorUid: admin.uid,
        actorEmail: admin.email,
      });
      return NextResponse.json({ question: q });
    }

    if (body.action === 'schedule_round') {
      const res = scheduleAdminRound({
        ...body,
        actorUid: admin.uid,
        actorEmail: admin.email,
      });
      return NextResponse.json(res);
    }

    if (body.action === 'publish_round') {
      const published = publishAdminRound({
        date: body.date,
        explicitFallbackLocales: body.explicitFallbackLocales as Locale[],
      });
      return NextResponse.json({ round: published });
    }

    if (body.action === 'rename_league') {
      const lg = renameLeague({
        codeOrId: body.codeOrId,
        actorUid: admin.uid,
        name: body.name,
        isAdmin: true,
      });
      return NextResponse.json({ league: lg });
    }

    if (body.action === 'delete_league') {
      const res = deleteLeague({
        codeOrId: body.codeOrId,
        actorUid: admin.uid,
        isAdmin: true,
      });
      return NextResponse.json(res);
    }

    if (body.action === 'remove_league_member') {
      const res = leaveOrRemoveLeagueMember({
        codeOrId: body.codeOrId,
        targetUid: body.targetUid,
        actorUid: admin.uid,
        isAdmin: true,
      });
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Admin action failed' },
      { status: 400 },
    );
  }
}
