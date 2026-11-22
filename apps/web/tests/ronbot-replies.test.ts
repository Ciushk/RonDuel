import { describe, expect, it } from 'vitest';

import { answerRonbotQuestion } from '../lib/ronbot-replies';

describe('RonBot answers', () => {
  it('answers an English reset question briefly in English', () => {
    const answer = answerRonbotQuestion('What time does the daily round reset?', 'ro', {});
    expect(answer.locale).toBe('en');
    expect(answer.intent).toBe('reset');
    expect(answer.reply.toLowerCase()).toContain('midnight');
    expect(answer.reply.split('\n').filter((line) => line.trim()).length).toBeLessThanOrEqual(6);
    expect(answer.action).toBeUndefined();
    expect(answer.reply).not.toMatch(/\bjoac/i);
  });

  it('describes RonDuel in a few sentences instead of the full how-to', () => {
    const answer = answerRonbotQuestion('Ce e RonDuel?', 'ro', {});
    expect(answer.locale).toBe('ro');
    expect(answer.intent).toBe('whatIs');
    expect(answer.reply).toContain('6');
    expect(answer.reply).not.toContain('10s');
    expect(answer.reply).not.toContain('**');
    expect(answer.action).toBeUndefined();
  });

  it('links Pro answers to RonDuel Pro and keeps the score answer in markdown', () => {
    const pro = answerRonbotQuestion('Ce oferă RonDuel Pro?', 'ro', {});
    expect(pro.intent).toBe('pro');
    expect(pro.locale).toBe('ro');
    expect(pro.action).toBe('pro');

    const score = answerRonbotQuestion('Cum se calculează scorul?', 'ro', {});
    expect(score.intent).toBe('score');
    expect(score.reply).toContain('**100**');
    expect(score.action).toBeUndefined();
  });

  it('shows the play action only when the answer is about playing today', () => {
    const pending = answerRonbotQuestion('Care e statusul meu azi?', 'ro', { played: false });
    expect(pending.action).toBe('play');
    const howTo = answerRonbotQuestion('Cum se joacă?', 'ro', { played: true });
    expect(howTo.action).toBeUndefined();
  });
});
