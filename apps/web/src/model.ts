// Client-side model: the scenario, the engine runs and the agent calls. The engine is pure and
// fast (≈15 ms per shift), so the browser runs it directly; only model calls go to the server.

import template from '../../../data/scenario/saadiyat-tower.json';
import weather from '../../../data/weather/abu-dhabi-2025-08.json';
import type { Decision, Minute, Plan, RunResult, Scenario } from '@heatline/contracts';
import { buildCatalogScenario, createEnvironment, runMetrics, runShift, type OpenMeteoHourly, type RunMetrics, type ScenarioTemplate, type SiteEnvironment } from '@heatline/sim';
import type { CrewSummary, GuardianContext, GuardianMessage, PlanCheck, SafetyBrief } from '@heatline/agents';

export const FEATURED = ['anwar', 'suresh', 'ravi', 'ahmed', 'bilal', 'joel'] as const;

export interface World {
  scenario: Scenario;
  environment: SiteEnvironment;
}

export function loadWorld(scenarioId: string): World {
  const scenario = buildCatalogScenario(scenarioId, template as ScenarioTemplate, weather as OpenMeteoHourly);
  return { scenario, environment: createEnvironment(scenario) };
}

export interface Branch {
  id: 'original' | 'plan';
  label: string;
  run: RunResult;
  metrics: RunMetrics;
  plan?: Plan;
}

export function runBranch(world: World, id: Branch['id'], label: string, decisions: Decision[] = [], plan?: Plan): Branch {
  const run = runShift(world.scenario, { policy: 'heatline', environment: world.environment, decisions });
  return { id, label, run, metrics: runMetrics(world.scenario, run), plan };
}

// ---- API ------------------------------------------------------------------------------------

export interface Health {
  ai: boolean;
  model: string | null;
}

export async function health(): Promise<Health> {
  try {
    const r = await fetch('/api/health');
    return (await r.json()) as Health;
  } catch {
    return { ai: false, model: null };
  }
}

export type AgentSource = { source: 'model' | 'rules'; model?: string; ms?: number };

export async function askGuardian(ctx: GuardianContext): Promise<GuardianMessage & AgentSource> {
  const r = await fetch('/api/guardian', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ctx) });
  if (!r.ok) throw new Error(`guardian ${r.status}`);
  return (await r.json()) as GuardianMessage & AgentSource;
}

export async function askSafety(clock: string, crews: CrewSummary[]): Promise<SafetyBrief & AgentSource> {
  const r = await fetch('/api/safety', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clock, crews }) });
  if (!r.ok) throw new Error(`safety ${r.status}`);
  return (await r.json()) as SafetyBrief & AgentSource;
}

export type PlannerEvent =
  | { type: 'status'; text: string }
  | { type: 'tool'; name: string; args: Record<string, unknown>; result: unknown }
  | { type: 'final'; source: 'model' | 'rules'; model?: string; reason?: string; levers: Record<string, unknown>; rationale: string; check: PlanCheck };

export async function askPlanner(body: { scenario: string; effectiveAt: Minute; unavailable: string[]; ask: string }, onEvent: (e: PlannerEvent) => void): Promise<void> {
  const r = await fetch('/api/planner', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok || !r.body) throw new Error(`planner ${r.status}`);
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as PlannerEvent);
    }
  }
}
