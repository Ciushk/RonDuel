import { GoogleGenAI } from '@google/genai';
import { LOCALES, type Locale, type QuestionType } from '@ronduel/shared';

import {
  classifyRonbotIntent,
  detectMessageLocale,
  renderRonbotAnswer,
  tRonbot,
  wantsRonbotDetail,
} from './ronbot-replies';

import {
  approveAdminQuestion,
  createDuel,
  createLeague,
  generateAiQuestionDrafts,
  getAdminDashboard,
  getPlayResult,
  getTodayStatus,
  getUserProfile,
  scheduleAdminRound,
} from './server-store';

export interface ChatRequestParams {
  message: string;
  locale?: string;
  uid?: string;
  tz?: string;
  nickname?: string;
  isAdmin?: boolean;
  previousInteractionId?: string;
}

export interface ChatResponsePayload {
  reply: string;
  interactionId?: string;
  mode: 'gemini-3.8-flash' | 'ronduel-engine';
  actionLink?: {
    label: string;
    href: string;
  };
  adminActionResult?: {
    type: 'drafts_created' | 'round_scheduled';
    summary: string;
    count?: number;
    date?: string;
  };
}

const RONDUEL_COMPLETE_ENCYCLOPEDIA = `
You are RonBot ⚡, the official AI mascot and game master of RonDuel ("Duelul zilnic pentru grupul tău de prieteni" / "The daily duel for your group chat").
Always answer in the user's language (defaulting to Romanian if the query is in Romanian). Be warm, clear, structured, and accurate.

COMPLETE RONDUEL RULES & SPECIFICATION:
1. HOW TO PLAY (CUM SE JOACĂ):
   - Tap "Joacă runda de azi" (Play today's round) on the home screen.
   - No account is required! On your first play, simply pick a nickname (2–20 chars) and check the 16+ confirmation.
   - You see a "Ready?" screen with a 3-2-1 countdown.
   - A daily round has exactly 6 questions and takes ~60 seconds (hard max 75s):
     * 2 × Multiple Choice (MCQ) — 4 options, 1 correct, 10 seconds each.
     * 1 × Ordering (Ordonare) — arrange 4 items in the right sequence using the Up/Down arrows, 15 seconds.
     * 1 × Odd-One-Out (Intrusul) — 4 options, pick the one that does NOT belong, 10 seconds.
     * 2 × Logic / Number (Logică & Matematică) — 4 options, 15 seconds each.
   - One attempt per calendar day! Once question 1 is served, the attempt counts. If you close or leave the page, the current question's timer expires and on return you resume at the next unanswered question.

2. SCORING & TIE-BREAKERS (SCOR ȘI DEPARTAJARE):
   - Correct answer: 100 base points + speed bonus up to 100 points.
   - Formula: bonus = round(100 × max(0, (limit - effectiveElapsed) / limit)), where effectiveElapsed = max(0, serverElapsed - 250ms network grace).
   - Maximum score per question: 200 points. Maximum daily score: 1,200 points (6 × 200).
   - Wrong answer or timeout: 0 points.
   - Ordering questions are all-or-nothing in v1 (all 4 items must be in the exact order).
   - Tie-breaker on leaderboards & duels: lower total server-measured time (totalMs), then earlier finish timestamp.
   - Anti-cheat: all timers and scores are calculated exclusively on the server; the correct answer is never sent to the browser before you answer.

3. EMOJI LEGEND & SHARE CARD (CARDUL DE SHARE FĂRĂ SPOILERE):
   - After finishing, you get a spoiler-free share card:
     * ⚡ = Correct and super fast (more than 60% of the time remaining, i.e. answered in the first 40% of the timer).
     * 🟩 = Correct answer within the time limit.
     * 🟥 = Wrong answer or timed out.
   - No question text or answers appear on the share card so you never spoil the round for your group chat.

4. LEAGUES & WEEKLY TROPHY (LIGI, GRUPURI ȘI TROFEUL SĂPTĂMÂNAL):
   - Tapping "Trimite pe grup" (Share to your group) after your round automatically creates a League with a 6-character code (/l/CODE) if you don't have one yet.
   - Friends tap the link in WhatsApp, Telegram, or Discord, pick a nickname, and play the same round.
   - 3 Leaderboards per league:
     * Azi (Today) — live updates! IMPORTANT: Other members' scores for today are hidden ("—") until YOU finish today's round, to prevent spoilers and cheating.
     * Săptămâna (This Week) — Monday 00:00 to Sunday 23:59:59 in the league's timezone; sum of daily scores. The #1 player at the end of Sunday wins the Weekly Trophy 🏆!
     * All-time — total score, rounds played, weekly wins, best streak.
    - Free tier limits: create up to 1 league (up to 5 members per league), join up to 10 leagues.

5. ASYNC 1v1 DUELS (DUELURI 1v1 ASINCRONE):
   - Tap "Provoacă un prieten (Duel 1v1)" on the result screen or ask RonBot to create a duel.
   - A duel is a separate 5-question mini-round drawn from the duel pool — it NEVER uses questions from today's daily round.
   - Both players have 24 hours to play their 5 questions asynchronously.
   - Higher score wins; ties are broken by lower total time (totalMs).
   - If the opponent never plays within 24h after the challenger finishes, the challenger wins by walkover (neprezentare).
   - A permanent head-to-head record (W-L) is tracked between every pair of players.
   - Free users can create up to 4 duels per month (unlimited with Pro).

6. STREAKS & DAILY RESET (SERIA ZILNICĂ ȘI RESETUL LA MIEZUL NOPȚII):
   - Every consecutive local calendar day you finish a round increases your streak 🔥 by +1. Missing a day resets it to 0.
   - Reset happens at your local midnight (Wordle model), so everyone plays their morning round at a natural hour.
   - Timezone changes are rate-limited to once per 24h to prevent date-hopping.

7. RONDEL PRO (€4.99/month or €39.99/year — save 33%):
   - Leagues up to 200 members (instead of 5).
   - Unlimited 1v1 duels (instead of 4/month).
   - 1 automatic Weekly Streak Shield 🛡️ per ISO week (automatically protects your streak if you miss 1 day).
   - Pro Topic Accuracy statistics on your Profile (/me).
   - 3 exclusive Split Court visual themes in Settings (/settings): Midnight Court, Clay Court, and Neon Arcade.
   - Zero interruptive ads, ever. Cancel anytime via Stripe Customer Portal.

8. ACCOUNT UPGRADE, ACCESSIBILITY, PWA & GDPR:
   - Account Upgrade (/me): link your anonymous profile to an Email Magic Link or Google account while keeping your uid, streak, and leagues.
   - Relaxed Timer (/settings): accessibility option that gives +50% time per question (15s for MCQ/Odd, 22.5s for Order/Logic).
   - PWA Install: add RonDuel to your Home Screen on Android or iOS for standalone full-screen play and Web Push reminders (on iOS Safari tabs, email reminders are offered until installed to Home Screen).
   - GDPR (/settings): 1-click JSON export of all your data and 1-click account deletion (anonymizes past league scores as "Former player").
`;

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function detectAdminIntent(message: string, isAdmin: boolean) {
  if (!isAdmin) return undefined;
  const norm = normalizeText(message);

  const dateMatch = message.match(/\b(202\d-\d{2}-\d{2})\b/);
  if (
    dateMatch &&
    (norm.includes('programeaz') || norm.includes('schedule') || norm.includes('rund'))
  ) {
    const targetDate = dateMatch[1]!;
    const dash = getAdminDashboard();
    const approved = dash.questions.filter((q) => q.reviewStatus === 'approved').slice(0, 6);
    if (approved.length === 6) {
      try {
        scheduleAdminRound({
          date: targetDate,
          questionIds: approved.map((q) => q.id),
          topicOfTheDay: 'RonBot Scheduled Duel ⚡',
        });
        return {
          type: 'round_scheduled' as const,
          date: targetDate,
          summary: 'ok',
        };
      } catch (err) {
        return {
          type: 'round_scheduled' as const,
          date: targetDate,
          summary: `ERR:${err instanceof Error ? err.message : 'error'}`,
        };
      }
    }
  }

  if (
    norm.includes('intreb') ||
    norm.includes('creeaz') ||
    norm.includes('genereaz') ||
    norm.includes('draft') ||
    norm.includes('question')
  ) {
    const countMatch = message.match(/\b([1-5])\b/);
    const count = countMatch ? Number(countMatch[1]) : 2;
    let type: QuestionType = 'mcq';
    if (norm.includes('ord')) type = 'order';
    else if (norm.includes('odd') || norm.includes('intrus')) type = 'odd';
    else if (norm.includes('logic') || norm.includes('mate')) type = 'logic';

    const topicMatch = message.match(
      /(?:despre|about|tema|topic)\s+([a-zA-ZăâîșțĂÂÎȘȚ0-9\s-]{2,30})/i,
    );
    const topic = topicMatch?.[1]?.trim() || 'General';

    const drafts = generateAiQuestionDrafts({
      topic,
      type,
      difficulty: 2,
      count,
    });

    if (norm.includes('aprob') || norm.includes('approve')) {
      for (const d of drafts) {
        approveAdminQuestion(d.id, 'ronbot-admin');
      }
    }

    return {
      type: 'drafts_created' as const,
      count: drafts.length,
      summary: `${type}|${topic}|${drafts.map((d) => d.id).join(', ')}`,
    };
  }

  return undefined;
}

function buildSmartRonDuelReply(params: {
  message: string;
  locale: string;
  uid?: string;
  tz?: string;
  nickname?: string;
  adminActionResult?: ChatResponsePayload['adminActionResult'];
}): { reply: string; actionLink?: { label: string; href: string }; generic: boolean } {
  const { message, locale, uid, tz = 'Europe/Bucharest', nickname, adminActionResult } = params;
  const pageLocale = locale || 'ro';
  const lang = detectMessageLocale(message, pageLocale);
  const intent = classifyRonbotIntent(message);

  if (adminActionResult) {
    const failed = adminActionResult.summary.startsWith('ERR:');
    const [draftType, draftTopic, draftIds] = adminActionResult.summary.split('|');
    const reply =
      adminActionResult.type === 'drafts_created'
        ? `${tRonbot(lang, 'replyAdminDrafts', {
            count: adminActionResult.count ?? 0,
            type: draftType,
            topic: draftTopic,
            ids: draftIds,
          })}\n\n${tRonbot(lang, 'replyAdminPanel')}`
        : `${tRonbot(lang, failed ? 'replyAdminScheduleFailed' : 'replyAdminScheduled', {
            date: adminActionResult.date ?? '',
            error: adminActionResult.summary.replace(/^ERR:/, ''),
          })}\n\n${tRonbot(lang, 'replyAdminPanel')}`;
    return {
      reply,
      actionLink: { label: tRonbot(lang, 'openAdmin'), href: '/admin' },
      generic: false,
    };
  }

  const todayStatus = uid ? getTodayStatus(uid, tz) : getTodayStatus('anon', tz);
  const playRes =
    todayStatus.played && todayStatus.playId ? getPlayResult(todayStatus.playId) : null;

  if (intent === 'createDuel' && uid) {
    try {
      const duel = createDuel({
        challengerUid: uid,
        nickname: nickname || undefined,
        tz,
      });
      return {
        reply: tRonbot(lang, 'replyDuelCreated'),
        actionLink: { label: tRonbot(lang, 'suggestCreateDuel'), href: `/${lang}/duel/${duel.id}` },
        generic: false,
      };
    } catch (err) {
      return {
        reply: tRonbot(lang, 'replyActionFailed', {
          error: err instanceof Error ? err.message : 'error',
        }),
        generic: false,
      };
    }
  }

  if (intent === 'createLeague' && uid) {
    try {
      const lg = createLeague({
        uid,
        tz,
        locale: (LOCALES.includes(lang as Locale) ? lang : 'en') as Locale,
      });
      return {
        reply: tRonbot(lang, 'replyLeagueCreated', { name: lg.name, code: lg.inviteCode }),
        actionLink: { label: lg.name, href: `/${lang}/league/${lg.id}` },
        generic: false,
      };
    } catch (err) {
      return {
        reply: tRonbot(lang, 'replyActionFailed', {
          error: err instanceof Error ? err.message : 'error',
        }),
        generic: false,
      };
    }
  }

  const rendered = renderRonbotAnswer(intent, lang, {
    nickname: nickname || undefined,
    date: todayStatus.date,
    roundNumber: todayStatus.roundNumber,
    topic: todayStatus.topicOfTheDay,
    played: todayStatus.played,
    score: playRes?.totalScore,
    emojiLine: playRes?.emojiLine,
    streakCurrent: todayStatus.streakCurrent,
    streakBest: todayStatus.streakBest,
    leagues: todayStatus.leagues.length,
    wantsDetail: wantsRonbotDetail(message),
  });

  let actionLink: { label: string; href: string } | undefined;
  if (rendered.action === 'play') {
    actionLink = { label: tRonbot(lang, 'playTodayCta'), href: `/${lang}/play` };
  } else if (rendered.action === 'pro') {
    actionLink = { label: tRonbot(lang, 'seePro'), href: `/${lang}/pro` };
  } else if (rendered.action === 'result' && playRes) {
    actionLink = {
      label: tRonbot(lang, 'suggestMyStatus'),
      href: `/${lang}/result/${encodeURIComponent(playRes.playId)}`,
    };
  }

  return {
    reply: rendered.reply,
    actionLink,
    generic: intent === 'fallback',
  };
}

export async function runRonBotChat(params: ChatRequestParams): Promise<ChatResponsePayload> {
  const locale = params.locale ?? 'ro';
  const tz = params.tz ?? 'Europe/Bucharest';
  const adminActionResult = detectAdminIntent(params.message, Boolean(params.isAdmin));
  const smartFallback = buildSmartRonDuelReply({
    message: params.message,
    locale,
    uid: params.uid,
    tz,
    nickname: params.nickname,
    adminActionResult,
  });

  if (!smartFallback.generic) {
    return {
      reply: smartFallback.reply,
      mode: 'ronduel-engine',
      actionLink: smartFallback.actionLink,
      adminActionResult,
    };
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (apiKey) {
    try {
      const client = new GoogleGenAI({ apiKey });
      const todayStatus = getTodayStatus(params.uid ?? 'anon', tz);
      const liveContext =
        `\n[Live context: date ${todayStatus.date}, round #${todayStatus.roundNumber}, topic "${todayStatus.topicOfTheDay}". ` +
        `Nickname "${params.nickname ?? 'guest'}". Played today: ${todayStatus.played}. Streak: ${todayStatus.streakCurrent}. ` +
        `Answer in the user's language, only the question they asked, in at most 6 short lines unless they asked for detail. ` +
        `Do not append a play button or the full rulebook.]`;

      const interaction = await client.interactions.create({
        model: 'gemini-3.8-flash',
        input: `${params.message}${liveContext}`,
        system_instruction: RONDUEL_COMPLETE_ENCYCLOPEDIA,
        ...(params.previousInteractionId
          ? { previous_interaction_id: params.previousInteractionId }
          : {}),
      });

      const replyText = interaction.output_text?.trim() || smartFallback.reply;
      return {
        reply: replyText,
        interactionId: interaction.id,
        mode: 'gemini-3.8-flash',
        adminActionResult,
      };
    } catch {
      // The built-in reply is already short and in the detected language.
    }
  }

  return {
    reply: smartFallback.reply,
    mode: 'ronduel-engine',
    actionLink: smartFallback.actionLink,
    adminActionResult,
  };
}
