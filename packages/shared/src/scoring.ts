import { z } from 'zod';

export const LOCALES = [
  'ro', 'en', 'es', 'pt', 'de', 'fr', 'it', 'nl', 'pl', 'bg',
  'cs', 'da', 'el', 'et', 'fi', 'ga', 'hr', 'hu', 'lt', 'lv',
  'mt', 'nb', 'sk', 'sl', 'sv', 'uk',
] as const;
export type Locale = (typeof LOCALES)[number];

export const QUESTION_TYPES = ['mcq', 'order', 'odd', 'logic'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const ITEM_TIME_LIMIT_MS: Record<QuestionType, number> = {
  mcq: 30_000,
  odd: 30_000,
  order: 30_000,
  logic: 30_000,
};

export const NETWORK_GRACE_MS = 250;
export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 100;
export const FAST_THRESHOLD_RATIO = 0.6; // > 60% of time left => ⚡

export const ScoreInputSchema = z.object({
  correct: z.boolean(),
  elapsedMs: z.number().min(0),
  limitMs: z.number().positive(),
});

export type ScoreInput = z.infer<typeof ScoreInputSchema>;

export interface ScoreResult {
  points: number;
  effectiveElapsedMs: number;
  timedOut: boolean;
  emoji: '⚡' | '🟩' | '🟥';
}

/**
 * Computes server-side points for a single item per §2.3:
 * - effectiveElapsed = max(0, elapsedMs - 250ms)
 * - If effectiveElapsed > limitMs => timedOut: true, 0 points
 * - If correct => 100 + round(100 * max(0, (limit - effectiveElapsed) / limit))
 * - Emoji: ⚡ if correct with > 60% of time left, 🟩 if correct, 🟥 otherwise.
 *
 * Future partial-credit note for 'order' items:
 * In v1 ordering is all-or-nothing. To add partial credit later, pass a
 * `matchRatio` in [0, 1] (e.g. Kendall tau or longest increasing subsequence)
 * and scale `BASE_POINTS` by `matchRatio` while gating speed bonus on full match.
 */
export function computeItemScore(input: ScoreInput): ScoreResult {
  const effectiveElapsedMs = Math.max(0, input.elapsedMs - NETWORK_GRACE_MS);

  if (effectiveElapsedMs > input.limitMs) {
    return {
      points: 0,
      effectiveElapsedMs,
      timedOut: true,
      emoji: '🟥',
    };
  }

  if (!input.correct) {
    return {
      points: 0,
      effectiveElapsedMs,
      timedOut: false,
      emoji: '🟥',
    };
  }

  const remainingRatio = Math.max(0, (input.limitMs - effectiveElapsedMs) / input.limitMs);
  const speedBonus = Math.round(MAX_SPEED_BONUS * remainingRatio);
  const emoji: '⚡' | '🟩' = remainingRatio > FAST_THRESHOLD_RATIO ? '⚡' : '🟩';

  return {
    points: BASE_POINTS + speedBonus,
    effectiveElapsedMs,
    timedOut: false,
    emoji,
  };
}

export function buildEmojiLine(results: ReadonlyArray<Pick<ScoreResult, 'emoji'>>): string {
  return results.map((r) => r.emoji).join('');
}
