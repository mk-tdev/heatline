// The crew-level context Noor reads, built from a scheduler run at one minute. Shared by the
// page and the evaluation, so both send exactly what the supervisor's board shows.
import { formatClock } from '@heatline/contracts';
import type { Minute } from '@heatline/contracts';
import type { WatchCrew, WatchRun } from './watch';

const TASK: Record<string, string> = { rebar: 'Rebar tying, heavy', concrete: 'Concrete placing, heavy', facade: 'Façade fixing, moderate' };
const SOURCE = { station: 'site station', 'station-stale': 'site station, delayed', forecast: 'forecast only' } as const;
/** Share of the limit as shown on the board: only a real breach reads 100% or more. */
export const limitShare = (ratio: number) => (ratio > 1 ? Math.round(ratio * 100) : Math.min(99, Math.round(ratio * 100)));

export function watchContext(run: WatchRun, minute: Minute, crews: WatchCrew[]) {
  const rec = run.minutes.find((m) => m.minute === minute) ?? run.minutes[run.minutes.length - 1]!;
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    clock: formatClock(rec.minute),
    site: {
      wbgtSun: r1(rec.estimate.sun), wbgtShade: r1(rec.estimate.shade), source: SOURCE[rec.source], forecastSun: r1(rec.forecast.sun),
      forecastSunInHour: r1((run.minutes.find((m) => m.minute === rec.minute + 60) ?? run.minutes[run.minutes.length - 1]!).forecast.sun),
      biasC: r1(rec.bias), marginC: rec.margin, dust: rec.dust, pm10: rec.pm10 === null ? null : Math.round(rec.pm10),
    },
    // One entry per crew group: acclimatised workers and workers on the new-worker limit can have different breaks.
    crews: crews.flatMap((c) => rec.groups.filter((g) => g.crew === c.id).map((g) => ({
      crew: c.id,
      workers: (c.groups.length === 1 ? 'whole crew' : g.tier === 'standard' ? 'acclimatised workers' : 'workers on the new-worker limit') as 'whole crew' | 'acclimatised workers' | 'workers on the new-worker limit',
      task: TASK[c.taskId] ?? c.taskId,
      status: (g.status === 'work' ? 'working' : g.status === 'rest' ? 'resting' : g.status === 'capped' ? 'indoor work' : 'off shift') as 'working' | 'resting' | 'indoor work' | 'off shift',
      limitSharePct: limitShare(g.ratio), limitShareIn30MinPct: g.in30 === null ? null : limitShare(g.in30),
      nextBreak: g.nextBreak ? formatClock(g.nextBreak.at) : null, breakLengthMin: g.nextBreak ? g.nextBreak.forMin : null,
      restingUntil: g.resumeAt !== null ? formatClock(g.resumeAt) : null,
      restPlace: g.restPlace === 'cool-room' ? 'the cooled room' : 'shade',
    }))),
    // Recent alerts still in force: the last 30 minutes, without break notices whose break has begun.
    alerts: run.alerts
      .filter((a) => a.minute <= rec.minute && rec.minute - a.minute <= 30 && !((a.kind === 'break-soon' || a.kind === 'break-moved') && a.due !== undefined && a.due <= rec.minute))
      .slice(-8).map((a) => ({ time: formatClock(a.minute), level: a.level, title: a.title, action: a.action })),
  };
}
