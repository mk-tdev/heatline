// The August 2025 back-test: the challenge's safety and productivity measures across 31 days,
// three shift windows and four policies. Precomputed by `npm run backtest`.

import report from '../../../../data/backtest/august-2025.json';
import type { BacktestReport, PolicyTotals } from '@heatline/sim';
import { formatClock } from '@heatline/contracts';
import { season } from '../season';

const r = report as unknown as BacktestReport;
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : null);
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '—');
const fmt = (n: number) => n.toLocaleString('en-GB');

const MEASURES: { label: string; get: (t: PolicyTotals) => number; lowerIsBetter: boolean; hint: string }[] = [
  { label: 'People with signs of serious heat illness', get: (t) => t.redFlags, lowerIsBetter: true, hint: 'simulated cases' },
  { label: 'Minutes in severe heat strain', get: (t) => t.workerMinutesPsi9, lowerIsBetter: true, hint: 'added up across all workers' },
  { label: 'Minutes in high heat strain', get: (t) => t.workerMinutesPsi7, lowerIsBetter: true, hint: 'added up across all workers' },
  { label: 'Times a site rule was broken', get: (t) => t.violationEpisodes, lowerIsBetter: true, hint: 'work-rest, water, shade, working alone' },
  { label: 'Minutes over the safe heat-exposure limit', get: (t) => t.nioshExceededWindows, lowerIsBetter: true, hint: `minutes when the hour before was over the US NIOSH limit, out of ${fmt(r.totals['heatline-plan'].nioshAssessedWindows)}` },
  { label: 'Minutes spent resting', get: (t) => t.restWorkerMinutes, lowerIsBetter: false, hint: 'the cost: time not working' },
  { label: 'Concrete pours finished', get: (t) => t.poursFinished, lowerIsBetter: false, hint: 'the work that got done' },
];

export function Evidence({ onClose }: { onClose: () => void }) {
  const w = r.warning;
  const shifts = r.totals['no-action'].shifts;
  const lead = [...w.leadTimes].sort((a, b) => a - b);
  return (
    <div className="overlay evidence-overlay">
      <div className="evidence">
        <header>
          <div>
            <strong>The evidence</strong>
            <small>First, what real weather says on its own. Then what a month of simulated shifts adds, and where it could be wrong.</small>
          </div>
          <button onClick={onClose}>Close</button>
        </header>

        <h3 className="ev-part">1 · Real weather, no simulation</h3>
        <p className="ev-lead">
          Every working hour (05:00–19:00) of the {season.yearsLabel} midday-break seasons near Saadiyat Island: {season.days} days. Heat stress (WBGT) is calculated from reanalysis weather and compared with the US NIOSH limit for steady moderate work by people used to the heat ({season.limitModerate.toFixed(1)} °C). No workers are simulated here.
        </p>
        <section className="ev-kpis">
          <div>
            <b>{season.overLimitPct}%</b>
            <span>of working hours were over the limit for steady moderate work in the sun: about {Math.round(season.overLimitHoursPerDay)} of {season.hoursPerDay} hours a day</span>
          </div>
          <div>
            <b>{season.insideBreakPct}%</b>
            <span>of those over-limit hours fall inside the 12:30–15:00 midday break. The rest have to be managed on site</span>
          </div>
          <div>
            <b>{season.afterBreakOverPct}%</b>
            <span>of hours from 15:00 to 18:00 were still over the limit in the sun; {season.afterBreakShadeOverPct}% were over it even in shade</span>
          </div>
          <div>
            <b>{season.heavyMinShade} → {season.heavyMinCoolRoom} min</b>
            <span>of heavy work per hour within the limit after 15:00: resting in shade, and resting in a cooled room</span>
          </div>
        </section>
        <table className="compact-table">
          <thead>
            <tr>
              <th>Hour</th>
              {season.report.years.map((y) => <th key={y.year}>{y.year}: mean WBGT in sun / shade</th>)}
              {season.report.years.map((y) => <th key={y.year}>{y.year}: days over the limit</th>)}
              <th>Heavy work per hour: cooled room / shade</th>
            </tr>
          </thead>
          <tbody>
            {season.report.years[0]!.byHour.map((h, i) => (
              <tr key={h.from} className={h.from === 780 || h.from === 840 ? 'ev-break' : ''}>
                <td>{formatClock(h.from)}{h.from === 780 || h.from === 840 ? <small>midday break</small> : null}</td>
                {season.report.years.map((y) => <td key={y.year}>{y.byHour[i]!.meanWbgtSun.toFixed(1)}° / {y.byHour[i]!.meanWbgtShade.toFixed(1)}°</td>)}
                {season.report.years.map((y) => <td key={y.year}>{Math.round(y.byHour[i]!.daysOverModerateLimitPct)}%</td>)}
                <td>{Math.round(season.report.years.reduce((sum, y) => sum + y.byHour[i]!.meanHeavyMinCoolRoom, 0) / season.report.years.length)} / {Math.round(season.report.years.reduce((sum, y) => sum + y.byHour[i]!.meanHeavyMinShade, 0) / season.report.years.length)} min</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ev-notes">
          <p><b>What this means.</b> The midday break removes the hottest two and a half hours. The hours either side still need work and rest cycles, and shade alone leaves almost no room for heavy work. A cooled rest room is what makes afternoon work possible within the limit. That is the planning problem Heatline addresses.</p>
          <p><b>Limits of this finding.</b> The weather is a reanalysis for a grid square of several kilometres, not an instrument on a site, and real sites can be hotter. Being over the limit means work needs controls, not that it is banned. Abu Dhabi’s own code asks for a Thermal Work Limit assessment, which this is not. Regenerate with <code>npm run season</code>.</p>
        </div>

        <h3 className="ev-part">2 · A month of simulated shifts</h3>
        <p className="ev-lead">
          Every day of August 2025, three shifts a day ({r.windows.map((x) => x.label).join(', ')}): {shifts} shifts of 20 synthetic workers, each played four ways on the real weather.
        </p>
        <p className="science-note">The workers and their bodies are simulated with a simple teaching model, so these are experiments, not measured health outcomes. The model produces far more serious cases than real sites report. Use it to compare one approach with another on the same day, not to predict how many people would fall ill.</p>
        <section className="ev-kpis">
          <div>
            <b>{pct(w.detected, w.episodes)}</b>
            <span>
              of {fmt(w.episodes)} times a worker got into high heat strain, their phone had warned them first
            </span>
          </div>
          <div>
            <b>{median(lead)} min</b>
            <span>typical warning time before it happened (1 in 10 warnings came less than {lead[Math.floor(lead.length * 0.1)]} min ahead)</span>
          </div>
          <div>
            <b>{pct(w.falseAlarms, w.warningOnsets)}</b>
            <span>
              of warnings were false alarms ({fmt(w.falseAlarms)} of {fmt(w.warningOnsets)}: no high strain followed within an hour)
            </span>
          </div>
          <div>
            <b>
              {pct(r.totals['no-action'].nioshExceededWindows, r.totals['no-action'].nioshAssessedWindows)} → {pct(r.totals['heatline-plan'].nioshExceededWindows, r.totals['heatline-plan'].nioshAssessedWindows)}
            </b>
            <span>of worker time over the NIOSH exposure limit: original schedule → Heatline with an approved plan. This check does not use the body model</span>
          </div>
        </section>

        <p className="science-note">
          <b>Why warnings alone are not enough.</b> Site-wide flag breaks ({r.totals['site-flags'].redFlags} cases) do better than Heatline&apos;s warnings on the original schedule ({r.totals['heatline-warnings'].redFlags}). A flag stops everyone at once; a phone warning relies on each person stopping, and in the simulation some workers keep going, as real crews do. Heatline is meant to be used with a plan: warnings plus a plan the supervisor approves gives {r.totals['heatline-plan'].redFlags}.
        </p>
        <table>
          <thead>
            <tr>
              <th>Measure ({shifts} shifts)</th>
              {r.policies.map((p) => (
                <th key={p.id}>{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEASURES.map((m) => {
              const values = r.policies.map((p) => m.get(r.totals[p.id]));
              const max = Math.max(...values, 1);
              const best = m.lowerIsBetter ? Math.min(...values) : null;
              return (
                <tr key={m.label}>
                  <td>
                    {m.label}
                    <small>{m.hint}</small>
                  </td>
                  {values.map((v, i) => (
                    <td key={i} className={best !== null && v === best ? 'win' : ''}>
                      <span className="ev-bar" style={{ width: `${(v / max) * 100}%` }} />
                      {fmt(v)}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr>
              <td>
                Typical minutes until a collapsed worker is being cooled<small>how fast help arrives</small>
              </td>
              {r.policies.map((p) => (
                <td key={p.id}>{median(r.totals[p.id].minutesToCooling) ?? '—'}</td>
              ))}
            </tr>
          </tbody>
        </table>

        <h4>Serious heat-illness cases by time of day</h4>
        <table className="compact-table">
          <thead>
            <tr>
              <th>Shift</th>
              {r.policies.map((p) => (
                <th key={p.id}>{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.windows.map((win) => (
              <tr key={win.id}>
                <td>{win.label}</td>
                {r.policies.map((p) => (
                  <td key={p.id}>{r.byWindow[win.id]![p.id].redFlags}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <h4>What if our assumptions are wrong?</h4>
        <p className="science-note">We replayed all 93 shifts again with the body model or the sensors deliberately made worse. These are stress tests, not error bars. Only a field trial with real workers can validate the model.</p>
        <table><thead><tr><th>What we changed</th><th>Warned in advance</th><th>False alarms</th><th>Serious cases: doing nothing / with a plan</th></tr></thead><tbody>
          {r.sensitivity?.map((s) => <tr key={s.label}><td>{s.label}<small>{s.assumptions}</small></td><td>{pct(s.detected, s.episodes)}<small>{s.detected} / {s.episodes}</small></td><td>{pct(s.falseAlarms, s.warningOnsets)}<small>{s.falseAlarms} / {s.warningOnsets}</small></td><td>{s.baselineRedFlags} / {s.planRedFlags}</td></tr>)}
        </tbody></table>
        <div className="ev-notes">
          <p><b>Missed warnings.</b> {fmt(w.missed)} times the warning had not arrived when strain started, and {fmt(w.simultaneous)} times it arrived at the same moment. {w.leftCensored ? `${w.leftCensored} workers started the shift already strained and are left out. ` : ''}{fmt(w.rightCensored)} warnings near the end of a shift could not be followed for a full hour and are left out of the false-alarm count.</p>
          <p><b>The safe exposure limit.</b> For each worker, we average the heat they were in (allowing for heavy clothing and where they rested) and how hard they worked over each hour, and compare that with the US <a href="https://www.cdc.gov/niosh/docs/2016-106/pdfs/2016-106.pdf" target="_blank" rel="noreferrer">NIOSH heat-stress limits</a>. The first hour of a shift has no full hour behind it and is skipped. This is a screening check on simulated workers, not UAE certification.</p>
          <p>
            <b>What this shows.</b> In the simulation, planned shade, crew rotation and rest cut serious cases to {r.totals['heatline-plan'].redFlags}. The cost is more rest and {r.totals['heatline-plan'].shifts - r.totals['heatline-plan'].poursFinished} shifts where the pour was moved off the day. It does not prove that real injuries would be prevented.
          </p>
          <p>
            <b>How it is measured.</b> The warning system only sees what a phone could see: a noisy wearable reading, or an estimate from the weather and the work when there is no wearable. We compare its warnings with what the simulation says was really happening in each worker&apos;s body.
          </p>
        </div>
      </div>
    </div>
  );
}
