// Site environment per minute: interpolated weather, real sun position, tower shadow, and
// WBGT per zone (sun / shade / air-conditioned). Deterministic and cached per scenario.

import type { Environment, Minute, Plan, Point, Scenario, Zone, ZoneConditions } from '@heatline/contracts';
import { heatIndexC, sunPosition, wbgtLiljegren } from '@heatline/climate';

/** WBGT inside an air-conditioned room (≈24 °C air, 50% RH, no radiant load). */
export const CABIN_WBGT = 21;

interface MinuteWeather {
  airC: number;
  rhPct: number;
  pressureHpa: number;
  wind10: number;
  ssrd: number;
  fdir: number;
}

export interface SiteEnvironment {
  at(minute: Minute): Environment;
  /** WBGT for a zone at a minute; tents in the plan shade outdoor/elevated zones once ready */
  zoneWbgt(zoneId: string, minute: Minute, plan?: Pick<Plan, 'tents'>): number;
  zoneConditions(minute: Minute, plan?: Pick<Plan, 'tents'>): ZoneConditions[];
  shadedByTower(point: Point, minute: Minute): boolean;
}

export function createEnvironment(scenario: Scenario): SiteEnvironment {
  const hourly = scenario.weather;
  // Open-Meteo: temperature, humidity, pressure and wind are instantaneous at HH:00; radiation is
  // the mean over the preceding hour, so it is anchored at HH−0:30.
  const stateAnchors = hourly.map((h) => ({ minute: Number(h.time.slice(11, 13)) * 60, h }));
  const radiationAnchors = stateAnchors.map((a) => ({ minute: a.minute - 30, h: a.h }));

  function interpolate(anchors: { minute: number; h: (typeof hourly)[number] }[], minute: Minute) {
    let i = anchors.findIndex((a) => a.minute > minute);
    if (i <= 0) i = i === 0 ? 1 : anchors.length - 1;
    const a = anchors[i - 1]!;
    const b = anchors[i]!;
    const f = Math.min(1, Math.max(0, (minute - a.minute) / (b.minute - a.minute)));
    return { a: a.h, b: b.h, lerp: (x: number, y: number) => x + (y - x) * f };
  }

  function weatherAt(minute: Minute): MinuteWeather {
    const s = interpolate(stateAnchors, minute);
    const r = interpolate(radiationAnchors, minute);
    const ssrd = r.lerp(r.a.ssrd, r.b.ssrd);
    const direct = r.lerp(r.a.directRad, r.b.directRad);
    let w: MinuteWeather = {
      airC: s.lerp(s.a.airC, s.b.airC),
      rhPct: s.lerp(s.a.rhPct, s.b.rhPct),
      pressureHpa: s.lerp(s.a.pressureHpa, s.b.pressureHpa),
      wind10: s.lerp(s.a.wind10, s.b.wind10),
      ssrd,
      fdir: ssrd > 0 ? Math.min(1, Math.max(0, direct / ssrd)) : 0,
    };
    for (const mod of scenario.weatherModifiers) {
      if (minute >= mod.from && minute < mod.to) {
        w = { ...w, rhPct: Math.min(100, w.rhPct + mod.rhDelta), ssrd: w.ssrd * mod.radiationFactor, fdir: Math.min(w.fdir, mod.directFraction) };
      }
    }
    return w;
  }

  const utcAt = (minute: Minute) => {
    const [y, m, d] = scenario.date.split('-').map(Number) as [number, number, number];
    return new Date(Date.UTC(y, m - 1, d, 0, minute - scenario.utcOffsetHours * 60));
  };

  const cache = new Map<string, number>();
  function wbgt(minute: Minute, shaded: boolean, windFactor: number): number {
    const key = `${minute}|${shaded ? 1 : 0}|${windFactor}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const w = weatherAt(minute);
    const sun = sunPosition(utcAt(minute), scenario.latitude, scenario.longitude);
    const value = wbgtLiljegren({
      airC: w.airC,
      rhPct: w.rhPct,
      pressureHpa: w.pressureHpa,
      wind10: w.wind10 * windFactor,
      ssrd: shaded ? w.ssrd * (1 - w.fdir) : w.ssrd,
      fdir: shaded ? 0 : w.fdir,
      cossza: sun.cosZenith,
    }).wbgt;
    cache.set(key, value);
    return value;
  }

  function shadedByTower(point: Point, minute: Minute): boolean {
    const sun = sunPosition(utcAt(minute), scenario.latitude, scenario.longitude);
    if (sun.elevation <= 0) return true;
    const t = scenario.tower;
    const toward = { x: Math.sin((sun.azimuth * Math.PI) / 180), y: Math.cos((sun.azimuth * Math.PI) / 180) };
    const reach = t.height / Math.tan((sun.elevation * Math.PI) / 180);
    for (let s = 0; s <= reach; s += 0.5) {
      const x = point.x + toward.x * s;
      const y = point.y + toward.y * s;
      if (x >= t.minX && x <= t.maxX && y >= t.minY && y <= t.maxY) return true;
    }
    return false;
  }

  const zoneMap = new Map(scenario.zones.map((z) => [z.id, z]));
  function isShaded(zone: Zone, minute: Minute, plan?: Pick<Plan, 'tents'>): boolean {
    if (zone.kind === 'tent' || zone.kind === 'cabin') return true;
    if (plan?.tents.some((t) => t.zone === zone.id && t.readyAt <= minute)) return true;
    return zone.kind === 'outdoor' && shadedByTower(zone.at, minute);
  }

  function zoneWbgt(zoneId: string, minute: Minute, plan?: Pick<Plan, 'tents'>): number {
    const zone = zoneMap.get(zoneId);
    if (!zone) throw new Error(`Unknown zone ${zoneId}`);
    if (zone.kind === 'cabin') return CABIN_WBGT;
    return wbgt(minute, isShaded(zone, minute, plan), zone.windFactor);
  }

  return {
    at(minute) {
      const w = weatherAt(minute);
      const sun = sunPosition(utcAt(minute), scenario.latitude, scenario.longitude);
      return {
        minute,
        airC: w.airC,
        rhPct: w.rhPct,
        heatIndex: heatIndexC(w.airC, w.rhPct),
        sunElevation: sun.elevation,
        sunAzimuth: sun.azimuth,
        wbgtSun: wbgt(minute, false, 1),
        wbgtShade: wbgt(minute, true, 1),
      };
    },
    zoneWbgt,
    zoneConditions(minute, plan) {
      return scenario.zones.map((z) => ({ zone: z.id, shaded: isShaded(z, minute, plan), wbgt: zoneWbgt(z.id, minute, plan) }));
    },
    shadedByTower,
  };
}
