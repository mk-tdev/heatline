// Data for the site-watch page: curated replay days, any past day fetched from Open-Meteo,
// today's forecast and air quality, station telemetry, and the scheduler runs.

import replay from '../../../../data/watch/replay-days.json';
import evaluation from '../../../../data/watch/evaluation.json';
import template from '../../../../data/scenario/saadiyat-tower.json';
import type { WeatherHour } from '@heatline/contracts';
import {
  checkReadings, conditionsFrom, dayAheadRows, defaultCrews, runWatch, shiftsFor, siteTruth, stationFrom, weatherRows,
  type CheckedReading, type OpenMeteoHourly, type StationReading, type WatchRun,
} from '@heatline/sim';

export { evaluation };

export interface ReplayDay {
  date: string;
  title: string;
  story: string;
  reanalysis: WeatherHour[];
  dayAhead: WeatherHour[];
  pm10: (number | null)[];
}

export const REPLAY_DAYS = replay.days as ReplayDay[];
export const REPLAY_SITE = replay.site;

const HOURLY = 'temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,shortwave_radiation,direct_radiation';

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  const body = (await r.json()) as T & { error?: boolean; reason?: string };
  if (!r.ok || body.error) throw new Error(body.reason ?? `weather service ${r.status}`);
  return body;
}

/** Any past day (from 2024) at a site: reanalysis, the forecast issued the day before, and PM10. */
export async function fetchReplayDay(date: string, latitude: number, longitude: number): Promise<ReplayDay> {
  const q = `latitude=${latitude.toFixed(3)}&longitude=${longitude.toFixed(3)}&start_date=${date}&end_date=${date}&wind_speed_unit=ms&timezone=auto`;
  const prev = HOURLY.split(',').map((v) => `${v}_previous_day1`).join(',');
  const [re, da, aq] = await Promise.all([
    getJson<OpenMeteoHourly>(`https://archive-api.open-meteo.com/v1/archive?${q}&hourly=${HOURLY}`),
    getJson<{ hourly: Record<string, number[] | string[]> }>(`https://previous-runs-api.open-meteo.com/v1/forecast?${q}&hourly=${prev}`),
    getJson<{ hourly: { time: string[]; pm10: (number | null)[] } }>(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&hourly=pm10`).catch(() => null),
  ]);
  return {
    date, title: 'A day you chose', story: 'Reanalysis weather, the forecast issued the day before, and modelled dust for this site.',
    reanalysis: weatherRows(re, date), dayAhead: dayAheadRows(da, date), pm10: aq ? aq.hourly.pm10.slice(0, 24) : Array(24).fill(null),
  };
}

/** Today's hourly forecast and PM10 at a site, with the site's UTC offset. */
export async function fetchToday(latitude: number, longitude: number): Promise<{ date: string; weather: WeatherHour[]; pm10: (number | null)[]; utcOffsetHours: number }> {
  const base = `latitude=${latitude.toFixed(3)}&longitude=${longitude.toFixed(3)}&wind_speed_unit=ms&timezone=auto&forecast_days=1`;
  const [fc, aq] = await Promise.all([
    getJson<OpenMeteoHourly & { utc_offset_seconds: number }>(`https://api.open-meteo.com/v1/forecast?${base}&hourly=${HOURLY}`),
    getJson<{ hourly: { time: string[]; pm10: (number | null)[] } }>(`https://air-quality-api.open-meteo.com/v1/air-quality?${base}&hourly=pm10`).catch(() => null),
  ]);
  const date = fc.hourly.time[0]!.slice(0, 10);
  return { date, weather: weatherRows(fc, date), pm10: aq ? aq.hourly.pm10.slice(0, 24) : Array(24).fill(null), utcOffsetHours: fc.utc_offset_seconds / 3600 };
}

/** Station readings stored for a site and date by the telemetry API. */
export async function fetchTelemetry(site: string, date: string): Promise<StationReading[]> {
  const r = await fetch(`/api/telemetry?date=${date}`, { headers: { 'x-heatline-site': site }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`telemetry ${r.status}`);
  const body = (await r.json()) as { readings: (Omit<StationReading, 'minute'> & { at: string })[] };
  return body.readings.map(({ at, ...rest }) => ({ minute: Number(at.slice(11, 13)) * 60 + Number(at.slice(14, 16)), ...rest }));
}

export type StationMode = 'on' | 'outage' | 'none';
export const OUTAGE = { from: 540, to: 720 };

export interface ReplayRuns {
  follow: WatchRun;
  fixed: WatchRun;
}

/** Both runs for a replay day: crews following Heatline's breaks, and a fixed 50/10 routine. */
export function replayRuns(day: ReplayDay, station: StationMode, rotation = true, latitude = REPLAY_SITE.latitude, longitude = REPLAY_SITE.longitude): ReplayRuns {
  const site = { latitude, longitude, utcOffsetHours: 4 };
  const forecast = conditionsFrom(day.dayAhead, day.date, site);
  const truth = siteTruth(conditionsFrom(day.reanalysis, day.date, site), day.date);
  const pm10 = (m: number) => day.pm10[Math.floor(m / 60)] ?? null;
  const readings = station === 'none' ? [] : stationFrom(truth, day.date, 300, 1200, station === 'outage' ? [OUTAGE] : [], pm10);
  const common = { date: day.date, shifts: shiftsFor(day.date), crews: defaultCrews(day.date, template.workers, { rotation }), forecast, truth, readings, pm10 };
  return { follow: runWatch({ ...common, policy: 'follow' }), fixed: runWatch({ ...common, policy: 'fixed' }) };
}

/** Today's run at a site: forecast, plus any station readings so far. */
export function liveRun(date: string, weather: WeatherHour[], pm10: (number | null)[], readings: StationReading[], latitude: number, longitude: number, utcOffsetHours: number): { run: WatchRun; rejected: number } {
  const forecast = conditionsFrom(weather, date, { latitude, longitude, utcOffsetHours });
  const checked = checkReadings(readings);
  const run = runWatch({ date, shifts: shiftsFor(date), crews: defaultCrews(date, template.workers, { rotation: true }), forecast, readings: checked.ok as CheckedReading[], pm10: (m) => pm10[Math.floor(m / 60)] ?? null, policy: 'follow' });
  return { run, rejected: checked.rejected.length };
}

export const crewsFor = (date: string, rotation = true) => defaultCrews(date, template.workers, { rotation });
