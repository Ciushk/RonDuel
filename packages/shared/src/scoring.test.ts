import { describe, expect, it } from 'vitest';

import {
  buildEmojiLine,
  computeItemScore,
  ITEM_TIME_LIMIT_MS,
  NETWORK_GRACE_MS,
} from './scoring.js';

describe('computeItemScore', () => {
  it('awards max 200 points and ⚡ at 0 ms elapsed', () => {
    const res = computeItemScore({ correct: true, elapsedMs: 0, limitMs: ITEM_TIME_LIMIT_MS.mcq });
    expect(res).toEqual({
      points: 200,
      effectiveElapsedMs: 0,
      timedOut: false,
      emoji: '⚡',
    });
  });

  it('applies 250 ms network grace period cleanly', () => {
    const res = computeItemScore({
      correct: true,
      elapsedMs: NETWORK_GRACE_MS,
      limitMs: ITEM_TIME_LIMIT_MS.mcq,
    });
    expect(res.effectiveElapsedMs).toBe(0);
    expect(res.points).toBe(200);
    expect(res.emoji).toBe('⚡');
  });

  it('awards 100 base points at exact limit after grace', () => {
    const res = computeItemScore({
      correct: true,
      elapsedMs: ITEM_TIME_LIMIT_MS.mcq + NETWORK_GRACE_MS,
      limitMs: ITEM_TIME_LIMIT_MS.mcq,
    });
    expect(res).toEqual({
      points: 100,
      effectiveElapsedMs: 10_000,
      timedOut: false,
      emoji: '🟩',
    });
  });

  it('marks timedOut and awards 0 points when over limit', () => {
    const res = computeItemScore({
      correct: true,
      elapsedMs: ITEM_TIME_LIMIT_MS.mcq + NETWORK_GRACE_MS + 1,
      limitMs: ITEM_TIME_LIMIT_MS.mcq,
    });
    expect(res).toEqual({
      points: 0,
      effectiveElapsedMs: 10_001,
      timedOut: true,
      emoji: '🟥',
    });
  });

  it('awards 0 points and 🟥 for wrong answer within limit', () => {
    const res = computeItemScore({
      correct: false,
      elapsedMs: 2_000,
      limitMs: ITEM_TIME_LIMIT_MS.order,
    });
    expect(res.points).toBe(0);
    expect(res.timedOut).toBe(false);
    expect(res.emoji).toBe('🟥');
  });

  it('builds spoiler-free emoji line', () => {
    expect(
      buildEmojiLine([{ emoji: '⚡' }, { emoji: '🟩' }, { emoji: '🟥' }, { emoji: '⚡' }]),
    ).toBe('⚡🟩🟥⚡');
  });
});
