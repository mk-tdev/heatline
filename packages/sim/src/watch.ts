// Site watch: the live scheduler. Every minute it
//   1. fuses the site station with the forecast (station.ts),
//   2. tracks each crew's rolling one-hour exposure (time-weighted WBGT and metabolic rate,
//      as NIOSH 2016-106 prescribes) against the NIOSH limit for that workload,
//   3. projects forward to find when the next break is needed and how long it must be,
//   4. raises proactive, explained alerts before the limit is reached.
//
// It sees crews, tasks, work history tiers and weather. It never receives a body measurement
// or a name. Pure and deterministic, so a replay of the same inputs gives the same alerts.

import type { Minute } from '@heatline/contracts';
import { formatClock } from '@heatline/contracts';
import { CABIN_WBGT } from './environment';
import { METABOLIC_W } from './physiology';
import { nioshLimitC } from './screening';
import { FUSION, correctionAhead, fuse, type CheckedReading, type ConditionSource, type FusionSettings } from './station';
import { task as taskProfile } from './profiles';
import { DUST_ADVICE, DUST_RANK, PM10_BANDS, dustLevel, type DustLevel } from './airquality';

export type Conditions = { sun: number; shade: number };

export interface WatchGroup {
  /** 'standard' uses the acclimatised limit; 'reduced' the unacclimatised limit and a daily heat-time cap */
  tier: 'standard' | 'reduced';
  headcount: number;
  /** heat-exposed work minutes allowed today (from acclimatisation profiles); Infinity for no cap */
  capMin: number;
}

export interface WatchCrew {
  id: string;
  label: string;
  taskId: string;
  inSun: boolean;
  clothingAdjustC: number;
  rest: 'shade' | 'cool-room';
  /** a lighter task in the shade the crew can rotate to instead of resting (e.g. rebar cutting under a canopy) */
  rotation?: { label: string; watts: number; indoor?: boolean };
  groups: WatchGroup[];
}

export interface WatchInput {
  date: string;
  shifts: { from: Minute; to: Minute }[];
  crews: WatchCrew[];
  /** the forecast at a minute (WBGT in sun and shade) */
  forecast: (m: Minute) => Conditions;
  /** what conditions really were (replay and evaluation only); the scheduler never sees it */
  truth?: (m: Minute) => Conditions;
  /** quality-checked station readings, in time order */
  readings: CheckedReading[];
  /** PM10 at a minute from the air-quality model [µg/m³] */
  pm10?: (m: Minute) => number | null;
  /** 'follow': crews take breaks when the scheduler says. 'fixed': a fixed 50/10 routine, alerts ignored */
  policy: 'follow' | 'fixed';
  fusion?: FusionSettings;
  /** how far ahead a break is announced [min] */
  noticeMin?: number;
  /** how far the scheduler looks ahead [min] */
  horizonMin?: number;
  /** keep a per-minute record (for the page); off for bulk evaluation */
  record?: boolean;
}

export type AlertKind = 'break-soon' | 'break-moved' | 'break-now' | 'over-limit' | 'cap' | 'rest-place' | 'hotter' | 'sensor' | 'dust';
export type AlertLevel = 'info' | 'watch' | 'act' | 'urgent';

export interface WatchAlert {
  id: string;
  minute: Minute;
  kind: AlertKind;
  level: AlertLevel;
  crew?: string;
  tier?: WatchGroup['tier'];
  title: string;
  action: string;
  /** the reasoning, as numbered facts a supervisor can check */
  why: string[];
  /** projected share of the limit, with the recommended action and without it (every 5 min) */
  projection?: { minute: Minute; withAction: number; without: number }[];
  /** for break alerts: when the break is due and how long */
  due?: Minute;
  forMin?: number;
  /** for break alerts: rest, or rotation to the crew's shaded lighter task */
  mode?: 'rest' | 'rotate';
}

export interface GroupMinute {
  crew: string;
  tier: WatchGroup['tier'];
  status: 'work' | 'rotate' | 'rest' | 'off' | 'capped';
  /** rolling one-hour average WBGT as the scheduler estimates it */
  twa: number;
  limit: number;
  /** twa / limit, as a share; above 1 is over the limit */
  ratio: number;
  heatMin: number;
  /** where the group rests now (the scheduler can move it from shade to the cooled room) */
  restPlace: WatchCrew['rest'];
  nextBreak: { at: Minute; forMin: number; mode: 'rest' | 'rotate' } | null;
  /** while on a break: when the scheduler expects work to resume */
  resumeAt: Minute | null;
  /** projected share of the limit 30 minutes from now, following the scheduler (record mode only) */
  in30: number | null;
  /** the same exposure on true conditions (replay and evaluation only) */
  truthRatio?: number;
}

export interface WatchMinute {
  minute: Minute;
  forecast: Conditions;
  estimate: Conditions;
  truth?: Conditions;
  station: number | null;
  source: ConditionSource;
  bias: number;
  margin: number;
  pm10: number | null;
  dust: DustLevel;
  groups: GroupMinute[];
}

export interface GroupSummary {
  crew: string;
  tier: WatchGroup['tier'];
  headcount: number;
  workMin: number;
  /** minutes on the shaded rotation task (productive, lighter) */
  rotateMin: number;
  shiftMin: number;
  /** minutes over the limit on true conditions while on shift */
  overLimitMin: number;
  breaks: { announcedAt: Minute | null; startedAt: Minute; lead: number | null }[];
  /** first minute over the limit on true conditions after each period under it */
  crossings: Minute[];
}

export interface WatchRun {
  date: string;
  minutes: WatchMinute[];
  alerts: WatchAlert[];
  groups: GroupSummary[];
}

const WINDOW = 60;
const MIN_REST = 10;
const RESUME_LOOKAHEAD = 15;
const GUARD_C = 0.1;
const REST_W = METABOLIC_W.rest;
const LIGHT_W = METABOLIC_W.light;

const limitFor = (watts: number, tier: WatchGroup['tier']) => nioshLimitC(Math.min(520, Math.max(115, watts)), tier === 'standard');

/** Last 60 minutes of exposure with running sums; cheap to copy for projections. */
class Rolling {
  w: Float64Array;
  m: Float64Array;
  i = 0;
  sw: number;
  sm: number;
  constructor(padW: number, padM: number, from?: Rolling) {
    if (from) {
      this.w = from.w.slice();
      this.m = from.m.slice();
      this.i = from.i;
      this.sw = from.sw;
      this.sm = from.sm;
    } else {
      this.w = new Float64Array(WINDOW).fill(padW);
      this.m = new Float64Array(WINDOW).fill(padM);
      this.sw = padW * WINDOW;
      this.sm = padM * WINDOW;
    }
  }
  push(w: number, m: number) {
    this.sw += w - this.w[this.i]!;
    this.sm += m - this.m[this.i]!;
    this.w[this.i] = w;
    this.m[this.i] = m;
    this.i = (this.i + 1) % WINDOW;
  }
  copy() { return new Rolling(0, 0, this); }
  get twa() { return this.sw / WINDOW; }
  get watts() { return this.sm / WINDOW; }
}

interface GroupState {
  crew: WatchCrew;
  group: WatchGroup;
  watts: number;
  est: Rolling;
  truth: Rolling;
  status: 'work' | 'rotate' | 'rest' | 'off' | 'capped';
  /** rotation task watts when the crew can rotate under this policy, else null */
  rotWatts: number | null;
  /** where the group rests; the scheduler can move it from shade to the cooled room */
  restPlace: WatchCrew['rest'];
  restStart: Minute;
  heatMin: number;
  /** announced break waiting to start */
  pending: { alert: string; announcedAt: Minute; due: Minute; forMin: number; mode: 'rest' | 'rotate' } | null;
  overAlert: boolean;
  capWarned: boolean;
  summary: GroupSummary;
  truthOver: boolean;
}

interface Exposure { workW: number; restW: number; rotW: number }

/** Exposure values for a crew from conditions: work area, where it rests, and its shaded rotation task. */
function exposure(crew: WatchCrew, c: Conditions, rest: WatchCrew['rest'] = crew.rest): Exposure {
  const work = (crew.inSun ? c.sun : c.shade) + crew.clothingAdjustC;
  const restW = rest === 'cool-room' ? CABIN_WBGT : c.shade + crew.clothingAdjustC;
  const rotW = crew.rotation?.indoor ? CABIN_WBGT : c.shade + crew.clothingAdjustC;
  return { workW: work, restW, rotW };
}

/** Margin by which the rotation task must sit under its own limit to count as recovery [°C]. */
export const ROTATION_GUARD_C = Number(globalThis.process?.env?.HEATLINE_ROT_GUARD ?? 0.5);
/**
 * Rotate only to a task that is sustainable in current conditions: done continuously, its heat and
 * effort sit at least ROTATION_GUARD_C under its own NIOSH limit, so the rolling hour falls while the
 * crew keeps working. And this minute must not breach the limit.
 */
function canRotate(r: Rolling, e: Exposure, rotWatts: number, tier: WatchGroup['tier']): boolean {
  if (e.rotW > limitFor(rotWatts, tier) - ROTATION_GUARD_C) return false;
  const twa = r.twa + (e.rotW - r.w[r.i]!) / WINDOW;
  const m = r.watts + (rotWatts - r.m[r.i]!) / WINDOW;
  return twa <= limitFor(m, tier) - GUARD_C;
}

/**
 * During relief from the main task: rotate to the shaded lighter task if that keeps a clear margin,
 * otherwise rest. Once resting, stay resting until the main task resumes (no flip-flopping).
 * Pushes the minute and returns what was done.
 */
function relief(r: Rolling, e: Exposure, rotWatts: number | null, tier: WatchGroup['tier'], previous: 'rotate' | 'rest' | 'work' = 'work'): 'rotate' | 'rest' {
  if (rotWatts !== null && previous !== 'rest' && canRotate(r, e, rotWatts, tier)) {
    r.push(e.rotW, rotWatts);
    return 'rotate';
  }
  r.push(e.restW, REST_W);
  return 'rest';
}

/** Can the group work this minute and stay under its limit? */
function canWork(r: Rolling, e: Exposure, watts: number, tier: WatchGroup['tier']): boolean {
  const twa = r.twa + (e.workW - r.w[r.i]!) / WINDOW;
  const m = r.watts + (watts - r.m[r.i]!) / WINDOW;
  return twa <= limitFor(m, tier) - GUARD_C;
}

/** Would `minutes` of work starting now stay under the limit throughout? */
function canResume(r: Rolling, at: (k: number) => Exposure, watts: number, tier: WatchGroup['tier'], minutes: number): boolean {
  const p = r.copy();
  for (let k = 0; k < minutes; k++) {
    const e = at(k);
    if (!canWork(p, e, watts, tier)) return false;
    p.push(e.workW, watts);
  }
  return true;
}

/** The scheduler's decision for one minute, given the state before it. */
/** 'rest' here means relief from the main task; whether that is rest or rotation is chosen by relief(). */
function decide(status: GroupState['status'], restStart: Minute, minute: Minute, r: Rolling, at: (k: number) => Exposure, watts: number, tier: WatchGroup['tier']): 'work' | 'rest' {
  if (status === 'work' || status === 'off') return canWork(r, at(0), watts, tier) ? 'work' : 'rest';
  if (minute - restStart < MIN_REST) return 'rest';
  return canResume(r, at, watts, tier, RESUME_LOOKAHEAD) ? 'work' : 'rest';
}

/** Project the scheduler forward on estimated conditions: when the next break starts and how long it lasts. */
function projectBreak(s: GroupState, minute: Minute, inShift: (m: Minute) => boolean, at: (k: number) => Exposure, horizon: number): { at: Minute; forMin: number; mode: 'rest' | 'rotate' } | null {
  if (s.status !== 'work') return null;
  const r = s.est.copy();
  let status: 'work' | 'rest' = 'work';
  let restStart = -Infinity;
  let breakAt: Minute | null = null;
  let mode: 'rest' | 'rotate' = 'rest';
  let prev: 'rotate' | 'rest' | 'work' = 'work';
  for (let k = 0; k < horizon; k++) {
    const m = minute + k;
    if (!inShift(m)) return breakAt === null ? null : { at: breakAt, forMin: m - breakAt, mode };
    const atK = (j: number) => at(k + j);
    const next = decide(status, restStart, m, r, atK, s.watts, s.group.tier);
    const e = at(k);
    if (next === 'rest' && status === 'work') {
      if (breakAt !== null) return { at: breakAt, forMin: m - breakAt, mode };
      restStart = m;
      breakAt = m;
    }
    if (next === 'work' && status === 'rest' && breakAt !== null) return { at: breakAt, forMin: m - breakAt, mode };
    status = next;
    if (next === 'work') { r.push(e.workW, s.watts); prev = 'work'; }
    else {
      prev = relief(r, e, s.rotWatts, s.group.tier, prev);
      if (m === breakAt) mode = prev;
    }
  }
  return breakAt === null ? null : { at: breakAt, forMin: minute + horizon - breakAt, mode };
}

/** Projected share of the limit over the next hour: following the scheduler, and working straight through. */
function projectRatios(s: GroupState, minute: Minute, at: (k: number) => Exposure, horizon = 60): { minute: Minute; withAction: number; without: number }[] {
  const a = s.est.copy();
  const b = s.est.copy();
  let status: 'work' | 'rest' = s.status === 'rest' || s.status === 'rotate' ? 'rest' : 'work';
  let restStart = s.restStart;
  const out: { minute: Minute; withAction: number; without: number }[] = [];
  let prevA: 'rotate' | 'rest' | 'work' = s.status === 'rotate' ? 'rotate' : s.status === 'rest' ? 'rest' : 'work';
  for (let k = 0; k <= horizon; k++) {
    const m = minute + k;
    const e = at(k);
    const next = decide(status, restStart, m, a, (j) => at(k + j), s.watts, s.group.tier);
    if (next === 'rest' && status === 'work') restStart = m;
    status = next;
    if (next === 'work') { a.push(e.workW, s.watts); prevA = 'work'; }
    else prevA = relief(a, e, s.rotWatts, s.group.tier, prevA);
    b.push(e.workW, s.watts);
    if (k % 5 === 0) out.push({ minute: m, withAction: a.twa / limitFor(a.watts, s.group.tier), without: b.twa / limitFor(b.watts, s.group.tier) });
  }
  return out;
}

const SOURCE_WORDS: Record<ConditionSource, string> = { station: 'site station', 'station-stale': 'site station, last reading delayed', forecast: 'forecast only' };
const restWords = (rest: WatchCrew['rest']) => (rest === 'cool-room' ? 'the cooled rest room' : 'shade');
const tierWords = (tier: WatchGroup['tier']) => (tier === 'standard' ? 'acclimatised workers' : 'workers on the new-worker limit');
const f1 = (x: number) => x.toFixed(1);

export function runWatch(input: WatchInput): WatchRun {
  const fusion = input.fusion ?? FUSION;
  const notice = input.noticeMin ?? 15;
  const horizon = input.horizonMin ?? 90;
  const start = Math.min(...input.shifts.map((s) => s.from));
  const end = Math.max(...input.shifts.map((s) => s.to));
  const inShift = (m: Minute) => input.shifts.some((s) => m >= s.from && m < s.to);
  const shiftOf = (m: Minute) => input.shifts.find((s) => m >= s.from && m < s.to);
  const alerts: WatchAlert[] = [];
  const minutes: WatchMinute[] = [];
  let seq = 0;
  const raise = (a: Omit<WatchAlert, 'id'>) => {
    const alert = { id: `a${String(++seq).padStart(3, '0')}`, ...a };
    alerts.push(alert);
    return alert;
  };

  const f0 = input.forecast(start);
  const states: GroupState[] = input.crews.flatMap((crew) => {
    const watts = taskProfile(crew.taskId).watts;
    return crew.groups.filter((g) => g.headcount > 0).map((group) => {
      // Before the shift: resting, as at the camp or on the bus (conservatively in shade).
      const pad = crew.rest === 'cool-room' ? CABIN_WBGT : f0.shade;
      return {
        crew, group, watts,
        est: new Rolling(pad, REST_W),
        truth: new Rolling(pad, REST_W),
        status: 'off' as const,
        rotWatts: input.policy === 'follow' && crew.rotation ? crew.rotation.watts : null,
        restPlace: crew.rest,
        restStart: -Infinity,
        heatMin: 0,
        pending: null,
        overAlert: false,
        capWarned: false,
        truthOver: false,
        summary: { crew: crew.id, tier: group.tier, headcount: group.headcount, workMin: 0, rotateMin: 0, shiftMin: 0, overLimitMin: 0, breaks: [], crossings: [] },
      };
    });
  });

  let lastSource: ConditionSource | null = null;
  let hotRun = 0;
  let hotAlerted = false;
  let lastDust: DustLevel = 'clear';
  // Dust is smoothed over 15 minutes and only steps down after 30 minutes clearly below its band,
  // so a reading hovering on a threshold does not flicker.
  const pmWindow: number[] = [];
  let dustBelowSince: Minute | null = null;
  const bandFloor = (level: DustLevel) => (level === 'clear' ? 0 : PM10_BANDS[level]);

  for (let minute = start; minute < end; minute++) {
    const fc = input.forecast(minute);
    const fused = fuse(input.readings, (m) => input.forecast(m).sun, minute, fusion);
    const at = (k: number): Conditions => {
      const c = input.forecast(minute + k);
      const corr = correctionAhead(fused, k, fusion);
      return { sun: c.sun + corr, shade: c.shade + corr };
    };
    const est = at(0);
    const truth = input.truth?.(minute) ?? est;
    const onShift = inShift(minute);
    const station = fused.last && fused.ageMin === 0 ? fused.last.wbgt : null;
    const pm10Model = input.pm10?.(minute) ?? null;
    const pm10 = fused.last?.pm10 !== undefined && fused.ageMin <= fusion.staleAfterMin ? fused.last.pm10! : pm10Model;

    // ---- Site-level alerts -------------------------------------------------------------------
    if (onShift) {
      if (lastSource !== null && fused.source !== lastSource) {
        const why = [`Last station reading ${Number.isFinite(fused.ageMin) ? `${fused.ageMin} min ago` : 'never received'}.`, `Forecast WBGT in the sun now: ${f1(fc.sun)} °C.`];
        if (fused.source === 'station') raise({ minute, kind: 'sensor', level: 'info', title: 'Site station back online', action: 'Breaks are timed from the station again.', why: [...why, `Station reads ${f1(fused.last!.wbgt)} °C, ${f1(fused.bias)} °C from the forecast.`] });
        else if (fused.source === 'station-stale') raise({ minute, kind: 'sensor', level: 'watch', title: 'Site station has gone quiet', action: `Using its last reading and the forecast, with ${fusion.staleMarginC} °C added for safety. Check the station.`, why });
        else raise({ minute, kind: 'sensor', level: 'act', title: lastSource === 'station-stale' ? 'Site station offline: forecast only' : 'No site station: forecast only', action: `Breaks are timed from the forecast with ${fusion.forecastMarginC} °C added for safety, so crews rest more. Restore the station or take a manual WBGT reading.`, why });
      }
      lastSource = fused.source;
      const hot = fused.source === 'station' && fused.bias >= 1;
      hotRun = hot ? hotRun + 1 : fused.bias < 0.5 || fused.source !== 'station' ? 0 : hotRun;
      if (hotRun >= 15 && !hotAlerted) {
        hotAlerted = true;
        raise({ minute, kind: 'hotter', level: 'watch', title: `Site is ${f1(fused.bias)} °C hotter than forecast`, action: 'Breaks have been brought forward to match. Tell crew leads that the morning plan is out of date.', why: [`Station WBGT in the sun: ${f1(fused.last!.wbgt)} °C. Forecast for this minute: ${f1(fc.sun)} °C.`, 'Averaged over the last 30 min of readings, held for 15 min before alerting.', 'Concrete, steel and wind shelter on site often run hotter than the area forecast.'] });
      }
      if (hotAlerted && fused.bias < 0.5) hotAlerted = false;
      if (pm10 !== null) { pmWindow.push(pm10); if (pmWindow.length > 15) pmWindow.shift(); }
      const pmMean = pmWindow.length ? pmWindow.reduce((a, b) => a + b, 0) / pmWindow.length : null;
      const raw = dustLevel(pmMean);
      let dust: DustLevel = lastDust;
      if (DUST_RANK[raw] > DUST_RANK[lastDust]) { dust = raw; dustBelowSince = null; }
      else if (DUST_RANK[raw] < DUST_RANK[lastDust]) {
        const clearlyBelow = pmMean === null || pmMean < 0.85 * bandFloor(lastDust);
        if (!clearlyBelow) dustBelowSince = null;
        else if (dustBelowSince === null) dustBelowSince = minute;
        else if (minute - dustBelowSince >= 30) { dust = raw; dustBelowSince = null; }
      } else dustBelowSince = null;
      if (dust !== lastDust) {
        raise({ minute, kind: 'dust', level: dust === 'severe' ? 'urgent' : dust === 'unhealthy' ? 'act' : dust === 'elevated' ? 'watch' : 'info', title: DUST_ADVICE[dust].title, action: DUST_ADVICE[dust].action, why: [`PM10 ${Math.round(pmMean ?? 0)} µg/m³ over the last 15 min (${fused.last?.pm10 !== undefined && pm10 === fused.last.pm10 ? 'site sensor' : 'CAMS air-quality model, about 45 km grid'}).`, 'Bands follow the US EPA AQI breakpoints for PM10 (155, 255, 355 µg/m³), applied to short averages as a stricter screen. A level clears after 30 min clearly below it.'] });
        lastDust = dust;
      }
    }

    // ---- Crews ----------------------------------------------------------------------------------
    const groups: GroupMinute[] = [];
    for (const s of states) {
      const exAt = (k: number) => exposure(s.crew, at(k), s.restPlace);
      const e = exAt(0);
      const et = exposure(s.crew, truth, s.restPlace);
      const label = `Crew ${s.crew.id}${s.crew.groups.length > 1 ? ` (${tierWords(s.group.tier)})` : ''}`;
      let next: GroupState['status'];
      if (!onShift) next = 'off';
      else if (s.heatMin >= s.group.capMin) next = 'capped';
      else if (input.policy === 'fixed') {
        const shift = shiftOf(minute)!;
        next = (minute - shift.from) % 60 < 50 ? 'work' : 'rest';
      } else {
        next = decide(s.status, s.restStart, minute, s.est, exAt, s.watts, s.group.tier);
        // An announced break starts when announced, even if conditions eased since: crews were told.
        if (next === 'work' && s.status === 'work' && s.pending && minute >= s.pending.due) next = 'rest';
        // Relief: the shaded lighter task if it keeps the rolling hour under the limit, otherwise rest.
        if (next === 'rest' && s.rotWatts !== null && s.status !== 'rest' && canRotate(s.est, e, s.rotWatts, s.group.tier)) next = 'rotate';
      }

      if ((next === 'rest' || next === 'rotate') && s.status === 'work') {
        s.restStart = minute;
        const lead = s.pending ? minute - s.pending.announcedAt : null;
        s.summary.breaks.push({ announcedAt: s.pending?.announcedAt ?? null, startedAt: minute, lead });
        if (input.policy === 'follow' && !s.pending) {
          raise({ minute, kind: 'break-now', level: 'act', crew: s.crew.id, tier: s.group.tier, title: `${label}: break now`, action: `Stop and rest in ${restWords(s.restPlace)}. Drink a cup of water.`, why: ['The site turned hotter than projected, so this break could not be announced earlier.', `Rolling hour: WBGT ${f1(s.est.twa)} °C against a limit of ${f1(limitFor(s.est.watts, s.group.tier))} °C.`] });
        }
        s.pending = null;
      }
      if (next === 'capped' && !s.capWarned) {
        s.capWarned = true;
        raise({ minute, kind: 'cap', level: 'act', crew: s.crew.id, tier: s.group.tier, title: `${label}: today's heat-time cap reached`, action: 'Move them to indoor or shaded light work for the rest of the shift.', why: [`${s.heatMin} minutes of heat work so far today; today's cap from their build-up schedule is ${s.group.capMin}.`, 'Caps come from each worker’s days in the heat (work history), not from body measurements.'] });
      }

      // Exposure this minute.
      const working = next === 'work';
      const rotating = next === 'rotate';
      const capped = next === 'capped';
      const wE = working ? e.workW : rotating ? e.rotW : capped ? CABIN_WBGT : e.restW;
      const wT = working ? et.workW : rotating ? et.rotW : capped ? CABIN_WBGT : et.restW;
      const watts = working ? s.watts : rotating ? s.rotWatts! : capped ? LIGHT_W : REST_W;
      s.est.push(wE, watts);
      s.truth.push(wT, watts);
      s.status = next;
      if (working || rotating) s.heatMin++;

      const limitE = limitFor(s.est.watts, s.group.tier);
      const ratio = s.est.twa / limitE;
      const truthRatio = s.truth.twa / limitFor(s.truth.watts, s.group.tier);
      if (onShift) {
        s.summary.shiftMin++;
        if (working) s.summary.workMin++;
        if (rotating) s.summary.rotateMin++;
        const over = truthRatio > 1;
        if (over) s.summary.overLimitMin++;
        if (over && !s.truthOver) s.summary.crossings.push(minute);
        s.truthOver = over;
      }

      // Announce the next break ahead of time (both policies: under 'fixed', crews ignore it).
      let nextBreak: GroupMinute['nextBreak'] = null;
      if (onShift && (next === 'work')) {
        nextBreak = projectBreak(s, minute + 1, inShift, (k) => exAt(k + 1), horizon);
        // Shade too hot to recover in: a long break in shade becomes a short one in the cooled room.
        if (nextBreak && s.restPlace === 'shade' && nextBreak.forMin > 30 && input.policy === 'follow' && !s.pending) {
          const coolAt = (k: number) => exposure(s.crew, at(k + 1), 'cool-room');
          const cool = projectBreak(s, minute + 1, inShift, coolAt, horizon);
          if (cool && cool.forMin < nextBreak.forMin) {
            raise({ minute, kind: 'rest-place', level: 'watch', crew: s.crew.id, tier: s.group.tier, title: `${label}: rest in the cooled room, not shade`, action: 'Shade is not cool enough to recover in today. Send the crew to the cooled rest room for every break.', why: [`WBGT in shade now: ${f1(est.shade + s.crew.clothingAdjustC)} °C${s.crew.clothingAdjustC ? ' including clothing' : ''}; cooled room about ${CABIN_WBGT} °C.`, `The next break would need about ${nextBreak.forMin} min in shade, or ${cool.forMin} min in the cooled room.`, 'Less time resting means more time working, inside the same limit.'] });
            s.restPlace = 'cool-room';
            nextBreak = cool;
          }
        }
        // While a break is announced, the board shows exactly what was announced, unless it is formally moved.
        if (nextBreak && s.pending && nextBreak.at > s.pending.due - 3) nextBreak = { at: s.pending.due, forMin: s.pending.forMin, mode: s.pending.mode };
        if (nextBreak) {
          const inMin = nextBreak.at - minute;
          if (!s.pending && inMin <= notice) {
            const rot = nextBreak.mode === 'rotate' && s.crew.rotation ? s.crew.rotation : null;
            const a = raise({
              minute, kind: 'break-soon', level: 'watch', crew: s.crew.id, tier: s.group.tier, due: nextBreak.at, forMin: nextBreak.forMin, mode: nextBreak.mode,
              title: rot ? `${label}: rotate at ${formatClock(nextBreak.at)} for ${nextBreak.forMin} min` : `${label}: break at ${formatClock(nextBreak.at)} for ${nextBreak.forMin} min`,
              action: rot
                ? `At ${formatClock(nextBreak.at)}, move the crew to ${rot.label} for ${nextBreak.forMin} min, then back to ${taskProfile(s.crew.taskId).label.toLowerCase()}. Drink a cup of water on the way.`
                : `Finish the current task by ${formatClock(nextBreak.at)}, then rest in ${restWords(s.restPlace)} and drink a cup of water.`,
              why: [
                `Heat now: WBGT ${f1(est.sun)} °C in the sun (${SOURCE_WORDS[fused.source]}${fused.margin ? `, +${fused.margin} °C safety margin` : ''}).`,
                `Last hour for ${tierWords(s.group.tier)}: average WBGT ${f1(s.est.twa)} °C at ${Math.round(s.est.watts)} W (${taskProfile(s.crew.taskId).label.toLowerCase()}${s.crew.clothingAdjustC ? `, +${s.crew.clothingAdjustC} °C for clothing` : ''}).`,
                `NIOSH ${s.group.tier === 'standard' ? 'recommended exposure limit' : 'limit for unacclimatised workers'} at that workload: ${f1(limitE)} °C.`,
                rot
                  ? `Working straight on, the hour's average passes the limit at about ${formatClock(nextBreak.at)}. Rotating to the lighter task in shade (${rot.watts} W) keeps the crew working and brings the average back under; resting is the fallback if it does not.`
                  : `Working straight on, the hour's average passes the limit at about ${formatClock(nextBreak.at)}. A ${nextBreak.forMin}-minute break in ${restWords(s.restPlace)} brings it back under.`,
              ],
              projection: projectRatios(s, minute + 1, (k) => exAt(k + 1)),
            });
            s.pending = { alert: a.id, announcedAt: minute, due: nextBreak.at, forMin: nextBreak.forMin, mode: nextBreak.mode };
          } else if (s.pending && nextBreak.at <= s.pending.due - 3) {
            raise({ minute, kind: 'break-moved', level: 'act', crew: s.crew.id, tier: s.group.tier, due: nextBreak.at, forMin: nextBreak.forMin, mode: nextBreak.mode, title: `${label}: ${nextBreak.mode === 'rotate' ? 'rotation' : 'break'} moved earlier, to ${formatClock(nextBreak.at)}`, action: nextBreak.mode === 'rotate' && s.crew.rotation ? `Conditions are hotter than projected. Move the crew to ${s.crew.rotation.label} from ${formatClock(nextBreak.at)}.` : `Conditions are hotter than projected. Rest in ${restWords(s.restPlace)} from ${formatClock(nextBreak.at)}.`, why: [`Earlier projection: ${formatClock(s.pending.due)}. Heat now: WBGT ${f1(est.sun)} °C (${SOURCE_WORDS[fused.source]}).`] });
            s.pending.due = nextBreak.at;
            s.pending.forMin = nextBreak.forMin;
          }
        }
      }

      // Over the limit now (a fixed routine ignoring the scheduler, or rest that is too hot to recover).
      if (onShift && ratio > 1 && !s.overAlert) {
        s.overAlert = true;
        const restingInShade = !working && s.restPlace === 'shade';
        if (input.policy === 'follow') s.restPlace = 'cool-room';
        raise({ minute, kind: 'over-limit', level: 'urgent', crew: s.crew.id, tier: s.group.tier, title: `${label}: over the heat limit`, action: restingInShade ? 'Rest in shade is too hot to recover. Move them to the cooled room now; ask about dizziness, nausea and confusion.' : 'Stop heat work now. Rest in the cooled room until the alert clears; ask about dizziness, nausea and confusion.', why: [`Rolling hour: WBGT ${f1(s.est.twa)} °C at ${Math.round(s.est.watts)} W; NIOSH limit ${f1(limitE)} °C.`, `Over the limit by ${f1(s.est.twa - limitE)} °C.`] });
      }
      if (s.overAlert && ratio <= 0.97) s.overAlert = false;

      let resumeAt: Minute | null = null;
      let in30: number | null = null;
      if (onShift && input.record !== false && (next === 'work' || next === 'rest' || next === 'rotate')) {
        const proj = projectRatios(s, minute + 1, (k) => exAt(k + 1), 30);
        in30 = proj[proj.length - 1]!.withAction;
        if (next !== 'work') {
          const r = s.est.copy();
          let st: 'work' | 'rest' = 'rest';
          let how: 'rotate' | 'rest' | 'work' = next === 'rotate' ? 'rotate' : 'rest';
          for (let k = 1; k <= horizon && inShift(minute + k); k++) {
            st = decide(st, s.restStart, minute + k, r, (j) => exAt(k + j), s.watts, s.group.tier);
            if (st === 'work') { resumeAt = minute + k; break; }
            how = relief(r, exAt(k), s.rotWatts, s.group.tier, how);
          }
        }
      }
      groups.push({ crew: s.crew.id, tier: s.group.tier, status: next, twa: s.est.twa, limit: limitE, ratio, heatMin: s.heatMin, restPlace: s.restPlace, nextBreak, resumeAt, in30, truthRatio: input.truth ? truthRatio : undefined });
    }

    if (input.record !== false) {
      minutes.push({ minute, forecast: fc, estimate: est, truth: input.truth ? truth : undefined, station, source: fused.source, bias: fused.bias, margin: fused.margin, pm10, dust: dustLevel(pm10), groups });
    }
  }
  return { date: input.date, minutes, alerts, groups: states.map((s) => s.summary) };
}

/** Lead time of the scheduler's announcements against real limit crossings, for a run under the 'fixed' policy. */
export function crossingLeads(run: WatchRun, window = 90): { crossings: number; warned: number; leads: number[] } {
  let crossings = 0;
  let warned = 0;
  const leads: number[] = [];
  for (const g of run.groups) {
    for (const c of g.crossings) {
      crossings++;
      const prior = run.alerts.filter((a) => a.crew === g.crew && a.tier === g.tier && (a.kind === 'break-soon' || a.kind === 'break-moved' || a.kind === 'over-limit') && a.minute <= c && c - a.minute <= window);
      const first = prior.reduce<WatchAlert | null>((x, a) => (x && x.minute <= a.minute ? x : a), null);
      if (first && c - first.minute >= 5) {
        warned++;
        leads.push(c - first.minute);
      }
    }
  }
  return { crossings, warned, leads };
}
