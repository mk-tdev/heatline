// Build a runnable scenario from the site template and one day of Open-Meteo weather.

import type { Minute, Scenario, WeatherHour } from '@heatline/contracts';

export type ScenarioTemplate = Omit<Scenario, 'date' | 'weather'> & { defaultDate: string };

export interface OpenMeteoHourly {
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    surface_pressure: number[];
    wind_speed_10m: number[];
    shortwave_radiation: number[];
    direct_radiation: number[];
  };
}

export function weatherForDate(source: OpenMeteoHourly, date: string): WeatherHour[] {
  const h = source.hourly;
  const rows: WeatherHour[] = [];
  h.time.forEach((time, i) => {
    if (!time.startsWith(date)) return;
    rows.push({
      time,
      airC: h.temperature_2m[i]!,
      rhPct: h.relative_humidity_2m[i]!,
      pressureHpa: h.surface_pressure[i]!,
      wind10: h.wind_speed_10m[i]!,
      ssrd: h.shortwave_radiation[i]!,
      directRad: h.direct_radiation[i]!,
    });
  });
  if (rows.length !== 24) throw new Error(`Expected 24 hours of weather for ${date}, found ${rows.length}`);
  return rows;
}

export interface ScenarioOptions {
  date?: string;
  start?: Minute;
  end?: Minute;
}

export function buildScenario(template: ScenarioTemplate, weather: OpenMeteoHourly, options: ScenarioOptions): Scenario {
  const start = options.start ?? template.start;
  const end = options.end ?? template.end;
  // Timed events in the template are relative to the default 15:00 shift; shift them with the window.
  const offset = start - template.start;
  const shift = (m: Minute) => m + offset;
  const { defaultDate, ...site } = template;
  const date = options.date ?? defaultDate;
  return {
    ...site,
    date,
    start,
    end,
    pour: { ...template.pour, truckArrives: shift(template.pour.truckArrives) },
    networkOutage: template.networkOutage && { from: shift(template.networkOutage.from), to: shift(template.networkOutage.to) },
    weatherModifiers: template.weatherModifiers.map((m) => ({ ...m, from: shift(m.from), to: shift(m.to) })),
    workers: template.workers.map((w) => (w.batteryDiesAt === undefined ? w : { ...w, batteryDiesAt: shift(w.batteryDiesAt) })),
    weather: weatherForDate(weather, date),
  };
}
