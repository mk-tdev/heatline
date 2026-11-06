// Rules-only protective planner. Deterministic: it is the fallback when no model is
// available, the policy used by the back-test, and the baseline the AI planner must beat.
//
// Strategy: put up both shade tents (deck first, then the crew task zone that needs it most),
// stand down unacclimatised workers to light indoor duties, rotate every other crew on the
// work/rest pattern its zone allows, rest in the AC cabin while it has room and the shade
// shelter otherwise, schedule water to the zone requirement, and start the pour at the
// earliest minute the deck crew can staff it continuously within the rules.

import type { Activity, Assignment, Minute, Plan, Scenario, ShadeTent, WorkerProfile } from '@heatline/contracts';
import { ZONE_RULES, exposureCapMin, heatZone, isAcclimatised, twlWorkClass } from './tables';

/**
 * High-level choices a person or a model can make; the planner turns them into a
 * minute-by-minute plan that respects every rule it can.
 */
export interface PlanLevers {
  /** zones to shade with the two site tents, in setup order */
  tents?: string[];
  /** pour start minute; null = no pour today; omitted = earliest lawful start */
  pourStart?: Minute | null;
  /** workers moved to light indoor duties for the rest of the shift */
  standDown?: string[];
}

export interface PlannerInput {
  scenario: Scenario;
  effectiveAt: Minute;
  zoneWbgt: (zone: string, minute: Minute, plan: Pick<Plan, 'tents'>) => number;
  exposureBefore: Record<string, number>;
  /** workers who must not be assigned work (e.g. after a red flag) */
  unavailable?: string[];
  /** minutes a tent takes to put up */
  tentSetupMin?: number;
  levers?: PlanLevers;
  label?: string;
}

const SLOT = 60;
const REST_ZONE = 'cabin';
const OVERFLOW_REST_ZONE = 'shelter';
const LIGHT_DUTY_ZONE = 'store';
const REST_WATER_LPH = 0.3;

export function protectivePlan(input: PlannerInput): Plan {
  const { scenario, effectiveAt } = input;
  const setup = input.tentSetupMin ?? 15;
  const unavailable = new Set(input.unavailable ?? []);
  const levers = input.levers ?? {};
  const standDown = new Set(levers.standDown ?? []);
  let tents: ShadeTent[];
  if (levers.tents) {
    tents = levers.tents.map((zone, i) => ({ zone, readyAt: effectiveAt + (i + 1) * setup }));
  } else {
    tents = [{ zone: scenario.pour.zone, readyAt: effectiveAt + setup }];
    const outdoorTask = scenario.tasks.find((t) => t.crew !== scenario.pour.crew && t.crew !== '*' && scenario.zones.find((z) => z.id === t.zone)?.kind === 'outdoor');
    if (outdoorTask) tents.push({ zone: outdoorTask.zone, readyAt: effectiveAt + 2 * setup });
  }
  const shade = { tents };

  const end = scenario.end;
  const assignments: Assignment[] = [];
  const cabinLoad = new Map<Minute, number>();
  const restZoneFor = (from: Minute, to: Minute): string => {
    const cap = scenario.zones.find((z) => z.id === REST_ZONE)?.capacity ?? Infinity;
    for (let m = from; m < to; m++) if ((cabinLoad.get(m) ?? 0) >= cap) return OVERFLOW_REST_ZONE;
    for (let m = from; m < to; m++) cabinLoad.set(m, (cabinLoad.get(m) ?? 0) + 1);
    return REST_ZONE;
  };
  const allowedWork = (zone: string, activity: Activity, from: Minute, to: Minute): number => {
    const cls = twlWorkClass(activity);
    if (!cls) return 60;
    let min = 60;
    for (let m = from; m < to; m++) {
      const rule = ZONE_RULES[heatZone(input.zoneWbgt(zone, m, shade))];
      min = Math.min(min, rule.essentialOnly ? 0 : rule.workPerHour[cls]);
    }
    return min;
  };
  const waterFor = (zone: string, from: Minute, to: Minute): number => {
    let litres = 0;
    for (let m = from; m < to; m++) litres += ZONE_RULES[heatZone(input.zoneWbgt(zone, m, shade))].waterLph / 60;
    return litres;
  };

  const lightDuty: WorkerProfile[] = [];
  const pour = levers.pourStart === null ? null : planPour(input, shade, new Set([...unavailable, ...standDown]), levers.pourStart);
  const pourCrew = new Set(pour?.crew.map((w) => w.id) ?? []);
  const pourEnd = pour ? pour.start + scenario.pour.durationMin : 0;

  /**
   * Rotate a worker on their own task from `from` to `to`, in slots of an hour. The whole crew
   * works the same window (so nobody is left alone); `restFirst` puts the first slot's rest
   * before its work, used when coming straight off the pour.
   */
  const ownTask = (w: WorkerProfile, task: (typeof scenario.tasks)[number], from: Minute, to: Minute, restFirst = false) => {
    for (let slot = from; slot < to; slot += SLOT) {
      const slotEnd = Math.min(to, slot + SLOT);
      const work = allowedWork(task.zone, task.activity, slot, slotEnd);
      const offset = restFirst && slot === from ? Math.max(0, slotEnd - slot - work) : 0;
      rotate(assignments, w, slot, slotEnd, work, offset, task.zone, task.activity, undefined, waterFor(task.zone, slot, slotEnd), restZoneFor);
    }
  };

  for (const task of scenario.tasks.filter((t) => t.crew !== '*')) {
    const members = scenario.workers.filter((w) => w.crew === task.crew);
    // Unacclimatised workers are never rotated into heat work: medium and high zones exclude
    // them outright, and their NIOSH exposure cap is spent within the first day or two.
    const able = members.filter((w) => !unavailable.has(w.id) && !standDown.has(w.id) && isAcclimatised(w.acclimatisationDay));
    lightDuty.push(...members.filter((w) => !unavailable.has(w.id) && (standDown.has(w.id) || !isAcclimatised(w.acclimatisationDay))));
    for (const w of members.filter((x) => unavailable.has(x.id))) {
      assignments.push({ worker: w.id, from: effectiveAt, to: end, zone: 'first-aid', activity: 'rest', drinkL: 1, reason: 'unavailable' });
    }
    for (const w of able) {
      if (!pourCrew.has(w.id) || !pour) {
        ownTask(w, task, effectiveAt, end);
        continue;
      }
      if (pour.start > effectiveAt) ownTask(w, task, effectiveAt, pour.start);
      rotate(assignments, w, pour.start, pourEnd, pour.workPerHour, pour.offsets.get(w.id)!, scenario.pour.zone, 'heavy', 'pour', waterFor(scenario.pour.zone, pour.start, pourEnd), restZoneFor);
      if (pourEnd < end) ownTask(w, task, pourEnd, end, true);
    }
  }

  for (const w of lightDuty) {
    const capMin = exposureCapMin(w.acclimatisationDay, w.experienced);
    const reason = standDown.has(w.id)
      ? 'stood down by the supervisor; light indoor duties'
      : `stood down from heat work (day ${w.acclimatisationDay}, cap ${capMin} min); light indoor duties`;
    assignments.push({ worker: w.id, from: effectiveAt, to: end, zone: LIGHT_DUTY_ZONE, activity: 'light', drinkL: 0.5 * ((end - effectiveAt) / 60), reason });
  }

  return {
    id: `rules-${effectiveAt}`,
    label: input.label ?? 'Rules-based protective plan',
    effectiveAt,
    assignments: enforceLimits(input, assignments, shade),
    tents,
    pourStart: pour?.start ?? null,
  };
}

interface MinuteSlot {
  zone: string;
  activity: Activity;
  reason?: string;
  drink: number;
}

/**
 * Final minute-by-minute pass: wherever the rotation would break the rolling work/rest limit
 * or leave someone working alone in the heat, turn that work minute into rest in the shade
 * shelter. It only ever converts work to rest and never touches pour minutes, so it cannot
 * create new violations or break pour coverage.
 */
function enforceLimits(input: PlannerInput, blocks: Assignment[], shade: Pick<Plan, 'tents'>): Assignment[] {
  const { scenario, effectiveAt } = input;
  const end = scenario.end;
  const kind = new Map(scenario.zones.map((z) => [z.id, z.kind]));
  const timeline = new Map<string, MinuteSlot[]>();
  for (const b of blocks) {
    const row = timeline.get(b.worker) ?? Array.from({ length: end - effectiveAt }, (): MinuteSlot => ({ zone: OVERFLOW_REST_ZONE, activity: 'rest', drink: 0 }));
    for (let m = b.from; m < b.to; m++) row[m - effectiveAt] = { zone: b.zone, activity: b.activity, reason: b.reason, drink: b.drinkL / (b.to - b.from) };
    timeline.set(b.worker, row);
  }
  const heat = (slot: MinuteSlot) => slot.activity !== 'rest' && kind.get(slot.zone) !== 'cabin';
  const toRest = (slot: MinuteSlot): MinuteSlot => ({ zone: OVERFLOW_REST_ZONE, activity: 'rest', reason: 'limit enforced', drink: slot.drink });

  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (const row of timeline.values()) {
      for (let i = 0; i < row.length; i++) {
        const slot = row[i]!;
        if (!heat(slot)) continue;
        const cls = twlWorkClass(slot.activity)!;
        const limit = ZONE_RULES[heatZone(input.zoneWbgt(slot.zone, effectiveAt + i, shade))].workPerHour[cls];
        const from = Math.max(0, i - 59);
        let worked = 0;
        for (let j = from; j <= i; j++) if (row[j]!.activity !== 'rest') worked++;
        if (worked <= limit) continue;
        // Free the latest non-pour work minute in the window.
        for (let j = i; j >= from; j--) {
          if (row[j]!.activity !== 'rest' && row[j]!.reason !== 'pour') {
            row[j] = toRest(row[j]!);
            changed = true;
            break;
          }
        }
      }
    }
    for (let i = 0; i < end - effectiveAt; i++) {
      const byZone = new Map<string, MinuteSlot[][]>();
      for (const row of timeline.values()) if (heat(row[i]!)) byZone.set(row[i]!.zone, [...(byZone.get(row[i]!.zone) ?? []), row]);
      for (const [zone, rows] of byZone) {
        if (rows.length !== 1 || !ZONE_RULES[heatZone(input.zoneWbgt(zone, effectiveAt + i, shade))].noLoneWork) continue;
        const row = rows[0]!;
        if (row[i]!.reason === 'pour') continue;
        row[i] = toRest(row[i]!);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // Water: the zone's hourly requirement, drunk across every minute of work (bottles on
  // site), plus a cup an hour while resting.
  for (const row of timeline.values()) {
    row.forEach((slot, i) => {
      slot.drink = slot.activity !== 'rest' ? ZONE_RULES[heatZone(input.zoneWbgt(slot.zone, effectiveAt + i, shade))].waterLph / 60 : REST_WATER_LPH / 60;
    });
  }

  const out: Assignment[] = [];
  for (const [worker, row] of timeline) {
    row.forEach((slot, i) => out.push({ worker, from: effectiveAt + i, to: effectiveAt + i + 1, zone: slot.zone, activity: slot.activity, drinkL: slot.drink, reason: slot.reason }));
  }
  return mergeBlocks(out);
}

interface PourPlan {
  start: Minute;
  workPerHour: number;
  crew: WorkerProfile[];
  offsets: Map<string, number>;
}

/** Earliest pour start that can be staffed continuously within the rules, borrowing workers if needed. */
function planPour(input: PlannerInput, shade: Pick<Plan, 'tents'>, unavailable: Set<string>, fixedStart?: Minute): PourPlan | null {
  const { scenario } = input;
  const pour = scenario.pour;
  // The deck crew first, then acclimatised workers borrowed from other crews.
  const able = (w: WorkerProfile) => !unavailable.has(w.id) && isAcclimatised(w.acclimatisationDay);
  const candidates = [
    ...scenario.workers.filter((w) => w.crew === pour.crew && able(w)),
    ...scenario.workers.filter((w) => w.crew !== pour.crew && able(w)),
  ];
  const earliest = fixedStart ?? Math.max(pour.truckArrives, input.effectiveAt);
  const latest = fixedStart ?? scenario.end - pour.durationMin;
  for (let start = earliest; start <= latest && start + pour.durationMin <= scenario.end; start += 5) {
    let work = 60;
    for (let m = start; m < start + pour.durationMin; m++) {
      work = Math.min(work, ZONE_RULES[heatZone(input.zoneWbgt(pour.zone, m, shade))].workPerHour.heavy);
    }
    if (work <= 0) continue;
    const groups = Math.ceil(60 / work);
    if (candidates.length < groups * pour.minCrew) continue;
    const crew = candidates.slice(0, groups * pour.minCrew);
    // Never strand one worker on a crew task (no lone work): bring them onto the pour too.
    for (const other of new Set(candidates.map((w) => w.crew))) {
      const left = candidates.filter((w) => w.crew === other && !crew.includes(w));
      if (left.length === 1) crew.push(left[0]!);
    }
    const offsets = new Map<string, number>();
    crew.forEach((w, i) => offsets.set(w.id, Math.floor(((i % groups) * 60) / groups)));
    return { start, workPerHour: work, crew, offsets };
  }
  return null;
}

/** Fill one slot with work then rest, starting the work phase at `offset` minutes into the slot. */
function rotate(
  out: Assignment[],
  w: WorkerProfile,
  slot: Minute,
  slotEnd: Minute,
  workMin: number,
  offset: number,
  zone: string,
  activity: Activity,
  reason: string | undefined,
  waterL: number,
  restZoneFor: (from: Minute, to: Minute) => string,
) {
  const len = slotEnd - slot;
  const work = Math.min(workMin, len);
  if (work <= 0) {
    const rz = restZoneFor(slot, slotEnd);
    out.push({ worker: w.id, from: slot, to: slotEnd, zone: rz, activity: 'rest', drinkL: Math.max(0.25, waterL * 0.5), reason: 'zone above limit for this work' });
    return;
  }
  // Work window [a, a + work) wraps within the slot.
  const a = slot + (offset % len);
  const segments: [Minute, Minute, boolean][] = [];
  const workEnd = a + work;
  if (workEnd <= slotEnd) {
    if (a > slot) segments.push([slot, a, false]);
    segments.push([a, workEnd, true]);
    if (workEnd < slotEnd) segments.push([workEnd, slotEnd, false]);
  } else {
    segments.push([slot, workEnd - len, true]);
    segments.push([workEnd - len, a, false]);
    segments.push([a, slotEnd, true]);
  }
  const restSegments = segments.filter(([, , isWork]) => !isWork);
  const restTotal = restSegments.reduce((s, [f, t]) => s + (t - f), 0);
  for (const [from, to, isWork] of segments) {
    if (to <= from) continue;
    if (isWork) out.push({ worker: w.id, from, to, zone, activity, drinkL: 0, reason });
    else {
      const share = restTotal > 0 ? (to - from) / restTotal : 0;
      out.push({ worker: w.id, from, to, zone: restZoneFor(from, to), activity: 'rest', drinkL: waterL * share, reason: 'scheduled rest' });
    }
  }
  if (restTotal === 0) {
    // Continuous work allowed: water is drunk at the work zone's nearest point in short stops.
    const last = out[out.length - 1]!;
    last.drinkL = waterL;
  }
}

/** Merge adjacent blocks with the same zone/activity/reason so plans stay readable. */
function mergeBlocks(blocks: Assignment[]): Assignment[] {
  const sorted = [...blocks].sort((a, b) => (a.worker === b.worker ? a.from - b.from : a.worker.localeCompare(b.worker)));
  const out: Assignment[] = [];
  for (const b of sorted) {
    const prev = out[out.length - 1];
    if (prev && prev.worker === b.worker && prev.to === b.from && prev.zone === b.zone && prev.activity === b.activity && prev.reason === b.reason) {
      prev.to = b.to;
      prev.drinkL += b.drinkL;
    } else out.push({ ...b });
  }
  return out;
}
