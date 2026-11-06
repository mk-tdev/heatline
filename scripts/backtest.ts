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
  { label: 'Higher heat response', assumptions: 'Truth heat coefficient +25%; observer unchanged', uncertainty: { truthHeatScale: 1.25 } },
  { label: 'Lower heat response', assumptions: 'Truth heat coefficient −25%; observer unchanged', uncertainty: { truthHeatScale: 0.75 } },
  { label: 'Wearable under-reading', assumptions: 'All wearable core estimates −0.3 °C', uncertainty: { wearableBiasC: -0.3 } },
  { label: 'Exposure underestimated', assumptions: 'Environment-only estimator WBGT −2 °C', uncertainty: { observationWbgtBiasC: -2 } },
  { label: 'Combined adverse assumptions', assumptions: 'Truth +0.2 °C, heat response +25%, wearable −0.3 °C, estimator WBGT −2 °C', uncertainty: { truthCoreOffsetC: 0.2, truthHeatScale: 1.25, wearableBiasC: -0.3, observationWbgtBiasC: -2 } },
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
