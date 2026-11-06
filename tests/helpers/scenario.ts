import template from '../../data/scenario/saadiyat-tower.json';
import weather from '../../data/weather/abu-dhabi-2025-08.json';
import { buildScenario, createEnvironment, runShift, type OpenMeteoHourly, type ScenarioOptions, type ScenarioTemplate } from '@heatline/sim';
import { protectivePlan } from '@heatline/rules';
import type { Minute, RunResult, Scenario } from '@heatline/contracts';

export const loadScenario = (options: ScenarioOptions = {}): Scenario =>
  buildScenario(template as ScenarioTemplate, weather as OpenMeteoHourly, options);

/** Heat-exposed minutes per worker at the start of `minute`, read from a run. */
export function exposureAt(run: RunResult, minute: Minute): Record<string, number> {
  const rec = run.minutes.find((m) => m.minute === minute - 1);
  return Object.fromEntries((rec?.truth ?? []).map((t) => [t.worker, t.exposureMin]));
}

/** The golden comparison: original schedule vs the rules planner's plan approved at 15:10. */
export function goldenBranches() {
  const scenario = loadScenario();
  const environment = createEnvironment(scenario);
  const asPlayed = runShift(scenario, { policy: 'heatline', environment });
  const plan = protectivePlan({ scenario, effectiveAt: 910, zoneWbgt: environment.zoneWbgt, exposureBefore: exposureAt(asPlayed, 910) });
  const changed = runShift(scenario, { policy: 'heatline', environment, decisions: [{ at: 910, plan }] });
  return { scenario, environment, asPlayed, changed, plan };
}
