// The August 2025 back-test: the challenge's safety and productivity measures across 31 days,
// three shift windows and four policies. Precomputed by `npm run backtest`.

import report from '../../../../data/backtest/august-2025.json';
import type { BacktestReport, PolicyTotals } from '@heatline/sim';

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
            <strong>What happened across August 2025</strong>
            <small>
              Every day of the month, three shifts a day ({r.windows.map((x) => x.label).join(', ')}): {shifts} shifts of 20 workers, each played four ways. Real weather for Saadiyat Island.
            </small>
          </div>
          <button onClick={onClose}>Close</button>
        </header>

        <p className="science-note">The weather is real. The workers and their bodies are simulated, so these are experiments, not measured health outcomes. A plan can follow the site rules and still be over the safe heat-exposure limit; both are shown.</p>
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
              {r.totals['no-action'].redFlags} → {r.totals['heatline-plan'].redFlags}
            </b>
            <span>people with signs of serious heat illness: doing nothing → Heatline with an approved plan</span>
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
