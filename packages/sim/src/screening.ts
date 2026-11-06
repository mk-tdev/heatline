// Independent environmental screening; no physiological model or proxy TWL conversion.
// NIOSH 2016-106, REL/RAL curves, 1-hour time-weighted WBGT and metabolic rate.
// https://www.cdc.gov/niosh/docs/2016-106/pdfs/2016-106.pdf
import type { RunResult, Scenario } from '@heatline/contracts';
import { METABOLIC_W } from './physiology';
export function nioshLimitC(watts: number, acclimatised: boolean): number {
  if (!Number.isFinite(watts) || watts < 115 || watts > 520) throw new Error('Metabolic rate outside screening range 115–520 W');
  return acclimatised ? 56.7 - 11.5 * Math.log10(watts) : 59.9 - 14.1 * Math.log10(watts);
}
export interface ExposureScreen { assessedWindows: number; exceededWindows: number; maxExcessC: number; incompleteWorkerMinutes: number }
export function screenExposure(scenario: Scenario, run: RunResult): ExposureScreen {
  const result: ExposureScreen = { assessedWindows: 0, exceededWindows: 0, maxExcessC: 0, incompleteWorkerMinutes: Math.min(59, run.minutes.length) * scenario.workers.length };
  for (const w of scenario.workers) {
    const samples = run.minutes.map((r) => {
      const o = r.observed.find((x) => x.worker === w.id)!;
      const cabin = scenario.zones.find((z) => z.id === o.zone)!.kind === 'cabin';
      return { wbgt: r.zones.find((z) => z.zone === o.zone)!.wbgt + (cabin ? 0 : (w.clothingAdjustC ?? 0)), watts: METABOLIC_W[o.activity] };
    });
    for (let i = 59; i < samples.length; i++) {
      const hour = samples.slice(i - 59, i + 1);
      const wbgt = hour.reduce((s, x) => s + x.wbgt, 0) / 60;
      const watts = hour.reduce((s, x) => s + x.watts, 0) / 60;
      const excess = wbgt - nioshLimitC(watts, w.acclimatisationDay >= 14);
      result.assessedWindows++;
      if (excess > 0) result.exceededWindows++;
      result.maxExcessC = Math.max(result.maxExcessC, excess);
    }
  }
  return result;
}
