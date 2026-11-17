import { describe, expect, it } from 'vitest';
import template from '../data/scenario/saadiyat-tower.json' with { type: 'json' };
import weather from '../data/weather/abu-dhabi-2025-08.json' with { type: 'json' };
import {
  acclimatisationProfile as acclimatisation, checkReadings, conditionsFrom, correctionAhead, defaultCrews, dustLevel, fuse, historyOf, parseStationCsv, runWatch, shiftsFor,
  siteTruth, stationFrom, stationWbgt, weatherRows, FUSION, type Conditions, type OpenMeteoHourly, type WatchCrew,
} from '@heatline/sim';

const date = '2025-08-19';
const grid = conditionsFrom(weatherRows(weather as OpenMeteoHourly, date), date);
const truth = siteTruth(grid, date);
const crews = defaultCrews(date, template.workers);
const shifts = shiftsFor(date);
const PRIVATE = /anwar|suresh|ravi|ahmed|bilal|joel|coreC|heartRate|psi\b|deficit/i;

describe('station telemetry', () => {
  it('computes WBGT from components (ISO 7243) when the meter does not report it', () => {
    expect(stationWbgt({ minute: 0, tnwb: 28, tg: 50, ta: 40 })).toBeCloseTo(0.7 * 28 + 0.2 * 50 + 0.1 * 40, 6);
    expect(stationWbgt({ minute: 0, wbgt: 31.2, tnwb: 1, tg: 1, ta: 1 })).toBe(31.2);
    expect(stationWbgt({ minute: 0, ta: 40 })).toBeNull();
  });
  it('rejects missing, implausible, duplicate and jumping readings', () => {
    const { ok, rejected } = checkReadings([
      { minute: 600, wbgt: 31 }, { minute: 601, wbgt: 31.2 }, { minute: 601, wbgt: 31.3 }, { minute: 602, wbgt: 36 },
      { minute: 603, wbgt: 60 }, { minute: 604, ta: 40 }, { minute: 605, wbgt: 31.4 },
    ]);
    expect(ok.map((r) => r.minute)).toEqual([600, 601, 605]);
    expect(rejected.map((r) => r.reason)).toEqual(['duplicate', 'jump', 'out-of-range', 'no-wbgt']);
  });
  it('trusts a fresh station, adds a margin when it goes quiet, and falls back to the forecast', () => {
    const forecastSun = () => 30;
    const readings = Array.from({ length: 30 }, (_, i) => ({ minute: 600 + i, wbgt: 31.5 }));
    const fresh = fuse(readings, forecastSun, 629);
    expect(fresh).toMatchObject({ source: 'station', margin: 0 });
    expect(fresh.bias).toBeCloseTo(1.5, 6);
    const stale = fuse(readings, forecastSun, 629 + 20);
    expect(stale.source).toBe('station-stale');
    expect(stale.bias).toBeLessThan(1.5);
    expect(stale.margin).toBe(FUSION.staleMarginC);
    expect(fuse(readings, forecastSun, 629 + 60)).toMatchObject({ source: 'forecast', bias: 0, margin: FUSION.forecastMarginC });
    expect(fuse([], forecastSun, 600)).toMatchObject({ source: 'forecast', margin: FUSION.forecastMarginC });
    // A measured bias fades into the future; the margin does not.
    expect(correctionAhead(fresh, 180)).toBeCloseTo(1.5 / Math.E, 6);
  });
  it('reads a WBGT meter CSV export, including Fahrenheit columns and 12-hour times', () => {
    const csv = [
      'Device,Heat stress meter', '',
      'Formatted Date Time,Temperature (°F),Relative Humidity (%),Globe Temperature (°F),Natural Wet Bulb (°F),Wet Bulb Globe Temperature (°F),Wind Speed (m/s)',
      '19/08/2025 2:05 PM,104,40,131,82.4,89.6,2.1',
      '19/08/2025 2:06 PM,104.2,40,131,82.6,bad,2.0',
      '20/08/2025 2:07 PM,100,40,120,80,88,2.0',
    ].join('\n');
    const { readings, skipped } = parseStationCsv(csv, date);
    expect(skipped).toBe(1);
    expect(readings).toHaveLength(2);
    expect(readings[0]!.minute).toBe(14 * 60 + 5);
    expect(readings[0]!.wbgt).toBeCloseTo(32, 6);
    expect(readings[0]!.tg).toBeCloseTo(55, 6);
    expect(readings[1]!.wbgt).toBeUndefined();
    expect(stationWbgt(readings[1]!)).toBeCloseTo(0.7 * 28.111 + 0.2 * 55 + 0.1 * 40.111, 2);
  });
});

describe('acclimatisation from work history', () => {
  it('builds new workers up from 20% and calls them acclimatised after two weeks', () => {
    expect(acclimatisation([], date)).toMatchObject({ tier: 'new', day: 1, exposureShare: 0.2, limit: 'RAL' });
    expect(acclimatisation(historyOf(date, 1), date)).toMatchObject({ tier: 'new', day: 2, exposureShare: 0.4 });
    expect(acclimatisation(historyOf(date, 13), date)).toMatchObject({ tier: 'acclimatised', limit: 'REL', exposureShare: 1 });
  });
  it('puts workers back after a week away on the 50/60/80/100 schedule, and restarts after four weeks', () => {
    const away = (daysAway: number) => historyOf('2025-07-20', 40).map((d) => ({ ...d, date: new Date(Date.parse(`${d.date}T00:00:00Z`) - daysAway * 86_400_000).toISOString().slice(0, 10) }));
    expect(acclimatisation(away(10), '2025-07-20')).toMatchObject({ tier: 'returning', day: 1, exposureShare: 0.5, limit: 'RAL' });
    expect(acclimatisation(away(3), '2025-07-20')).toMatchObject({ tier: 'acclimatised' });
    expect(acclimatisation(away(40), '2025-07-20')).toMatchObject({ tier: 'new', day: 1, exposureShare: 0.2 });
    const back = [...historyOf('2025-07-20', 2), ...away(12).slice(5)];
    expect(acclimatisation(back, '2025-07-20')).toMatchObject({ tier: 'returning', day: 3, exposureShare: 0.8 });
  });
  it('ignores short days and days after today', () => {
    expect(acclimatisation([{ date: '2025-08-18', heatMinutes: 20 }, { date: '2025-08-25', heatMinutes: 400 }], date).tier).toBe('new');
  });
});

describe('dust', () => {
  it('uses the EPA PM10 breakpoints', () => {
    expect([null, 100, 155, 260, 400].map(dustLevel)).toEqual(['clear', 'clear', 'elevated', 'unhealthy', 'severe']);
  });
});

describe('site watch scheduler', () => {
  const readings = stationFrom(truth, date, 300, 1200);
  const live = runWatch({ date, shifts, crews, forecast: grid, truth, readings, policy: 'follow' });
  const routine = runWatch({ date, shifts, crews, forecast: grid, truth, readings, policy: 'fixed' });

  it('keeps crews far closer to the limit than a fixed 50/10 routine', () => {
    const over = (r: typeof live) => r.groups.reduce((s, g) => s + g.overLimitMin * g.headcount, 0);
    const shift = live.groups.reduce((s, g) => s + g.shiftMin * g.headcount, 0);
    expect(over(routine) / shift).toBeGreaterThan(0.5);
    expect(over(live) / shift).toBeLessThan(0.05);
    // and the work still happens
    expect(live.groups.every((g) => g.tier === 'reduced' || g.workMin > 150)).toBe(true);
  });
  it('announces breaks ahead of time, with an explanation and a projection', () => {
    const breaks = live.groups.flatMap((g) => g.breaks);
    const announced = breaks.filter((b) => b.lead !== null && b.lead >= 10).length;
    expect(announced / breaks.length).toBeGreaterThan(0.9);
    const notice = live.alerts.find((a) => a.kind === 'break-soon')!;
    expect(notice.why.length).toBeGreaterThanOrEqual(4);
    expect(notice.why.join(' ')).toMatch(/NIOSH/);
    expect(notice.projection!.some((p) => p.without > 1)).toBe(true);
    expect(notice.projection!.every((p) => p.withAction <= 1.01)).toBe(true);
    expect(notice.due! - notice.minute).toBeLessThanOrEqual(15);
  });
  it('respects the midday break and the new-worker heat-time cap', () => {
    for (const m of live.minutes.filter((x) => x.minute >= 750 && x.minute < 900)) expect(m.groups.every((g) => g.status === 'off')).toBe(true);
    const reduced = live.groups.find((g) => g.tier === 'reduced')!;
    const cap = crews.flatMap((c) => c.groups).find((g) => g.tier === 'reduced')!.capMin;
    expect(reduced.workMin).toBeLessThanOrEqual(cap);
    expect(live.alerts.some((a) => a.kind === 'cap')).toBe(true);
  });
  it('degrades safely when the station goes down', () => {
    const outage = runWatch({ date, shifts, crews, forecast: grid, truth, readings: stationFrom(truth, date, 300, 1200, [{ from: 540, to: 720 }]), policy: 'follow' });
    const kinds = outage.alerts.filter((a) => a.kind === 'sensor').map((a) => a.title);
    expect(kinds.some((t) => /quiet/.test(t))).toBe(true);
    expect(kinds.some((t) => /offline/.test(t))).toBe(true);
    expect(kinds.some((t) => /back online/.test(t))).toBe(true);
    const during = outage.minutes.filter((m) => m.minute >= 600 && m.minute < 720);
    expect(during.every((m) => m.source === 'forecast' && m.margin === FUSION.forecastMarginC)).toBe(true);
  });
  it('flags a site hotter than its forecast and brings breaks forward', () => {
    const hot = (m: number): Conditions => ({ sun: grid(m).sun + 2, shade: grid(m).shade + 2 });
    const run = runWatch({ date, shifts, crews, forecast: grid, truth: hot, readings: stationFrom(hot, date, 300, 1200), policy: 'follow' });
    expect(run.alerts.some((a) => a.kind === 'hotter')).toBe(true);
    const work = (r: typeof run) => r.groups.reduce((s, g) => s + g.workMin, 0);
    expect(work(run)).toBeLessThan(work(live));
  });
  it('moves a crew from shade to the cooled room when shade is too hot to recover in', () => {
    const shadeCrew: WatchCrew = { id: 'S', label: 'Test', taskId: 'rebar', inSun: true, clothingAdjustC: 0, rest: 'shade', groups: [{ tier: 'standard', headcount: 5, capMin: Infinity }] };
    const run = runWatch({ date, shifts, crews: [shadeCrew], forecast: grid, truth, readings, policy: 'follow' });
    const moved = run.alerts.find((a) => a.kind === 'rest-place')!;
    expect(moved.why.join(' ')).toMatch(/shade/);
    expect(run.groups[0]!.workMin).toBeGreaterThan(100);
  });
  it('raises dust alerts once per level change, not every minute', () => {
    const pm = (m: number) => (m >= 600 && m < 700 ? 300 + (m % 2 ? 20 : -20) : 40);
    const run = runWatch({ date, shifts, crews, forecast: grid, readings: [], pm10: pm, policy: 'follow' });
    const dust = run.alerts.filter((a) => a.kind === 'dust');
    // The 15-minute average climbs through "elevated" on its way up; each level is announced once.
    expect(dust.map((a) => a.title)).toEqual(['Dust elevated', 'Dust unhealthy', 'Dust back to normal']);
  });
  it('is deterministic', () => {
    const again = runWatch({ date, shifts, crews, forecast: grid, truth, readings, policy: 'follow' });
    expect(again.alerts).toEqual(live.alerts);
  });
  it('never carries a name or a body measurement', () => {
    const text = JSON.stringify({ alerts: live.alerts, minutes: live.minutes.slice(0, 200), groups: live.groups, crews });
    expect(text).not.toMatch(PRIVATE);
  });
});

import { BROADCAST_LANGUAGES, broadcast, broadcastLines } from '@heatline/sim';
describe('crew broadcasts', () => {
  const scripts: Record<string, RegExp> = { ar: /[؀-ۿ]/, ur: /[؀-ۿ]/, hi: /[ऀ-ॿ]/, bn: /[ঀ-৿]/, ml: /[ഀ-ൿ]/ };
  it('carries the same times and minutes in every language, with no placeholders left', () => {
    for (const language of BROADCAST_LANGUAGES) {
      for (const { english, text } of broadcastLines(language)) {
        expect(text).not.toMatch(/[{}]/);
        if (scripts[language]) expect(text).toMatch(scripts[language]!);
        for (const n of english.match(/\d+(?::\d+)?/g) ?? []) expect(text).toContain(n);
      }
    }
  });
  it('broadcasts crew actions but keeps supervisor-only alerts off the crew channel', () => {
    const run = runWatch({ date, shifts, crews, forecast: grid, truth, readings: stationFrom(truth, date, 300, 1200, [{ from: 540, to: 720 }]), policy: 'follow' });
    const soon = run.alerts.find((a) => a.kind === 'break-soon')!;
    expect(broadcast(soon, 'en')).toContain(`break at`);
    expect(broadcast(run.alerts.find((a) => a.kind === 'sensor')!, 'bn')).toBeNull();
  });
});
