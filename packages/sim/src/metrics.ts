// Outcome measures for one run, computed from engine records only. These describe the
// simulation; they are not claims about real injuries prevented.

import type { Minute, RunResult, Scenario } from '@heatline/contracts';
import { exposureCapMin, isAcclimatised } from '@heatline/rules';

export interface RunMetrics {
  /** worker-minutes with true strain index ≥ 7 */
  minutesPsi7: number;
  /** worker-minutes with true strain index ≥ 9 */
  minutesPsi9: number;
  peakCoreC: number;
  /** workers who became symptomatic (red flag) */
  redFlags: number;
  /** minutes from symptom onset to cooling, per red flag */
  minutesToCooling: number[];
  /** minutes unacclimatised workers spent in heat work beyond their exposure cap */
  unacclimatisedOverCapMin: number;
  /** sum of end-of-shift water deficits above 1 L [L] */
  waterShortfallL: number;
  /** distinct rule-violation episodes during the run */
  violationEpisodes: number;
  restMinutes: number;
  pourStartedAt: Minute | null;
  pourFinishedAt: Minute | null;
}

export function runMetrics(scenario: Scenario, run: RunResult): RunMetrics {
  let minutesPsi7 = 0;
  let minutesPsi9 = 0;
  let peakCoreC = 0;
  let restMinutes = 0;
  let unaccOver = 0;
  const symptomOnset = new Map<string, Minute>();
  const cooled = new Map<string, Minute>();
  const profile = new Map(scenario.workers.map((w) => [w.id, w]));

  for (const rec of run.minutes) {
    for (const t of rec.truth) {
      if (t.psi >= 7) minutesPsi7++;
      if (t.psi >= 9) minutesPsi9++;
      peakCoreC = Math.max(peakCoreC, t.coreC);
      if (t.activity === 'rest') restMinutes++;
      const w = profile.get(t.worker)!;
      const heatWork = t.activity !== 'rest' && scenario.zones.find((z) => z.id === t.zone)?.kind !== 'cabin';
      if (heatWork && !isAcclimatised(w.acclimatisationDay) && t.exposureMin > exposureCapMin(w.acclimatisationDay, w.experienced)) unaccOver++;
      if (t.symptomatic && !symptomOnset.has(t.worker)) symptomOnset.set(t.worker, rec.minute);
    }
  }
  for (const e of run.events) if (e.kind === 'cooling-started' && e.worker && !cooled.has(e.worker)) cooled.set(e.worker, e.minute);

  const last = run.minutes[run.minutes.length - 1];
  const waterShortfallL = last ? last.truth.reduce((s, t) => s + Math.max(0, t.deficitL - 1), 0) : 0;
  return {
    minutesPsi7,
    minutesPsi9,
    peakCoreC,
    redFlags: symptomOnset.size,
    minutesToCooling: [...symptomOnset].map(([w, onset]) => (cooled.has(w) ? cooled.get(w)! - onset : Infinity)),
    unacclimatisedOverCapMin: unaccOver,
    waterShortfallL,
    violationEpisodes: run.violations.length,
    restMinutes,
    pourStartedAt: run.pourStartedAt,
    pourFinishedAt: run.pourFinishedAt,
  };
}
