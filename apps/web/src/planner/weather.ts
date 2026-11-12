// Weather for one site and one day from Open-Meteo, straight from the browser (no key, and only
// the coordinates and the date leave the device). Forecasts for the coming days; ERA5-based
// reanalysis for past days. A bundled August 2025 day keeps the planner usable offline.

import bundled from '../../../../data/weather/abu-dhabi-2025-08.json';
import type { WeatherHour } from '@heatline/contracts';
import { weatherRows, type OpenMeteoHourly } from '@heatline/sim';

export interface DayWeather {
  weather: WeatherHour[];
  utcOffsetHours: number;
  /** where the numbers came from, for the page to say plainly */
  source: 'forecast' | 'recent' | 'reanalysis' | 'bundled';
  grid: { latitude: number; longitude: number };
}

const HOURLY = 'temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,shortwave_radiation,direct_radiation';
type Response = OpenMeteoHourly & { latitude: number; longitude: number; utc_offset_seconds: number; error?: boolean; reason?: string };

export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return isoDate(new Date(y, m - 1, d + days));
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export const BUNDLED_DATE = '2025-08-19';
export const BUNDLED_SITE = { latitude: 24.54, longitude: 54.43 };

export function bundledDay(): DayWeather {
  return { weather: weatherRows(bundled as OpenMeteoHourly, BUNDLED_DATE), utcOffsetHours: 4, source: 'bundled', grid: { latitude: 24.499, longitude: 54.423 } };
}

async function get(base: string, latitude: number, longitude: number, date: string): Promise<Response> {
  const query = `latitude=${latitude.toFixed(3)}&longitude=${longitude.toFixed(3)}&start_date=${date}&end_date=${date}&hourly=${HOURLY}&wind_speed_unit=ms&timezone=auto`;
  const r = await fetch(`${base}?${query}`, { signal: AbortSignal.timeout(12_000) });
  const body = (await r.json()) as Response;
  if (!r.ok || body.error) throw new Error(body.reason ?? `weather service ${r.status}`);
  return body;
}

export async function fetchDay(latitude: number, longitude: number, date: string, today = isoDate(new Date())): Promise<DayWeather> {
  const ahead = daysBetween(today, date);
  if (ahead > 15) throw new Error('Forecasts reach 15 days ahead. Pick an earlier day.');
  // The forecast service also serves the recent past; older days come from the reanalysis archive.
  const order: ['forecast' | 'reanalysis', string][] =
    ahead >= -60
      ? [['forecast', 'https://api.open-meteo.com/v1/forecast'], ['reanalysis', 'https://archive-api.open-meteo.com/v1/archive']]
      : [['reanalysis', 'https://archive-api.open-meteo.com/v1/archive']];
  let last: unknown;
  for (const [source, base] of order) {
    try {
      const body = await get(base, latitude, longitude, date);
      return { weather: weatherRows(body, date), utcOffsetHours: body.utc_offset_seconds / 3600, source: source === 'forecast' && ahead < 0 ? 'recent' : source, grid: { latitude: body.latitude, longitude: body.longitude } };
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error('Weather is unavailable');
}
