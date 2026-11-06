// Deterministic shift engine. Pure: the same scenario, policy and decisions always produce
// the same run, so rewinding is simply re-running with one decision changed.
//
// Two physiologies run side by side. TRUTH is what happens to each worker's body in the
// simulation. OBSERVATION is what the warning system can know: noisy wearable signals when a
// worker has one with battery, otherwise an environment-only estimate. Warnings are computed
// from observations only, which is what makes lead time and false alarms measurable.

import type {
  Activity,
  Assignment,
  Decision,
  EventKind,
  Minute,
  MinuteRecord,
  Plan,
  RunResult,
  Scenario,
  SimEvent,
  Violation,
  Warning,
  WorkerObservation,
  WorkerProfile,
  WorkerTruth,
} from '@heatline/contracts';
import { formatClock } from '@heatline/contracts';
import { dubaiFlag } from '@heatline/climate';
import {
  ZONE_RULES,
  evaluateWarning,
  exposureCapMin,
  heatZone,
  isAcclimatised,
  middayBanApplies,
  twlWorkClass,
} from '@heatline/rules';
import { createEnvironment, type SiteEnvironment } from './environment';
import { SYMPTOM_CORE_C, SYMPTOM_MINUTES, heartRate, psi, stepCore, sweatRateLph } from './physiology';
import { baselinePlan } from './plans';
import { noise } from './random';

export type Policy = 'baseline' | 'site-flags' | 'heatline';

export interface RunOptions {
  policy: Policy;
  decisions?: Decision[];
  /** reuse a prepared environment (back-test runs many policies on one day) */
  environment?: SiteEnvironment;
}

/** Minutes before co-workers notice and act on a collapsed or confused colleague without Heatline. */
export const UNAIDED_DETECTION_MIN = 6;
const WEARABLE_LAG_MIN = 5;
const OVERRIDE_REST_MIN = 12;
/** Core temperature at which self-paced workers ease heavy work to moderate. */
export const SELF_PACE_CORE_C = 38.5;

interface WorkerState {
  core: number;
  coreHistory: number[];
  deficit: number;
  exposure: number;
  continuousWork: number;
  restRun: number;
  aboveSymptom: number;
  symptomatic: boolean;
  symptomaticSince: Minute | null;
  coolingSince: Minute | null;
  estCore: number;
  estDeficit: number;
  restUntil: Minute;
  stoodDown: boolean;
  lastLevel: Warning['level'];
  lastViolations: Set<string>;
}

export function runShift(scenario: Scenario, options: RunOptions): RunResult {
  const env = options.environment ?? createEnvironment(scenario);
  const decisions = [...(options.decisions ?? [])].sort((a, b) => a.at - b.at);
  const baseline = baselinePlan(scenario);
  const events: SimEvent[] = [];
  const violations: Violation[] = [];
  const minutes: MinuteRecord[] = [];
  let eventSeq = 0;
  const emit = (minute: Minute, kind: EventKind, detail: string, extra: Partial<SimEvent> = {}) =>
    events.push({ id: `e${String(++eventSeq).padStart(4, '0')}`, minute, kind, detail, ...extra });

  const states = new Map<string, WorkerState>(
    scenario.workers.map((w) => [
      w.id,
      {
        core: 37.2,
        coreHistory: [],
        deficit: w.startDeficitL,
        exposure: w.priorExposureMin,
        continuousWork: 0,
        restRun: 0,
        aboveSymptom: 0,
        symptomatic: false,
        symptomaticSince: null,
        coolingSince: null,
        estCore: 37.2,
        estDeficit: 0.5,
        restUntil: -1,
        stoodDown: false,
        lastLevel: 'green',
        lastViolations: new Set(),
      },
    ]),
  );

  const planAt = (minute: Minute): Plan => {
    let plan = baseline;
    for (const d of decisions) if (d.at <= minute && d.plan.effectiveAt <= minute) plan = d.plan;
    return plan;
  };
  const blockFor = (plan: Plan, worker: string, minute: Minute): Assignment | undefined =>
    plan.assignments.find((a) => a.worker === worker && a.from <= minute && minute < a.to);

  let pourProgress = 0;
  let pourStartedAt: Minute | null = null;
  let pourFinishedAt: Minute | null = null;
  let lastPlanId = baseline.id;
  let previousWarnings = new Map<string, Warning>();

  emit(scenario.start, 'shift-start', `Shift starts ${formatClock(scenario.start)} on ${scenario.date}`);

  for (let minute = scenario.start; minute < scenario.end; minute++) {
    const plan = planAt(minute);
    if (plan.id !== lastPlanId) {
      emit(minute, 'plan-applied', `Plan applied: ${plan.label}`);
      lastPlanId = plan.id;
    }
    scheduledEvents(scenario, plan, minute, emit);

    const envNow = env.at(minute);
    const conditions = env.zoneConditions(minute, plan);
    const conditionOf = new Map(conditions.map((c) => [c.zone, c]));
    const siteFlag = dubaiFlag(envNow.heatIndex);
    const networkUp = !scenario.networkOutage || minute < scenario.networkOutage.from || minute >= scenario.networkOutage.to;

    // 1. Where is everyone and what are they doing this minute.
    const placed = scenario.workers.map((w) => {
      const s = states.get(w.id)!;
      const block = blockFor(plan, w.id, minute);
      const prev = previousWarnings.get(w.id);
      return { w, s, ...place(w, s, block, prev, minute, options.policy, scenario, siteFlag) };
    });
    const workingInZone = new Map<string, number>();
    for (const p of placed) if (p.activity !== 'rest') workingInZone.set(p.zone, (workingInZone.get(p.zone) ?? 0) + 1);

    // 2. Advance truth and observation; evaluate warnings.
    const truth: WorkerTruth[] = [];
    const observed: WorkerObservation[] = [];
    const warnings: Warning[] = [];
    for (const p of placed) {
      const { w, s, zone, activity } = p;
      const zoneKind = scenario.zones.find((z) => z.id === zone)!.kind;
      const condition = conditionOf.get(zone)!;
      const wbgt = condition.wbgt;
      const shaded = zoneKind !== 'cabin' && condition.shaded;
      const inputs = { activity, wbgt, inCabin: zoneKind === 'cabin', inShade: shaded, acclimatisationDay: w.acclimatisationDay };

      s.core = stepCore(s.core, { ...inputs, deficitL: s.deficit, susceptibility: w.susceptibility });
      s.coreHistory.push(s.core);
      const drink = p.drinkPerMin;
      s.deficit = Math.max(0, s.deficit + sweatRateLph(activity, wbgt) / 60 - drink);
      s.estDeficit = Math.max(0, s.estDeficit + sweatRateLph(activity, wbgt) / 60 - drink);
      const working = activity !== 'rest';
      if (working && zoneKind !== 'cabin') s.exposure += 1;
      if (working) {
        s.continuousWork += 1;
        s.restRun = 0;
      } else if (++s.restRun >= 10) s.continuousWork = 0;

      s.aboveSymptom = s.core >= SYMPTOM_CORE_C ? s.aboveSymptom + 1 : 0;
      if (!s.symptomatic && s.aboveSymptom >= SYMPTOM_MINUTES) {
        s.symptomatic = true;
        s.symptomaticSince = minute;
        emit(minute, 'red-flag', `${w.name} shows signs of heat illness (confusion)`, { worker: w.id });
      } else if (s.symptomatic && s.core < 38.5) s.symptomatic = false;
      if (s.symptomatic && p.cooling && s.coolingSince === null) {
        s.coolingSince = minute;
        emit(minute, 'cooling-started', `${w.name} is being cooled in the first-aid room`, { worker: w.id });
      }

      const hr = heartRate(s.core, activity, s.deficit);
      truth.push({
        worker: w.id,
        zone,
        activity,
        coreC: s.core,
        heartRate: hr,
        psi: psi(s.core, hr),
        deficitL: s.deficit,
        exposureMin: s.exposure,
        continuousWorkMin: s.continuousWork,
        symptomatic: s.symptomatic,
      });

      const obs = observe(w, s, inputs, activity, zone, minute, scenario.seed);
      observed.push(obs);
      const warning = evaluateWarning({
        observation: obs,
        acclimatisationDay: w.acclimatisationDay,
        experienced: w.experienced,
        wbgt,
        coworkersInZone: working ? (workingInZone.get(zone) ?? 1) - 1 : 0,
      });
      warnings.push(warning);
      if (warning.level !== s.lastLevel) {
        emit(minute, 'warning-changed', `${w.name}: ${s.lastLevel} → ${warning.level} (${warning.reasons.join(', ') || 'clear'})`, { worker: w.id });
        s.lastLevel = warning.level;
      }
      if (working) recordViolations(w, s, zone, activity, wbgt, minute, scenario, plan, violations);
      else s.lastViolations.clear();
    }

    // 3. Pour progress: needs the minimum crew working on the deck as part of the pour.
    if (plan.pourStart !== null && minute >= plan.pourStart && pourFinishedAt === null) {
      const onDeck = placed.filter((p) => p.zone === scenario.pour.zone && p.activity !== 'rest' && p.pour).length;
      if (onDeck >= scenario.pour.minCrew) {
        if (pourStartedAt === null) {
          pourStartedAt = minute;
          emit(minute, 'pour-started', `Pour started with ${onDeck} on the deck`, { crew: scenario.pour.crew });
        }
        if (++pourProgress >= scenario.pour.durationMin) {
          pourFinishedAt = minute + 1;
          emit(minute + 1, 'pour-finished', 'Pour finished', { crew: scenario.pour.crew });
        }
      }
    }

    previousWarnings = new Map(warnings.map((x) => [x.worker, x]));
    minutes.push({ minute, env: envNow, zones: conditions, truth, observed, warnings, networkUp });
  }

  emit(scenario.end, 'shift-end', `Shift ends ${formatClock(scenario.end)}`);
  return { scenario: scenario.id, decisions, minutes, events, violations, pourStartedAt, pourFinishedAt };
}

interface Placement {
  zone: string;
  activity: Activity;
  drinkPerMin: number;
  cooling: boolean;
  pour: boolean;
}

/** Where a worker is and what they do this minute, given the plan, the policy and last minute's warning. */
function place(
  w: WorkerProfile,
  s: WorkerState,
  block: Assignment | undefined,
  prev: Warning | undefined,
  minute: Minute,
  policy: Policy,
  scenario: Scenario,
  siteFlag: ReturnType<typeof dubaiFlag>,
): Placement {
  // After a red flag a worker is cooled and then stays off heat work for the rest of the shift.
  if (s.coolingSince !== null) return { zone: 'first-aid', activity: 'rest', drinkPerMin: 0.02, cooling: true, pour: false };
  // A symptomatic worker is cooled once someone acts: at once with Heatline, otherwise when noticed.
  if (s.symptomatic && s.symptomaticSince !== null) {
    const noticed = policy === 'heatline' ? true : minute - s.symptomaticSince >= UNAIDED_DETECTION_MIN;
    if (noticed) return { zone: 'first-aid', activity: 'rest', drinkPerMin: 0.02, cooling: true, pour: false };
  }
  let zone = block?.zone ?? 'shelter';
  let activity: Activity = block?.activity ?? 'rest';
  let drinkPerMin = block ? block.drinkL / Math.max(1, block.to - block.from) : 0;
  let pour = block?.reason === 'pour';

  // Without enforcement, some workers keep working through scheduled breaks.
  const scheduledRest = block?.activity === 'rest' && block.reason === 'scheduled break';
  if (w.skipsBreaks && scheduledRest && policy !== 'heatline') {
    const task = scenario.tasks.find((t) => t.crew === w.crew)!;
    zone = task.zone;
    activity = task.activity;
    pour = w.crew === scenario.pour.crew;
    drinkPerMin = 0;
  }

  // Self-paced work: a hot worker slows heavy work to a moderate pace. Pour work is paced by
  // the concrete and cannot slow down (the TWL distinction between self-paced and paced work).
  if (activity === 'heavy' && !pour && s.core >= SELF_PACE_CORE_C) activity = 'moderate';

  if (policy === 'site-flags' && activity !== 'rest') {
    // Dubai-style flag: site-wide rest by the hour, same for everyone.
    const restMin = siteFlag === 'red' ? 30 : siteFlag === 'amber' ? 15 : 0;
    if ((minute - scenario.start) % 60 >= 60 - restMin) return { zone: 'shelter', activity: 'rest', drinkPerMin: 0.3 / Math.max(1, restMin), cooling: false, pour: false };
  }

  if (policy === 'heatline') {
    if (s.stoodDown) return { zone: 'store', activity: 'light', drinkPerMin: 0.01, cooling: false, pour: false };
    if (prev?.action === 'stop-work') {
      s.stoodDown = true;
      return { zone: 'store', activity: 'light', drinkPerMin: 0.01, cooling: false, pour: false };
    }
    // Imperfect compliance: a worker who habitually skips breaks also pushes through his
    // guardian's strain warnings to finish the job. Only an actual symptom stops him; rest the
    // supervisor has scheduled into the plan is kept.
    const ignoresAdvice = !!w.skipsBreaks && !!prev && prev.level !== 'green' && !prev.reasons.includes('red-flag');
    if (prev && !ignoresAdvice && (prev.action === 'rest-cabin' || prev.action === 'emergency') && activity !== 'rest' && minute >= s.restUntil) {
      s.restUntil = minute + OVERRIDE_REST_MIN;
    }
    if (minute < s.restUntil) return { zone: 'cabin', activity: 'rest', drinkPerMin: 0.04, cooling: false, pour: false };
    if (prev?.action === 'drink') drinkPerMin += 0.02;
  }
  return { zone, activity, drinkPerMin, cooling: false, pour };
}

/** What the warning system can see about one worker this minute. */
function observe(
  w: WorkerProfile,
  s: WorkerState,
  inputs: { activity: Activity; wbgt: number; inCabin: boolean; inShade: boolean; acclimatisationDay: number },
  activity: Activity,
  zone: string,
  minute: Minute,
  seed: number,
): WorkerObservation {
  const wearableOn = w.wearable && (w.batteryDiesAt === undefined || minute < w.batteryDiesAt);
  // The environment-only estimator always runs, so it is warm when a wearable drops out.
  s.estCore = stepCore(s.estCore, { ...inputs, deficitL: s.estDeficit, susceptibility: 0 });
  let estCore = s.estCore;
  let hr: number | null = null;
  if (wearableOn) {
    const lagged = s.coreHistory[Math.max(0, s.coreHistory.length - 1 - WEARABLE_LAG_MIN)] ?? s.core;
    estCore = lagged + 0.15 * noise(seed, `${w.id}:bias`);
    hr = heartRate(s.core, activity, s.deficit) + 3 * noise(seed, `${w.id}:hr`, minute);
    s.estCore = estCore;
  }
  const estHr = hr ?? heartRate(estCore, activity, s.estDeficit);
  return {
    worker: w.id,
    source: wearableOn ? 'wearable' : 'environment-only',
    estCoreC: estCore,
    heartRate: hr,
    estPsi: psi(estCore, estHr),
    deficitL: s.estDeficit,
    exposureMin: s.exposure,
    continuousWorkMin: s.continuousWork,
    zone,
    activity,
    symptomReported: s.symptomatic,
  };
}

function scheduledEvents(scenario: Scenario, plan: Plan, minute: Minute, emit: (m: Minute, k: EventKind, d: string, x?: Partial<SimEvent>) => void) {
  if (minute === scenario.pour.truckArrives) emit(minute, 'truck-arrived', 'Concrete truck arrived at the gate', { crew: scenario.pour.crew });
  for (const w of scenario.workers) if (w.batteryDiesAt === minute) emit(minute, 'battery-died', `${w.name}'s wearable battery died`, { worker: w.id });
  if (scenario.networkOutage?.from === minute) emit(minute, 'network-down', 'Site network down');
  if (scenario.networkOutage?.to === minute) emit(minute, 'network-up', 'Site network restored');
  for (const m of scenario.weatherModifiers) if (m.from === minute) emit(minute, 'weather-modifier', m.label);
  for (const t of plan.tents) if (t.readyAt === minute) emit(minute, 'tent-ready', `Shade tent ready at ${t.zone}`);
}

/** Record a violation episode when a rule starts being broken (not every minute it continues). */
function recordViolations(w: WorkerProfile, s: WorkerState, zone: string, activity: Activity, wbgt: number, minute: Minute, scenario: Scenario, plan: Plan, out: Violation[]) {
  const rule = ZONE_RULES[heatZone(wbgt)];
  const cls = twlWorkClass(activity)!;
  const zoneKind = scenario.zones.find((z) => z.id === zone)!.kind;
  const now = new Set<string>();
  if (zoneKind !== 'cabin') {
    if (!rule.unacclimatisedAllowed && !isAcclimatised(w.acclimatisationDay)) now.add('unacclimatised-in-zone');
    if (rule.workPerHour[cls] < 60 && s.continuousWork > rule.workPerHour[cls] + 5) now.add('work-rest');
    if (rule.essentialOnly && !(zone === scenario.pour.zone && plan.pourStart !== null)) now.add('essential-only');
    if (middayBanApplies(scenario.date, minute) && !plan.tents.some((t) => t.zone === zone && t.readyAt <= minute)) now.add('midday-ban');
  }
  if (!isAcclimatised(w.acclimatisationDay) && s.exposure > exposureCapMin(w.acclimatisationDay, w.experienced) && zoneKind !== 'cabin') now.add('acclimatisation-cap');
  for (const r of now) {
    if (!s.lastViolations.has(r)) out.push({ rule: r, minute, worker: w.id, detail: `${w.name}: ${r} at ${formatClock(minute)} in ${zone}` });
  }
  s.lastViolations = now;
}
