// On-site telemetry: readings from a WBGT meter or weather station on the work area, quality
// control, and fusion with the forecast. Pure functions; no storage.
//
// WBGT from components follows ISO 7243 for outdoor work in the sun:
//   WBGT = 0.7 · natural wet-bulb + 0.2 · globe + 0.1 · air temperature.
// A meter placed in the sun on the work area (OSHA placement guidance) is treated as the
// "sun" reading; the forecast's sun/shade difference is kept for shaded rest areas.

import type { Minute } from '@heatline/contracts';

export interface StationReading {
  /** minutes since local midnight on the plan date */
  minute: Minute;
  /** WBGT as reported by the meter [°C] */
  wbgt?: number;
  /** air temperature [°C] */
  ta?: number;
  /** relative humidity [%] */
  rh?: number;
  /** black globe temperature [°C] (radiant heat) */
  tg?: number;
  /** natural wet-bulb temperature [°C] */
  tnwb?: number;
  /** wind speed [m/s] */
  wind?: number;
  /** particulate matter [µg/m³] */
  pm10?: number;
  pm25?: number;
}

export type RejectReason = 'no-wbgt' | 'out-of-range' | 'jump' | 'duplicate';

/** WBGT for one reading: the meter's own value, or ISO 7243 from its components. */
export function stationWbgt(r: StationReading): number | null {
  if (r.wbgt !== undefined && Number.isFinite(r.wbgt)) return r.wbgt;
  if (r.tnwb !== undefined && r.tg !== undefined && r.ta !== undefined && [r.tnwb, r.tg, r.ta].every(Number.isFinite)) {
    return 0.7 * r.tnwb + 0.2 * r.tg + 0.1 * r.ta;
  }
  return null;
}

export interface CheckedReading {
  minute: Minute;
  wbgt: number;
  pm10?: number;
}

/**
 * Quality control: drop readings without a WBGT, physically implausible values, and jumps of
 * more than 3 °C between consecutive accepted readings within five minutes (a knocked or
 * sun-flashed sensor). Readings are sorted by time; duplicates keep the first.
 */
export function checkReadings(readings: StationReading[]): { ok: CheckedReading[]; rejected: { minute: Minute; reason: RejectReason }[] } {
  const ok: CheckedReading[] = [];
  const rejected: { minute: Minute; reason: RejectReason }[] = [];
  const sorted = [...readings].sort((a, b) => a.minute - b.minute);
  for (const r of sorted) {
    const wbgt = stationWbgt(r);
    const last = ok[ok.length - 1];
    if (wbgt === null) rejected.push({ minute: r.minute, reason: 'no-wbgt' });
    else if (wbgt < 5 || wbgt > 45 || (r.rh !== undefined && (r.rh < 0 || r.rh > 100))) rejected.push({ minute: r.minute, reason: 'out-of-range' });
    else if (last && last.minute === r.minute) rejected.push({ minute: r.minute, reason: 'duplicate' });
    else if (last && r.minute - last.minute <= 5 && Math.abs(wbgt - last.wbgt) > 3) rejected.push({ minute: r.minute, reason: 'jump' });
    else ok.push({ minute: r.minute, wbgt, pm10: r.pm10 !== undefined && r.pm10 >= 0 && r.pm10 < 5000 ? r.pm10 : undefined });
  }
  return { ok, rejected };
}

export type ConditionSource = 'station' | 'station-stale' | 'forecast';

export interface FusionSettings {
  /** readings older than this are "stale" [min] */
  staleAfterMin: number;
  /** with no reading for this long, fall back to the forecast alone [min] */
  fallbackAfterMin: number;
  /** extra °C added when running on a stale station */
  staleMarginC: number;
  /** extra °C added when running on the forecast alone (no station, or station down) */
  forecastMarginC: number;
  /** how long a measured bias is trusted into the future [min, e-folding] */
  biasMemoryMin: number;
}

/** Defaults. The margins are Heatline's conservative choices, not published values. */
export const FUSION: FusionSettings = { staleAfterMin: 10, fallbackAfterMin: 45, staleMarginC: 0.5, forecastMarginC: 1.0, biasMemoryMin: 180 };

export interface Fused {
  source: ConditionSource;
  /** station minus forecast, averaged over the last 30 min of readings [°C] */
  bias: number;
  /** safety margin added for missing or stale data [°C] */
  margin: number;
  /** minutes since the last accepted reading (Infinity when none) */
  ageMin: number;
  /** last accepted reading, if any */
  last: CheckedReading | null;
}

/**
 * How far the site is running from the forecast right now, from readings up to `now`.
 * `forecastSun(minute)` is the forecast WBGT in the sun at that minute.
 */
export function fuse(readings: CheckedReading[], forecastSun: (m: Minute) => number, now: Minute, settings: FusionSettings = FUSION): Fused {
  let lastIndex = -1;
  for (let i = readings.length - 1; i >= 0; i--) if (readings[i]!.minute <= now) { lastIndex = i; break; }
  if (lastIndex < 0) return { source: 'forecast', bias: 0, margin: settings.forecastMarginC, ageMin: Infinity, last: null };
  const last = readings[lastIndex]!;
  const ageMin = now - last.minute;
  let sum = 0;
  let n = 0;
  for (let i = lastIndex; i >= 0 && last.minute - readings[i]!.minute < 30; i--) {
    sum += readings[i]!.wbgt - forecastSun(readings[i]!.minute);
    n++;
  }
  const measured = sum / n;
  if (ageMin > settings.fallbackAfterMin) return { source: 'forecast', bias: 0, margin: settings.forecastMarginC, ageMin, last };
  if (ageMin > settings.staleAfterMin) {
    // Keep a fading memory of the bias, and add a margin for not knowing.
    return { source: 'station-stale', bias: measured * Math.exp(-ageMin / settings.biasMemoryMin), margin: settings.staleMarginC, ageMin, last };
  }
  return { source: 'station', bias: measured, margin: 0, ageMin, last };
}

/** Correction to apply `ahead` minutes after now: the bias fades, the margin stays. */
export const correctionAhead = (f: Fused, ahead: number, settings: FusionSettings = FUSION): number =>
  f.bias * Math.exp(-Math.max(0, ahead) / settings.biasMemoryMin) + f.margin;

// ---- CSV import from a WBGT meter export -------------------------------------------------------

const HEADERS: { key: keyof StationReading | 'time'; match: RegExp }[] = [
  { key: 'time', match: /^(time|timestamp|date.?time|formatted date.?time|date)$/i },
  { key: 'wbgt', match: /wet.?bulb.?globe|^wbgt/i },
  { key: 'tnwb', match: /natural.?wet.?bulb|^nwb|^tnwb/i },
  { key: 'tg', match: /globe/i },
  { key: 'rh', match: /humid|^rh/i },
  { key: 'wind', match: /wind.?speed|^wind/i },
  { key: 'pm10', match: /pm.?10/i },
  { key: 'pm25', match: /pm.?2\.?5/i },
  { key: 'ta', match: /^(temp|temperature|air.?temp|dry.?bulb|ta)\b/i },
];

/**
 * Read a CSV exported by a WBGT meter or station (for example a Kestrel LiNK export or a
 * generic logger). Columns are matched by name; the first column that looks like a time is
 * used. Only rows on `date` are kept. Fahrenheit columns (header containing °F or "F)") are
 * converted.
 */
export function parseStationCsv(text: string, date: string): { readings: StationReading[]; columns: string[]; skipped: number } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const split = (line: string) => line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
  // Some exports start with a few lines of device information; find the header row.
  const headerIndex = lines.findIndex((l) => /time|date/i.test(l) && /(temp|wbgt|globe|humid)/i.test(l));
  if (headerIndex < 0) return { readings: [], columns: [], skipped: lines.length };
  const header = split(lines[headerIndex]!);
  const map = new Map<number, { key: keyof StationReading | 'time'; fahrenheit: boolean }>();
  const used = new Set<string>();
  header.forEach((h, i) => {
    const hit = HEADERS.find((x) => x.match.test(h) && !used.has(x.key) && !(x.key === 'tg' && /wet.?bulb/i.test(h)));
    if (hit) {
      used.add(hit.key);
      map.set(i, { key: hit.key, fahrenheit: /°\s?f\b|\(f\)|\bdeg.?f\b/i.test(h) });
    }
  });
  const readings: StationReading[] = [];
  let skipped = 0;
  for (const line of lines.slice(headerIndex + 1)) {
    const cells = split(line);
    const r: StationReading = { minute: -1 };
    let stamp = '';
    map.forEach(({ key, fahrenheit }, i) => {
      const raw = cells[i] ?? '';
      if (key === 'time') { stamp = raw; return; }
      const v = Number(raw);
      if (raw === '' || !Number.isFinite(v)) return;
      (r as unknown as Record<string, number>)[key] = fahrenheit && ['wbgt', 'tnwb', 'tg', 'ta'].includes(key) ? ((v - 32) * 5) / 9 : v;
    });
    const minute = minuteOf(stamp, date);
    if (minute === null) { skipped++; continue; }
    r.minute = minute;
    readings.push(r);
  }
  return { readings, columns: [...map.values()].map((m) => m.key), skipped };
}

/** Minutes since midnight from "2026-08-22 14:05", "2026-08-22T14:05:30", "22/08/2026 2:05 PM" or "14:05" (date assumed). */
function minuteOf(stamp: string, date: string): number | null {
  const s = stamp.trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})/);
  const dmy = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})[ ,]+(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i);
  const timeOnly = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  let day: string | null = null;
  let h: number;
  let m: number;
  let ampm: string | undefined;
  if (iso) { day = iso[1]!; h = Number(iso[2]); m = Number(iso[3]); }
  else if (dmy) { day = `${dmy[3]}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`; h = Number(dmy[4]); m = Number(dmy[5]); ampm = dmy[6]; }
  else if (timeOnly) { h = Number(timeOnly[1]); m = Number(timeOnly[2]); ampm = timeOnly[3]; }
  else return null;
  if (ampm) h = (h % 12) + (/pm/i.test(ampm) ? 12 : 0);
  if (day !== null && day !== date) return null;
  return h < 24 && m < 60 ? h * 60 + m : null;
}
