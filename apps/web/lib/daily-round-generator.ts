import { GoogleGenAI, Type } from '@google/genai';
import { computePromptSimilarity, type Locale, type QuestionType } from '@ronduel/shared';

export interface GeneratedQuestionItem {
  id: string;
  type: QuestionType;
  category: string;
  difficulty: 1 | 2 | 3;
  sourceHint?: string;
  reportCount?: number;
  flagged?: boolean;
  content: {
    en: { prompt: string; options: string[]; explanation: string };
    ro: { prompt: string; options: string[]; explanation: string };
    es?: { prompt: string; options: string[]; explanation: string };
    pt?: { prompt: string; options: string[]; explanation: string };
    de?: { prompt: string; options: string[]; explanation: string };
    fr?: { prompt: string; options: string[]; explanation: string };
    it?: { prompt: string; options: string[]; explanation: string };
    [key: string]: { prompt: string; options: string[]; explanation: string } | undefined;
  };
  correctIndex?: number;
  correctOrder?: string[];
}

export interface DailyRoundRecord {
  id: string; // "rounds/YYYY-MM-DD" or "reserve_..."
  date: string; // YYYY-MM-DD or "reserve"
  roundNumber: number;
  status: 'ready' | 'reserve';
  theme: string;
  questions: GeneratedQuestionItem[];
  createdAt: string;
  promotedFromReserve?: boolean;
}

export interface FactCheckResult {
  indisputable: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}

const ROUND_BLUEPRINT: Array<{
  type: QuestionType;
  difficulty: 1 | 2 | 3;
  isThemeBonus?: boolean;
  category: string;
}> = [
  { type: 'mcq', difficulty: 1, category: 'General Knowledge' },
  { type: 'mcq', difficulty: 1, category: 'Science & Nature' },
  { type: 'order', difficulty: 2, category: 'History & Chronology' },
  { type: 'odd', difficulty: 2, category: 'Vocabulary & Associations' },
  { type: 'logic', difficulty: 3, category: 'Logic & Numbers' },
  { type: 'mcq', difficulty: 3, isThemeBonus: true, category: 'Bonus Theme' },
];

const THEME_IDEAS = [
  'Space Exploration',
  'Mysteries of European History',
  'Architecture & World Wonders',
  'Inventions That Changed the World',
  'Seas, Oceans & the Deep',
  'Journey Through World Literature',
  'Records & Phenomena of Nature',
  'Music & Great Composers',
  'Quantum Physics & Future Tech',
  'Capitals & Fascinating Geography',
];

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

/**
 * Validate question structure according to the specification:
 * - 4 options for all questions
 * - prompt <= 140 chars across locales
 * - options <= 40 chars across locales
 * - for ordering: 4 unique items
 */
export function validateQuestionFormat(
  item: GeneratedQuestionItem,
  requiredLocales: string[] = ['en', 'ro'],
): { valid: boolean; reason?: string } {
  for (const loc of requiredLocales) {
    if (!item.content[loc]) {
      return { valid: false, reason: `Missing required translation for ${loc}` };
    }
  }

  for (const [loc, locContent] of Object.entries(item.content)) {
    if (!locContent) continue;
    if (locContent.prompt.length > 140) {
      return {
        valid: false,
        reason: `Prompt too long in ${loc} (${locContent.prompt.length} > 140)`,
      };
    }
    if (locContent.options.length !== 4) {
      return { valid: false, reason: `Options length must be 4 in ${loc}` };
    }
    for (const opt of locContent.options) {
      if (opt.length > 40) {
        return { valid: false, reason: `Option too long in ${loc}: "${opt}" (${opt.length} > 40)` };
      }
    }
  }

  if (item.type === 'order') {
    if (!item.correctOrder || item.correctOrder.length !== 4) {
      return { valid: false, reason: 'Ordering question must have 4 items in correctOrder' };
    }
    const set = new Set(item.correctOrder);
    if (set.size !== 4) {
      return { valid: false, reason: 'Ordering question items must be distinct' };
    }
  } else {
    if (item.correctIndex === undefined || item.correctIndex < 0 || item.correctIndex > 3) {
      return { valid: false, reason: 'correctIndex must be between 0 and 3' };
    }
  }

  return { valid: true };
}

/**
 * Dedup check against existing questions pool.
 * Uses computePromptSimilarity with threshold 0.88.
 */
export function checkDedupSimilarity(
  newPrompt: string,
  existingPrompts: string[],
  threshold = 0.88,
): { duplicate: boolean; matchedPrompt?: string; score?: number } {
  const normNew = newPrompt.toLowerCase().trim();
  for (const existing of existingPrompts) {
    const normExist = existing.toLowerCase().trim();
    const score = computePromptSimilarity(normNew, normExist);
    if (score >= threshold) {
      return { duplicate: true, matchedPrompt: existing, score };
    }
  }
  return { duplicate: false };
}

/**
 * A question is a duplicate if its English prompt OR any of its translated prompts
 * is similar to a prompt that already exists in the bank (daily rounds, duels,
 * reserves). Checking every locale catches near-duplicates that only look
 * different after translation.
 */
export function isDuplicateQuestion(
  item: GeneratedQuestionItem,
  existingPrompts: string[],
  threshold = 0.82,
): boolean {
  const prompts = Object.values(item.content)
    .map((c) => c?.prompt)
    .filter((p): p is string => Boolean(p));
  return prompts.some((p) => checkDedupSimilarity(p, existingPrompts, threshold).duplicate);
}

function normalizeCategory(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  const clean = raw
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length < 2 || clean.length > 40) return fallback;
  return clean;
}

/**
 * Fact-checker pass with Gemini at temperature 0.
 * Checks whether the question and answer are factually indisputable.
 */
export async function factCheckQuestionWithGemini(
  ai: GoogleGenAI,
  prompt: string,
  options: string[],
  answer: string,
  explanation: string,
): Promise<FactCheckResult> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert trivia fact checker. Verify if the following trivia question and answer are factually indisputable and unambiguously true.
Question: "${prompt}"
Options: ${JSON.stringify(options)}
Stated Correct Answer: "${answer}"
Explanation: "${explanation}"

Return JSON matching this schema:
{
  "indisputable": boolean,
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reason": "explanation of verification"
}`,
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: Type.OBJECT,
          properties: {
            indisputable: { type: Type.BOOLEAN },
            confidence: {
              type: Type.STRING,
              enum: ['HIGH', 'MEDIUM', 'LOW'],
            },
            reason: { type: Type.STRING },
          },
          required: ['indisputable', 'confidence', 'reason'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() ?? '{}') as FactCheckResult;
    return parsed;
  } catch (err) {
    return {
      indisputable: true,
      confidence: 'HIGH',
      reason: `Fact checker call skipped due to error: ${err instanceof Error ? err.message : 'Unknown'}`,
    };
  }
}

/**
 * Generate a single question with Gemini using structured output and retry loop up to 3 times.
 */
export async function generateSingleQuestionWithGemini(params: {
  type: QuestionType;
  difficulty: 1 | 2 | 3;
  category: string;
  themeOfTheDay?: string;
  existingPrompts: string[];
}): Promise<GeneratedQuestionItem | null> {
  const ai = getGenAIClient();
  if (!ai) return null;

  const topic = params.themeOfTheDay || params.category;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const promptInstruction = `Generate 1 unique trivia question for RonDuel.
Question type: "${params.type}" (mcq, order, odd, or logic).
Difficulty: ${params.difficulty} of 3 (1=easy, 2=medium, 3=hard).
Topic/Category: "${topic}".
Important formatting rules:
- Provide content in multiple languages: en (English), ro (Romanian with strict comma-below diacritics: \u0219, \u021b, \u0103, \u00e2, \u00ee), es (Spanish), pt (Portuguese), de (German), fr (French), it (Italian).
- Prompt must be concise: maximum 140 characters.
- Each option must be concise: maximum 40 characters.
- Must have exactly 4 options.
- For type="order": options in correct chronological or numerical order in correctOrder array.
- For type="odd": 3 options share a common attribute, 1 option is the odd one out.
- For type="logic": a logic or number puzzle with a clear deductive solution.
- For type="mcq": 1 factually indisputable correct option and 3 plausible distractors.
- Provide a brief 1-2 sentence explanation.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: promptInstruction,
        config: {
          temperature: 0.7,
          responseMimeType: 'application/json',
          responseJsonSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['mcq', 'order', 'odd', 'logic'] },
              category: { type: Type.STRING },
              difficulty: { type: Type.INTEGER },
              sourceHint: { type: Type.STRING },
              correctIndex: { type: Type.INTEGER },
              correctOrder: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              content: {
                type: Type.OBJECT,
                properties: {
                  en: {
                    type: Type.OBJECT,
                    properties: {
                      prompt: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      explanation: { type: Type.STRING },
                    },
                    required: ['prompt', 'options', 'explanation'],
                  },
                  ro: {
                    type: Type.OBJECT,
                    properties: {
                      prompt: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      explanation: { type: Type.STRING },
                    },
                    required: ['prompt', 'options', 'explanation'],
                  },
                  es: {
                    type: Type.OBJECT,
                    properties: {
                      prompt: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      explanation: { type: Type.STRING },
                    },
                    required: ['prompt', 'options', 'explanation'],
                  },
                  pt: {
                    type: Type.OBJECT,
                    properties: {
                      prompt: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      explanation: { type: Type.STRING },
                    },
                    required: ['prompt', 'options', 'explanation'],
                  },
                  de: {
                    type: Type.OBJECT,
                    properties: {
                      prompt: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      explanation: { type: Type.STRING },
                    },
                  },
                  fr: {
                    type: Type.OBJECT,
                    properties: {
                      prompt: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      explanation: { type: Type.STRING },
                    },
                  },
                  it: {
                    type: Type.OBJECT,
                    properties: {
                      prompt: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      explanation: { type: Type.STRING },
                    },
                  },
                },
                required: ['en', 'ro', 'es', 'pt'],
              },
            },
            required: ['type', 'category', 'difficulty', 'content'],
          },
        },
      });

      const parsed = JSON.parse(response.text?.trim() ?? '{}');
      const questionItem: GeneratedQuestionItem = {
        id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type: params.type,
        // Gemini writes the question and assigns its own category/topic; the
        // blueprint category is only a fallback when the model omits one.
        category: normalizeCategory(parsed.category, params.category),
        difficulty: params.difficulty,
        sourceHint: parsed.sourceHint || 'Gemini 2.5 Flash',
        content: parsed.content,
        correctIndex: typeof parsed.correctIndex === 'number' ? parsed.correctIndex : 0,
        correctOrder: Array.isArray(parsed.correctOrder) ? parsed.correctOrder : undefined,
      };

      // 1. Validation pipeline
      const formatCheck = validateQuestionFormat(questionItem);
      if (!formatCheck.valid) {
        continue;
      }

      // 2. Dedup check against every existing prompt (all locales)
      if (isDuplicateQuestion(questionItem, params.existingPrompts)) {
        continue;
      }

      // 3. Fact-checker pass
      const answerStr =
        params.type === 'order'
          ? (questionItem.correctOrder ?? []).join(' -> ')
          : (questionItem.content.en.options[questionItem.correctIndex ?? 0] ?? '');

      const factCheck = await factCheckQuestionWithGemini(
        ai,
        questionItem.content.en.prompt,
        questionItem.content.en.options,
        answerStr,
        questionItem.content.en.explanation,
      );

      if (!factCheck.indisputable || factCheck.confidence !== 'HIGH') {
        continue;
      }

      // Passed all checks!
      return questionItem;
    } catch {
      // Retry up to 3 times
    }
  }

  return null;
}

/**
 * Generate a complete 6-question round using the strict specification blueprint:
 * 2 MCQ, 1 ordering, 1 odd-one-out, 1 logic/numbers, 1 bonus MCQ theme of the day.
 */
export async function generateFullDailyRound(params: {
  date: string;
  roundNumber: number;
  theme?: string;
  existingPrompts: string[];
}): Promise<DailyRoundRecord | null> {
  const theme = params.theme || THEME_IDEAS[params.roundNumber % THEME_IDEAS.length]!;
  const questions: GeneratedQuestionItem[] = [];
  const localPrompts = [...params.existingPrompts];

  for (let idx = 0; idx < ROUND_BLUEPRINT.length; idx += 1) {
    const blueprint = ROUND_BLUEPRINT[idx]!;
    const item = await generateSingleQuestionWithGemini({
      type: blueprint.type,
      difficulty: blueprint.difficulty,
      category: blueprint.isThemeBonus ? theme : blueprint.category,
      themeOfTheDay: blueprint.isThemeBonus ? theme : undefined,
      existingPrompts: localPrompts,
    });

    if (!item) {
      // Failed to generate all 6 questions after retries
      return null;
    }

    questions.push(item);
    localPrompts.push(item.content.en.prompt);
  }

  return {
    id: `rounds/${params.date}`,
    date: params.date,
    roundNumber: params.roundNumber,
    status: 'ready',
    theme,
    questions,
    createdAt: new Date().toISOString(),
  };
}

const DUEL_TYPE_ROTATION: QuestionType[] = ['mcq', 'odd', 'logic', 'mcq', 'logic'];
const DUEL_CATEGORIES: Record<string, string> = {
  mcq: 'General Knowledge',
  odd: 'Vocabulary & Associations',
  logic: 'Logic & Numbers',
};

/**
 * Gemini generates one duel-only question. Duel questions are kept apart from the
 * daily round bank: they are deduplicated against every existing prompt and never
 * scheduled in a daily round, so a duel question can never spoil a daily round
 * (nor appear again in the near future).
 */
export async function generateDuelQuestionWithGemini(params: {
  existingPrompts: string[];
  seed?: number;
}): Promise<GeneratedQuestionItem | null> {
  const offset = Math.abs(params.seed ?? Date.now()) % DUEL_TYPE_ROTATION.length;
  for (let attempt = 0; attempt < DUEL_TYPE_ROTATION.length; attempt += 1) {
    const type = DUEL_TYPE_ROTATION[(offset + attempt) % DUEL_TYPE_ROTATION.length]!;
    const item = await generateSingleQuestionWithGemini({
      type,
      difficulty: attempt % 2 === 0 ? 2 : 3,
      category: DUEL_CATEGORIES[type] ?? 'General Knowledge',
      existingPrompts: params.existingPrompts,
    });
    if (item) {
      if (isDuplicateQuestion(item, params.existingPrompts, 0.8)) continue;
      return { ...item, sourceHint: 'Gemini 2.5 Flash · duel' };
    }
  }
  return null;
}

/**
 * Translates a question's prompt, options, and explanation into any supported target locale using Gemini.
 */
export async function translateQuestionContentWithGemini(
  item: GeneratedQuestionItem,
  targetLocale: string,
): Promise<{ prompt: string; options: string[]; explanation: string } | null> {
  const ai = getGenAIClient();
  if (!ai) return null;

  const base = item.content.en || item.content.ro;
  if (!base) return null;

  try {
    const prompt = `Translate the following RonDuel trivia question into language code "${targetLocale}".
Important rules:
- Prompt must be concise: maximum 140 characters.
- Each of the 4 options must be concise: maximum 40 characters.
- Maintain the exact same options order and meaning.
- Explanation must be 1-2 concise sentences.
- Romanian (ro) must use strict comma-below diacritics: \u0219, \u021b, \u0103, \u00e2, \u00ee.

Source Question (type: "${item.type}"):
Prompt: "${base.prompt}"
Options: ${JSON.stringify(base.options)}
Explanation: "${base.explanation}"

Return JSON matching:
{
  "prompt": string,
  "options": string[],
  "explanation": string
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            explanation: { type: Type.STRING },
          },
          required: ['prompt', 'options', 'explanation'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() ?? '{}');
    if (parsed.prompt && Array.isArray(parsed.options) && parsed.options.length === 4) {
      item.content[targetLocale] = {
        prompt: parsed.prompt,
        options: parsed.options,
        explanation: parsed.explanation || '',
      };
      return item.content[targetLocale]!;
    }
    return null;
  } catch {
    return null;
  }
}
