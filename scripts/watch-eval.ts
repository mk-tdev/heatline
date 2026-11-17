// Site-watch evaluation over the 2025 and 2026 midday-break seasons (186 days).
//
// What the scheduler knows: the archived day-ahead forecast (Open-Meteo previous-runs API),
// and, when a station is present, readings from the work area.
// What really happened at the site: ERA5-based reanalysis plus synthetic site effects
// (packages/sim/src/watchday.ts). Crews and tasks are the demonstration site's.
//
// Strategies, each on the same days and crews:
//   routine        fixed 50 min work / 10 min rest, scheduler alerts ignored
//   forecast       breaks timed from the day-ahead forecast, no station, no margin
//   forecast+1     the same with Heatline's +1 °C margin for running without a station
//   live           breaks timed from the station fused with the forecast
//   live-outage    as live, with the station down 09:00–12:00 every day
//
// Writes data/watch/evaluation.json. Run: npm run eval:watch
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import template from '../data/scenario/saadiyat-tower.json' with { type: 'json' };
import { FUSION, buildDayPlan, conditionsFrom, crossingLeads, dayAheadRows, defaultCrews, pm10From, runWatch, shiftsFor, siteTruth, stationFrom, weatherRows, dustLevel, type OpenMeteoHourly, type WatchRun } from '@heatline/sim';

const YEARS = [2025, 2026];
const load = (name: string) => JSON.parse(readFileSync(`data/weather/${name}`, 'utf8'));
const dates = (y: number) => {
  const out: string[] = [];
  for (let d = new Date(Date.UTC(y, 5, 15)); d <= new Date(Date.UTC(y, 8, 15)); d = new Date(d.getTime() + 86_400_000)) out.push(d.toISOString().slice(0, 10));
  return out;
};
const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const pct = (a: number, b: number) => round((100 * a) / Math.max(1, b));
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : null);
const quantile = (xs: number[], q: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * q))]! : null);

type Strategy = 'routine' | 'forecast' | 'forecast+1' | 'live' | 'live-outage';
const STRATEGIES: { id: Strategy; label: string }[] = [
  { id: 'routine', label: 'Fixed routine: 50 min work, 10 min rest' },
  { id: 'forecast', label: 'Breaks from the day-ahead forecast only' },
  { id: 'forecast+1', label: 'Day-ahead forecast with Heatline’s +1 °C margin' },
  { id: 'live', label: 'Live: site station fused with the forecast' },
  { id: 'live-outage', label: 'Live, with the station down 09:00–12:00' },
];

interface Totals { workerDays: number; byLevel: Record<string, number>; workerShiftMin: number; workerOverMin: number; workerWorkMin: number; groupDays: number; groupDaysOver15: number; breaks: number; breaksAnnounced10: number; leads: number[]; alerts: number; alertDays: number }
const empty = (): Totals => ({ workerDays: 0, byLevel: { info: 0, watch: 0, act: 0, urgent: 0 }, workerShiftMin: 0, workerOverMin: 0, workerWorkMin: 0, groupDays: 0, groupDaysOver15: 0, breaks: 0, breaksAnnounced10: 0, leads: [], alerts: 0, alertDays: 0 });
const totals = Object.fromEntries(STRATEGIES.map((s) => [s.id, empty()])) as Record<Strategy, Totals>;
const crossing = { crossings: 0, warned: 0, leads: [] as number[] };

// Forecast skill, per working hour 06:00–19:00.
const skill = { hours: 0, sumErr: 0, sumAbs: 0, coolBy1: 0, coolBy2: 0, siteSumErr: 0, siteCoolBy1: 0 };
// Day-ahead plan against the plan the real weather would have given (heavy work, cooled-room rest).
const plan = { hours: 0, tooGenerous: 0, tooGenerousBy10: 0, tooGenerousWithMargin: 0, tooStrict: 0 };
// Dust hours during shifts.
const dust = { shiftHours: 0, elevated: 0, unhealthy: 0, severe: 0, days: new Set<string>() };

const t0 = performance.now();
for (const year of YEARS) {
  const re = load(`abu-dhabi-season-${year}.json`) as OpenMeteoHourly;
  const da = load(`abu-dhabi-dayahead-${year}.json`);
  const aq = load(`abu-dhabi-airquality-${year}.json`);
  for (const date of dates(year)) {
    const reRows = weatherRows(re, date);
    const daRows = dayAheadRows(da, date);
    const grid = conditionsFrom(reRows, date);
    const forecast = conditionsFrom(daRows, date);
    const truth = siteTruth(grid, date);
    const pm10 = pm10From(aq, date);
    const shifts = shiftsFor(date);
    const crews = defaultCrews(date, template.workers);
    const readings = stationFrom(truth, date, 300, 1200, [], pm10);
    const outage = stationFrom(truth, date, 300, 1200, [{ from: 540, to: 720 }], pm10);

    for (let m = 360; m < 1140; m += 60) {
      const err = forecast(m + 30).sun - grid(m + 30).sun;
      skill.hours++;
      skill.sumErr += err;
      skill.sumAbs += Math.abs(err);
      if (err < -1) skill.coolBy1++;
      if (err < -2) skill.coolBy2++;
      const siteErr = forecast(m + 30).sun - truth(m + 30).sun;
      skill.siteSumErr += siteErr;
      if (siteErr < -1) skill.siteCoolBy1++;
      const p = pm10(m + 30);
      if (shifts.some((s) => m >= s.from && m < s.to)) {
        dust.shiftHours++;
        const level = dustLevel(p);
        if (level !== 'clear') { dust[level]++; dust.days.add(date); }
      }
    }
    const site = { date, latitude: 24.54, longitude: 54.43, utcOffsetHours: 4 };
    const planAhead = buildDayPlan({ ...site, weather: daRows, rest: 'cool-room' });
    const planAheadMargin = buildDayPlan({ ...site, weather: daRows.map((h) => ({ ...h, airC: h.airC + 1.4 })), rest: 'cool-room' });
    const planReal = buildDayPlan({ ...site, weather: reRows, rest: 'cool-room' });
    planReal.hours.forEach((h, i) => {
      if (h.banned) return;
      const a = planAhead.hours[i]!.work.heavy;
      plan.hours++;
      if (a > h.work.heavy) plan.tooGenerous++;
      if (a >= h.work.heavy + 10) plan.tooGenerousBy10++;
      if (planAheadMargin.hours[i]!.work.heavy > h.work.heavy) plan.tooGenerousWithMargin++;
      if (a < h.work.heavy) plan.tooStrict++;
    });

    const runs: Record<Strategy, WatchRun> = {
      routine: runWatch({ date, shifts, crews, forecast, truth, readings, pm10, policy: 'fixed', record: false }),
      forecast: runWatch({ date, shifts, crews, forecast, truth, readings: [], pm10, policy: 'follow', record: false, fusion: { ...FUSION, forecastMarginC: 0 } }),
      'forecast+1': runWatch({ date, shifts, crews, forecast, truth, readings: [], pm10, policy: 'follow', record: false }),
      live: runWatch({ date, shifts, crews, forecast, truth, readings, pm10, policy: 'follow', record: false }),
      'live-outage': runWatch({ date, shifts, crews, forecast, truth, readings: outage, pm10, policy: 'follow', record: false }),
    };
    const c = crossingLeads(runs.routine);
    crossing.crossings += c.crossings;
    crossing.warned += c.warned;
    crossing.leads.push(...c.leads);
    for (const s of STRATEGIES) {
      const t = totals[s.id];
      const run = runs[s.id];
      t.alerts += run.alerts.length;
      t.alertDays++;
      for (const a of run.alerts) t.byLevel[a.level]!++;
      for (const g of run.groups) {
        t.workerDays += g.headcount;
        t.workerShiftMin += g.shiftMin * g.headcount;
        t.workerOverMin += g.overLimitMin * g.headcount;
        t.workerWorkMin += g.workMin * g.headcount;
        t.groupDays++;
        if (g.overLimitMin > 15) t.groupDaysOver15++;
        for (const b of g.breaks) {
          t.breaks++;
          if (b.lead !== null && b.lead >= 10) t.breaksAnnounced10++;
          if (b.lead !== null) t.leads.push(b.lead);
        }
      }
    }
  }
  console.log(`${year} done (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
}

const strategies = STRATEGIES.map((s) => {
  const t = totals[s.id];
  return {
    id: s.id,
    label: s.label,
    overLimitSharePct: pct(t.workerOverMin, t.workerShiftMin),
    workMinPerWorkerDay: round(t.workerWorkMin / Math.max(1, t.workerDays), 0),
    overLimitMinPerWorkerDay: round(t.workerOverMin / Math.max(1, t.workerDays), 0),
    workSharePct: pct(t.workerWorkMin, t.workerShiftMin),
    groupDaysOver15Pct: pct(t.groupDaysOver15, t.groupDays),
    breaksPerGroupDay: round(t.breaks / Math.max(1, t.groupDays)),
    breaksAnnounced10Pct: s.id === 'routine' ? null : pct(t.breaksAnnounced10, t.breaks),
    medianLeadMin: s.id === 'routine' ? null : median(t.leads),
    alertsPerDay: round(t.alerts / Math.max(1, t.alertDays)),
    alarmsPerDay: round((t.byLevel.act! + t.byLevel.urgent!) / Math.max(1, t.alertDays)),
    byLevelPerDay: Object.fromEntries(Object.entries(t.byLevel).map(([k, v]) => [k, round(v / Math.max(1, t.alertDays))])),
  };
});

const report = {
  generated: new Date().toISOString(),
  days: YEARS.reduce((n, y) => n + dates(y).length, 0),
  seasons: '15 June – 15 September, 2025 and 2026',
  site: 'Saadiyat Island grid point (24.50 N, 54.42 E); three crews of the demonstration site (20 workers, one on a new-worker build-up)',
  sources: {
    forecast: 'Open-Meteo previous-runs API: the forecast issued one day ahead (variables *_previous_day1)',
    reanalysis: 'Open-Meteo historical weather API (ERA5-based)',
    airQuality: 'Open-Meteo air-quality API (CAMS), hourly PM10',
  },
  assumptions: 'Site conditions = reanalysis + synthetic site effects (+0.3 °C, up to +0.9 °C more in sun, day offset SD 0.4 °C, wander SD 0.25 °C). Station = site conditions + noise (SD 0.2 °C). Limits: NIOSH REL/RAL on a rolling 60-minute average. These are stated assumptions, not measurements.',
  forecastSkill: {
    hours: skill.hours,
    meanErrorC: round(skill.sumErr / skill.hours, 2),
    meanAbsErrorC: round(skill.sumAbs / skill.hours, 2),
    coolerBy1Pct: pct(skill.coolBy1, skill.hours),
    coolerBy2Pct: pct(skill.coolBy2, skill.hours),
    siteMeanErrorC: round(skill.siteSumErr / skill.hours, 2),
    siteCoolerBy1Pct: pct(skill.siteCoolBy1, skill.hours),
    note: 'Day-ahead forecast WBGT in the sun minus reanalysis WBGT ("site": minus the site conditions including site effects). Negative means the forecast was too cool.',
  },
  dayAheadPlan: {
    hours: plan.hours,
    tooGenerousPct: pct(plan.tooGenerous, plan.hours),
    tooGenerousBy10Pct: pct(plan.tooGenerousBy10, plan.hours),
    tooGenerousWithMarginPct: pct(plan.tooGenerousWithMargin, plan.hours),
    tooStrictPct: pct(plan.tooStrict, plan.hours),
    note: 'Heavy-work minutes per hour (cooled-room rest) from the shift planner on the day-ahead forecast, against the planner on the reanalysis for the same day. "With margin" warms the forecast air by 1.4 °C, about +1 °C WBGT.',
  },
  dust: {
    shiftHours: dust.shiftHours,
    elevatedHours: dust.elevated,
    unhealthyHours: dust.unhealthy,
    severeHours: dust.severe,
    daysWithAnyDustAlert: dust.days.size,
  },
  alertLead: {
    crossings: crossing.crossings,
    warnedPct: pct(crossing.warned, crossing.crossings),
    medianLeadMin: median(crossing.leads),
    p10LeadMin: quantile(crossing.leads, 0.1),
    note: 'Under the fixed routine (alerts ignored): each time a crew group crossed the limit on site conditions, was a break announced at least 5 minutes before, within the previous 90 minutes?',
  },
  strategies,
};
mkdirSync('data/watch', { recursive: true });
writeFileSync('data/watch/evaluation.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify({ forecastSkill: report.forecastSkill, dayAheadPlan: report.dayAheadPlan, dust: report.dust, alertLead: report.alertLead }, null, 1));
console.table(strategies);
console.log(`Done in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
