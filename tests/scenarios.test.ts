import { describe, expect, it } from 'vitest';
import template from '../data/scenario/saadiyat-tower.json';
import weather from '../data/weather/abu-dhabi-2025-08.json';
import { SCENARIOS, buildCatalogScenario, createEnvironment, runMetrics, runShift, type OpenMeteoHourly, type ScenarioTemplate } from '@heatline/sim';
import { middayBanApplies, protectivePlan, validatePlan } from '@heatline/rules';

const build = (id: string) => {
  const scenario = buildCatalogScenario(id, template as ScenarioTemplate, weather as OpenMeteoHourly);
  const environment = createEnvironment(scenario);
  const at = scenario.decision!.at;
  const asPlayed = runShift(scenario, { policy: 'heatline', environment });
  const exposureBefore = Object.fromEntries(asPlayed.minutes.find((m) => m.minute === at - 1)!.truth.map((t) => [t.worker, t.exposureMin]));
  const plan = protectivePlan({ scenario, effectiveAt: at, zoneWbgt: environment.zoneWbgt, exposureBefore });
  const validation = validatePlan({ scenario, plan, zoneWbgt: environment.zoneWbgt, exposureBefore });
  const planned = runShift(scenario, { policy: 'heatline', environment, decisions: [{ at, plan }] });
  const unprotected = runShift(scenario, { policy: 'baseline', environment });
  return { scenario, environment, at, plan, validation, asPlayed, planned, unprotected };
};

describe.each(SCENARIOS.map((s) => s.id))('scenario %s', (id) => {
  const r = build(id);
  it('builds a 3-hour or longer shift with a decision inside it', () => {
    expect(r.scenario.end - r.scenario.start).toBeGreaterThanOrEqual(180);
    expect(r.at).toBeGreaterThan(r.scenario.start);
    expect(r.at).toBeLessThan(r.scenario.end);
  });
  it('the rules planner produces a valid plan at the decision', () => {
    expect(r.validation.violations).toEqual([]);
  });
  it('the approved plan has no rule violations after it takes effect and no red flags', () => {
    expect(r.planned.violations.filter((v) => v.minute >= r.at)).toEqual([]);
    expect(runMetrics(r.scenario, r.planned).redFlags).toBe(0);
  });
  it('an unprotected site produces red flags; Heatline cuts high-strain minutes', () => {
    const none = runMetrics(r.scenario, r.unprotected);
    expect(none.redFlags).toBeGreaterThan(0);
    expect(runMetrics(r.scenario, r.planned).minutesPsi7).toBeLessThan(none.minutesPsi7 / 4);
  });
});

describe('scenario specifics', () => {
  it('racing the break: no work in direct sun after 12:30, and coveralls raise the effective heat', () => {
    const r = build('racing-the-break');
    expect(middayBanApplies(r.scenario.date, 12 * 60 + 45)).toBe(true);
    expect(r.planned.violations.some((v) => v.rule === 'midday-ban')).toBe(false);
    expect(r.asPlayed.violations.some((v) => v.rule === 'midday-ban')).toBe(true);
    const joel = r.scenario.workers.find((w) => w.id === 'joel')!;
    expect(joel.clothingAdjustC).toBe(1);
    expect(r.plan.assignments.filter((a) => a.worker === 'joel').every((a) => a.zone === 'store' || a.activity === 'rest')).toBe(true);
    if (r.planned.pourFinishedAt !== null) expect(r.planned.pourFinishedAt).toBeLessThanOrEqual(12 * 60 + 30);
  });

  it('the day nobody should pour: no lawful pour start exists, so the plan has none', () => {
    const r = build('no-pour-day');
    expect(r.plan.pourStart).toBeNull();
    expect(r.planned.pourStartedAt).toBeNull();
    expect(runMetrics(r.scenario, r.unprotected).redFlags).toBeGreaterThanOrEqual(4);
  });

  it('when everything fails: warnings continue on estimates after wearables die and during the outage', () => {
    const r = build('everything-fails');
    const after = r.planned.minutes.filter((m) => m.minute >= 1000);
    for (const id of ['ravi', 'suresh', 'bilal']) expect(after.every((m) => m.observed.find((o) => o.worker === id)!.source === 'environment-only')).toBe(true);
    const outage = r.planned.minutes.filter((m) => !m.networkUp);
    expect(outage.length).toBe(35);
    expect(outage.every((m) => m.warnings.length === r.scenario.workers.length)).toBe(true);
  });
});
