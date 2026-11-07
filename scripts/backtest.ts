// Run the August 2025 back-test and write data/backtest/august-2025.json for the evidence view.
// Run: node --import tsx scripts/backtest.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import template from '../data/scenario/saadiyat-tower.json' with { type: 'json' };
import weather from '../data/weather/abu-dhabi-2025-08.json' with { type: 'json' };
import { runBacktest, type OpenMeteoHourly, type ScenarioTemplate } from '@heatline/sim';

const t0 = performance.now();
const report = runBacktest(template as ScenarioTemplate, weather as OpenMeteoHourly);
report.sensitivity = [];
for (const variant of [
  { label: 'Bodies heat up faster', assumptions: 'Workers heat up 25% faster than the model expects', uncertainty: { truthHeatScale: 1.25 } },
  { label: 'Bodies heat up slower', assumptions: 'Workers heat up 25% slower than the model expects', uncertainty: { truthHeatScale: 0.75 } },
  { label: 'Wearables read low', assumptions: 'Every wearable reads body temperature 0.3 °C too low', uncertainty: { wearableBiasC: -0.3 } },
  { label: 'Heat underestimated', assumptions: 'Without a wearable, the site heat is guessed 2 °C too low', uncertainty: { observationWbgtBiasC: -2 } },
  { label: 'All of these at once', assumptions: 'Workers start 0.2 °C warmer and heat up faster; wearables read low; heat guessed low', uncertainty: { truthCoreOffsetC: 0.2, truthHeatScale: 1.25, wearableBiasC: -0.3, observationWbgtBiasC: -2 } },
]) {
  const r = runBacktest(template as ScenarioTemplate, weather as OpenMeteoHourly, 31, variant.uncertainty);
  report.sensitivity.push({ label: variant.label, assumptions: variant.assumptions, detected: r.warning.detected, episodes: r.warning.episodes, falseAlarms: r.warning.falseAlarms, warningOnsets: r.warning.warningOnsets, baselineRedFlags: r.totals['no-action'].redFlags, planRedFlags: r.totals['heatline-plan'].redFlags });
}
mkdirSync('data/backtest' , { recursive: true });
writeFileSync('data/backtest/august-2025.json', JSON.stringify(report, null, 1));
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
console.log(`Back-test: ${report.days} days × ${report.windows.length} windows × ${report.policies.length} policies in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
for (const p of report.policies) {
  const t = report.totals[p.id];
  console.log(`${p.label.padEnd(42)} psi7 ${String(t.workerMinutesPsi7).padStart(6)}  psi9 ${String(t.workerMinutesPsi9).padStart(5)}  red ${String(t.redFlags).padStart(3)}  cool(med) ${median(t.minutesToCooling)}  viol ${String(t.violationEpisodes).padStart(5)}  rest ${t.restWorkerMinutes}  pours ${t.poursFinished}/${t.shifts}`);
}
const w = report.warning;
console.log(`Warnings: ${w.detected}/${w.episodes} episodes detected; median lead ${median(w.leadTimes)} min; false alarms ${w.falseAlarms}/${w.warningOnsets}`);
