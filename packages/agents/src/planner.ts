// Omar, the planning agent. He works through tools backed by the real engine: he can look at
// conditions, try a plan (which is compiled, rule-checked and simulated to the end of the shift)
// and submit one. The rules engine, not the model, decides whether a plan is allowed.

import type { Minute, Plan, Scenario } from '@heatline/contracts';
import { formatClock } from '@heatline/contracts';
import { heatZone, protectivePlan, validatePlan, type PlanLevers } from '@heatline/rules';
import { screenExposure, type ExposureScreen, runMetrics, runShift, type SiteEnvironment } from '@heatline/sim';
import { plannerRoster } from './projections';

export interface PlannerWorld {
  scenario: Scenario;
  environment: SiteEnvironment;
  effectiveAt: Minute;
  exposureBefore: Record<string, number>;
  unavailable: string[];
}

export const PLANNER_SYSTEM = `This is a synthetic training simulation. All policy checks are demonstration assumptions, not TWL equivalents or UAE compliance certification. Never call a plan safe, lawful, or clinically validated. You are Omar, the planning assistant for a construction site supervisor in Abu Dhabi during summer.
Your job: propose a plan for the rest of the shift that protects workers first and still gets the work done where the rules allow.
You can change only these levers: which zones get the site's two shade tents (in setup order; only the deck and the yard can take a tent), the concrete pour start time (or no pour today), and which workers stand down to indoor duties. The rules engine then builds the minute-by-minute rotation, water and rest.
Work method:
1. Look at conditions for the zones that matter.
2. Try a plan with check_plan. If exposureScreen.exceededWindows is positive, state in your rationale that further controls and professional review are needed. A policy-permitted pour is not a safe-work approval. It tells you whether the rules allow it and what the simulation predicts (strain, red flags, pour finish).
3. If it is refused, change a lever and try again. Prefer plans with zero red flags and the fewest high-strain minutes; finishing the pour today is good but never at the cost of a rule.
4. Call submit_plan exactly once with your final levers and a rationale of at most three short sentences for the supervisor, using only numbers the tools gave you.
You see crew rosters with capability tags (acclimatised or not) only. You never see or ask for anyone's body readings.`;

const parseClock = (hhmm: string): Minute | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export function plannerTools(world: PlannerWorld) {
  const zones = world.scenario.zones.filter((z) => z.kind === 'outdoor' || z.kind === 'elevated').map((z) => z.id);
  const tentZones = world.scenario.zones.filter((z) => z.tentable).map((z) => z.id);
  const workerIds = world.scenario.workers.map((w) => w.id);
  const leverProps = {
    tents: { type: 'array', items: { type: 'string', enum: tentZones }, description: 'Zones to shade with the two tents, in setup order (max 2). Tents need a floor: the deck and the yard.' },
    pourStart: { type: ['string', 'null'], description: 'Pour start as HH:MM, or null for no pour today.' },
    standDown: { type: 'array', items: { type: 'string', enum: workerIds }, description: 'Worker ids moved to indoor duties.' },
  };
  return [
    {
      type: 'function' as const,
      name: 'get_conditions',
      description: 'WBGT and heat-risk zone for one site zone every 15 minutes from now to the end of the shift, in sun and with a tent.',
      parameters: { type: 'object', properties: { zone: { type: 'string', enum: zones } }, required: ['zone'], additionalProperties: false },
      strict: true,
    },
    {
      type: 'function' as const,
      name: 'get_roster',
      description: 'Crews, tasks and workers with capability tags (acclimatised or not, unavailable).',
      parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
      strict: true,
    },
    {
      type: 'function' as const,
      name: 'check_plan',
      description: 'Compile the levers into a full plan, check every rule, and simulate the rest of the shift.',
      parameters: { type: 'object', properties: leverProps, required: ['tents', 'pourStart', 'standDown'], additionalProperties: false },
      strict: true,
    },
    {
      type: 'function' as const,
      name: 'submit_plan',
      description: 'Submit the final plan for the supervisor to approve.',
      parameters: {
        type: 'object',
        properties: { ...leverProps, rationale: { type: 'string', description: 'At most three short sentences for the supervisor.' } },
        required: ['tents', 'pourStart', 'standDown', 'rationale'],
        additionalProperties: false,
      },
      strict: true,
    },
  ];
}

export interface LeverArgs {
  tents: string[];
  pourStart: string | null;
  standDown: string[];
}

export function toLevers(args: LeverArgs): PlanLevers {
  const start = args.pourStart === null ? null : parseClock(args.pourStart);
  return { tents: [...new Set(args.tents)].slice(0, 2), pourStart: start, standDown: [...new Set(args.standDown)] };
}

export interface PlanCheck {
  ok: boolean;
  plan: Plan;
  violations: { rule: string; count: number; example: string }[];
  forecast: { minutesPsi7: number; redFlags: number; pourStart: string | null; pourFinish: string | null; restMinutes: number } | null;
  note?: string;
  exposureScreen?: ExposureScreen;
}

/** Compile, validate and (if valid) simulate a set of levers. Shared by the tool and the UI. */
export function checkLevers(world: PlannerWorld, levers: PlanLevers, label = 'Omar’s plan'): PlanCheck {
  const { scenario, environment, effectiveAt, exposureBefore, unavailable } = world;
  const plan = protectivePlan({ scenario, effectiveAt, zoneWbgt: environment.zoneWbgt, exposureBefore, unavailable, levers, label });
  const result = validatePlan({ scenario, plan, zoneWbgt: environment.zoneWbgt, exposureBefore });
  const grouped = new Map<string, { count: number; example: string }>();
  for (const v of result.violations) {
    const g = grouped.get(v.rule) ?? { count: 0, example: v.detail };
    g.count++;
    grouped.set(v.rule, g);
  }
  const violations = [...grouped].map(([rule, g]) => ({ rule, ...g }));
  let note: string | undefined;
  if (levers.pourStart !== null && levers.pourStart !== undefined && plan.pourStart === null) {
    // Never silently drop a requested pour: refuse, and make "no pour" an explicit choice.
    note = `A pour starting at ${formatClock(levers.pourStart)} is not allowed: the deck is in the high-risk zone, the crew cannot staff it within the work/rest limits, it would run into the midday break, or it is outside the truck window. Choose another time or no pour (null).`;
    violations.push({ rule: 'pour-not-possible', count: 1, example: note });
    return { ok: false, plan, violations, forecast: null, note };
  }
  if (!result.ok) return { ok: false, plan, violations, forecast: null, note };
  const run = runShift(scenario, { policy: 'heatline', environment, decisions: [{ at: effectiveAt, plan }] });
  const m = runMetrics(scenario, run);
  return {
    ok: true,
    exposureScreen: screenExposure(scenario, run),
    plan,
    violations,
    note,
    forecast: {
      minutesPsi7: m.minutesPsi7,
      redFlags: m.redFlags,
      pourStart: m.pourStartedAt === null ? null : formatClock(m.pourStartedAt),
      pourFinish: m.pourFinishedAt === null ? null : formatClock(m.pourFinishedAt),
      restMinutes: m.restMinutes,
    },
  };
}

/** Execute one planner tool call. Returns a JSON-serialisable result for the model. */
export function runPlannerTool(world: PlannerWorld, name: string, args: Record<string, unknown>): unknown {
  const { scenario, environment, effectiveAt } = world;
  if (name === 'get_conditions') {
    const zone = String(args.zone);
    const rows = [];
    for (let m = effectiveAt; m <= scenario.end; m += 15) {
      const sun = environment.zoneWbgt(zone, m);
      const tent = environment.zoneWbgt(zone, m, { tents: [{ zone, readyAt: 0 }] });
      rows.push({ time: formatClock(m), wbgtSun: Math.round(sun * 10) / 10, zoneSun: heatZone(sun), wbgtTent: Math.round(tent * 10) / 10, zoneTent: heatZone(tent) });
    }
    return { zone, truckArrives: formatClock(scenario.pour.truckArrives), pourMinutes: scenario.pour.durationMin, pourMinCrew: scenario.pour.minCrew, rows };
  }
  if (name === 'get_roster') {
    const roster = plannerRoster(scenario, world.unavailable);
    return { tasks: scenario.tasks.filter((t) => t.crew !== '*').map((t) => ({ crew: t.crew, task: t.label, zone: t.zone, activity: t.activity })), workers: roster };
  }
  if (name === 'check_plan' || name === 'submit_plan') {
    const check = checkLevers(world, toLevers(args as unknown as LeverArgs));
    return { ok: check.ok, violations: check.violations.slice(0, 5), forecast: check.forecast, exposureScreen: check.exposureScreen, note: check.note };
  }
  return { error: `Unknown tool ${name}` };
}
