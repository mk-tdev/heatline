// Shift plan for a real site and a real day, from weather alone. No simulated workers and no
// physiology model: hourly WBGT in sun and shade (Liljegren), then the longest work period per
// hour that keeps the hour's time-weighted exposure within the NIOSH limits (2016-106, REL for
// acclimatised workers, RAL for workers not yet used to the heat). Pure and deterministic.
//
// This is a planning aid built from gridded weather. It is not a measurement at the site and
// not a UAE compliance assessment; see docs/scientific-basis.md.

import type { Minute, Scenario, WeatherHour } from '@heatline/contracts';
import { dubaiFlag, type DubaiFlag } from '@heatline/climate';
import { MIDDAY_BAN, middayBanApplies } from '@heatline/rules';
import { CABIN_WBGT, createEnvironment } from './environment';
import { METABOLIC_W } from './physiology';
import { nioshLimitC } from './screening';
import type { OpenMeteoHourly } from './scenario';

export type RestPlace = 'shade' | 'cool-room';
export type DayLevel = 'green' | 'yellow' | 'amber' | 'red';

export interface DayPlanInput {
  date: string; // YYYY-MM-DD, local
  latitude: number;
  longitude: number;
  utcOffsetHours: number;
  weather: WeatherHour[]; // 24 hourly rows for the date
  /** first and last minute of the working day (defaults 05:00–19:00) */
  workStart?: Minute;
  workEnd?: Minute;
  /** where crews rest between work periods */
  rest?: RestPlace;
  /** clothing adjustment added to WBGT while working [°C] (0 work clothes, +1 coveralls, +3 double layer) */
  clothingAdjustC?: number;
  /** length of the paced task to place (a concrete pour) [min] */
  pourMinutes?: number;
  /** apply the UAE midday break (12:30–15:00, 15 Jun–15 Sep) */
  middayBan?: boolean;
}

export interface WorkMinutes {
  light: number;
  moderate: number;
  heavy: number;
}

export interface HourRow {
  /** first minute of the hour block */
  from: Minute;
  wbgtSun: number;
  wbgtShade: number;
  heatIndex: number;
  flag: DubaiFlag;
  /** the whole hour falls inside the midday break */
  banned: boolean;
  /** part of the hour falls inside the midday break */
  partlyBanned: boolean;
  /** most minutes of work in the sun per hour, acclimatised workers, resting where the plan says */
  work: WorkMinutes;
  /** the same for workers not yet used to the heat */
  workNew: WorkMinutes;
  level: DayLevel;
}

export interface PourWindow {
  from: Minute;
  to: Minute;
  meanWbgtSun: number;
  /** heavy paced work cannot pause, so the window is checked as continuous heavy work in the sun */
  withinLimit: boolean;
}

export interface DayPlan {
  input: Required<Omit<DayPlanInput, 'weather'>>;
  hours: HourRow[];
  peak: { minute: Minute; wbgtSun: number };
  /** span of hours in which heavy work in the sun needs rest periods (null on a mild day) */
  limited: { from: Minute; to: Minute } | null;
  /** tightest heavy-work allowance in the limited, non-banned hours [min per hour] */
  tightestHeavy: number;
  /** working hours after the midday break in which continuous moderate work is over the limit */
  afterBreakOverLimitHours: number;
  afterBreakHours: number;
  pour: { best: PourWindow | null; worst: PourWindow | null };
  seasonBan: boolean;
}

const REST_W = METABOLIC_W.rest;

/**
 * Longest work period in an hour [min, multiples of 5] such that the hour's time-weighted WBGT
 * stays within the NIOSH limit for the hour's time-weighted metabolic rate.
 */
export function maxWorkMinutes(wbgtWork: number, wbgtRest: number, watts: number, acclimatised: boolean): number {
  for (let work = 60; work >= 5; work -= 5) {
    const rest = 60 - work;
    const meanWatts = (work * watts + rest * REST_W) / 60;
    const meanWbgt = (work * wbgtWork + rest * wbgtRest) / 60;
    if (meanWbgt <= nioshLimitC(meanWatts, acclimatised)) return work;
  }
  return 0;
}

/**
 * Risk level for an hour, independent of the rest area the plan assumes: how much steady
 * moderate work the hour allows when the only relief is shade. Green: all hour. Yellow: at
 * least half. Amber: at least ten minutes. Red: less.
 */
const levelFor = (moderateMinWithShadeRest: number): DayLevel =>
  moderateMinWithShadeRest >= 60 ? 'green' : moderateMinWithShadeRest >= 30 ? 'yellow' : moderateMinWithShadeRest >= 10 ? 'amber' : 'red';

/** Pick the 24 rows for one date out of an Open-Meteo hourly response. */
export function weatherRows(source: OpenMeteoHourly, date: string): WeatherHour[] {
  const h = source.hourly;
  const rows: WeatherHour[] = [];
  h.time.forEach((time, i) => {
    if (!time.startsWith(date)) return;
    const values = [h.temperature_2m[i], h.relative_humidity_2m[i], h.surface_pressure[i], h.wind_speed_10m[i], h.shortwave_radiation[i], h.direct_radiation[i]];
    if (values.some((v) => v === null || v === undefined || !Number.isFinite(v))) return;
    rows.push({ time, airC: values[0]!, rhPct: values[1]!, pressureHpa: values[2]!, wind10: values[3]!, ssrd: values[4]!, directRad: values[5]! });
  });
  if (rows.length !== 24) throw new Error(`No complete weather for ${date} (${rows.length} of 24 hours)`);
  return rows;
}

export function buildDayPlan(input: DayPlanInput): DayPlan {
  const cfg = {
    date: input.date,
    latitude: input.latitude,
    longitude: input.longitude,
    utcOffsetHours: input.utcOffsetHours,
    workStart: input.workStart ?? 5 * 60,
    workEnd: input.workEnd ?? 19 * 60,
    rest: input.rest ?? 'cool-room',
    clothingAdjustC: input.clothingAdjustC ?? 0,
    pourMinutes: input.pourMinutes ?? 45,
    middayBan: input.middayBan ?? true,
  } satisfies Required<Omit<DayPlanInput, 'weather'>>;
  if (input.weather.length !== 24) throw new Error('A day plan needs 24 hours of weather');

  // The environment only needs the weather, the date and the place.
  const env = createEnvironment({
    id: 'day-plan', title: 'Day plan', date: cfg.date, utcOffsetHours: cfg.utcOffsetHours, latitude: cfg.latitude, longitude: cfg.longitude,
    start: cfg.workStart, end: cfg.workEnd, seed: 0, tower: { minX: 0, maxX: 0, minY: 0, maxY: 0, height: 0 }, zones: [], workers: [], tasks: [],
    pour: { crew: '', zone: '', truckArrives: 0, durationMin: cfg.pourMinutes, minCrew: 0 }, weatherModifiers: [], weather: input.weather,
  } satisfies Scenario);

  const banAt = (minute: Minute) => cfg.middayBan && middayBanApplies(cfg.date, minute);
  const seasonBan = cfg.middayBan && middayBanApplies(cfg.date, MIDDAY_BAN.from);

  const hours: HourRow[] = [];
  let peak = { minute: cfg.workStart, wbgtSun: -Infinity };
  for (let from = cfg.workStart; from < cfg.workEnd; from += 60) {
    // Mean over the hour, sampled every 10 minutes.
    const samples = [5, 15, 25, 35, 45, 55].map((m) => env.at(from + m));
    const mean = (pick: (e: (typeof samples)[number]) => number) => samples.reduce((s, e) => s + pick(e), 0) / samples.length;
    const wbgtSun = mean((e) => e.wbgtSun);
    const wbgtShade = mean((e) => e.wbgtShade);
    const heatIndex = mean((e) => e.heatIndex);
    for (const e of samples) if (e.wbgtSun > peak.wbgtSun) peak = { minute: e.minute, wbgtSun: e.wbgtSun };
    const restWbgt = cfg.rest === 'cool-room' ? CABIN_WBGT : wbgtShade;
    const workWbgt = wbgtSun + cfg.clothingAdjustC;
    const allow = (acclimatised: boolean): WorkMinutes => ({
      light: maxWorkMinutes(workWbgt, restWbgt, METABOLIC_W.light, acclimatised),
      moderate: maxWorkMinutes(workWbgt, restWbgt, METABOLIC_W.moderate, acclimatised),
      heavy: maxWorkMinutes(workWbgt, restWbgt, METABOLIC_W.heavy, acclimatised),
    });
    const bannedMinutes = [0, 10, 20, 30, 40, 50].filter((m) => banAt(from + m)).length;
    const work = allow(true);
    hours.push({ from, wbgtSun, wbgtShade, heatIndex, flag: dubaiFlag(heatIndex), banned: bannedMinutes === 6, partlyBanned: bannedMinutes > 0 && bannedMinutes < 6, work, workNew: allow(false), level: levelFor(maxWorkMinutes(workWbgt, wbgtShade, METABOLIC_W.moderate, true)) });
  }

  const open = hours.filter((h) => !h.banned);
  const needsRest = hours.filter((h) => h.work.heavy < 60);
  const limited = needsRest.length ? { from: needsRest[0]!.from, to: needsRest[needsRest.length - 1]!.from + 60 } : null;
  const tightest = open.filter((h) => h.work.heavy < 60);
  const afterBreak = hours.filter((h) => h.from >= MIDDAY_BAN.to);
  const continuousModerateOk = (h: HourRow) => h.wbgtSun + cfg.clothingAdjustC <= nioshLimitC(METABOLIC_W.moderate, true);

  // Pour windows: every 15-minute start inside the working day that avoids the midday break.
  const windows: PourWindow[] = [];
  for (let from = cfg.workStart; from + cfg.pourMinutes <= cfg.workEnd; from += 15) {
    const to = from + cfg.pourMinutes;
    let banned = false;
    let sum = 0;
    let n = 0;
    for (let m = from; m < to; m += 5) {
      if (banAt(m)) banned = true;
      sum += env.at(m).wbgtSun;
      n++;
    }
    if (banned) continue;
    const meanWbgtSun = sum / n;
    windows.push({ from, to, meanWbgtSun, withinLimit: meanWbgtSun + cfg.clothingAdjustC <= nioshLimitC(METABOLIC_W.heavy, true) });
  }
  const byHeat = [...windows].sort((a, b) => a.meanWbgtSun - b.meanWbgtSun || a.from - b.from);

  return {
    input: cfg,
    hours,
    peak,
    limited,
    tightestHeavy: tightest.length ? Math.min(...tightest.map((h) => h.work.heavy)) : 60,
    afterBreakOverLimitHours: afterBreak.filter((h) => !continuousModerateOk(h)).length,
    afterBreakHours: afterBreak.length,
    pour: { best: byHeat[0] ?? null, worst: byHeat[byHeat.length - 1] ?? null },
    seasonBan,
  };
}
