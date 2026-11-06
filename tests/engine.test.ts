import { describe, expect, it } from 'vitest';
import { createEnvironment, runMetrics, runShift } from '@heatline/sim';
import { formatClock } from '@heatline/contracts';
import { goldenBranches, loadScenario } from './helpers/scenario';

describe('determinism and replay', () => {
  it('produces an identical run for identical inputs', () => {
    const scenario = loadScenario();
    const a = runShift(scenario, { policy: 'heatline' });
    const b = runShift(scenario, { policy: 'heatline', environment: createEnvironment(scenario) });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('a branch is identical to the original before the changed decision takes effect', () => {
    const { asPlayed, changed } = goldenBranches();
    const before = (run: typeof asPlayed) => JSON.stringify(run.minutes.filter((m) => m.minute < 910));
    expect(before(changed)).toBe(before(asPlayed));
    const firstDifferent = changed.minutes.findIndex((m, i) => JSON.stringify(m) !== JSON.stringify(asPlayed.minutes[i]));
    expect(changed.minutes[firstDifferent]!.minute).toBeGreaterThanOrEqual(910);
  });

  it('runs a three-hour shift for 20 workers quickly enough to back-test a month', () => {
    const scenario = loadScenario();
    const environment = createEnvironment(scenario);
    runShift(scenario, { policy: 'baseline', environment });
    const t0 = performance.now();
    runShift(scenario, { policy: 'heatline', environment });
    expect(performance.now() - t0).toBeLessThan(250);
  });
});

describe('golden comparison: 19 Aug 2025, decision at 15:10', () => {
  const { scenario, asPlayed, changed } = goldenBranches();
  const a = runMetrics(scenario, asPlayed);
  const b = runMetrics(scenario, changed);

  it('approving the original pour plan ends in a red flag for the worker who pushes on', () => {
    expect(a.redFlags).toBe(1);
    const flag = asPlayed.events.find((e) => e.kind === 'red-flag');
    expect(flag?.worker).toBe('suresh');
    expect(asPlayed.events.some((e) => e.kind === 'cooling-started' && e.worker === 'suresh')).toBe(true);
  });

  it('the protective plan cuts high-strain minutes and keeps everyone below a red flag', () => {
    expect(b.minutesPsi7).toBeLessThan(a.minutesPsi7 / 2);
    expect(b.redFlags).toBe(0);
    expect(b.unacclimatisedOverCapMin).toBe(0);
  });

  it('a worker stays off heat work for the rest of the shift after a red flag', () => {
    const cooled = asPlayed.events.find((e) => e.kind === 'cooling-started')!;
    const after = asPlayed.minutes.filter((m) => m.minute >= cooled.minute).map((m) => m.truth.find((t) => t.worker === 'suresh')!);
    expect(after.every((t) => t.zone === 'first-aid' && t.activity === 'rest')).toBe(true);
  });

  it('the protective plan has no rule violations once it takes effect', () => {
    expect(changed.violations.filter((v) => v.minute >= 910)).toEqual([]);
    expect(asPlayed.violations.filter((v) => v.minute >= 910).length).toBeGreaterThan(0);
  });

  it('the pour still gets done, and the trade-off in rest time is visible', () => {
    expect(b.pourFinishedAt).not.toBeNull();
    expect(b.pourFinishedAt!).toBeLessThanOrEqual(scenario.end);
    expect(b.restMinutes).toBeGreaterThan(a.restMinutes);
  });

  it('records the scripted field events in both branches', () => {
    for (const run of [asPlayed, changed]) {
      const kinds = run.events.map((e) => e.kind);
      for (const k of ['truck-arrived', 'battery-died', 'network-down', 'network-up', 'weather-modifier', 'shift-end'] as const) expect(kinds).toContain(k);
    }
    expect(changed.events.some((e) => e.kind === 'tent-ready')).toBe(true);
  });

  it('matches the frozen outcome summary', () => {
    const summary = (m: typeof a) => ({
      minutesPsi7: m.minutesPsi7,
      minutesPsi9: m.minutesPsi9,
      peakCoreC: Number(m.peakCoreC.toFixed(2)),
      redFlags: m.redFlags,
      unacclimatisedOverCapMin: m.unacclimatisedOverCapMin,
      violationEpisodes: m.violationEpisodes,
      pour: [m.pourStartedAt, m.pourFinishedAt].map((x) => (x === null ? null : formatClock(x))),
    });
    expect({ asPlayed: summary(a), changed: summary(b) }).toMatchSnapshot();
  });
});

describe('policies on the original schedule', () => {
  const scenario = loadScenario();
  const environment = createEnvironment(scenario);
  const run = (policy: 'baseline' | 'site-flags' | 'heatline') => runMetrics(scenario, runShift(scenario, { policy, environment }));
  const baseline = run('baseline');
  const flags = run('site-flags');
  const heatline = run('heatline');

  it('the unprotected schedule produces red flags and slow cooling', () => {
    expect(baseline.redFlags).toBeGreaterThan(0);
    for (const t of baseline.minutesToCooling) expect(t).toBeGreaterThanOrEqual(6);
  });

  it('site-wide flags help, per-worker warnings help more', () => {
    expect(flags.minutesPsi7).toBeLessThan(baseline.minutesPsi7);
    expect(heatline.minutesPsi7).toBeLessThan(flags.minutesPsi7);
  });

  it('with Heatline, a red flag reaches cooling within two minutes instead of six or more', () => {
    for (const t of heatline.minutesToCooling) expect(t).toBeLessThanOrEqual(2);
  });

  it('warnings alone do not make an unlawful schedule lawful', () => {
    expect(heatline.violationEpisodes).toBeGreaterThan(0);
  });
});
