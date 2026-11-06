import { afterEach, describe, expect, it, vi } from 'vitest';
import { nioshLimitC, runShift, screenExposure, warningPerformance, type WarningPerformance } from '@heatline/sim';
import type { RunResult } from '@heatline/contracts';
import { goldenBranches, loadScenario } from './helpers/scenario';
import { crewSummaries, fallbackSafetyBrief, guardianContext } from '@heatline/agents';
import { askGuardian, askSafety } from '../apps/web/src/model';

const stats = (): WarningPerformance => ({ episodes: 0, detected: 0, simultaneous: 0, missed: 0, leftCensored: 0, rightCensored: 0, warningOnsets: 0, falseAlarms: 0, leadTimes: [] });
function fixture(psi: number[], warnings: number[]): RunResult {
  return { minutes: psi.map((value, minute) => ({ minute, truth: [{ worker: 'one', psi: value }], warnings: [{ worker: 'one', level: ['green', 'yellow', 'amber', 'red'][warnings[minute] ?? 0] }] })) } as RunResult;
}
afterEach(() => vi.unstubAllGlobals());

describe('warning outcome accounting', () => {
  it('does not count a simultaneous warning as advance detection', () => {
    const s = stats(); warningPerformance(fixture([2, 3, 7, 8], [0, 0, 2, 2]), s);
    expect(s).toMatchObject({ episodes: 1, detected: 0, simultaneous: 1, missed: 0, leadTimes: [] });
  });
  it('reports positive lead time and missed episodes separately', () => {
    const s = stats(); warningPerformance(fixture([2, 3, 7, 3, 7], [0, 2, 2, 0, 0]), s);
    expect(s.detected).toBe(2); expect(s.leadTimes).toEqual([1, 3]);
    const missed = stats(); warningPerformance(fixture([2, 7], [0, 0]), missed);
    expect(missed.missed).toBe(1);
  });
  it('excludes pre-existing strain and right-censored negative outcomes', () => {
    const s = stats(); warningPerformance(fixture([7, 7, 2, 2], [0, 0, 2, 2]), s);
    expect(s).toMatchObject({ leftCensored: 1, episodes: 0, rightCensored: 1, warningOnsets: 0, falseAlarms: 0 });
  });
  it('counts a false alert only with a full negative follow-up hour', () => {
    const s = stats(); warningPerformance(fixture(Array(61).fill(2), Array(61).fill(2)), s);
    expect(s).toMatchObject({ warningOnsets: 1, falseAlarms: 1, rightCensored: 0 });
  });
});

describe('independent occupational exposure screen', () => {
  it('matches the published NIOSH moderate-work example and lower unacclimatised limit', () => {
    expect(nioshLimitC(348.9, true)).toBeCloseTo(27.46, 1);
    expect(nioshLimitC(300, false)).toBeLessThan(nioshLimitC(300, true));
    expect(() => nioshLimitC(NaN, true)).toThrow();
  });
  it('exposes screening exceedances even when a demonstration plan passes', () => {
    const { scenario, changed } = goldenBranches();
    const screen = screenExposure(scenario, changed);
    expect(screen.assessedWindows).toBe((changed.minutes.length - 59) * scenario.workers.length);
    expect(screen.exceededWindows).toBeGreaterThan(0);
    expect(screen.incompleteWorkerMinutes).toBe(59 * scenario.workers.length);
  });
  it('varies hidden physiology without changing the environmental screening equations', () => {
    const scenario = loadScenario();
    const normal = runShift(scenario, { policy: 'baseline' });
    const stress = runShift(scenario, { policy: 'baseline', uncertainty: { truthHeatScale: 1.25 } });
    expect(stress.minutes[10]!.truth[0]!.coreC).toBeGreaterThan(normal.minutes[10]!.truth[0]!.coreC);
  });
});

describe('local warning continuity', () => {
  const { scenario, asPlayed } = goldenBranches();
  const ctx = guardianContext(scenario, asPlayed.minutes[20]!, 'anwar');
  it('does not report no action when crews need rest without amber or red alerts', () => {
    const crews = crewSummaries(scenario, asPlayed.minutes[10]!);
    expect(crews.some((c) => c.needRest > 0)).toBe(true);
    expect(fallbackSafetyBrief(crews).summary).not.toMatch(/No additional/);
  });
  it('does not call the network in offline mode or for emergency text', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect((await askGuardian(ctx, true)).source).toBe('rules');
    const emergency = await askGuardian({ ...ctx, action: 'emergency' });
    expect(emergency.english).toContain('first aid');
    expect(emergency.english).not.toMatch(/sip|drink/i);
    expect((await askSafety('15:20', [], true)).source).toBe('rules');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('falls back on actual network errors and HTTP failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect((await askGuardian(ctx)).source).toBe('rules');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    expect((await askSafety('15:20', [])).source).toBe('rules');
  });
});
