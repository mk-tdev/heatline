// Worker and task profiles for the live scheduler.
//
// Acclimatisation is worked out from work history (which days a worker spent in the heat),
// not from any body measurement, so it can be held by the employer's attendance system or on
// the worker's phone. NIOSH 2016-106: new workers start at 20% of a usual day's heat exposure
// and add 20% a day; workers returning after a week or more away follow 50/60/80/100%.
// Secondary sources and studies put full loss of acclimatisation at four to six weeks away;
// Heatline uses four weeks (the conservative end).

import type { Activity } from '@heatline/contracts';

export interface TaskProfile {
  id: string;
  label: string;
  activity: Exclude<Activity, 'rest'>;
  /** whole-body metabolic rate estimate [W] */
  watts: number;
}

/**
 * Task catalogue. Watts are class estimates in the spirit of ISO 8996 and the NIOSH 2016
 * examples, to be replaced with site-specific estimates by an occupational hygienist.
 */
export const TASKS: TaskProfile[] = [
  { id: 'rebar', label: 'Rebar tying and carrying', activity: 'heavy', watts: 415 },
  { id: 'concrete', label: 'Concrete placing and finishing', activity: 'heavy', watts: 415 },
  { id: 'blockwork', label: 'Blockwork and shovelling', activity: 'heavy', watts: 415 },
  { id: 'formwork', label: 'Formwork and carrying', activity: 'moderate', watts: 300 },
  { id: 'facade', label: 'Façade panel fixing', activity: 'moderate', watts: 300 },
  { id: 'scaffold', label: 'Scaffold erection', activity: 'moderate', watts: 300 },
  { id: 'survey', label: 'Setting out and inspection', activity: 'light', watts: 180 },
  { id: 'plant', label: 'Plant operation, open cab', activity: 'light', watts: 180 },
];
export const task = (id: string): TaskProfile => {
  const t = TASKS.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown task ${id}`);
  return t;
};

export interface HeatDay {
  date: string; // YYYY-MM-DD
  /** minutes of work in the heat that day */
  heatMinutes: number;
}

export type Tier = 'acclimatised' | 'new' | 'returning';

export interface Acclimatisation {
  tier: Tier;
  /** day number in the build-up schedule (1 = first day); 0 when acclimatised */
  day: number;
  /** share of a usual day's heat exposure allowed today */
  exposureShare: number;
  /** which NIOSH limit applies today */
  limit: 'REL' | 'RAL';
  /** plain explanation, for the worker's own screen */
  reason: string;
}

const HEAT_DAY_MIN = 60;
const RETURN_AFTER_DAYS = 7;
const RESTART_AFTER_DAYS = 28;
const ACCLIMATISED_AFTER_DAYS = 14;
const dayIndex = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/** Today's acclimatisation from a work history (any order; days with under an hour in the heat do not count). */
export function acclimatisation(history: HeatDay[], today: string): Acclimatisation {
  const t = dayIndex(today);
  const days = [...new Set(history.filter((d) => d.heatMinutes >= HEAT_DAY_MIN && dayIndex(d.date) < t).map((d) => dayIndex(d.date)))].sort((a, b) => b - a);
  if (!days.length) return { tier: 'new', day: 1, exposureShare: 0.2, limit: 'RAL', reason: 'No recent days in the heat: first day of a new-worker build-up (20%).' };
  const gapToday = t - days[0]!;
  if (gapToday > RESTART_AFTER_DAYS) return { tier: 'new', day: 1, exposureShare: 0.2, limit: 'RAL', reason: `${gapToday - 1} days away from the heat: acclimatisation is treated as lost; start again at 20%.` };
  // The current run of heat days, broken by any gap of a week or more.
  let run = 1;
  for (let i = 1; i < days.length && days[i - 1]! - days[i]! < RETURN_AFTER_DAYS; i++) run++;
  const gapBeforeRun = run < days.length ? days[run - 1]! - days[run]! : Infinity;
  if (gapToday >= RETURN_AFTER_DAYS) {
    // Returning today after a week or more away.
    return { tier: 'returning', day: 1, exposureShare: 0.5, limit: 'RAL', reason: `${gapToday - 1} days away from the heat: returning schedule, day 1 (50%).` };
  }
  const dayToday = run + 1;
  if (gapBeforeRun >= RETURN_AFTER_DAYS && gapBeforeRun <= RESTART_AFTER_DAYS && days.length > run) {
    const share = [0.5, 0.6, 0.8][dayToday - 1] ?? 1;
    return share < 1
      ? { tier: 'returning', day: dayToday, exposureShare: share, limit: 'RAL', reason: `Back after a break: returning schedule, day ${dayToday} (${Math.round(share * 100)}%).` }
      : { tier: 'acclimatised', day: 0, exposureShare: 1, limit: 'REL', reason: 'Back to full exposure after the returning schedule.' };
  }
  if (dayToday >= ACCLIMATISED_AFTER_DAYS) return { tier: 'acclimatised', day: 0, exposureShare: 1, limit: 'REL', reason: `${run} recent days in the heat: acclimatised.` };
  return { tier: 'new', day: dayToday, exposureShare: Math.min(1, 0.2 * dayToday), limit: 'RAL', reason: `Day ${dayToday} of a new-worker build-up (${Math.round(Math.min(1, 0.2 * dayToday) * 100)}% of a usual day; full limits from day ${ACCLIMATISED_AFTER_DAYS}).` };
}

/** A worker history with `days` consecutive heat days ending yesterday (for scenarios and tests). */
export function historyOf(today: string, days: number, minutes = 420): HeatDay[] {
  const t = dayIndex(today);
  return Array.from({ length: days }, (_, i) => ({ date: new Date((t - 1 - i) * 86_400_000).toISOString().slice(0, 10), heatMinutes: minutes }));
}
