// Shared types for the engine, rules, agents, server and web app. Plain types only; model
// input/output schemas are added with Zod alongside the agents.

/** Minutes since local midnight on the scenario date (e.g. 15:00 → 900). */
export type Minute = number;

export type Activity = 'rest' | 'light' | 'moderate' | 'heavy';
export type ZoneKind = 'outdoor' | 'elevated' | 'cabin' | 'tent';
export type WarningLevel = 'green' | 'yellow' | 'amber' | 'red';
export type Language = 'en' | 'ar' | 'hi' | 'ur' | 'bn' | 'ml' | 'tl';

export interface Point {
  x: number; // metres east of the site origin
  y: number; // metres north of the site origin
}

export interface Zone {
  id: string;
  label: string;
  kind: ZoneKind;
  at: Point;
  /** height above ground [m]; elevated zones are never in the tower's shadow */
  height: number;
  /** multiplier on the 10 m wind speed (decks at height see more wind) */
  windFactor: number;
  hasWater: boolean;
  capacity?: number;
  /** a shade tent can be put up here (needs a floor: decks and yards, not scaffolds) */
  tentable?: boolean;
}

export interface Footprint {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  height: number;
}

export interface WorkerProfile {
  id: string;
  name: string;
  crew: string;
  language: Language;
  featured: boolean;
  /** day number on site in hot conditions; 1 = first day (unacclimatised until day 14) */
  acclimatisationDay: number;
  /** true for workers returning to the same job (NIOSH 50/60/80/100% schedule) */
  experienced: boolean;
  /** heat-exposed minutes already worked today before the scenario starts */
  priorExposureMin: number;
  /** water deficit [L] at scenario start */
  startDeficitL: number;
  /** consented wearable */
  wearable: boolean;
  /** individual offset on steady-state core temperature [°C]; hidden from the warning system */
  susceptibility: number;
  /** minute at which the wearable battery dies, if it does */
  batteryDiesAt?: Minute;
  /** behaviour: skips rest breaks that are not enforced */
  skipsBreaks?: boolean;
  /**
   * Clothing adjustment added to WBGT outside air-conditioned rooms [°C], e.g. +1 for
   * polyolefin coveralls, +3 for double-layer woven garments (ACGIH; research/02).
   */
  clothingAdjustC?: number;
  /** what the worker is wearing, for display (e.g. "polyolefin coverall") */
  ppe?: string;
}

export interface CrewTask {
  crew: string;
  zone: string;
  activity: Activity;
  label: string;
}

export interface WeatherHour {
  /** local time label "YYYY-MM-DDTHH:00" (value is the mean over the preceding hour) */
  time: string;
  airC: number;
  rhPct: number;
  pressureHpa: number;
  wind10: number;
  ssrd: number;
  directRad: number;
}

export interface WeatherModifier {
  from: Minute;
  to: Minute;
  label: string;
  rhDelta: number;
  radiationFactor: number;
  directFraction: number;
}

export interface Scenario {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD local
  utcOffsetHours: number;
  latitude: number;
  longitude: number;
  start: Minute;
  end: Minute;
  seed: number;
  tower: Footprint;
  zones: Zone[];
  workers: WorkerProfile[];
  tasks: CrewTask[];
  /** concrete pour: crew, zone, earliest start, duration, minimum crew on deck */
  pour: { crew: string; zone: string; truckArrives: Minute; durationMin: number; minCrew: number };
  networkOutage?: { from: Minute; to: Minute };
  /** the supervisor's decision point in the story, and the question put to the planner */
  decision?: { at: Minute; question: string };
  weatherModifiers: WeatherModifier[];
  weather: WeatherHour[];
}

/** One assignment block for one worker. */
export interface Assignment {
  worker: string;
  from: Minute;
  to: Minute;
  zone: string;
  activity: Activity;
  /** drink this much during the block if at a water point [L] */
  drinkL: number;
  reason?: string;
}

export interface ShadeTent {
  zone: string;
  /** minute the tent is up and giving shade */
  readyAt: Minute;
}

export interface Plan {
  id: string;
  label: string;
  /** minute the plan takes effect */
  effectiveAt: Minute;
  assignments: Assignment[];
  tents: ShadeTent[];
  pourStart: Minute | null;
  /** workers allowed to work in the midday-ban window with a recorded exemption reason */
  exemptions?: { worker: string; reason: string }[];
}

export interface Decision {
  at: Minute;
  plan: Plan;
}

export interface Environment {
  minute: Minute;
  airC: number;
  rhPct: number;
  heatIndex: number;
  sunElevation: number;
  sunAzimuth: number;
  wbgtSun: number;
  wbgtShade: number;
}

export interface ZoneConditions {
  zone: string;
  shaded: boolean;
  wbgt: number;
}

/** Ground truth for a worker at one minute (never shown to the supervisor). */
export interface WorkerTruth {
  worker: string;
  zone: string;
  activity: Activity;
  coreC: number;
  heartRate: number;
  psi: number;
  deficitL: number;
  exposureMin: number;
  /** minutes worked since the last rest of at least 10 minutes */
  continuousWorkMin: number;
  symptomatic: boolean;
}

/** What the warning system can observe about a worker. */
export interface WorkerObservation {
  worker: string;
  source: 'wearable' | 'environment-only';
  estCoreC: number;
  heartRate: number | null;
  estPsi: number;
  deficitL: number;
  exposureMin: number;
  continuousWorkMin: number;
  zone: string;
  activity: Activity;
  symptomReported: boolean;
}

export interface Warning {
  worker: string;
  level: WarningLevel;
  reasons: WarningReason[];
  action: WarningAction;
}

export type WarningReason =
  | 'strain-severe'
  | 'strain-high'
  | 'strain-rising'
  | 'water-deficit'
  | 'rest-overdue'
  | 'acclimatisation-cap'
  | 'zone-over-limit'
  | 'alone-in-heat'
  | 'red-flag';

export type WarningAction = 'continue' | 'drink' | 'rest-shade' | 'rest-cabin' | 'stop-work' | 'emergency';

export type EventKind =
  | 'shift-start'
  | 'truck-arrived'
  | 'pour-started'
  | 'pour-finished'
  | 'battery-died'
  | 'network-down'
  | 'network-up'
  | 'weather-modifier'
  | 'tent-ready'
  | 'plan-applied'
  | 'warning-changed'
  | 'red-flag'
  | 'cooling-started'
  | 'rule-violation'
  | 'shift-end';

export interface SimEvent {
  id: string;
  minute: Minute;
  kind: EventKind;
  worker?: string;
  crew?: string;
  detail: string;
}

export interface Violation {
  rule: string;
  minute: Minute;
  worker?: string;
  crew?: string;
  detail: string;
}

export interface MinuteRecord {
  minute: Minute;
  env: Environment;
  zones: ZoneConditions[];
  truth: WorkerTruth[];
  observed: WorkerObservation[];
  warnings: Warning[];
  networkUp: boolean;
}

export interface RunResult {
  scenario: string;
  decisions: Decision[];
  minutes: MinuteRecord[];
  events: SimEvent[];
  violations: Violation[];
  pourStartedAt: Minute | null;
  pourFinishedAt: Minute | null;
}

export const formatClock = (minute: Minute): string =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
