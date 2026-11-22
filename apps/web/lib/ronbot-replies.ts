import bg from '../messages/bg.json';
import cs from '../messages/cs.json';
import da from '../messages/da.json';
import de from '../messages/de.json';
import el from '../messages/el.json';
import en from '../messages/en.json';
import es from '../messages/es.json';
import et from '../messages/et.json';
import fi from '../messages/fi.json';
import fr from '../messages/fr.json';
import ga from '../messages/ga.json';
import hr from '../messages/hr.json';
import hu from '../messages/hu.json';
import it from '../messages/it.json';
import lt from '../messages/lt.json';
import lv from '../messages/lv.json';
import mt from '../messages/mt.json';
import nb from '../messages/nb.json';
import nl from '../messages/nl.json';
import pl from '../messages/pl.json';
import pt from '../messages/pt.json';
import ro from '../messages/ro.json';
import sk from '../messages/sk.json';
import sl from '../messages/sl.json';
import sv from '../messages/sv.json';
import uk from '../messages/uk.json';

type Catalog = { ronbot?: Record<string, string> };

const CATALOGS: Record<string, Catalog> = {
  bg,
  cs,
  da,
  de,
  el,
  en,
  es,
  et,
  fi,
  fr,
  ga,
  hr,
  hu,
  it,
  lt,
  lv,
  mt,
  nb,
  nl,
  pl,
  pt,
  ro,
  sk,
  sl,
  sv,
  uk,
};

const LOCALE_HINTS: Record<string, string[]> = {
  en: ['the', 'what', 'when', 'does', 'how', 'your', 'today', 'reset', 'score', 'play'],
  ro: ['cum', 'ce', 'este', 'sunt', 'azi', 'se', 'nu', 'pentru', 'runda', 'scor'],
  es: ['que', 'como', 'cuando', 'hoy', 'ronda', 'puntos', 'jugar', 'el', 'una'],
  pt: ['como', 'quando', 'hoje', 'rodada', 'pontos', 'jogar', 'uma', 'voce'],
  de: ['wie', 'wann', 'heute', 'runde', 'punkte', 'spielen', 'nicht', 'eine'],
  fr: ['comment', 'quand', 'aujourd', 'manche', 'points', 'jouer', 'une', 'est'],
  it: ['come', 'quando', 'oggi', 'turno', 'punti', 'giocare', 'una', 'che'],
  nl: ['hoe', 'wanneer', 'vandaag', 'ronde', 'punten', 'spelen', 'een', 'niet'],
  pl: ['jak', 'kiedy', 'dzis', 'runda', 'punkty', 'grac', 'czy', 'nie'],
  cs: ['jak', 'kdy', 'dnes', 'kolo', 'body', 'hrat', 'co', 'neni'],
  sk: ['ako', 'kedy', 'dnes', 'kolo', 'body', 'hrat', 'co', 'nie'],
  bg: ['kak', 'koga', 'dnes', 'runda', 'tochki'],
  uk: ['yak', 'koly', 'sogodni', 'raund', 'bali'],
  el: ['pos', 'pote', 'simera', 'gyros', 'pontoi'],
  hu: ['hogyan', 'mikor', 'ma', 'kor', 'pont', 'jatsz'],
  fi: ['miten', 'milloin', 'tanaan', 'kierros', 'pisteet'],
  sv: ['hur', 'nar', 'idag', 'runda', 'poang', 'spela'],
  da: ['hvordan', 'hvornar', 'runde', 'point', 'spille'],
  nb: ['hvordan', 'nar', 'runde', 'poeng', 'spille'],
  et: ['kuidas', 'millal', 'tana', 'voor', 'punktid'],
  lv: ['ka', 'kad', 'sodien', 'raunds', 'punkti'],
  lt: ['kaip', 'kada', 'siandien', 'raundas', 'taskai'],
  hr: ['kako', 'kad', 'danas', 'runda', 'bodovi'],
  sl: ['kako', 'kdaj', 'danes', 'krog', 'tocke'],
  ga: ['conas', 'cathain', 'inniu', 'babhta', 'pointi'],
  mt: ['kif', 'meta', 'illum', 'rawnd', 'punti'],
};

export type RonbotIntent =
  | 'createDuel'
  | 'createLeague'
  | 'reset'
  | 'status'
  | 'score'
  | 'whatIs'
  | 'howTo'
  | 'emoji'
  | 'duelInfo'
  | 'league'
  | 'streak'
  | 'account'
  | 'pro'
  | 'fallback';

export type RonbotAction = 'play' | 'pro' | 'result';

export interface RonbotAnswerContext {
  nickname?: string;
  date?: string;
  roundNumber?: number | string;
  topic?: string;
  played?: boolean;
  score?: number | string;
  emojiLine?: string;
  streakCurrent?: number | string;
  streakBest?: number | string;
  leagues?: number | string;
  wantsDetail?: boolean;
}

export function normalizeRonbotText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ș/g, 's')
    .replace(/ț/g, 't')
    .trim();
}

function scoreLocale(norm: string, words: string[]): number {
  const tokens = new Set(norm.split(/[^a-z0-9]+/).filter(Boolean));
  let score = 0;
  for (const word of words) {
    if (!word) continue;
    if (word.includes(' ')) {
      if (norm.includes(word)) score += 2;
    } else if (tokens.has(word)) {
      score += 1;
    }
  }
  return score;
}

export function detectMessageLocale(message: string, fallback: string): string {
  if (/[іїєґІЇЄҐ]/.test(message)) return 'uk';
  if (/[ъЪ]/.test(message)) return 'bg';
  if (/[\u0400-\u04FF]/.test(message)) return fallback === 'bg' ? 'bg' : 'uk';
  if (/[\u0370-\u03FF]/.test(message)) return 'el';

  const norm = normalizeRonbotText(message);
  let best = fallback;
  let bestScore = 0;
  for (const [locale, words] of Object.entries(LOCALE_HINTS)) {
    if (!CATALOGS[locale]) continue;
    const score = scoreLocale(norm, words);
    if (score > bestScore) {
      bestScore = score;
      best = locale;
    }
  }
  return bestScore > 0 ? best : fallback;
}

export function tRonbot(
  locale: string,
  key: string,
  vars?: Record<string, string | number | undefined>,
): string {
  const primary = CATALOGS[locale]?.ronbot?.[key];
  const fallback = CATALOGS.en?.ronbot?.[key];
  let text = primary || fallback || key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, value == null ? '' : String(value));
    }
  }
  return text;
}

export function wantsRonbotDetail(message: string): boolean {
  const norm = normalizeRonbotText(message);
  return /detaliat|pe larg|pas cu pas|step by step|in detail|more detail|ausfuhrlich|en detalle|em detalhe/.test(
    norm,
  );
}

export function classifyRonbotIntent(message: string): RonbotIntent {
  const norm = normalizeRonbotText(message);
  if (/creeaza un duel|creeaza duel|start a duel|create a duel|provoaca/.test(norm))
    return 'createDuel';
  if (/creeaza o liga|fa o liga|create a league|nueva liga|criar uma liga/.test(norm))
    return 'createLeague';
  if (
    /reset|midnight|miezul noptii|what time|when does|que hora|que horas|a quelle heure|a che ora|wann |cand apare|cand se reseteaza|la ce ora/.test(
      norm,
    )
  ) {
    return 'reset';
  }
  if (
    /scorul meu|seria mea|statusul meu|am jucat|my score|my status|runda de azi|my streak|status today/.test(
      norm,
    )
  ) {
    return 'status';
  }
  if (/scor|score|puncte|punct|points|point|bonus/.test(norm)) return 'score';
  if (
    /ce e ronduel|ce este ronduel|what is ronduel|whats ronduel|what's ronduel|que es ronduel|o que e ronduel|was ist ronduel/.test(
      norm,
    )
  ) {
    return 'whatIs';
  }
  if (
    /cum se joaca|cum joc|how to play|how do i play|como se juega|comment jouer|come si gioca|regulile|the rules/.test(
      norm,
    )
  ) {
    return 'howTo';
  }
  if (
    /emoji|fulger|spoiler|share card|patrat/.test(norm) ||
    message.includes('⚡') ||
    message.includes('🟩')
  ) {
    return 'emoji';
  }
  if (/\bduel\b|1v1|provoc|walkover/.test(norm)) return 'duelInfo';
  if (/\blig|\bleague|clasament|trofeu|invitat|invite code/.test(norm)) return 'league';
  if (/streak|seria|scut|shield|miezul/.test(norm)) return 'streak';
  if (/\bcont\b|account|gdpr|notific|pwa|instal/.test(norm)) return 'account';
  if (/(^|[^a-z])pro([^a-z]|$)|abonament|subscription|\bpret\b|pricing|cat costa/.test(norm))
    return 'pro';
  return 'fallback';
}

export function renderRonbotAnswer(
  intent: RonbotIntent,
  locale: string,
  ctx: RonbotAnswerContext = {},
): { reply: string; action?: RonbotAction } {
  const t = (key: string, vars?: Record<string, string | number | undefined>) =>
    tRonbot(locale, key, vars);
  const name = ctx.nickname?.trim() || t('guestName');

  switch (intent) {
    case 'whatIs':
      return { reply: t('replyWhatIs') };
    case 'reset':
      return { reply: t('replyReset') };
    case 'score':
      return { reply: t('replyScore') };
    case 'howTo':
      return {
        reply: ctx.wantsDetail ? t('replyHowToDetail') : t('replyHowTo'),
        action: ctx.played ? undefined : 'play',
      };
    case 'pro':
      return { reply: t('replyPro'), action: 'pro' };
    case 'emoji':
      return { reply: t('replyEmoji') };
    case 'league':
    case 'createLeague':
      return { reply: t('replyLeague') };
    case 'duelInfo':
    case 'createDuel':
      return { reply: t('replyDuel') };
    case 'streak':
      return { reply: t('replyStreak') };
    case 'account':
      return { reply: t('replyAccount') };
    case 'status':
      if (ctx.played) {
        return {
          reply: t('replyStatusPlayed', {
            date: ctx.date ?? '',
            round: ctx.roundNumber ?? '',
            topic: ctx.topic ?? '',
            score: ctx.score ?? '',
            emoji: ctx.emojiLine ?? '',
            streak: ctx.streakCurrent ?? 0,
            best: ctx.streakBest ?? 0,
            leagues: ctx.leagues ?? 0,
          }),
          action: 'result',
        };
      }
      return {
        reply: t('replyStatusPending', {
          date: ctx.date ?? '',
          round: ctx.roundNumber ?? '',
          topic: ctx.topic ?? '',
          streak: ctx.streakCurrent ?? 0,
          best: ctx.streakBest ?? 0,
        }),
        action: 'play',
      };
    default:
      return { reply: t('replyFallback', { name }) };
  }
}

export function answerRonbotQuestion(
  message: string,
  pageLocale: string,
  ctx: RonbotAnswerContext = {},
) {
  const locale = detectMessageLocale(message, pageLocale);
  const intent = classifyRonbotIntent(message);
  const rendered = renderRonbotAnswer(intent, locale, {
    ...ctx,
    wantsDetail: ctx.wantsDetail || wantsRonbotDetail(message),
  });
  return { locale, intent, ...rendered };
}
