// The ban-season weather analysis (scripts/season.ts), combined across its years for display.
// These numbers come from weather alone: no simulated workers.
import report from '../../../data/season/abu-dhabi-ban-season.json';

const years = report.years;
const sum = (pick: (y: (typeof years)[number]) => number) => years.reduce((s, y) => s + pick(y), 0);
const avg = (pick: (y: (typeof years)[number]) => number) => sum(pick) / years.length;

export const season = {
  report,
  yearsLabel: years.map((y) => y.year).join(' and '),
  days: sum((y) => y.days),
  /** working hours per day (05:00–19:00) */
  hoursPerDay: years[0]!.workingHours / years[0]!.days,
  overLimitHoursPerDay: Math.round(avg((y) => y.overLimitHoursPerDay) * 10) / 10,
  overLimitPct: Math.round((100 * sum((y) => y.hoursOverModerateLimit)) / sum((y) => y.workingHours)),
  insideBreakPct: Math.round(avg((y) => y.overLimitHoursInsideBreakPct)),
  afterBreakOverPct: Math.round(avg((y) => y.afterBreak.hoursOverModerateLimitPct) * 10) / 10,
  afterBreakShadeOverPct: Math.round(avg((y) => y.afterBreak.shadeHoursOverModerateLimitPct)),
  afterBreakWbgtSun: Math.round(avg((y) => y.afterBreak.meanWbgtSun) * 10) / 10,
  heavyMinShade: Math.round(avg((y) => y.afterBreak.meanHeavyMinShade)),
  heavyMinCoolRoom: Math.round(avg((y) => y.afterBreak.meanHeavyMinCoolRoom)),
  limitModerate: report.limits.moderateContinuousC,
};
