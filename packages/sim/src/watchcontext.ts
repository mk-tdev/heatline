// The crew-level context Noor reads, built from a scheduler run at one minute. Shared by the
// page and the evaluation, so both send exactly what the supervisor's board shows.
import { formatClock } from '@heatline/contracts';
import type { Minute } from '@heatline/contracts';
import type { WatchAlert, WatchCrew, WatchRun } from './watch';

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
      status: (g.status === 'work' ? 'working' : g.status === 'rotate' ? 'indoor rotation' : g.status === 'rest' ? 'resting' : g.status === 'capped' ? 'indoor work' : 'off shift') as 'working' | 'indoor rotation' | 'resting' | 'indoor work' | 'off shift',
      limitSharePct: limitShare(g.ratio), limitShareIn30MinPct: g.in30 === null ? null : limitShare(g.in30),
      nextBreak: g.nextBreak ? formatClock(g.nextBreak.at) : null, breakLengthMin: g.nextBreak ? g.nextBreak.forMin : null, nextBreakKind: g.nextBreak ? (g.nextBreak.mode === 'rotate' ? 'indoor rotation' : 'rest') : null,
      restingUntil: g.resumeAt !== null ? formatClock(g.resumeAt) : null,
      restPlace: g.restPlace === 'cool-room' ? 'the cooled room' : 'shade',
      rotationTask: c.rotation ? c.rotation.label : null,
    }))),
    // Recent alerts still in force: the last 30 minutes, without break notices whose break has begun.
    alerts: run.alerts
      .filter((a) => a.minute <= rec.minute && rec.minute - a.minute <= 30 && !((a.kind === 'break-soon' || a.kind === 'break-moved') && a.due !== undefined && a.due <= rec.minute))
      .slice(-8).map((a) => ({ time: formatClock(a.minute), level: a.level, title: a.title, action: a.action })),
  };
}

/** What makes Noor brief on her own: significant changes on the board, at least `gapMin` apart. */
export interface NoorTrigger { minute: Minute; reason: string }
const TRIGGER_KINDS = new Set(['over-limit', 'break-moved', 'break-now', 'rest-place', 'cap', 'hotter', 'sensor', 'dust']);
export function noorTriggers(run: WatchRun, gapMin = 20): NoorTrigger[] {
  const out: NoorTrigger[] = [];
  const first = run.minutes[0]?.minute;
  if (first !== undefined) out.push({ minute: first + 15, reason: 'Start of shift' });
  for (const a of run.alerts) {
    const significant = a.level === 'urgent' || a.level === 'act' || TRIGGER_KINDS.has(a.kind);
    if (!significant) continue;
    const last = out[out.length - 1];
    if (last && a.minute - last.minute < gapMin) continue;
    out.push({ minute: a.minute, reason: a.title });
  }
  return out;
}

/** Crew-level summary of a shift (so far) for the end-of-shift record. Every number is computed here. */
export function shiftSummary(run: WatchRun, crews: WatchCrew[], until?: Minute) {
  const upto = run.minutes.filter((m) => until === undefined || m.minute <= until);
  const onShift = upto.filter((m) => m.groups.some((g) => g.status !== 'off'));
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const peak = onShift.reduce((a, m) => (m.estimate.sun > a.estimate.sun ? m : a), onShift[0] ?? upto[0]!);
  const dustMinutes = (lvl: string) => onShift.filter((m) => m.dust === lvl).length;
  const alerts = run.alerts.filter((a) => until === undefined || a.minute <= until);
  const count = (f: (a: WatchAlert) => boolean) => alerts.filter(f).length;
  const groups = crews.flatMap((c) => c.groups.map((g) => {
    const mins = onShift.map((m) => m.groups.find((x) => x.crew === c.id && x.tier === g.tier)).filter((x): x is NonNullable<typeof x> => !!x && x.status !== 'off');
    const breaks = alerts.filter((a) => a.crew === c.id && a.tier === g.tier && a.kind === 'break-soon');
    return {
      crew: c.id,
      workers: c.groups.length === 1 ? 'whole crew' : g.tier === 'standard' ? 'acclimatised workers' : 'workers on the new-worker limit',
      task: TASK[c.taskId] ?? c.taskId,
      headcount: g.headcount,
      mainTaskMin: mins.filter((x) => x.status === 'work').length,
      indoorRotationMin: mins.filter((x) => x.status === 'rotate').length,
      restMin: mins.filter((x) => x.status === 'rest').length,
      indoorCapMin: mins.filter((x) => x.status === 'capped').length,
      minutesOverLimitEstimated: mins.filter((x) => x.ratio > 1).length,
      peakLimitSharePct: mins.length ? limitShare(Math.max(...mins.map((x) => x.ratio))) : 0,
      breaksAnnounced: breaks.length,
      restMovedToCooledRoom: alerts.some((a) => a.crew === c.id && a.tier === g.tier && a.kind === 'rest-place'),
    };
  }));
  return {
    date: run.date,
    from: formatClock(onShift[0]?.minute ?? upto[0]!.minute),
    to: formatClock(onShift[onShift.length - 1]?.minute ?? upto[upto.length - 1]!.minute),
    shiftMinutes: onShift.length,
    peakWbgtSun: r1(peak.estimate.sun),
    peakAt: formatClock(peak.minute),
    maxSiteAboveForecastC: r1(Math.max(0, ...onShift.filter((m) => m.source === 'station').map((m) => m.bias))),
    stationMinutes: onShift.filter((m) => m.source === 'station').length,
    stationMissingMinutes: onShift.filter((m) => m.source !== 'station').length,
    dustMinutes: { elevated: dustMinutes('elevated'), unhealthy: dustMinutes('unhealthy'), severe: dustMinutes('severe') },
    peakPm10: Math.round(Math.max(0, ...onShift.map((m) => m.pm10 ?? 0))),
    alerts: {
      total: alerts.length,
      toActOn: count((a) => a.level === 'act' || a.level === 'urgent'),
      urgent: count((a) => a.level === 'urgent'),
      breaksAnnounced: count((a) => a.kind === 'break-soon'),
      breaksMovedEarlier: count((a) => a.kind === 'break-moved'),
      breaksUnannounced: count((a) => a.kind === 'break-now'),
      stationEvents: count((a) => a.kind === 'sensor'),
      dustEvents: count((a) => a.kind === 'dust'),
      capsReached: count((a) => a.kind === 'cap'),
    },
    groups,
  };
}
export type ShiftSummary = ReturnType<typeof shiftSummary>;
