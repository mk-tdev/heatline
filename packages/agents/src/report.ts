// The shift recorder: drafts the end-of-shift heat-safety record for the site's HSE file from
// a crew-level summary of the scheduler's day. Every number comes from the summary; the model
// writes the prose, and its draft is rejected if it introduces a number, a name or a safety claim.

import { z } from 'zod';

/** Structural copy of the summary built in @heatline/sim (shiftSummary), kept here to avoid a dependency. */
export interface ShiftRecordInput {
  date: string;
  from: string;
  to: string;
  shiftMinutes: number;
  peakWbgtSun: number;
  peakAt: string;
  maxSiteAboveForecastC: number;
  stationMinutes: number;
  stationMissingMinutes: number;
  dustMinutes: { elevated: number; unhealthy: number; severe: number };
  peakPm10: number;
  alerts: { total: number; toActOn: number; urgent: number; breaksAnnounced: number; breaksMovedEarlier: number; breaksUnannounced: number; stationEvents: number; dustEvents: number; capsReached: number };
  groups: {
    crew: string;
    workers: string;
    task: string;
    headcount: number;
    mainTaskMin: number;
    indoorRotationMin: number;
    restMin: number;
    indoorCapMin: number;
    minutesOverLimitEstimated: number;
    peakLimitSharePct: number;
    breaksAnnounced: number;
    restMovedToCooledRoom: boolean;
  }[];
}

export const ShiftRecord = z.object({
  summary: z.string().describe('Two or three sentences: conditions, how crews were protected, and anything unusual.'),
  wentWell: z.array(z.string()).describe('Up to three short points.'),
  concerns: z.array(z.string()).describe('Up to three short points that need follow-up; empty if none.'),
  forTomorrow: z.array(z.string()).describe('Up to three concrete actions for the next shift, drawn only from the record.'),
});
export type ShiftRecord = z.infer<typeof ShiftRecord>;

export const REPORT_SYSTEM = `You are the heat-safety recorder for a construction site in the UAE. Draft the end-of-shift record for the site's health and safety file, for the site manager to review and sign.
You receive a crew-level summary computed by the scheduler. You never see, ask for, or mention any individual worker, name or body reading.
Rules:
- Use only numbers that appear in the summary, exactly as written. Do not add, subtract, convert, round or total them yourself.
- "Minutes over the limit" are the scheduler's own estimates on the board, not measurements of harm. Say "estimated".
- Plain, factual sentences a manager can sign. No diagnosis or medicine. Never say the shift was safe or compliant; say what the record shows.
- Concerns: station gaps, breaks that could not be announced ahead, minutes over the limit, dust, heat-time caps, rest moved to the cooled room. Leave concerns empty if there are none.
- Do not list a zero count as an achievement unless its absence matters (for example, no break had to be called without warning). Prefer the few points a manager would act on.
- For tomorrow: concrete actions that follow from the record (for example: check the station mounting and power, keep the cooled room free for crew C, plan the pour earlier). Do not invent equipment or people the summary does not mention.`;

export function reportPrompt(s: ShiftRecordInput): string {
  const lines = [
    `Shift ${s.date}, ${s.from}–${s.to}: ${s.shiftMinutes} minutes on shift.`,
    `Peak WBGT in the sun ${s.peakWbgtSun} °C at ${s.peakAt}. Site ran up to ${s.maxSiteAboveForecastC} °C above the forecast.`,
    `Station: ${s.stationMinutes} minutes live, ${s.stationMissingMinutes} minutes without it (forecast plus margin).`,
    `Dust: ${s.dustMinutes.elevated} minutes elevated, ${s.dustMinutes.unhealthy} unhealthy, ${s.dustMinutes.severe} severe; peak PM10 ${s.peakPm10} µg/m³.`,
    `Alerts: ${s.alerts.total} in all, ${s.alerts.toActOn} to act on (${s.alerts.urgent} urgent). Breaks announced ahead: ${s.alerts.breaksAnnounced}. Breaks moved earlier: ${s.alerts.breaksMovedEarlier}. Breaks that could not be announced ahead: ${s.alerts.breaksUnannounced}. Station events: ${s.alerts.stationEvents}. Dust events: ${s.alerts.dustEvents}. Heat-time caps reached: ${s.alerts.capsReached}.`,
    ...s.groups.map((g) => `Crew ${g.crew}${g.workers === 'whole crew' ? '' : `, ${g.workers}`} (${g.task}, ${g.headcount} people): ${g.mainTaskMin} min on the main task, ${g.indoorRotationMin} min indoor rotation, ${g.restMin} min rest${g.indoorCapMin ? `, ${g.indoorCapMin} min indoor work after reaching the heat-time cap` : ''}. Estimated minutes over the limit: ${g.minutesOverLimitEstimated}. Peak ${g.peakLimitSharePct}% of the limit. ${g.breaksAnnounced} breaks announced.${g.restMovedToCooledRoom ? ' Rest moved from shade to the cooled room.' : ''}`),
  ];
  return lines.join('\n');
}

/** Rule-written record when the model is unavailable or its draft is rejected. */
export function fallbackShiftRecord(s: ShiftRecordInput): ShiftRecord {
  const over = s.groups.filter((g) => g.minutesOverLimitEstimated > 0);
  const concerns: string[] = [];
  if (s.stationMissingMinutes > 0) concerns.push(`The station was unavailable for ${s.stationMissingMinutes} minutes; breaks were timed from the forecast with a margin.`);
  if (s.alerts.breaksUnannounced > 0) concerns.push(`${s.alerts.breaksUnannounced} breaks could not be announced ahead because conditions changed quickly.`);
  for (const g of over.slice(0, 2)) concerns.push(`Crew ${g.crew}: an estimated ${g.minutesOverLimitEstimated} minutes over the limit.`);
  if (s.dustMinutes.unhealthy + s.dustMinutes.severe > 0) concerns.push(`Dust was unhealthy or worse for ${s.dustMinutes.unhealthy + s.dustMinutes.severe} minutes (peak PM10 ${s.peakPm10} µg/m³).`);
  const wentWell = [
    `${s.alerts.breaksAnnounced} breaks were announced ahead.`,
    ...(s.groups.some((g) => g.indoorRotationMin > 0) ? ['Crews rotated to indoor tasks instead of resting where the heat allowed it.'] : []),
    ...(over.length === 0 ? ['No crew group was estimated over its limit.'] : []),
  ].slice(0, 3);
  const forTomorrow = [
    ...(s.stationMissingMinutes > 0 ? ['Check the station mounting, power and network before the shift.'] : []),
    ...(s.groups.some((g) => g.restMovedToCooledRoom) ? ['Plan cooled-room rest for every crew; shade was not enough today.'] : []),
    ...(s.maxSiteAboveForecastC >= 1 ? ['Expect the site to run hotter than the forecast; review tomorrow’s plan against it.'] : []),
  ].slice(0, 3);
  return {
    summary: `Shift ${s.date}, ${s.from}–${s.to}. Peak WBGT in the sun ${s.peakWbgtSun} °C at ${s.peakAt}. ${s.alerts.toActOn} alerts called for action.`,
    wentWell,
    concerns: concerns.slice(0, 3),
    forTomorrow,
  };
}

const NAMES = /\b(anwar|suresh|ravi|ahmed|bilal|joel)\b/i;
const number = (x: string) => String(Number(x.replace(/,/g, '')));

/** Reject a draft that adds a number, a name or a safety claim. Returns a reason or null. */
export function checkShiftRecord(s: ShiftRecordInput, r: ShiftRecord): string | null {
  const all = [r.summary, ...r.wentWell, ...r.concerns, ...r.forTomorrow].join(' ');
  if (!r.summary.trim() || r.wentWell.length > 3 || r.concerns.length > 3 || r.forTomorrow.length > 3 || all.length > 1600) return 'shape';
  if (NAMES.test(all)) return 'name';
  if (/\b(was|were|is|are) (safe|compliant)\b|\bguarantee/i.test(all)) return 'safety claim';
  const source = reportPrompt(s);
  const known = new Set((source.match(/\d+(?:[.,]\d+)?/g) ?? []).map(number));
  for (const t of all.match(/\d{1,2}:\d{2}/g) ?? []) if (!source.includes(t.padStart(5, '0'))) return `unknown time ${t}`;
  const withoutTimes = all.replace(/\d{1,2}:\d{2}/g, ' ').replace(/\d{4}-\d{2}-\d{2}/g, ' ');
  for (const n of withoutTimes.match(/\d+(?:[.,]\d+)?/g) ?? []) {
    if (!known.has(number(n)) && !['0', '1', '2', '3'].includes(number(n))) return `unknown number ${n}`;
  }
  const crews = new Set(s.groups.map((g) => g.crew));
  for (const c of all.match(/\b[Cc]rew ([A-Z])\b/g) ?? []) if (!crews.has(c.slice(-1))) return `unknown crew ${c}`;
  return null;
}
