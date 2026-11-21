import { GoogleGenAI } from '@google/genai';
import { type Locale, type QuestionType } from '@ronduel/shared';

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
   - Free tier limits: create up to 3 leagues (up to 25 members per league), join up to 10 leagues.

5. ASYNC 1v1 DUELS (DUELURI 1v1 ASINCRONE):
   - Tap "Provoacă un prieten (Duel 1v1)" on the result screen or ask RonBot to create a duel.
   - A duel is a separate 5-question mini-round drawn from the duel pool — it NEVER uses questions from today's daily round.
   - Both players have 24 hours to play their 5 questions asynchronously.
   - Higher score wins; ties are broken by lower total time (totalMs).
   - If the opponent never plays within 24h after the challenger finishes, the challenger wins by walkover (neprezentare).
   - A permanent head-to-head record (W-L) is tracked between every pair of players.
   - Free users can have up to 3 active duels at once (unlimited with Pro).

6. STREAKS & DAILY RESET (SERIA ZILNICĂ ȘI RESETUL LA MIEZUL NOPȚII):
   - Every consecutive local calendar day you finish a round increases your streak 🔥 by +1. Missing a day resets it to 0.
   - Reset happens at your local midnight (Wordle model), so everyone plays their morning round at a natural hour.
   - Timezone changes are rate-limited to once per 24h to prevent date-hopping.

7. RONDEL PRO ($4.99/month or $39.99/year — save 33%):
   - Leagues up to 200 members (instead of 25).
   - Unlimited active 1v1 duels (instead of 3).
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
    const topic = topicMatch?.[1]?.trim() || 'Cultură Generală';

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
      summary: `Am creat ${drafts.length} întrebări noi (${type.toUpperCase()}) pe tema „${topic}” în banca de întrebări din /admin (${drafts.map((d) => d.id).join(', ')}).`,
    };
  }

  return undefined;
}

/**
 * Rich, multi-intent RonDuel knowledge & live-action responder.
 * Handles any question about how to play, rules, question types, timers, scoring, emojis,
 * leagues, hidden scores, weekly trophies, 1v1 duels, streaks, reset times, Pro, PWA, GDPR,
 * plus live player status and instant duel/league creation!
 */
function buildSmartRonDuelReply(params: {
  message: string;
  locale: string;
  uid?: string;
  tz?: string;
  nickname?: string;
  adminActionResult?: ChatResponsePayload['adminActionResult'];
}): { reply: string; actionLink?: { label: string; href: string } } {
  const { message, locale, uid, tz = 'Europe/Bucharest', nickname, adminActionResult } = params;

  if (adminActionResult) {
    return {
      reply: `🤖 **RonBot Admin Co-Pilot:** ${adminActionResult.summary}\n\nPoți vedea și edita întrebările sau rundele direct în tabelul din **/admin**.`,
      actionLink: { label: 'Reîncarcă panoul /admin', href: '/admin' },
    };
  }

  const norm = normalizeText(message);
  const loc = ['en', 'es', 'pt', 'ro'].includes(locale) ? locale : 'ro';
  const todayStatus = uid ? getTodayStatus(uid, tz) : getTodayStatus('anon', tz);

  // 1. Live Action: Player asks to create a 1v1 Duel right now from chat
  if (
    uid &&
    (norm.includes('creeaza un duel') ||
      norm.includes('incepe un duel') ||
      norm.includes('provoaca') ||
      norm.includes('start a duel') ||
      norm.includes('create a duel'))
  ) {
    try {
      const duel = createDuel({
        challengerUid: uid,
        nickname: nickname || undefined,
        tz,
      });
      return {
        reply: `⚔️ **Am creat un Duel 1v1 nou pentru tine!**\nAre 5 întrebări rapide (diferite de runda zilnică) și 24h timp de joc.\n\nApasă butonul de mai jos ca să îți joci tura și să trimiți linkul unui prieten!`,
        actionLink: {
          label: '⚔️ Deschide Duelul 1v1',
          href: `/${loc}/duel/${duel.id}`,
        },
      };
    } catch (err) {
      return {
        reply: `Nu am putut crea duelul: ${err instanceof Error ? err.message : 'eroare'}.`,
      };
    }
  }

  // 2. Live Action: Player asks to create a League right now from chat
  if (
    uid &&
    (norm.includes('creeaza o liga') ||
      norm.includes('fa o liga') ||
      norm.includes('create a league'))
  ) {
    const lg = createLeague({
      uid,
      tz,
      locale: (loc as Locale) || 'ro',
    });
    return {
      reply: `🏆 **Am creat liga „${lg.name}”** (cod de invitație: **${lg.inviteCode}**).\nTrimite linkul prietenilor tăi pe WhatsApp sau Telegram și concurați zilnic!`,
      actionLink: {
        label: `🏆 Deschide liga ${lg.name}`,
        href: `/${loc}/league/${lg.id}`,
      },
    };
  }

  // 3. Player asks about their own status / today's round / my score / my streak
  if (
    norm.includes('scorul meu') ||
    norm.includes('seria mea') ||
    norm.includes('runda de azi') ||
    norm.includes('ce runda e') ||
    norm.includes('am jucat azi') ||
    norm.includes('statusul meu') ||
    norm.includes('my score') ||
    norm.includes('today round')
  ) {
    const playRes =
      todayStatus.played && todayStatus.playId ? getPlayResult(todayStatus.playId) : null;
    if (playRes) {
      return {
        reply: `📊 **Statusul tău pe azi (${todayStatus.date}):**\n- **Runda #${todayStatus.roundNumber}** (${todayStatus.topicOfTheDay})\n- **Ai jucat deja azi:** **${playRes.totalScore} puncte** (${playRes.emojiLine})\n- **Seria ta actuală:** 🔥 **${todayStatus.streakCurrent} zile** (record: ${todayStatus.streakBest} zile)\n- **Ligi în care ești:** ${todayStatus.leagues.length}`,
        actionLink: {
          label: 'Vezi rezultatul tău de azi',
          href: `/${loc}/result/${encodeURIComponent(playRes.playId)}`,
        },
      };
    }
    return {
      reply: `📅 **Runda de azi (${todayStatus.date}):**\n- **Runda #${todayStatus.roundNumber}** — Tema zilei: **${todayStatus.topicOfTheDay}**\n- **Status:** Nu ai jucat încă runda de azi!\n- **Seria ta:** 🔥 **${todayStatus.streakCurrent} zile** (record: ${todayStatus.streakBest} zile)\n\nEști gata pentru cele 6 întrebări în ~60 de secunde?`,
      actionLink: {
        label: '▶️ Joacă runda de azi',
        href: `/${loc}/play`,
      },
    };
  }

  // 4. HOW TO PLAY / RULES / STEP BY STEP ("Cum se joaca?", "Care sunt regulile?", "Ce este RonDuel?", "Cum incep?")
  const matchedSections: string[] = [];

  if (
    norm.includes('cum se joaca') ||
    norm.includes('cum joc') ||
    norm.includes('regul') ||
    norm.includes('ce este') ||
    norm.includes('ce e ronduel') ||
    norm.includes('despre joc') ||
    norm.includes('cum functioneaza') ||
    norm.includes('cum incep') ||
    norm.includes('explica') ||
    norm.includes('how to play') ||
    norm.includes('rules')
  ) {
    matchedSections.push(
      `🎮 **Cum se joacă RonDuel (Pas cu Pas):**\n` +
        `1. **Fără cont la început:** Apasă **„Joacă runda de azi”**, alege-ți o poreclă și bifează că ai 16+ ani.\n` +
        `2. **Runda zilnică (~60 secunde):** După numărătoarea **3-2-1**, primești **6 întrebări** identice pentru toți jucătorii în ziua respectivă:\n` +
        `   • **2 × Grilă (MCQ)** — 4 variante, 1 corectă (*10 secunde*)\n` +
        `   • **1 × Ordonare** — aranjezi 4 elemente în ordinea cerută cu săgețile Sus/Jos (*15 secunde*)\n` +
        `   • **1 × Intrusul (Odd-one-out)** — alegi elementul care NU se potrivește (*10 secunde*)\n` +
        `   • **2 × Logică / Numere** — 4 variante rapide (*15 secunde*)\n` +
        `3. **O singură încercare pe zi:** După terminare, primești scorul (max **1.200p**) și cardul fără spoilere (\`⚡🟩🟥\`) pe care îl trimiți pe grupul de WhatsApp / Telegram ca să creezi liga voastră!`,
    );
  }

  // 5. QUESTION TYPES & TIMERS ("Ce tipuri de intrebari?", "Cat timp am?", "Cate secunde?", "Ordonare")
  if (
    norm.includes('tipuri de intreb') ||
    norm.includes('cate intreb') ||
    norm.includes('cat timp') ||
    norm.includes('cate secunde') ||
    norm.includes('cronometru') ||
    norm.includes('timer') ||
    norm.includes('ordonare') ||
    norm.includes('intrus') ||
    norm.includes('relaxat')
  ) {
    matchedSections.push(
      `⏱️ **Întrebări & Timp pe întrebare:**\n` +
        `- Fiecare rundă zilnică are **6 întrebări** (iar un Duel 1v1 are **5 întrebări**).\n` +
        `- **Grilă (MCQ)** și **Intrusul (Odd-one-out)**: **10 secunde** pe întrebare.\n` +
        `- **Ordonare (Sequence)** și **Logică / Matematică**: **15 secunde** pe întrebare (la ordonare trebuie ca toate cele 4 poziții să fie în ordinea exactă).\n` +
        `- **Cronometru relaxat (Accesibilitate):** Din **Setări (/settings)** poți activa opțiunea **+50% timp** (15s / 22.5s) dacă preferi un ritm mai puțin stresant!`,
    );
  }

  // 6. SCORING & TIE-BREAKER ("Cum se calculeaza scorul?", "Puncte", "Egalitate")
  if (
    norm.includes('scor') ||
    norm.includes('punct') ||
    norm.includes('bonus') ||
    norm.includes('egalitate') ||
    norm.includes('departaj') ||
    norm.includes('maxim') ||
    norm.includes('score')
  ) {
    matchedSections.push(
      `⚡ **Calculul Scorului & Departajarea:**\n` +
        `- **Răspuns corect:** **100 puncte de bază** + **bonus de viteză (0–100 puncte)** în funcție de cât timp ți-a rămas.\n` +
        `- Serverul scade automat **250 ms grație de rețea** (ca să nu pierzi puncte din cauza conexiunii).\n` +
        `- **Maxim pe întrebare:** 200 puncte → **Maxim pe zi:** **1.200 puncte**.\n` +
        `- **Greșit sau timp expirat:** 0 puncte.\n` +
        `- **La egalitate de puncte:** câștigă jucătorul cu **timpul total mai mic** măsurat pe server!`,
    );
  }

  // 7. EMOJIS & SHARE CARD ("Ce inseamna emoji?", "Fulger", "Share")
  if (
    norm.includes('emoji') ||
    norm.includes('fulger') ||
    norm.includes('patrat') ||
    norm.includes('⚡') ||
    norm.includes('🟩') ||
    norm.includes('🟥') ||
    norm.includes('share') ||
    norm.includes('spoiler')
  ) {
    matchedSections.push(
      `🃏 **Semnificația Emoji-urilor de pe Cardul de Share:**\n` +
        `- **⚡ (Fulger Volt):** Răspuns corect și **ultra-rapid** (ai răspuns când mai aveai peste **60% din timp** disponibil!).\n` +
        `- **🟩 (Verde):** Răspuns corect în limita de timp.\n` +
        `- **🟥 (Roșu):** Răspuns greșit sau timp expirat.\n` +
        `Cardul nu conține niciodată textul întrebărilor sau răspunsurile, ca să îl poți pune pe grup fără spoilere!`,
    );
  }

  // 8. LEAGUES, HIDDEN SCORES & WEEKLY TROPHY ("Ligi", "Grup", "De ce nu vad scorurile?", "Trofeu")
  if (
    norm.includes('lig') ||
    norm.includes('grup') ||
    norm.includes('prieten') ||
    norm.includes('clasament') ||
    norm.includes('ascuns') ||
    norm.includes('nu vad scor') ||
    norm.includes('trofeu') ||
    norm.includes('saptaman') ||
    norm.includes('cod') ||
    norm.includes('invit') ||
    norm.includes('league')
  ) {
    matchedSections.push(
      `🏆 **Ligi, Clasamente & Trofeul Săptămânal:**\n` +
        `- **Creare automată:** După ce termini runda, apasă **„Trimite pe grup”** — se creează instant o ligă cu un cod unic de 6 caractere (\`/l/COD\`).\n` +
        `- **De ce sunt ascunse scorurile de azi?** În tabul **Azi**, vezi cine a jucat, dar scorurile lor apar ca **„—”** până când termini și tu runda de azi (regulă anti-spoiler & anti-cheat).\n` +
        `- **Trofeul Săptămânal 🏆:** Săptămâna ține de Luni 00:00 până Duminică 23:59. Cel mai mare scor cumulat câștigă trofeul săptămânii!\n` +
        `- **Limite:** Gratuit poți crea până la **3 ligi** (cu max **25 membri/ligă**) și intra în 10 ligi. Cu **Pro**, ligile urcă la **200 de membri**!`,
    );
  }

  // 9. 1v1 DUELS ("Duel", "1v1", "Provocare", "24h", "Walkover")
  if (
    norm.includes('duel') ||
    norm.includes('1v1') ||
    norm.includes('provoc') ||
    norm.includes('adversar') ||
    norm.includes('walkover') ||
    norm.includes('24h') ||
    norm.includes('24 de ore')
  ) {
    matchedSections.push(
      `⚔️ **Dueluri 1v1 Asincrone:**\n` +
        `- Orice membru poate porni un duel 1v1 (din ecranul de rezultat sau scriindu-mi aici *„Creează un duel”*).\n` +
        `- Conține **5 întrebări** extrase separat din bancă (nu se suprapun niciodată cu runda zilnică de azi!).\n` +
        `- Fiecare jucător are **24 de ore** să își joace tura. Dacă adversarul nu joacă în 24h după ce ai terminat tu, câștigi prin **walkover (neprezentare)**.\n` +
        `- Se păstrează automat scorul direct **W–L (Victorii–Înfrângeri)** între voi!`,
    );
  }

  // 10. STREAKS, SHIELD & MIDNIGHT RESET ("Serie", "Streak", "Scut", "Miezul noptii", "Cand apare runda")
  if (
    norm.includes('seri') ||
    norm.includes('streak') ||
    norm.includes('scut') ||
    norm.includes('shield') ||
    norm.includes('reset') ||
    norm.includes('miezul noptii') ||
    norm.includes('cand apare') ||
    norm.includes('de doua ori') ||
    norm.includes('ies din')
  ) {
    matchedSections.push(
      `🔥 **Seria Zilnică (Streak), Scutul & Resetul la Miezul Nopții:**\n` +
        `- **Serie (Streak):** Crește cu **+1** în fiecare zi consecutivă în care termini runda. Dacă sari o zi, revine la 0.\n` +
        `- **Scutul de serie (Pro):** Abonații **RonDuel Pro** primesc **1 scut automat pe săptămână** care îți salvează seria dacă ratezi o zi!\n` +
        `- **Reset:** Runda nouă se deblochează la **miezul nopții în fusul tău orar local**.\n` +
        `- **Dacă părăsești pagina în timpul jocului:** Încercarea nu se resetează — întrebarea curentă expiră, iar când revii continui de la următoarea întrebare.`,
    );
  }

  // 11. RONDUEL PRO & PRICING ("Pro", "Pret", "Cat costa", "Gratis", "Teme", "Abonament")
  if (
    norm.includes('pro') ||
    norm.includes('pret') ||
    norm.includes('costa') ||
    norm.includes('gratis') ||
    norm.includes('gratuit') ||
    norm.includes('abonament') ||
    norm.includes('stripe') ||
    norm.includes('teme') ||
    norm.includes('theme')
  ) {
    matchedSections.push(
      `✨ **E gratuit? Ce oferă RonDuel Pro?**\n` +
        `- **Jocul de bază este 100% gratuit și fără reclame** care să întrerupă jocul!\n` +
        `- **RonDuel Pro ($4.99/lună sau $39.99/an — economisești 33%):**\n` +
        `  • Ligi de până la **200 de membri** (față de 25 gratuit)\n` +
        `  • **Dueluri 1v1 nelimitate** (față de 3 active gratuit)\n` +
        `  • **1 Scut automat de serie** pe săptămână\n` +
        `  • **Statistici de acuratețe pe teme** în Profil (\`/me\`)\n` +
        `  • **3 teme vizuale Pro** în Setări (\`/settings\`): *Midnight Court*, *Clay Court*, *Neon Arcade*.`,
    );
  }

  // 12. ACCOUNT, PWA INSTALL, NOTIFICATIONS & GDPR ("Cont", "Email", "Google", "Instalare", "Telefon", "Stergere", "GDPR")
  if (
    norm.includes('cont') ||
    norm.includes('email') ||
    norm.includes('google') ||
    norm.includes('instal') ||
    norm.includes('telefon') ||
    norm.includes('aplicati') ||
    norm.includes('pwa') ||
    norm.includes('notific') ||
    norm.includes('sterg') ||
    norm.includes('export') ||
    norm.includes('gdpr') ||
    norm.includes('datele')
  ) {
    matchedSections.push(
      `📱 **Cont, Instalare pe Telefon (PWA), Notificări & GDPR:**\n` +
        `- **Salvare cont (\`/me\`):** Îți poți conecta oricând sesiunea anonimă cu **Email Magic Link** sau **Google** — îți păstrezi \`uid\`-ul, seria și toate ligile!\n` +
        `- **Instalare pe telefon (Add to Home Screen):** RonDuel este un PWA. Pe Android și iOS îl poți adăuga pe ecranul principal pentru rulare full-screen și notificări **Web Push** (maxim 2 notificări/zi, la ora 18:00 locală dacă nu ai jucat încă).\n` +
        `- **GDPR & Confidențialitate (\`/settings\`):** Poți descărca toate datele tale în format **JSON** sau îți poți șterge complet contul cu un singur click.`,
    );
  }

  if (matchedSections.length > 0) {
    return {
      reply: matchedSections.join('\n\n---\n\n'),
      actionLink: !todayStatus.played
        ? { label: '▶️ Joacă runda de azi', href: `/${loc}/play` }
        : undefined,
    };
  }

  // Fallback comprehensive overview if the user typed a greeting or general question
  const profileSummary = uid ? getUserProfile(uid) : null;
  const greetingName = profileSummary?.nickname || nickname || 'Campionule';

  return {
    reply:
      `Salut, **${greetingName}**! Sunt **RonBot ⚡**, ghidul tău din arena RonDuel!\n\n` +
      `Iată pe scurt **cum se joacă**:\n` +
      `• În fiecare zi ai **o rundă de 6 întrebări** (~60 secunde): 2 Grilă (10s), 1 Ordonare (15s), 1 Intrus (10s) și 2 Logică (15s).\n` +
      `• Fiecare răspuns corect îți aduce **100p bază + până la 100p bonus de viteză** (maxim **1.200p/zi**).\n` +
      `• După rundă, apeși **„Trimite pe grup”** pentru a crea automat o **ligă cu prietenii** sau pornești un **Duel 1v1** de 5 întrebări!\n\n` +
      `Întreabă-mă orice detaliu (ex: *„Cum se calculează scorul?”*, *„De ce sunt ascunse scorurile în ligă?”*, *„Ce înseamnă ⚡🟩🟥?”*, *„Care e statusul meu azi?”* sau *„Creează un duel”*)!`,
    actionLink: !todayStatus.played
      ? { label: '▶️ Joacă runda de azi', href: `/${loc}/play` }
      : undefined,
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

  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();

  if (apiKey) {
    try {
      const client = new GoogleGenAI({ apiKey });
      const todayStatus = getTodayStatus(params.uid ?? 'anon', tz);
      const liveContext =
        `\n[Live Player & Game Context: Today is ${todayStatus.date}, Round #${todayStatus.roundNumber}, Topic: "${todayStatus.topicOfTheDay}". ` +
        `Player nickname: "${params.nickname ?? 'Anonymous'}", Played today: ${todayStatus.played}, Current streak: ${todayStatus.streakCurrent} days, Best streak: ${todayStatus.streakBest} days, Leagues joined: ${todayStatus.leagues.length}.` +
        (adminActionResult
          ? ` Admin action just executed on server: ${adminActionResult.summary}.`
          : '') +
        `]`;

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
        actionLink: smartFallback.actionLink,
        adminActionResult,
      };
    } catch {
      // Fall back to the full built-in RonDuel engine
    }
  }

  return {
    reply: smartFallback.reply,
    mode: 'ronduel-engine',
    actionLink: smartFallback.actionLink,
    adminActionResult,
  };
}
