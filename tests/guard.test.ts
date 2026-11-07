import { describe, expect, it } from 'vitest';
import { allow, resetLimits, signSpeech, verifySpeech } from '../server/guard';

describe('public deployment protection', () => {
  it('speaks only text the server signed, for that language', () => {
    const token = signSpeech('bn', 'আনোয়ার, পানি পান করুন।');
    expect(verifySpeech('bn', 'আনোয়ার, পানি পান করুন।', token)).toBe(true);
    expect(verifySpeech('bn', 'Any other text', token)).toBe(false);
    expect(verifySpeech('ml', 'আনোয়ার, পানি পান করুন।', token)).toBe(false);
    expect(verifySpeech('bn', 'আনোয়ার, পানি পান করুন।', 'forged')).toBe(false);
  });

  it('limits each visitor separately and recovers after the window', () => {
    resetLimits();
    const t = 1_000_000;
    for (let i = 0; i < 6; i++) expect(allow('planner', 'a', t)).toBe(true);
    expect(allow('planner', 'a', t)).toBe(false);
    expect(allow('planner', 'b', t)).toBe(true);
    expect(allow('planner', 'a', t + 10 * 60_000 + 1)).toBe(true);
  });
});
