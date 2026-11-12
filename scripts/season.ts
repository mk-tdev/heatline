// What the weather alone says about the UAE midday-break season (15 June–15 September), for
// 2025 and 2026 near Saadiyat Island. No simulated workers and no physiology model: hourly
// Liljegren WBGT from ERA5-based reanalysis, compared with the NIOSH exposure limits.
// Writes data/season/abu-dhabi-ban-season.json. Run: npm run season
import { mkdirSync, writeFileSync } from 'node:fs';
import s2025 from '../data/weather/abu-dhabi-season-2025.json' with { type: 'json' };
import s2026 from '../data/weather/abu-dhabi-season-2026.json' with { type: 'json' };
import { buildDayPlan, nioshLimitC, physiology, weatherRows, type DayPlan, type OpenMeteoHourly } from '@heatline/sim';

const SITE = { latitude: 24.54, longitude: 54.43, utcOffsetHours: 4 };
const LIMIT_MODERATE = nioshLimitC(physiology.METABOLIC_W.moderate, true);
const LIMIT_HEAVY = nioshLimitC(physiology.METABOLIC_W.heavy, true);
const BAN = { from: 750, to: 900 };
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
const share = (n: number, of: number) => round((100 * n) / Math.max(1, of), 1);

function dates(year: number): string[] {
  const out: string[] = [];
  for (let d = new Date(Date.UTC(year, 5, 15)); d <= new Date(Date.UTC(year, 8, 15)); d = new Date(d.getTime() + 86_400_000)) out.push(d.toISOString().slice(0, 10));
  return out;
}

function analyse(year: number, source: OpenMeteoHourly) {
  const days = dates(year).map((date) => {
    const weather = weatherRows(source, date);
    const cool = buildDayPlan({ ...SITE, date, weather, rest: 'cool-room' });
    const shade = buildDayPlan({ ...SITE, date, weather, rest: 'shade' });
    return { date, cool, shade };
  });
  const hoursOf = (p: DayPlan) => p.hours;
  // Working day 05:00–19:00 in hour blocks; a block counts in the break when any part is banned.
  let overHours = 0;
  let overInBan = 0;
  let workHours = 0;
  for (const d of days) for (const h of hoursOf(d.cool)) {
    workHours++;
    if (h.wbgtSun > LIMIT_MODERATE) {
      overHours++;
      // Hour blocks 13:00 and 14:00 are fully inside the break; 12:00 is half inside.
      overInBan += h.banned ? 1 : h.partlyBanned ? 0.5 : 0;
    }
  }
  const after = (p: DayPlan) => p.hours.filter((h) => h.from >= BAN.to && h.from < 18 * 60);
  const afterAll = days.flatMap((d) => after(d.cool));
  const byHour = Array.from({ length: 14 }, (_, i) => {
    const from = (5 + i) * 60;
    const rows = days.map((d) => d.cool.hours.find((h) => h.from === from)!);
    const shadeRows = days.map((d) => d.shade.hours.find((h) => h.from === from)!);
    return {
      from,
      meanWbgtSun: round(mean(rows.map((r) => r.wbgtSun))),
      meanWbgtShade: round(mean(rows.map((r) => r.wbgtShade))),
      maxWbgtSun: round(Math.max(...rows.map((r) => r.wbgtSun))),
      daysOverModerateLimitPct: share(rows.filter((r) => r.wbgtSun > LIMIT_MODERATE).length, rows.length),
      daysOverHeavyLimitPct: share(rows.filter((r) => r.wbgtSun > LIMIT_HEAVY).length, rows.length),
      meanHeavyMinCoolRoom: round(mean(rows.map((r) => r.work.heavy)), 0),
      meanHeavyMinShade: round(mean(shadeRows.map((r) => r.work.heavy)), 0),
      meanModerateMinCoolRoom: round(mean(rows.map((r) => r.work.moderate)), 0),
      meanModerateMinShade: round(mean(shadeRows.map((r) => r.work.moderate)), 0),
    };
  });
  const peaks = days.map((d) => ({ date: d.date, peak: d.cool.peak.wbgtSun })).sort((a, b) => a.peak - b.peak);
  return {
    year,
    days: days.length,
    workingHours: workHours,
    hoursOverModerateLimit: overHours,
    hoursOverModerateLimitPct: share(overHours, workHours),
    overLimitHoursInsideBreakPct: share(overInBan, overHours),
    overLimitHoursPerDay: round(overHours / days.length),
    overLimitHoursPerDayOutsideBreak: round((overHours - overInBan) / days.length),
    afterBreak: {
      window: '15:00–18:00',
      meanWbgtSun: round(mean(afterAll.map((h) => h.wbgtSun))),
      meanWbgtShade: round(mean(afterAll.map((h) => h.wbgtShade))),
      hoursOverModerateLimitPct: share(afterAll.filter((h) => h.wbgtSun > LIMIT_MODERATE).length, afterAll.length),
      daysEveryHourOverModerateLimitPct: share(days.filter((d) => after(d.cool).every((h) => h.wbgtSun > LIMIT_MODERATE)).length, days.length),
      shadeHoursOverModerateLimitPct: share(afterAll.filter((h) => h.wbgtShade > LIMIT_MODERATE).length, afterAll.length),
      daysNoHeavyWorkWithShadeRestPct: share(days.filter((d) => after(d.shade).every((h) => h.work.heavy === 0)).length, days.length),
      meanHeavyMinShade: round(mean(days.flatMap((d) => after(d.shade)).map((h) => h.work.heavy)), 0),
      meanHeavyMinCoolRoom: round(mean(afterAll.map((h) => h.work.heavy)), 0),
    },
    hottestDay: { date: peaks[peaks.length - 1]!.date, peakWbgtSun: round(peaks[peaks.length - 1]!.peak) },
    typicalDay: { date: peaks[Math.floor(peaks.length / 2)]!.date, peakWbgtSun: round(peaks[Math.floor(peaks.length / 2)]!.peak) },
    mildestDay: { date: peaks[0]!.date, peakWbgtSun: round(peaks[0]!.peak) },
    byHour,
  };
}

const report = {
  generated: new Date().toISOString(),
  site: { label: 'Saadiyat Island, Abu Dhabi', ...SITE, grid: '24.499 N, 54.423 E' },
  source: 'Open-Meteo Historical Weather API (ERA5-based reanalysis), hourly; WBGT by Liljegren et al. (2008)',
  season: '15 June – 15 September (UAE midday break, 12:30–15:00)',
  workingDay: '05:00–19:00',
  limits: { moderateContinuousC: round(LIMIT_MODERATE), heavyContinuousC: round(LIMIT_HEAVY), basis: 'NIOSH 2016-106 recommended exposure limit, acclimatised workers, continuous work' },
  years: [analyse(2025, s2025 as OpenMeteoHourly), analyse(2026, s2026 as OpenMeteoHourly)],
  note: 'Gridded reanalysis near the site, not an instrument on a site. Real sites differ (radiating concrete, wind shadow, work at height). No workers are simulated here.',
};
mkdirSync('data/season', { recursive: true });
writeFileSync('data/season/abu-dhabi-ban-season.json', JSON.stringify(report, null, 1));
for (const y of report.years) {
  console.log(`\n${y.year}: ${y.days} days, ${y.workingHours} working hours`);
  console.log(`  over the moderate-work limit: ${y.hoursOverModerateLimitPct}% of working hours (${y.overLimitHoursPerDay} h/day; ${y.overLimitHoursPerDayOutsideBreak} h/day outside the break); inside the break: ${y.overLimitHoursInsideBreakPct}%`);
  console.log('  after the break', JSON.stringify(y.afterBreak));
  console.log('  hottest', y.hottestDay, 'typical', y.typicalDay, 'mildest', y.mildestDay);
  for (const h of y.byHour) console.log(`  ${String(h.from / 60).padStart(2, '0')}:00 sun ${h.meanWbgtSun} shade ${h.meanWbgtShade} max ${h.maxWbgtSun} overMod ${h.daysOverModerateLimitPct}% heavy cool/shade ${h.meanHeavyMinCoolRoom}/${h.meanHeavyMinShade}`);
}
