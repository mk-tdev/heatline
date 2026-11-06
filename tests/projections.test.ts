import { describe, expect, it } from 'vitest';
import type { Language, WarningAction } from '@heatline/contracts';
import {
  checkGuardianMessage,
  crewSummaries,
  fallbackGuardianMessage,
  guardianContext,
  plannerRoster,
  redFlagDisclosures,
  runPlannerTool,
  type PlannerWorld,
} from '@heatline/agents';
import { protectivePlan, validatePlan } from '@heatline/rules';
import { exposureAt, goldenBranches } from './helpers/scenario';

// Keys that carry an individual's physiology or symptoms. None may reach a crew-level view.
const PRIVATE_KEYS = ['coreC', 'estCoreC', 'heartRate', 'psi', 'estPsi', 'deficitL', 'waterDeficitL', 'symptomatic', 'symptomReported', 'exposureMin'];
const keysDeep = (value: unknown, out = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) value.forEach((v) => keysDeep(v, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) (out.add(k), keysDeep(v, out));
  return out;
};

describe('privacy boundary: what the supervisor and the planner can see', () => {
  const { scenario, environment, asPlayed, changed } = goldenBranches();
  const names = scenario.workers.map((w) => w.name);

  it('crew summaries never carry individual readings or names, at any minute of either branch', () => {
    for (const run of [asPlayed, changed]) {
      for (const rec of run.minutes) {
        const summaries = crewSummaries(scenario, rec);
        const keys = keysDeep(summaries);
        for (const k of PRIVATE_KEYS) expect(keys.has(k), `${k} at ${rec.minute}`).toBe(false);
        const text = JSON.stringify(summaries);
        for (const n of names) expect(text.includes(`"${n}"`) || text.includes(` ${n} `)).toBe(false);
      }
    }
  });

  it('a name reaches the supervisor only with a red flag, and only that name', () => {
    for (const rec of asPlayed.minutes) {
      const disclosures = redFlagDisclosures(scenario, rec);
      const flagged = rec.warnings.filter((w) => w.reasons.includes('red-flag')).map((w) => w.worker);
      expect(disclosures.map((d) => d.worker)).toEqual(flagged);
      expect(keysDeep(disclosures).has('coreC')).toBe(false);
    }
    expect(asPlayed.minutes.some((rec) => redFlagDisclosures(scenario, rec).length > 0)).toBe(true);
  });

  it('the planner sees capability tags and conditions, never readings', () => {
    const world: PlannerWorld = { scenario, environment, effectiveAt: 910, exposureBefore: exposureAt(asPlayed, 910), unavailable: [] };
    const outputs = [
      plannerRoster(scenario),
      runPlannerTool(world, 'get_roster', {}),
      runPlannerTool(world, 'get_conditions', { zone: 'deck' }),
      runPlannerTool(world, 'check_plan', { tents: ['deck', 'yard'], pourStart: '15:30', standDown: ['anwar'] }),
    ];
    for (const out of outputs) {
      const keys = keysDeep(out);
      for (const k of PRIVATE_KEYS) expect(keys.has(k), k).toBe(false);
    }
  });

  it('a guardian context is about one worker only', () => {
    const rec = asPlayed.minutes[20]!;
    const ctx = guardianContext(scenario, rec, 'anwar');
    const text = JSON.stringify(ctx);
    for (const n of names.filter((n) => n !== 'Anwar')) expect(text.includes(n)).toBe(false);
    expect(ctx.heartRate).toBeNull(); // Anwar has no wearable
  });
});

describe('planner levers and tools', () => {
  const { scenario, environment, asPlayed } = goldenBranches();
  const world: PlannerWorld = { scenario, environment, effectiveAt: 910, exposureBefore: exposureAt(asPlayed, 910), unavailable: [] };

  it('refuses a tent on the scaffold', () => {
    const plan = protectivePlan({ scenario, effectiveAt: 910, zoneWbgt: environment.zoneWbgt, exposureBefore: world.exposureBefore, levers: { tents: ['facade'] } });
    const result = validatePlan({ scenario, plan, zoneWbgt: environment.zoneWbgt, exposureBefore: world.exposureBefore });
    expect(result.violations.map((v) => v.rule)).toContain('tent-placement');
  });

  it('honours "no pour today" and a supervisor stand-down', () => {
    const result = runPlannerTool(world, 'check_plan', { tents: ['deck'], pourStart: null, standDown: ['bilal'] }) as { ok: boolean; forecast: { pourStart: string | null } };
    expect(result.ok).toBe(true);
    expect(result.forecast.pourStart).toBeNull();
    const plan = protectivePlan({ scenario, effectiveAt: 910, zoneWbgt: environment.zoneWbgt, exposureBefore: world.exposureBefore, levers: { standDown: ['bilal'] } });
    expect(plan.assignments.filter((a) => a.worker === 'bilal').every((a) => a.zone === 'store')).toBe(true);
  });

  it('refuses, rather than silently drops, a pour that cannot lawfully start', () => {
    const result = runPlannerTool(world, 'check_plan', { tents: [], pourStart: '17:50', standDown: [] }) as { ok: boolean; note?: string; violations: { rule: string }[] };
    expect(result.ok).toBe(false);
    expect(result.violations.map((v) => v.rule)).toContain('pour-not-possible');
    expect(result.note).toMatch(/not allowed/);
  });
});

describe('guardian fallbacks', () => {
  const languages: Language[] = ['en', 'ar', 'hi', 'ur', 'bn', 'ml', 'tl'];
  const actions: WarningAction[] = ['continue', 'drink', 'rest-shade', 'rest-cabin', 'stop-work', 'emergency'];
  const { scenario, asPlayed } = goldenBranches();
  const base = guardianContext(scenario, asPlayed.minutes[30]!, 'anwar');

  it('has a message for every language and action that passes the output checks', () => {
    for (const language of languages) {
      for (const action of actions) {
        const ctx = { ...base, language, action };
        const msg = fallbackGuardianMessage(ctx);
        expect(checkGuardianMessage(ctx, msg), `${language}/${action}`).toBeNull();
      }
    }
  });

  it('rejects model output in the wrong script or that adds medication', () => {
    const ctx = { ...base, language: 'bn' as const, action: 'rest-cabin' as const };
    expect(checkGuardianMessage(ctx, { message: 'Anwar, rest now.', english: 'Anwar, rest now.' })).toBe('wrong script');
    expect(checkGuardianMessage({ ...ctx, language: 'en' }, { message: 'Anwar, take a paracetamol.', english: 'Anwar, take a paracetamol.' })).toBe('forbidden content');
  });
});
