import { describe, expect, it } from 'vitest';
import type { Plan, WorkerObservation } from '@heatline/contracts';
import {
  evaluateWarning,
  exposureCapMin,
  heatZone,
  isAcclimatised,
  middayBanApplies,
  protectivePlan,
  validatePlan,
} from '@heatline/rules';
import { baselinePlan, createEnvironment, runShift } from '@heatline/sim';
import { exposureAt, loadScenario } from './helpers/scenario';

const obs = (o: Partial<WorkerObservation> = {}): WorkerObservation => ({
  worker: 'w',
  source: 'wearable',
  estCoreC: 37.4,
  heartRate: 100,
  estPsi: 2,
  deficitL: 0.2,
  exposureMin: 60,
  continuousWorkMin: 10,
  zone: 'yard',
  activity: 'heavy',
  symptomReported: false,
  ...o,
});
const ctx = (o: Partial<WorkerObservation> = {}, extra: Partial<Parameters<typeof evaluateWarning>[0]> = {}) =>
  evaluateWarning({ observation: obs(o), acclimatisationDay: 60, experienced: true, wbgt: 27, coworkersInZone: 3, ...extra });

describe('tables', () => {
  it('maps WBGT to the proxy TWL zones at the boundaries', () => {
    expect(heatZone(27.9)).toBe('unrestricted');
    expect(heatZone(28)).toBe('low');
    expect(heatZone(30.5)).toBe('medium');
    expect(heatZone(32.5)).toBe('high');
  });

  it('applies the midday ban only in season and in the window', () => {
    expect(middayBanApplies('2025-08-19', 13 * 60)).toBe(true);
    expect(middayBanApplies('2025-08-19', 15 * 60)).toBe(false);
    expect(middayBanApplies('2025-08-19', 12 * 60 + 29)).toBe(false);
    expect(middayBanApplies('2025-09-16', 13 * 60)).toBe(false);
    expect(middayBanApplies('2025-06-15', 13 * 60)).toBe(true);
  });

  it('follows the NIOSH acclimatisation schedule', () => {
    expect(exposureCapMin(1, false)).toBe(96); // 20% of 480
    expect(exposureCapMin(2, false)).toBe(192);
    expect(exposureCapMin(1, true)).toBe(240); // 50%
    expect(exposureCapMin(3, true)).toBe(384); // 80%
    expect(isAcclimatised(13)).toBe(false);
    expect(isAcclimatised(14)).toBe(true);
  });
});

describe('warnings come from rules', () => {
  it('green when everything is within limits', () => {
    expect(ctx().level).toBe('green');
  });

  it('a reported symptom is always red and calls an emergency', () => {
    const w = ctx({ symptomReported: true, estPsi: 1 });
    expect(w.level).toBe('red');
    expect(w.reasons).toContain('red-flag');
    expect(w.action).toBe('emergency');
  });

  it('strain bands: 5 yellow, 7 amber, 9 red (severe strain, not a red flag)', () => {
    expect(ctx({ estPsi: 5 }).level).toBe('yellow');
    expect(ctx({ estPsi: 7 }).level).toBe('amber');
    const severe = ctx({ estPsi: 9 });
    expect(severe.level).toBe('red');
    expect(severe.reasons).toEqual(['strain-severe']);
  });

  it('water deficit and overdue rest raise warnings with a matching action', () => {
    expect(ctx({ deficitL: 1.1 }).action).toBe('drink');
    expect(ctx({ continuousWorkMin: 50 }, { wbgt: 33 }).level).toBe('amber'); // high zone, heavy: 20 min
    expect(ctx({ continuousWorkMin: 18 }, { wbgt: 33 }).level).toBe('yellow'); // rest due soon
  });

  it('an unacclimatised worker in a medium or high zone is told to stop', () => {
    const w = ctx({}, { acclimatisationDay: 2, experienced: false, wbgt: 31 });
    expect(w.level).toBe('amber');
    expect(w.action).toBe('stop-work');
  });

  it('working alone in the heat is flagged', () => {
    expect(ctx({}, { wbgt: 29, coworkersInZone: 0 }).reasons).toContain('alone-in-heat');
  });
});

describe('plan validation', () => {
  const scenario = loadScenario();
  const environment = createEnvironment(scenario);
  const validate = (plan: Plan) =>
    validatePlan({ scenario, plan, zoneWbgt: environment.zoneWbgt, exposureBefore: Object.fromEntries(scenario.workers.map((w) => [w.id, w.priorExposureMin])) });

  it('refuses the original schedule and cites the rules it breaks', () => {
    const result = validate(baselinePlan(scenario));
    expect(result.ok).toBe(false);
    const rules = new Set(result.violations.map((v) => v.rule));
    for (const r of ['unacclimatised-in-zone', 'essential-only', 'work-rest', 'water']) expect(rules).toContain(r);
  });

  it('refuses a pour before the truck, an understaffed pour, too many tents and unknown zones', () => {
    const plan = { ...baselinePlan(scenario), pourStart: 920, tents: [{ zone: 'deck', readyAt: 900 }, { zone: 'yard', readyAt: 900 }, { zone: 'facade', readyAt: 900 }, { zone: 'nowhere', readyAt: 900 }] };
    plan.assignments = plan.assignments.map((a) => (a.reason === 'pour' && a.worker !== 'suresh' ? { ...a, reason: undefined } : a));
    const rules = new Set(validate(plan).violations.map((v) => v.rule));
    for (const r of ['pour-before-truck', 'pour-crew', 'tents-available', 'unknown-zone']) expect(rules).toContain(r);
  });

  it('flags midday-ban work in direct sun', () => {
    const morning = loadScenario({ start: 12 * 60, end: 15 * 60 });
    const env = createEnvironment(morning);
    const result = validatePlan({ scenario: morning, plan: baselinePlan(morning), zoneWbgt: env.zoneWbgt, exposureBefore: {} });
    expect(result.violations.map((v) => v.rule)).toContain('midday-ban');
  });
});

describe('rules planner', () => {
  it('produces a valid plan with a staffed pour on the demo day', () => {
    const scenario = loadScenario();
    const environment = createEnvironment(scenario);
    const asPlayed = runShift(scenario, { policy: 'heatline', environment });
    const plan = protectivePlan({ scenario, effectiveAt: 910, zoneWbgt: environment.zoneWbgt, exposureBefore: exposureAt(asPlayed, 910) });
    expect(validatePlan({ scenario, plan, zoneWbgt: environment.zoneWbgt, exposureBefore: exposureAt(asPlayed, 910) }).violations).toEqual([]);
    expect(plan.pourStart).not.toBeNull();
    expect(plan.assignments.filter((a) => a.worker === 'anwar').every((a) => a.zone === 'store' || a.activity === 'rest')).toBe(true);
  });

  it('produces a valid plan on every day of August 2025', () => {
    const failures: string[] = [];
    for (let d = 1; d <= 31; d++) {
      const date = `2025-08-${String(d).padStart(2, '0')}`;
      const scenario = loadScenario({ date });
      const environment = createEnvironment(scenario);
      const exposureBefore = Object.fromEntries(scenario.workers.map((w) => [w.id, w.priorExposureMin]));
      const plan = protectivePlan({ scenario, effectiveAt: scenario.start, zoneWbgt: environment.zoneWbgt, exposureBefore });
      const result = validatePlan({ scenario, plan, zoneWbgt: environment.zoneWbgt, exposureBefore });
      if (!result.ok) failures.push(`${date}: ${result.violations.slice(0, 2).map((v) => v.detail).join('; ')}`);
    }
    expect(failures).toEqual([]);
  });

  it('keeps unavailable workers out of every assignment except first aid', () => {
    const scenario = loadScenario();
    const environment = createEnvironment(scenario);
    const plan = protectivePlan({ scenario, effectiveAt: 960, zoneWbgt: environment.zoneWbgt, exposureBefore: {}, unavailable: ['bilal'] });
    expect(plan.assignments.filter((a) => a.worker === 'bilal').every((a) => a.zone === 'first-aid' && a.activity === 'rest')).toBe(true);
  });
});
