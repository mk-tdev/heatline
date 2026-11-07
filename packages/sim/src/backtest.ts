// Back-test across real August 2025 weather: every day, three shift windows, four policies.
// Measures the challenge's "safety and productivity" outcomes on the SIMULATION: warning lead
// time and false alarms (judged against ground-truth strain the warning system cannot see),
// red flags, time to cooling, rule compliance and lost work time. Pure; run by scripts/backtest.ts.

import type { Minute, RunResult, Scenario } from '@heatline/contracts';
import { levelRank, protectivePlan } from '@heatline/rules';
import { createEnvironment } from './environment';
import { runShift, type Policy, type RunOptions } from './engine';
import { screenExposure } from './screening';
import { runMetrics } from './metrics';
import { buildScenario, type OpenMeteoHourly, type ScenarioTemplate } from './scenario';

export const WINDOWS = [
  { id: 'morning', label: '07:00–10:00', start: 420, end: 600 },
  { id: 'late-morning', label: '10:00–12:30', start: 600, end: 750 },
  { id: 'afternoon', label: '15:00–18:00', start: 900, end: 1080 },
] as const;

export type BacktestPolicy = 'no-action' | 'site-flags' | 'heatline-warnings' | 'heatline-plan';
export const POLICIES: { id: BacktestPolicy; label: string }[] = [
  { id: 'no-action', label: 'Doing nothing (original schedule)' },
  { id: 'site-flags', label: 'Site-wide flag breaks (common today)' },
  { id: 'heatline-warnings', label: 'Heatline phone warnings only' },
  { id: 'heatline-plan', label: 'Heatline warnings + approved plan' },
];

export interface PolicyTotals {
  shifts: number;
  nioshExceededWindows: number;
  nioshAssessedWindows: number;
  workerMinutesPsi7: number;
  workerMinutesPsi9: number;
  redFlags: number;
  minutesToCooling: number[];
  violationEpisodes: number;
  restWorkerMinutes: number;
  poursFinished: number;
}

export interface WarningPerformance {
  /** worker episodes reaching true PSI ≥ 7 with no intervention */
  episodes: number;
  /** episodes preceded by an amber-or-red warning (within 60 min) */
  detected: number;
  simultaneous: number;
  missed: number;
  leftCensored: number;
  rightCensored: number;
  /** minutes between the first amber warning and true PSI ≥ 7, for detected episodes */
  leadTimes: number[];
  /** amber-or-red warning onsets */
  warningOnsets: number;
  /** onsets not followed by true PSI ≥ 7 within 60 minutes */
  falseAlarms: number;
}

export interface BacktestReport {
  generated: string;
  sensitivity?: { label: string; assumptions: string; detected: number; episodes: number; falseAlarms: number; warningOnsets: number; baselineRedFlags: number; planRedFlags: number }[];
  days: number;
  windows: typeof WINDOWS;
  policies: typeof POLICIES;
  totals: Record<BacktestPolicy, PolicyTotals>;
  byWindow: Record<string, Record<BacktestPolicy, PolicyTotals>>;
  warning: WarningPerformance;
  note: string;
}

const emptyTotals = (): PolicyTotals => ({ shifts: 0, nioshExceededWindows: 0, nioshAssessedWindows: 0, workerMinutesPsi7: 0, workerMinutesPsi9: 0, redFlags: 0, minutesToCooling: [], violationEpisodes: 0, restWorkerMinutes: 0, poursFinished: 0 });

/** Strip scripted test events so only the weather differs between shifts. */
function weatherOnly(s: Scenario): Scenario {
  return { ...s, networkOutage: undefined, weatherModifiers: [], workers: s.workers.map((w) => ({ ...w, batteryDiesAt: undefined })) };
}

/** Warning performance from a no-intervention run: warnings exist but nobody acts on them. */
export function warningPerformance(run: RunResult, into: WarningPerformance) {
  const workers = run.minutes[0]?.truth.map((t) => t.worker) ?? [];
  for (const id of workers) {
    const truthPsi = run.minutes.map((m) => m.truth.find((t) => t.worker === id)!.psi);
    const level = run.minutes.map((m) => levelRank(m.warnings.find((w) => w.worker === id)!.level));
    const minute = (i: number): Minute => run.minutes[i]!.minute;
    if (truthPsi[0]! >= 7) into.leftCensored++;
    // Episodes: first minute of each run of true PSI ≥ 7.
    for (let i = 0; i < truthPsi.length; i++) {
      if (i > 0 && truthPsi[i]! >= 7 && truthPsi[i - 1]! < 7) {
        into.episodes++;
        let first = -1;
        for (let j = Math.max(0, i - 60); j < i; j++) if (level[j]! >= 2) {
          first = j;
          break;
        }
        if (first >= 0) {
          into.detected++;
          into.leadTimes.push(minute(i) - minute(first));
        } else if (level[i]! >= 2) into.simultaneous++;
        else into.missed++;
      }
    }
    // Warning onsets: transitions into amber or red.
    for (let i = 0; i < level.length; i++) {
      if (level[i]! >= 2 && (i === 0 || level[i - 1]! < 2)) {
        into.warningOnsets++;
        const horizon = truthPsi.slice(i, i + 61);
        if (!horizon.some((p) => p >= 7) && i + 60 < truthPsi.length) into.falseAlarms++;
        else if (!horizon.some((p) => p >= 7)) { into.warningOnsets--; into.rightCensored++; } // not enough time left to judge
      }
    }
  }
}

export function runBacktest(template: ScenarioTemplate, weather: OpenMeteoHourly, days = 31, uncertainty: RunOptions['uncertainty'] = {}): BacktestReport {
  const totals = Object.fromEntries(POLICIES.map((p) => [p.id, emptyTotals()])) as Record<BacktestPolicy, PolicyTotals>;
  const byWindow = Object.fromEntries(WINDOWS.map((w) => [w.id, Object.fromEntries(POLICIES.map((p) => [p.id, emptyTotals()]))])) as BacktestReport['byWindow'];
  const warning: WarningPerformance = { episodes: 0, detected: 0, simultaneous: 0, missed: 0, leftCensored: 0, rightCensored: 0, leadTimes: [], warningOnsets: 0, falseAlarms: 0 };

  for (let d = 1; d <= days; d++) {
    const date = `2025-08-${String(d).padStart(2, '0')}`;
    for (const window of WINDOWS) {
      const scenario = weatherOnly(buildScenario(template, weather, { date, start: window.start, end: window.end }));
      const environment = createEnvironment(scenario);
      const exposureBefore = Object.fromEntries(scenario.workers.map((w) => [w.id, w.priorExposureMin]));
      const runs: Record<BacktestPolicy, RunResult> = {
        'no-action': runShift(scenario, { policy: 'baseline' as Policy, environment, uncertainty }),
        'site-flags': runShift(scenario, { policy: 'site-flags', environment, uncertainty }),
        'heatline-warnings': runShift(scenario, { policy: 'heatline', environment, uncertainty }),
        'heatline-plan': runShift(scenario, {
          policy: 'heatline',
          environment, uncertainty,
          decisions: [{ at: scenario.start, plan: protectivePlan({ scenario, effectiveAt: scenario.start, zoneWbgt: environment.zoneWbgt, exposureBefore }) }],
        }),
      };
      warningPerformance(runs['no-action'], warning);
      for (const p of POLICIES) {
        const m = runMetrics(scenario, runs[p.id]);
        const screen = screenExposure(scenario, runs[p.id]);
        for (const t of [totals[p.id], byWindow[window.id]![p.id]]) {
          t.shifts++;
          t.nioshExceededWindows += screen.exceededWindows;
          t.nioshAssessedWindows += screen.assessedWindows;
          t.workerMinutesPsi7 += m.minutesPsi7;
          t.workerMinutesPsi9 += m.minutesPsi9;
          t.redFlags += m.redFlags;
          t.minutesToCooling.push(...m.minutesToCooling.filter(Number.isFinite));
          t.violationEpisodes += m.violationEpisodes;
          t.restWorkerMinutes += m.restMinutes;
          if (m.pourFinishedAt !== null) t.poursFinished++;
        }
      }
    }
  }
  return {
    generated: new Date().toISOString(),
    days,
    windows: WINDOWS,
    policies: POLICIES,
    totals,
    byWindow,
    warning,
    note: 'Simulation results from a teaching physiology model driven by real ERA5 weather for August 2025 near Saadiyat. They show how the warning and planning logic behaves across real conditions; they are not evidence of injuries prevented in the real world.',
  };
}
