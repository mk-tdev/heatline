// DEMONSTRATION POLICY ONLY. No TWL is measured or computed here. WBGT bands are
// scenario assumptions, not TWL equivalents, NIOSH limits, or UAE compliance criteria.
// Independent NIOSH exposure screening lives in sim/screening.ts.
// Rule tables. Every row names its source in research/. Values marked ASSUMPTION are
// Heatline's configurable defaults, not regulatory text.

import type { Activity } from '@heatline/contracts';

export type HeatZone = 'unrestricted' | 'low' | 'medium' | 'high';

export const SOURCES = {
  sharjahTwl: 'Sharjah OSHJ-CoP-33 v2 (2024) Table 3 — research/02 "TWL zones"; Abu Dhabi OSHAD CoP 11.0 uses the same approach',
  middayBan: 'MoHRE midday break, 12:30–15:00, 15 Jun–15 Sep — research/04',
  niosh: 'NIOSH 2016 acclimatisation schedule — research/02 "Acclimatisation"',
  dubaiFlags: 'Dubai Municipality heat-stress guideline v2.0 (2019) flag colours — research/02',
  psi: 'Moran et al. (1998) PSI bands — research/02 "Physiological strain"',
  proxy:
    'DEMONSTRATION ASSUMPTION: WBGT scenario bands only. No equivalence to TWL or regulatory compliance is established. Work/rest defaults borrow the structure of published TWL guidance, not its validity for these WBGT bands.',
} as const;

/**
 * Demonstration band from WBGT at a work location.
 * These are not TWL zones; see SOURCES.proxy and docs/scientific-basis.md.
 */
export const ZONE_WBGT_THRESHOLDS = { low: 28, medium: 30.5, high: 32.5 } as const;

export function heatZone(wbgt: number): HeatZone {
  if (wbgt >= ZONE_WBGT_THRESHOLDS.high) return 'high';
  if (wbgt >= ZONE_WBGT_THRESHOLDS.medium) return 'medium';
  if (wbgt >= ZONE_WBGT_THRESHOLDS.low) return 'low';
  return 'unrestricted';
}

/** TWL zones define light and heavy work only; moderate is treated as heavy (conservative). */
export const twlWorkClass = (activity: Activity): 'light' | 'heavy' | null =>
  activity === 'rest' ? null : activity === 'light' ? 'light' : 'heavy';

export interface ZoneRule {
  /** maximum work minutes in any 60-minute window */
  workPerHour: { light: number; heavy: number };
  /** water to drink per hour while working [L] */
  waterLph: number;
  /** may unacclimatised workers work here */
  unacclimatisedAllowed: boolean;
  /** must workers be in pairs or more */
  noLoneWork: boolean;
  /** only essential work (e.g. a pour already committed) may continue */
  essentialOnly: boolean;
}

/** Sharjah CoP 33 Table 3 (the "Acclimatised employees not allowed" cell is read as *unacclimatised*; see research/02). */
export const ZONE_RULES: Record<HeatZone, ZoneRule> = {
  unrestricted: { workPerHour: { light: 60, heavy: 60 }, waterLph: 0.5, unacclimatisedAllowed: true, noLoneWork: false, essentialOnly: false },
  low: { workPerHour: { light: 60, heavy: 60 }, waterLph: 1.0, unacclimatisedAllowed: true, noLoneWork: true, essentialOnly: false },
  medium: { workPerHour: { light: 60, heavy: 40 }, waterLph: 1.2, unacclimatisedAllowed: false, noLoneWork: true, essentialOnly: false },
  high: { workPerHour: { light: 45, heavy: 20 }, waterLph: 1.5, unacclimatisedAllowed: false, noLoneWork: true, essentialOnly: true },
};

/** Midday break: outdoor work in direct sun is prohibited 12:30–15:00 from 15 June to 15 September. */
export const MIDDAY_BAN = { from: 12 * 60 + 30, to: 15 * 60, season: { from: '06-15', to: '09-15' } } as const;

export function middayBanApplies(date: string, minute: number): boolean {
  const md = date.slice(5);
  return md >= MIDDAY_BAN.season.from && md <= MIDDAY_BAN.season.to && minute >= MIDDAY_BAN.from && minute < MIDDAY_BAN.to;
}

/** A worker counts as unacclimatised until day 14 (Sharjah CoP 33: >14 days off resets). */
export const isAcclimatised = (day: number): boolean => day >= 14;

/**
 * NIOSH cap on heat-exposed minutes for a day, as a share of a usual 8-hour heat exposure.
 * New workers: 20% on day 1, +20% per day. Experienced workers returning: 50/60/80/100%.
 */
export const USUAL_EXPOSURE_MIN = 480;
export function exposureCapMin(day: number, experienced: boolean): number {
  const share = experienced ? ([0.5, 0.6, 0.8][day - 1] ?? 1) : Math.min(1, 0.2 * day);
  return Math.round(share * USUAL_EXPOSURE_MIN);
}

/** Warning thresholds on the observed strain index and water deficit. */
export const WARNING_THRESHOLDS = {
  psi: { yellow: 5, amber: 7, red: 9 },
  deficitL: { yellow: 1.0, amber: 1.5 },
  restDueSoonMin: 5,
  restOverdueMin: 5,
} as const;
