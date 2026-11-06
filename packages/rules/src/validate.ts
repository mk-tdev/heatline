// Plan validation: every proposed plan (from a person, the rules planner or a model) is
// checked minute by minute before it can be approved. Output cites the rule that failed.

import type { Assignment, Minute, Plan, Scenario, Violation, WorkerProfile } from '@heatline/contracts';
import { formatClock } from '@heatline/contracts';
import { ZONE_RULES, exposureCapMin, heatZone, isAcclimatised, middayBanApplies, twlWorkClass } from './tables';

export interface ValidationInput {
  scenario: Scenario;
  plan: Plan;
  /** forecast WBGT at a zone and minute, accounting for shade (tower shadow, tents in the plan) */
  zoneWbgt: (zone: string, minute: Minute, plan: Plan) => number;
  /** heat-exposed minutes each worker has accumulated before plan.effectiveAt */
  exposureBefore: Record<string, number>;
  /** water deficit each worker carries into the plan [L] */
  deficitBefore?: Record<string, number>;
  horizonEnd?: Minute;
}

export interface ValidationResult {
  ok: boolean;
  violations: Violation[];
}

const MAX_PER_RULE = 3; // keep reports readable: the first few instances of each rule per subject

export function validatePlan(input: ValidationInput): ValidationResult {
  const { scenario, plan } = input;
  const end = input.horizonEnd ?? scenario.end;
  const workers = new Map(scenario.workers.map((w) => [w.id, w]));
  const zones = new Map(scenario.zones.map((z) => [z.id, z]));
  const violations: Violation[] = [];
  const counts = new Map<string, number>();
  const add = (v: Violation) => {
    const key = `${v.rule}|${v.worker ?? v.crew ?? ''}`;
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    if (n <= MAX_PER_RULE) violations.push(v);
  };

  const byWorker = new Map<string, Assignment[]>();
  for (const a of plan.assignments) {
    if (!workers.has(a.worker)) add({ rule: 'unknown-worker', minute: a.from, worker: a.worker, detail: `No worker ${a.worker}` });
    if (!zones.has(a.zone)) add({ rule: 'unknown-zone', minute: a.from, worker: a.worker, detail: `No zone ${a.zone}` });
    if (a.to <= a.from) add({ rule: 'empty-block', minute: a.from, worker: a.worker, detail: 'Assignment ends before it starts' });
    byWorker.set(a.worker, [...(byWorker.get(a.worker) ?? []), a]);
  }
  for (const [worker, blocks] of byWorker) {
    const sorted = [...blocks].sort((x, y) => x.from - y.from);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.from < sorted[i - 1]!.to) add({ rule: 'overlap', minute: sorted[i]!.from, worker, detail: 'Two assignments overlap' });
    }
  }
  for (const tent of plan.tents) {
    const zone = zones.get(tent.zone);
    if (!zone) add({ rule: 'unknown-zone', minute: tent.readyAt, detail: `Tent placed in unknown zone ${tent.zone}` });
  }
  if (plan.tents.length > 2) add({ rule: 'tents-available', minute: plan.effectiveAt, detail: 'Only two shade tents are on site' });

  const blockAt = (worker: string, minute: Minute) => byWorker.get(worker)?.find((a) => a.from <= minute && minute < a.to);
  const exemptions = new Set((plan.exemptions ?? []).map((e) => e.worker));

  // Per-minute checks.
  const exposure = { ...input.exposureBefore };
  const workLog = new Map<string, number[]>(); // per worker: 1 if working that minute
  for (let minute = plan.effectiveAt; minute < end; minute++) {
    const workingByZone = new Map<string, string[]>();
    const cabinCount = new Map<string, number>();
    for (const w of scenario.workers) {
      const a = blockAt(w.id, minute);
      const log = workLog.get(w.id) ?? [];
      const working = !!a && a.activity !== 'rest';
      log.push(working ? 1 : 0);
      workLog.set(w.id, log);
      if (!a) continue;
      const zone = zones.get(a.zone);
      if (!zone) continue;
      if (zone.kind === 'cabin') cabinCount.set(zone.id, (cabinCount.get(zone.id) ?? 0) + 1);
      if (!working) continue;
      workingByZone.set(a.zone, [...(workingByZone.get(a.zone) ?? []), w.id]);
      if (zone.kind === 'cabin') continue; // indoor air-conditioned work is not heat exposure
      exposure[w.id] = (exposure[w.id] ?? 0) + 1;
      checkWorkerMinute(w, a, minute, input, exposure[w.id]!, exemptions.has(w.id), log, add);
    }
    for (const [zoneId, ids] of workingByZone) {
      const rule = ZONE_RULES[heatZone(input.zoneWbgt(zoneId, minute, plan))];
      if (rule.noLoneWork && ids.length === 1) {
        add({ rule: 'no-lone-work', minute, worker: ids[0], detail: `${ids[0]} would work alone in ${zoneId} at ${formatClock(minute)}` });
      }
    }
    for (const [zoneId, n] of cabinCount) {
      const cap = zones.get(zoneId)?.capacity;
      if (cap !== undefined && n > cap) add({ rule: 'cabin-capacity', minute, crew: zoneId, detail: `${n} people in ${zoneId} (capacity ${cap}) at ${formatClock(minute)}` });
    }
  }

  checkWater(input, byWorker, add);
  checkPour(input, blockAt, add);

  return { ok: violations.length === 0, violations };
}

function checkWorkerMinute(
  w: WorkerProfile,
  a: Assignment,
  minute: Minute,
  input: ValidationInput,
  exposureSoFar: number,
  exempt: boolean,
  log: number[],
  add: (v: Violation) => void,
) {
  const { scenario, plan } = input;
  const zone = scenario.zones.find((z) => z.id === a.zone)!;
  const wbgt = input.zoneWbgt(a.zone, minute, plan);
  const rule = ZONE_RULES[heatZone(wbgt)];
  const workClass = twlWorkClass(a.activity)!;
  const clock = formatClock(minute);

  const outdoor = zone.kind === 'outdoor' || zone.kind === 'elevated';
  const tentShade = plan.tents.some((t) => t.zone === a.zone && t.readyAt <= minute);
  if (outdoor && !tentShade && middayBanApplies(scenario.date, minute) && !exempt) {
    add({ rule: 'midday-ban', minute, worker: w.id, detail: `${w.name} in direct sun at ${clock} during the midday break` });
  }
  if (!rule.unacclimatisedAllowed && !isAcclimatised(w.acclimatisationDay)) {
    add({ rule: 'unacclimatised-in-zone', minute, worker: w.id, detail: `${w.name} (day ${w.acclimatisationDay}) assigned to ${heatZone(wbgt)}-risk work in ${a.zone} at ${clock}` });
  }
  if (rule.essentialOnly && !isEssential(a, scenario)) {
    add({ rule: 'essential-only', minute, worker: w.id, detail: `Non-essential work by ${w.name} in a high-risk zone at ${clock}` });
  }
  const window = log.slice(-60).reduce((s, x) => s + x, 0);
  if (window > rule.workPerHour[workClass]) {
    add({ rule: 'work-rest', minute, worker: w.id, detail: `${w.name} works ${window} of 60 min at ${clock}; limit ${rule.workPerHour[workClass]} for ${workClass} work` });
  }
  if (!isAcclimatised(w.acclimatisationDay) && exposureSoFar > exposureCapMin(w.acclimatisationDay, w.experienced)) {
    add({ rule: 'acclimatisation-cap', minute, worker: w.id, detail: `${w.name} exceeds the day-${w.acclimatisationDay} exposure cap at ${clock}` });
  }
}

const isEssential = (a: Assignment, scenario: Scenario) => a.zone === scenario.pour.zone && a.reason === 'pour';

function checkWater(input: ValidationInput, byWorker: Map<string, Assignment[]>, add: (v: Violation) => void) {
  const { scenario, plan } = input;
  const end = input.horizonEnd ?? scenario.end;
  for (const w of scenario.workers) {
    const blocks = byWorker.get(w.id) ?? [];
    for (let hour = plan.effectiveAt; hour + 60 <= end; hour += 60) {
      let workMin = 0;
      let required = 0;
      for (let m = hour; m < hour + 60; m++) {
        const a = blocks.find((b) => b.from <= m && m < b.to);
        if (!a || a.activity === 'rest') continue;
        workMin++;
        required += ZONE_RULES[heatZone(input.zoneWbgt(a.zone, m, plan))].waterLph / 60;
      }
      if (workMin === 0) continue;
      const planned = blocks
        .filter((b) => b.from < hour + 60 && b.to > hour)
        .reduce((s, b) => s + b.drinkL * (Math.min(b.to, hour + 60) - Math.max(b.from, hour)) / (b.to - b.from), 0);
      if (planned + 1e-6 < required * 0.9) {
        add({ rule: 'water', minute: hour, worker: w.id, detail: `${w.name}: ${planned.toFixed(2)} L planned, ${required.toFixed(2)} L required ${formatClock(hour)}–${formatClock(hour + 60)}` });
      }
    }
  }
}

function checkPour(input: ValidationInput, blockAt: (w: string, m: Minute) => Assignment | undefined, add: (v: Violation) => void) {
  const { scenario, plan } = input;
  const pour = scenario.pour;
  if (plan.pourStart === null) return;
  if (plan.pourStart < pour.truckArrives) {
    add({ rule: 'pour-before-truck', minute: plan.pourStart, detail: `Pour cannot start before the truck at ${formatClock(pour.truckArrives)}` });
  }
  if (plan.pourStart + pour.durationMin > (input.horizonEnd ?? scenario.end)) {
    add({ rule: 'pour-after-shift', minute: plan.pourStart, detail: 'Pour would not finish before the shift ends' });
  }
  for (let m = plan.pourStart; m < plan.pourStart + pour.durationMin; m++) {
    const onDeck = scenario.workers.filter((w) => {
      const a = blockAt(w.id, m);
      return a && a.zone === pour.zone && a.activity !== 'rest' && a.reason === 'pour';
    }).length;
    if (onDeck < pour.minCrew) {
      add({ rule: 'pour-crew', minute: m, crew: pour.crew, detail: `${onDeck} of ${pour.minCrew} needed on the pour at ${formatClock(m)}` });
    }
  }
}
