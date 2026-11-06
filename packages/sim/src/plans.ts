// The site's original schedule, before anyone intervenes: crews work their tasks with a
// 10-minute break at :50 each hour in the shade shelter, one cup of water per break, and the
// pour starts when the truck arrives with the whole deck crew (including the newcomer).

import type { Assignment, Plan, Scenario } from '@heatline/contracts';

export const BASELINE_BREAK_MIN = 10;
export const BASELINE_CUP_L = 0.3;

export function baselinePlan(scenario: Scenario): Plan {
  const assignments: Assignment[] = [];
  for (const w of scenario.workers) {
    const task = scenario.tasks.find((t) => t.crew === w.crew);
    if (!task) continue;
    for (let hour = scenario.start; hour < scenario.end; hour += 60) {
      const breakAt = Math.min(scenario.end, hour + 60 - BASELINE_BREAK_MIN);
      const reason = w.crew === scenario.pour.crew ? 'pour' : undefined;
      assignments.push({ worker: w.id, from: hour, to: breakAt, zone: task.zone, activity: task.activity, drinkL: 0, reason });
      if (breakAt < Math.min(scenario.end, hour + 60)) {
        assignments.push({ worker: w.id, from: breakAt, to: Math.min(scenario.end, hour + 60), zone: 'shelter', activity: 'rest', drinkL: BASELINE_CUP_L, reason: 'scheduled break' });
      }
    }
  }
  return { id: 'baseline', label: 'Original site schedule', effectiveAt: scenario.start, assignments, tents: [], pourStart: scenario.pour.truckArrives };
}
