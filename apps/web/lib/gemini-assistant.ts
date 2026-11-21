import { GoogleGenAI } from '@google/genai';
import type { QuestionType } from '@ronduel/shared';

import {
  approveAdminQuestion,
  generateAiQuestionDrafts,
  getAdminDashboard,
  scheduleAdminRound,
} from './server-store';

export interface ChatRequestParams {
  message: string;
  locale?: string;
  isAdmin?: boolean;
  previousInteractionId?: string;
  apiKeyOverride?: string;
}

export interface ChatResponsePayload {
  reply: string;
  interactionId?: string;
  mode: 'gemini-3.8-flash' | 'local-knowledge';
  adminActionResult?: {
    type: 'drafts_created' | 'round_scheduled';
    summary: string;
    count?: number;
    date?: string;
  };
}

const RONDUEL_SYSTEM_INSTRUCTION = `You are RonBot ⚡, the friendly Split Court robot mascot and AI assistant for RonDuel ("The daily duel for your group chat").
Always answer concisely, warmly, and in the same language the user writes in (Romanian, English, Spanish, or Portuguese).

Key facts about RonDuel:
- Daily round: 6 questions per calendar day (local midnight reset, Wordle model): 2 Multiple Choice (10s each), 1 Ordering (15s), 1 Odd-One-Out (10s), 2 Logic/Number (15s).
- Zero friction: no account needed on first play—just pick a nickname and confirm 16+ age.
- Scoring: 100 base points + up to 100 speed bonus points per correct answer (server-timed with 250ms network grace). Maximum daily score is 1,200 points. Wrong or timed out = 0 points.
- Share card emojis (spoiler-free):
  - ⚡ = correct with > 60% time remaining
  - 🟩 = correct
  - 🟥 = wrong or timed out
- Leagues: sharing your result to WhatsApp/Telegram/Discord automatically creates a friend-group league with a 6-character code (/l/CODE). Leaderboards: Today (scores hidden until you finish today's round!), This Week (Monday–Sunday, weekly trophy 🏆), and All-time.
- Async 1v1 Duels: 5-question mini-round drawn from the duel pool (never overlaps with today's daily round). 24h clock; ties broken by lower total time.
- RonDuel Pro ($4.99/mo or $39.99/yr): leagues up to 200 members (vs 25 free), unlimited active duels (vs 3 free), 1 automatic weekly streak shield, topic accuracy stats, and 3 Pro themes (Midnight Court, Clay Court, Neon Arcade).
- Admin Co-Pilot: When assisting an admin, help them draft factual questions (with 4 options, correct answer first, explanation, and fact-verification checklist) and schedule 6-item daily rounds while respecting the 180-day anti-repetition rule.`;

function detectAdminIntent(message: string, isAdmin: boolean) {
  if (!isAdmin) return undefined;
  const lower = message.toLowerCase();

  // Check if admin wants to schedule a round for a YYYY-MM-DD date
  const dateMatch = message.match(/\b(202\d-\d{2}-\d{2})\b/);
  if (
    dateMatch &&
    (lower.includes('programeaz') || lower.includes('schedule') || lower.includes('rund'))
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
          summary: `Am programat runda de 6 întrebări aprobate pentru data ${targetDate}!`,
        };
      } catch (err) {
        return {
          type: 'round_scheduled' as const,
          date: targetDate,
          summary: `Nu am putut programa runda pentru ${targetDate}: ${err instanceof Error ? err.message : 'eroare'}`,
        };
      }
    }
  }

  // Check if admin wants to generate question drafts
  if (
    lower.includes('intreb') ||
    lower.includes('întreb') ||
    lower.includes('creeaz') ||
    lower.includes('genereaz') ||
    lower.includes('draft') ||
    lower.includes('question')
  ) {
    const countMatch = message.match(/\b([1-5])\b/);
    const count = countMatch ? Number(countMatch[1]) : 2;
    let type: QuestionType = 'mcq';
    if (lower.includes('ord')) type = 'order';
    else if (lower.includes('odd') || lower.includes('intrus')) type = 'odd';
    else if (lower.includes('logic') || lower.includes('mate')) type = 'logic';

    const topicMatch = message.match(
      /(?:despre|about|tema|topic)\s+([a-zA-ZăâîșțĂÂÎȘȚ0-9\s-]{2,30})/i,
    );
    const topic = topicMatch?.[1]?.trim() || ' Cultură Generală';

    const drafts = generateAiQuestionDrafts({
      topic,
      type,
      difficulty: 2,
      count,
    });

    // If admin explicitly asked to also approve them
    if (lower.includes('aprob') || lower.includes('approve')) {
      for (const d of drafts) {
        approveAdminQuestion(d.id, 'ronbot-admin');
      }
    }

    return {
      type: 'drafts_created' as const,
      count: drafts.length,
      summary: `Am creat ${drafts.length} întrebări noi (${type.toUpperCase()}) pe tema „${topic.trim()}” în banca de întrebări din /admin (${drafts.map((d) => d.id).join(', ')}).`,
    };
  }

  return undefined;
}

function buildLocalFallbackReply(
  message: string,
  locale = 'ro',
  adminActionResult?: ChatResponsePayload['adminActionResult'],
): string {
  if (adminActionResult) {
    return `🤖 **RonBot Admin Co-Pilot:** ${adminActionResult.summary}\n\nPoți vedea și edita întrebările sau rundele direct în tabelul din **/admin**.`;
  }

  const lower = message.toLowerCase();
  const isRo = locale === 'ro' || /[ăâîșț]|cum|ce|este|joc|scor|lig|duel|regul/i.test(lower);

  if (lower.includes('scor') || lower.includes('punct') || lower.includes('score')) {
    return isRo
      ? '⚡ **Cum se calculează scorul în RonDuel:**\nPentru fiecare răspuns corect primești **100 puncte de bază** + un **bonus de viteză de până la 100 puncte** (calculat pe server, cu 250ms grație de rețea). Scorul maxim zilnic este **1.200 puncte** (6 întrebări × 200p). Dacă răspunzi în primele 40% din timp, primești simbolul **⚡** pe cardul de share!'
      : '⚡ **How scoring works:**\nEach correct answer awards **100 base points** + up to **100 speed bonus points** (server-timed with 250ms network grace). Max daily score is **1,200 points** across 6 items. Fast answers (>60% time left) earn a **⚡** tile!';
  }

  if (
    lower.includes('lig') ||
    lower.includes('grup') ||
    lower.includes('league') ||
    lower.includes('prieten')
  ) {
    return isRo
      ? '🏆 **Ligi & Grupuri:**\nDupă ce termini runda de azi, apasă **„Trimite pe grup”**. Linkul tău creează automat o ligă cu un cod de 6 caractere (`/l/COD`). Prietenii intră dintr-o singură atingere, își aleg o poreclă și concurează în clasamentul **Azi**, **Săptămâna** (cu trofeul 🏆 luni) și **All-time**. Scorurile de azi sunt ascunse până joci și tu, ca să nu existe spoilere!'
      : '🏆 **Leagues & Groups:**\nTap **Share to your group** after finishing a round to auto-create a league (`/l/CODE`). Friends join in one tap with just a nickname. Today’s scores stay hidden until you play!';
  }

  if (lower.includes('duel') || lower.includes('1v1')) {
    return isRo
      ? '⚔️ **Dueluri 1v1 Asincrone:**\nPoți provoca orice prieten la un mini-duel de **5 întrebări** (care nu se suprapun niciodată cu runda zilnică). Fiecare are **24 de ore** să își joace tura; scorul mai mare câștigă, iar la egalitate decide timpul total mai mic!'
      : '⚔️ **Async 1v1 Duels:**\nChallenge any friend to a 5-question mini-round (never overlapping with today’s daily round). Each player has 24 hours to play; higher score wins, ties go to lower total time!';
  }

  if (
    lower.includes('pro') ||
    lower.includes('abonament') ||
    lower.includes('teme') ||
    lower.includes('scut')
  ) {
    return isRo
      ? '✨ **RonDuel Pro ($4.99/lună sau $39.99/an):**\nInclude ligi de până la **200 de membri**, **dueluri 1v1 nelimitate**, **1 scut automat pe săptămână** pentru serie (protejează o zi ratată), statistici de acuratețe pe teme și cele 3 teme vizuale Pro (**Midnight Court**, **Clay Court**, **Neon Arcade**).'
      : '✨ **RonDuel Pro ($4.99/mo or $39.99/yr):**\nUnlocks 200-member leagues, unlimited 1v1 duels, 1 automatic weekly streak shield, topic accuracy stats, and 3 exclusive Split Court themes.';
  }

  if (
    lower.includes('admin') ||
    lower.includes('intreb') ||
    lower.includes('întreb') ||
    lower.includes('rund')
  ) {
    return isRo
      ? '🛠️ **Ajutor pentru Admini:**\nÎn pagina **/admin** (sau activând modul Admin în acest chat), îmi poți scrie direct:\n- *„Creează 3 întrebări despre Astronomie”*\n- *„Generează 2 întrebări de logică”*\n- *„Programează o rundă pentru 2026-12-18”*\nși le voi adăuga automat în banca de întrebări cu checklist de verificare!'
      : '🛠️ **Admin Co-Pilot:**\nIn **/admin** (or with Admin mode toggled on in this chat), ask me:\n- *"Create 3 questions about Astronomy"*\n- *"Schedule a round for 2026-12-18"*\nand I will create the drafts or schedule the round for you!';
  }

  return isRo
    ? 'Salut! Sunt **RonBot ⚡**, asistentul tău din arena Split Court! Mă poți întreba orice despre:\n- **Reguli & Scor** (cele 6 întrebări zilnice, bonusul de viteză, ⚡🟩🟥)\n- **Ligi & Dueluri 1v1** cu prietenii\n- **RonDuel Pro & Scutul de serie**\n- **Comenzi Admin** (*„Creează 2 întrebări despre Istorie”* sau *„Programează o rundă pentru 2026-12-18”*)'
    : 'Hi! I’m **RonBot ⚡**, your Split Court assistant! Ask me anything about **rules & scoring**, **group leagues**, **1v1 duels**, **RonDuel Pro**, or use **Admin commands** to generate questions and schedule rounds!';
}

export async function runRonBotChat(params: ChatRequestParams): Promise<ChatResponsePayload> {
  const adminActionResult = detectAdminIntent(params.message, Boolean(params.isAdmin));
  const apiKey =
    params.apiKeyOverride?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim();

  if (apiKey) {
    try {
      const client = new GoogleGenAI({ apiKey });
      const adminContext = adminActionResult
        ? `\n[System note: You just executed an admin action on the server: ${adminActionResult.summary}. Confirm this action to the admin and also provide the full text of the generated questions/schedule in your reply.]`
        : '';

      const interaction = await client.interactions.create({
        model: 'gemini-3.8-flash',
        input: `${params.message}${adminContext}`,
        system_instruction: RONDUEL_SYSTEM_INSTRUCTION,
        ...(params.previousInteractionId
          ? { previous_interaction_id: params.previousInteractionId }
          : {}),
      });

      const replyText =
        interaction.output_text?.trim() ||
        buildLocalFallbackReply(params.message, params.locale, adminActionResult);

      return {
        reply: replyText,
        interactionId: interaction.id,
        mode: 'gemini-3.8-flash',
        adminActionResult,
      };
    } catch {
      // Fall back cleanly if the provided API key is invalid or network fails
    }
  }

  return {
    reply: buildLocalFallbackReply(params.message, params.locale, adminActionResult),
    mode: 'local-knowledge',
    adminActionResult,
  };
}
