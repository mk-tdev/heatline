// Inputs for a site-watch day: conditions from hourly weather, a site that runs hotter than the
// grid-square weather, a station on the work area, and the default crews. Used by the replay
// page and by the evaluation over two summers.
//
// SYNTHETIC ASSUMPTIONS, stated once here and in docs/scientific-basis.md:
// - The site runs hotter than the reanalysis grid square: +0.3 °C plus up to +0.9 °C with the
//   sun high (radiating concrete and steel), a day-to-day offset (SD 0.4 °C) and a slow wander
//   (SD 0.25 °C). No measurements back these numbers; they stand in for the site effects that
//   WBGT surveys on urban and construction sites report.
// - The station reads the site with noise (SD 0.2 °C) every minute, unless switched off.

import type { Minute, Scenario, WeatherHour } from '@heatline/contracts';
import { middayBanApplies } from '@heatline/rules';
import { createEnvironment } from './environment';
import { weatherRows } from './dayplan';
import { acclimatisation, historyOf } from './profiles';
import type { OpenMeteoHourly } from './scenario';
import type { CheckedReading } from './station';
import type { Conditions, WatchCrew } from './watch';
import { USUAL_EXPOSURE_MIN } from '@heatline/rules';

export const SITE = { latitude: 24.54, longitude: 54.43, utcOffsetHours: 4 };

/** WBGT in sun and shade at every minute of a day, from 24 hourly weather rows. */
export function conditionsFrom(weather: WeatherHour[], date: string, site = SITE): (m: Minute) => Conditions {
  const env = createEnvironment({
    id: 'watch', title: 'Site watch', date, utcOffsetHours: site.utcOffsetHours, latitude: site.latitude, longitude: site.longitude,
    start: 0, end: 1440, seed: 0, tower: { minX: 0, maxX: 0, minY: 0, maxY: 0, height: 0 }, zones: [], workers: [], tasks: [],
    pour: { crew: '', zone: '', truckArrives: 0, durationMin: 0, minCrew: 0 }, weatherModifiers: [], weather,
  } satisfies Scenario);
  const cache = new Map<number, Conditions>();
  return (m) => {
    const key = Math.max(0, Math.min(1439, Math.round(m)));
    let c = cache.get(key);
    if (!c) {
      const e = env.at(key);
      c = { sun: e.wbgtSun, shade: e.wbgtShade };
      cache.set(key, c);
    }
    return c;
  };
}

/** Rows from an Open-Meteo previous-runs response (variables suffixed `_previous_day1`). */
export function dayAheadRows(source: { hourly: Record<string, (number | null)[] | string[]> }, date: string): WeatherHour[] {
  const h = source.hourly;
  const pick = (name: string) => (h[`${name}_previous_day1`] ?? h[name]) as number[];
  return weatherRows({
    hourly: {
      time: h.time as string[],
      temperature_2m: pick('temperature_2m'),
      relative_humidity_2m: pick('relative_humidity_2m'),
      surface_pressure: pick('surface_pressure'),
      wind_speed_10m: pick('wind_speed_10m'),
      shortwave_radiation: pick('shortwave_radiation'),
      direct_radiation: pick('direct_radiation'),
    },
  } as OpenMeteoHourly, date);
}

/** Small deterministic random numbers (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(next() || 1e-9)) * Math.cos(2 * Math.PI * next());
  return { next, normal };
}

const seedOf = (date: string) => Number(date.replaceAll('-', '')) % 2147483647;

/** The site's real conditions: grid weather plus site effects (synthetic; see header). */
export function siteTruth(grid: (m: Minute) => Conditions, date: string, siteOffset = true): (m: Minute) => Conditions {
  if (!siteOffset) return grid;
  const r = rng(seedOf(date));
  const day = 0.4 * r.normal();
  // Hourly wander, interpolated to minutes.
  const wander: number[] = [];
  let w = 0;
  for (let h = 0; h <= 24; h++) { w = 0.7 * w + 0.25 * Math.sqrt(1 - 0.49) * r.normal(); wander.push(w); }
  return (m) => {
    const g = grid(m);
    const h = Math.floor(m / 60);
    const wv = wander[h]! + (wander[h + 1]! - wander[h]!) * ((m % 60) / 60);
    const sunPart = Math.max(0, g.sun - g.shade); // grows with direct sun
    const offset = 0.3 + Math.min(0.9, 0.45 * sunPart) + day + wv;
    return { sun: g.sun + offset, shade: g.shade + offset * 0.6 };
  };
}

/** A station reading the site every minute with noise; minutes inside `outages` are missing. */
export function stationFrom(truth: (m: Minute) => Conditions, date: string, from: Minute, to: Minute, outages: { from: Minute; to: Minute }[] = [], pm10?: (m: Minute) => number | null): CheckedReading[] {
  const r = rng(seedOf(date) ^ 0x5bd1e995);
  const out: CheckedReading[] = [];
  let e = 0;
  for (let m = from; m < to; m++) {
    e = 0.6 * e + 0.2 * Math.sqrt(1 - 0.36) * r.normal();
    if (outages.some((o) => m >= o.from && m < o.to)) continue;
    const p = pm10?.(m);
    out.push({ minute: m, wbgt: truth(m).sun + e, pm10: p === null || p === undefined ? undefined : Math.max(0, p * (1 + 0.1 * r.normal())) });
  }
  return out;
}

/** Hourly PM10 from an Open-Meteo air-quality response, as a function of the minute. */
export function pm10From(source: { hourly: { time: string[]; pm10: (number | null)[] } }, date: string): (m: Minute) => number | null {
  const values = new Map<number, number>();
  source.hourly.time.forEach((t, i) => {
    if (t.startsWith(date) && source.hourly.pm10[i] !== null) values.set(Number(t.slice(11, 13)), source.hourly.pm10[i]!);
  });
  return (m) => values.get(Math.floor(m / 60)) ?? null;
}

/** Shift windows: 06:00–19:00, with the midday break 12:30–15:00 in season. */
export function shiftsFor(date: string): { from: Minute; to: Minute }[] {
  return middayBanApplies(date, 750) ? [{ from: 360, to: 750 }, { from: 900, to: 1140 }] : [{ from: 360, to: 720 }, { from: 780, to: 1140 }];
}

/**
 * The demonstration site's crews, with acclimatisation worked out from each worker's days in
 * the heat (the same workers as the 3D site). Only crew-level groups leave this function.
 */
export function defaultCrews(date: string, workers: { crew: string; acclimatisationDay: number; experienced?: boolean }[], options: { rotation?: boolean } = {}): WatchCrew[] {
  // Each crew's shaded, lighter task to rotate to (when rotation is on). Watts are class estimates.
  const rotations: Record<string, WatchCrew['rotation']> = {
    A: { label: 'rebar cutting and bending in the cooled workshop', watts: 300, indoor: true },
    B: { label: 'formwork and fixings preparation in the cooled workshop', watts: 300, indoor: true },
    C: { label: 'panel sealing and inspection in the cooled store', watts: 180, indoor: true },
  };
  const base: Omit<WatchCrew, 'groups'>[] = [
    { id: 'A', label: 'Rebar yard', taskId: 'rebar', inSun: true, clothingAdjustC: 0, rest: 'cool-room' },
    { id: 'B', label: 'Level 12 deck', taskId: 'concrete', inSun: true, clothingAdjustC: 0, rest: 'cool-room' },
    { id: 'C', label: 'West façade', taskId: 'facade', inSun: true, clothingAdjustC: 1, rest: 'shade' },
  ];
  const crews = base.map((c) => (options.rotation ? { ...c, rotation: rotations[c.id] } : c));
  return crews.map((c) => {
    const tiers = workers.filter((w) => w.crew === c.id).map((w) => acclimatisation(historyOf(date, w.acclimatisationDay - 1), date));
    const standard = tiers.filter((t) => t.limit === 'REL');
    const reduced = tiers.filter((t) => t.limit === 'RAL');
    const cap = reduced.length ? Math.round(Math.min(...reduced.map((t) => t.exposureShare)) * USUAL_EXPOSURE_MIN) : Infinity;
    return {
      ...c,
      groups: [
        { tier: 'standard' as const, headcount: standard.length, capMin: Infinity },
        { tier: 'reduced' as const, headcount: reduced.length, capMin: cap },
      ].filter((g) => g.headcount > 0),
    };
  });
}
