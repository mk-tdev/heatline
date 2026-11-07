// What each role is allowed to see. These projections ARE the privacy model: an agent or a
// screen receives only what its function returns. tests/projections.test.ts asserts that no
// individual physiological field ever reaches a crew-level or planning projection.

import type { Language, Minute, MinuteRecord, Scenario, WarningAction, WarningLevel, WarningReason } from '@heatline/contracts';
import { formatClock } from '@heatline/contracts';
import { ZONE_RULES, heatZone, isAcclimatised, type HeatZone } from '@heatline/rules';

// ---- Supervisor and site-safety agent: crews, never individuals -------------------------

export interface CrewSummary {
  crew: string;
  task: string;
  zone: string;
  zoneLabel: string;
  wbgt: number;
  heatZone: HeatZone;
  shaded: boolean;
  headcount: number;
  working: number;
  resting: number;
  inFirstAid: number;
  /** how many crew members are at each warning level (counts only) */
  levels: Record<WarningLevel, number>;
  /** number of crew members whose guardian is asking for rest or water right now */
  needRest: number;
  needWater: number;
  waterRequiredLph: number;
  workPerHourHeavy: number;
}

export function crewSummaries(scenario: Scenario, rec: MinuteRecord): CrewSummary[] {
  const crews = [...new Set(scenario.workers.map((w) => w.crew))].sort();
  return crews.map((crew) => {
    const task = scenario.tasks.find((t) => t.crew === crew)!;
    const zone = scenario.zones.find((z) => z.id === task.zone)!;
    const condition = rec.zones.find((z) => z.zone === task.zone)!;
    const members = new Set(scenario.workers.filter((w) => w.crew === crew).map((w) => w.id));
    const truth = rec.truth.filter((t) => members.has(t.worker));
    const warnings = rec.warnings.filter((w) => members.has(w.worker));
    const levels: Record<WarningLevel, number> = { green: 0, yellow: 0, amber: 0, red: 0 };
    for (const w of warnings) levels[w.level]++;
    const hz = heatZone(condition.wbgt);
    return {
      crew,
      task: task.label,
      zone: zone.id,
      zoneLabel: zone.label,
      wbgt: round1(condition.wbgt),
      heatZone: hz,
      shaded: condition.shaded,
      headcount: members.size,
      working: truth.filter((t) => t.activity !== 'rest').length,
      resting: truth.filter((t) => t.activity === 'rest' && t.zone !== 'first-aid').length,
      inFirstAid: truth.filter((t) => t.zone === 'first-aid').length,
      levels,
      needRest: warnings.filter((w) => ['rest-shade', 'rest-cabin', 'stop-work'].includes(w.action)).length,
      needWater: warnings.filter((w) => w.action === 'drink').length,
      waterRequiredLph: ZONE_RULES[hz].waterLph,
      workPerHourHeavy: ZONE_RULES[hz].workPerHour.heavy,
    };
  });
}

/**
 * The only individual fact the supervisor may receive: a red flag, with name and place, so
 * help can reach the person. Every disclosure is listed in the worker's own audit log.
 */
export interface RedFlagDisclosure {
  worker: string;
  name: string;
  zoneLabel: string;
  minute: Minute;
  clock: string;
}

export function redFlagDisclosures(scenario: Scenario, rec: MinuteRecord): RedFlagDisclosure[] {
  return rec.warnings
    .filter((w) => w.reasons.includes('red-flag'))
    .map((w) => {
      const profile = scenario.workers.find((p) => p.id === w.worker)!;
      const t = rec.truth.find((x) => x.worker === w.worker)!;
      return { worker: w.worker, name: profile.name, zoneLabel: scenario.zones.find((z) => z.id === t.zone)!.label, minute: rec.minute, clock: formatClock(rec.minute) };
    });
}

// ---- Guardian: one worker, their own data ------------------------------------------------

export interface GuardianContext {
  worker: string;
  name: string;
  language: Language;
  daysOnSite: number;
  acclimatised: boolean;
  clock: string;
  level: WarningLevel;
  reasons: WarningReason[];
  action: WarningAction;
  /** where the reading comes from; 'environment-only' means an estimate without a wearable */
  source: 'wearable' | 'environment-only';
  estCoreC: number;
  heartRate: number | null;
  waterDeficitL: number;
  minutesWorkedWithoutRest: number;
  placeLabel: string;
  /** in an air-conditioned room (cabin, tool store, first aid), not out in the heat */
  indoors: boolean;
  wbgt: number;
  /** protective clothing being worn and its WBGT adjustment, if any */
  ppe: string | null;
  clothingAdjustC: number;
}

export function guardianContext(scenario: Scenario, rec: MinuteRecord, workerId: string): GuardianContext {
  const profile = scenario.workers.find((w) => w.id === workerId);
  if (!profile) throw new Error(`Unknown worker ${workerId}`);
  const o = rec.observed.find((x) => x.worker === workerId)!;
  const warning = rec.warnings.find((x) => x.worker === workerId)!;
  const place = scenario.zones.find((z) => z.id === o.zone)!;
  return {
    worker: workerId,
    name: profile.name,
    language: profile.language,
    daysOnSite: profile.acclimatisationDay,
    acclimatised: isAcclimatised(profile.acclimatisationDay),
    clock: formatClock(rec.minute),
    level: warning.level,
    reasons: warning.reasons,
    action: warning.action,
    source: o.source,
    estCoreC: round1(o.estCoreC),
    heartRate: o.heartRate === null ? null : Math.round(o.heartRate),
    waterDeficitL: round1(o.deficitL),
    minutesWorkedWithoutRest: o.continuousWorkMin,
    placeLabel: place.label,
    indoors: place.kind === 'cabin',
    wbgt: round1(rec.zones.find((z) => z.zone === o.zone)!.wbgt),
    ppe: profile.ppe ?? null,
    clothingAdjustC: profile.clothingAdjustC ?? 0,
  };
}

// ---- Planner: capability tags, conditions and crew requests ------------------------------

export interface PlannerRosterEntry {
  id: string;
  name: string;
  crew: string;
  acclimatised: boolean;
  /** unavailable for work (e.g. after a red flag) */
  unavailable: boolean;
}

export function plannerRoster(scenario: Scenario, unavailable: string[] = []): PlannerRosterEntry[] {
  return scenario.workers.map((w) => ({ id: w.id, name: w.name, crew: w.crew, acclimatised: isAcclimatised(w.acclimatisationDay), unavailable: unavailable.includes(w.id) }));
}

const round1 = (x: number) => Math.round(x * 10) / 10;
