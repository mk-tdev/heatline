// The August 2025 back-test: the challenge's safety and productivity measures across 31 days,
// three shift windows and four policies. Precomputed by `npm run backtest`.

import report from '../../../../data/backtest/august-2025.json';
import type { BacktestReport, PolicyTotals } from '@heatline/sim';

const r = report as unknown as BacktestReport;
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : null);
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '—');
const fmt = (n: number) => n.toLocaleString('en-GB');

const MEASURES: { label: string; get: (t: PolicyTotals) => number; lowerIsBetter: boolean; hint: string }[] = [
  { label: 'Simulated red-flag events', get: (t) => t.redFlags, lowerIsBetter: true, hint: 'incidents' },
  { label: 'Worker-minutes at severe strain (PSI ≥ 9)', get: (t) => t.workerMinutesPsi9, lowerIsBetter: true, hint: 'exposure' },
  { label: 'Worker-minutes at high strain (PSI ≥ 7)', get: (t) => t.workerMinutesPsi7, lowerIsBetter: true, hint: 'exposure' },
  { label: 'Rule-violation episodes', get: (t) => t.violationEpisodes, lowerIsBetter: true, hint: 'demonstration policy' },
  { label: 'NIOSH screening exceedances', get: (t) => t.nioshExceededWindows, lowerIsBetter: true, hint: `${fmt(r.totals['heatline-plan'].nioshAssessedWindows)} overlapping windows per policy; first 59 min excluded` },
  { label: 'Rest worker-minutes', get: (t) => t.restWorkerMinutes, lowerIsBetter: false, hint: 'lost work time (the cost)' },
  { label: 'Pours completed', get: (t) => t.poursFinished, lowerIsBetter: false, hint: 'productivity' },
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
            <strong>August 2025 simulation evidence</strong>
            <small>
              {r.days} days × {r.windows.length} shift windows ({r.windows.map((x) => x.label).join(', ')}) × {r.policies.length} policies = {shifts} shifts per policy, 20 workers each. Real ERA5 weather for Saadiyat.
            </small>
          </div>
          <button onClick={onClose}>Close</button>
        </header>

        <p className="science-note">Synthetic workers, historical gridded weather and an illustrative physiology model. These are scenario experiments, not measured health outcomes. A plan can pass the demonstration policy and still exceed an independent exposure screen.</p>
        <section className="ev-kpis">
          <div>
            <b>{pct(w.detected, w.episodes)}</b>
            <span>
              of {fmt(w.episodes)} high-strain episodes warned in advance (amber or red 1–60 min before)
            </span>
          </div>
          <div>
            <b>{median(lead)} min</b>
            <span>median warning lead time · 1 in 10 under {lead[Math.floor(lead.length * 0.1)]} min</span>
          </div>
          <div>
            <b>{pct(w.falseAlarms, w.warningOnsets)}</b>
            <span>
              false-alert fraction: {fmt(w.falseAlarms)} of {fmt(w.warningOnsets)} assessable amber/red onsets without high strain within an hour
            </span>
          </div>
          <div>
            <b>
              {r.totals['no-action'].redFlags} → {r.totals['heatline-plan'].redFlags}
            </b>
            <span>red flags, no intervention → Heatline with an approved plan</span>
          </div>
        </section>

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
                Median minutes to cooling after a red flag<small>escalation</small>
              </td>
              {r.policies.map((p) => (
                <td key={p.id}>{median(r.totals[p.id].minutesToCooling) ?? '—'}</td>
              ))}
            </tr>
          </tbody>
        </table>

        <h4>Red flags by shift window</h4>
        <table className="compact-table">
          <thead>
            <tr>
              <th>Window</th>
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

        <h4>Sensitivity to unvalidated assumptions</h4>
        <p className="science-note">Each variant repeats all 93 shifts with the same policies. Perturbations are engineering stress tests, not confidence intervals. The observer and simulated truth still share a model family; independent field validation remains outstanding.</p>
        <table><thead><tr><th>Assumption tested</th><th>Advance warnings</th><th>False-alert fraction</th><th>Red flags: baseline / plan</th></tr></thead><tbody>
          {r.sensitivity?.map((s) => <tr key={s.label}><td>{s.label}<small>{s.assumptions}</small></td><td>{pct(s.detected, s.episodes)}<small>{s.detected} / {s.episodes}</small></td><td>{pct(s.falseAlarms, s.warningOnsets)}<small>{s.falseAlarms} / {s.warningOnsets}</small></td><td>{s.baselineRedFlags} / {s.planRedFlags}</td></tr>)}
        </tbody></table>
        <div className="ev-notes">
          <p><b>Accounting.</b> {w.simultaneous} episodes were warned only at onset; {w.missed} had no warning by onset. {w.leftCensored} workers already had high strain at shift start and are excluded from detection. {w.rightCensored} warning onsets lack an outcome and a full follow-up hour and are excluded from the false-alert denominator. Lead-time statistics include detected episodes only; episodes are not independent workers.</p>
          <p><b>Independent screen.</b> Rolling 60-minute mean WBGT (including clothing adjustment and rest location) and mean metabolic workload are compared with NIOSH REL/RAL curves. The first 59 minutes have insufficient prior exposure history. This is occupational screening on synthetic inputs, not UAE compliance certification. <a href="https://www.cdc.gov/niosh/docs/2016-106/pdfs/2016-106.pdf" target="_blank" rel="noreferrer">NIOSH criteria</a>.</p>
          <p>
            <b>What this shows.</b> In this model, scheduled shade, rotation and rest reduce simulated strain. The default protective-plan runs produce {r.totals['heatline-plan'].redFlags} red flags, with more rest and {r.totals['heatline-plan'].shifts - r.totals['heatline-plan'].poursFinished} shifts without a completed pour. This does not establish injury prevention or permission to work.
          </p>
          <p>
            <b>How it is measured.</b> Lead time and false alarms come from runs with no intervention, comparing the warning system (which sees only noisy wearables or estimates) against the simulation’s true strain. {r.note}
          </p>
        </div>
      </div>
    </div>
  );
}
