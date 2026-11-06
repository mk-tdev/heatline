// Heatline API server. Holds the OpenAI key; the browser never sees it. Every agent endpoint
// accepts only a strict, projected context and falls back to rule-based text if the model is
// unavailable, slow or returns something that fails the checks.
//
//   npm run dev   (starts this server and the web app together)

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import template from '../data/scenario/saadiyat-tower.json' with { type: 'json' };
import weather from '../data/weather/abu-dhabi-2025-08.json' with { type: 'json' };
import { SCENARIOS, buildCatalogScenario, createEnvironment, runShift, type OpenMeteoHourly, type ScenarioTemplate } from '@heatline/sim';
import {
  GUARDIAN_SYSTEM,
  GuardianMessage,
  PLANNER_SYSTEM,
  SAFETY_SYSTEM,
  SafetyBrief,
  checkGuardianMessage,
  checkLevers,
  fallbackGuardianMessage,
  fallbackSafetyBrief,
  guardianPrompt,
  plannerTools,
  runPlannerTool,
  safetyPrompt,
  toLevers,
  type CrewSummary,
  LANGUAGE_NAMES,
  type GuardianContext,
  type LeverArgs,
  type PlannerWorld,
} from '@heatline/agents';

const PORT = Number(process.env.HEATLINE_API_PORT) || 8787;
const MODEL = process.env.OPENAI_MODEL || 'gpt-6-luna';
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ maxRetries: 1 }) : null;
const TTS_MODEL = process.env.HEATLINE_MODEL_TTS || 'gpt-4o-mini-tts';
const TTS_VOICE = process.env.HEATLINE_TTS_VOICE || 'coral';

// ---- Input schemas: the projected contexts, nothing more ---------------------------------

const Language = z.enum(['en', 'ar', 'hi', 'ur', 'bn', 'ml', 'tl']);
const Level = z.enum(['green', 'yellow', 'amber', 'red']);
const GuardianInput = z.strictObject({
  worker: z.string().max(20),
  name: z.string().max(40),
  language: Language,
  daysOnSite: z.number().int().min(1).max(10000),
  acclimatised: z.boolean(),
  clock: z.string().regex(/^\d{2}:\d{2}$/),
  level: Level,
  reasons: z.array(z.string().max(30)).max(8),
  action: z.enum(['continue', 'drink', 'rest-shade', 'rest-cabin', 'stop-work', 'emergency']),
  source: z.enum(['wearable', 'environment-only']),
  estCoreC: z.number().min(35).max(43),
  heartRate: z.number().min(30).max(230).nullable(),
  waterDeficitL: z.number().min(0).max(10),
  minutesWorkedWithoutRest: z.number().int().min(0).max(600),
  placeLabel: z.string().max(60),
  wbgt: z.number().min(0).max(50),
  ppe: z.string().max(60).nullable(),
  clothingAdjustC: z.number().min(0).max(5),
});
const CrewInput = z.strictObject({
  crew: z.string().max(4),
  task: z.string().max(80),
  zone: z.string().max(20),
  zoneLabel: z.string().max(60),
  wbgt: z.number(),
  heatZone: z.enum(['unrestricted', 'low', 'medium', 'high']),
  shaded: z.boolean(),
  headcount: z.number().int(),
  working: z.number().int(),
  resting: z.number().int(),
  inFirstAid: z.number().int(),
  levels: z.strictObject({ green: z.number().int(), yellow: z.number().int(), amber: z.number().int(), red: z.number().int() }),
  needRest: z.number().int(),
  needWater: z.number().int(),
  waterRequiredLph: z.number(),
  workPerHourHeavy: z.number(),
});
const SafetyInput = z.strictObject({ clock: z.string().regex(/^\d{2}:\d{2}$/), crews: z.array(CrewInput).max(10) });
const PlannerInput = z.strictObject({
  scenario: z.enum(SCENARIOS.map((s) => s.id) as [string, ...string[]]),
  effectiveAt: z.number().int().min(0).max(1440),
  unavailable: z.array(z.string().max(20)).max(30),
  ask: z.string().max(300),
});

// ---- Helpers ------------------------------------------------------------------------------

async function readJson(req: IncomingMessage, limit = 32 * 1024): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw Object.assign(new Error('Request too large'), { status: 413 });
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
}

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

const withTimeout = <T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return run(controller.signal).finally(() => clearTimeout(timer));
};

function world(scenarioId: string, effectiveAt: number, unavailable: string[]): PlannerWorld {
  const scenario = buildCatalogScenario(scenarioId, template as ScenarioTemplate, weather as OpenMeteoHourly);
  const environment = createEnvironment(scenario);
  const asPlayed = runShift(scenario, { policy: 'heatline', environment });
  const rec = asPlayed.minutes.find((m) => m.minute === effectiveAt - 1);
  const exposureBefore = Object.fromEntries((rec?.truth ?? []).map((t) => [t.worker, t.exposureMin]));
  return { scenario, environment, effectiveAt, exposureBefore, unavailable };
}

// ---- Agents -------------------------------------------------------------------------------

async function guardian(ctx: GuardianContext) {
  const t0 = performance.now();
  if (!openai || ctx.action === 'emergency') return { ...fallbackGuardianMessage(ctx), source: 'rules', ms: 0 };
  try {
    const response = await withTimeout(15_000, (signal) =>
      openai.responses.parse(
        {
          model: MODEL,
          reasoning: { effort: 'low' },
          input: [
            { role: 'system', content: GUARDIAN_SYSTEM },
            { role: 'user', content: guardianPrompt(ctx) },
          ],
          text: { format: zodTextFormat(GuardianMessage, 'guardian_message') },
        },
        { signal },
      ),
    );
    const out = response.output_parsed;
    const problem = out ? checkGuardianMessage(ctx, out) : 'no output';
    if (out && !problem) return { ...out, source: 'model', model: MODEL, ms: Math.round(performance.now() - t0) };
    console.warn(`guardian: rejected model output (${problem})`);
  } catch (error) {
    console.warn(`guardian: ${(error as Error).name}: ${(error as Error).message}`);
  }
  return { ...fallbackGuardianMessage(ctx), source: 'rules', ms: Math.round(performance.now() - t0) };
}

async function safety(clock: string, crews: CrewSummary[]) {
  const t0 = performance.now();
  if (!openai) return { ...fallbackSafetyBrief(crews), source: 'rules', ms: 0 };
  try {
    const response = await withTimeout(15_000, (signal) =>
      openai.responses.parse(
        {
          model: MODEL,
          reasoning: { effort: 'low' },
          input: [
            { role: 'system', content: SAFETY_SYSTEM },
            { role: 'user', content: safetyPrompt(clock, crews) },
          ],
          text: { format: zodTextFormat(SafetyBrief, 'safety_brief') },
        },
        { signal },
      ),
    );
    if (response.output_parsed) return { ...response.output_parsed, requests: response.output_parsed.requests.slice(0, 3), source: 'model', model: MODEL, ms: Math.round(performance.now() - t0) };
  } catch (error) {
    console.warn(`safety: ${(error as Error).name}: ${(error as Error).message}`);
  }
  return { ...fallbackSafetyBrief(crews), source: 'rules', ms: Math.round(performance.now() - t0) };
}

/** Omar's tool loop, streamed as NDJSON so the console can show each step as it happens. */
async function planner(input: z.infer<typeof PlannerInput>, res: ServerResponse) {
  res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' });
  const write = (event: unknown) => res.write(`${JSON.stringify(event)}\n`);
  const w = world(input.scenario, input.effectiveAt, input.unavailable);
  const deadline = Date.now() + 75_000;
  const finishWithRules = (reason: string) => {
    const check = checkLevers(w, {}, 'Rules-based protective plan');
    write({ type: 'final', source: 'rules', reason, levers: { tents: check.plan.tents.map((t) => t.zone), pourStart: check.plan.pourStart, standDown: [] }, rationale: 'Rules-only plan: shade the deck and yard, stand down workers not yet used to the heat, rotate crews within the zone limits.', check });
    res.end();
  };
  if (!openai) return finishWithRules('no API key configured');

  const tools = plannerTools(w);
  const input_: OpenAI.Responses.ResponseInput = [
    { role: 'system', content: PLANNER_SYSTEM },
    { role: 'user', content: `Supervisor at ${String(Math.floor(input.effectiveAt / 60)).padStart(2, '0')}:${String(input.effectiveAt % 60).padStart(2, '0')}: "${input.ask}"` },
  ];
  try {
    for (let step = 0; step < 8; step++) {
      if (Date.now() > deadline) return finishWithRules('planner time budget used up');
      write({ type: 'status', text: step === 0 ? 'Omar is reading the site…' : 'Omar is thinking…' });
      const response = await withTimeout(Math.max(1_000, deadline - Date.now()), (signal) =>
        openai.responses.create({ model: MODEL, reasoning: { effort: 'low' }, tools, input: input_ }, { signal }),
      );
      input_.push(...(response.output as OpenAI.Responses.ResponseInputItem[]));
      const calls = response.output.filter((o): o is OpenAI.Responses.ResponseFunctionToolCall => o.type === 'function_call');
      if (calls.length === 0) {
        input_.push({ role: 'user', content: 'Please finish by calling submit_plan with your final levers.' });
        continue;
      }
      for (const call of calls) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(call.arguments) as Record<string, unknown>;
        } catch {
          input_.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify({ error: 'arguments were not valid JSON' }) });
          continue;
        }
        const result = runPlannerTool(w, call.name, args);
        write({ type: 'tool', name: call.name, args, result });
        if (call.name === 'submit_plan') {
          const levers = toLevers(args as unknown as LeverArgs);
          const check = checkLevers(w, levers);
          if (!check.ok) {
            input_.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify({ refused: true, ...(result as object) }) });
            write({ type: 'status', text: 'The rules refused that plan; Omar is revising…' });
            continue;
          }
          write({ type: 'final', source: 'model', model: MODEL, levers: args, rationale: String(args.rationale ?? ''), check });
          return res.end();
        }
        input_.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
      }
    }
    finishWithRules('planner did not submit a valid plan in 8 steps');
  } catch (error) {
    console.warn(`planner: ${(error as Error).name}: ${(error as Error).message}`);
    finishWithRules('model call failed');
  }
}

// ---- Voice: read the guardian's message aloud (for workers who can't read the screen) ----------

const SpeakInput = z.strictObject({ text: z.string().min(1).max(300), language: Language });
const speechCache = new Map<string, Buffer>();

async function speak(text: string, language: z.infer<typeof Language>): Promise<Buffer> {
  const key = `${language}|${text}`;
  const hit = speechCache.get(key);
  if (hit) return hit;
  const audio = await openai!.audio.speech.create({
    model: TTS_MODEL,
    voice: TTS_VOICE,
    input: text,
    instructions: `Speak in ${LANGUAGE_NAMES[language]}, calmly and clearly, like a kind older colleague on a hot building site. Not rushed, not alarming.`,
    response_format: 'mp3',
  });
  const buf = Buffer.from(await audio.arrayBuffer());
  if (speechCache.size > 200) speechCache.delete(speechCache.keys().next().value!);
  speechCache.set(key, buf);
  return buf;
}

// ---- HTTP ---------------------------------------------------------------------------------

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ai: !!openai, model: openai ? MODEL : null });
    if (req.method === 'POST' && url.pathname === '/api/guardian') {
      const parsed = GuardianInput.safeParse(await readJson(req));
      if (!parsed.success) return send(res, 400, { error: 'invalid guardian context' });
      return send(res, 200, await guardian(parsed.data as GuardianContext));
    }
    if (req.method === 'POST' && url.pathname === '/api/safety') {
      const parsed = SafetyInput.safeParse(await readJson(req));
      if (!parsed.success) return send(res, 400, { error: 'invalid crew summaries' });
      return send(res, 200, await safety(parsed.data.clock, parsed.data.crews as CrewSummary[]));
    }
    if (req.method === 'POST' && url.pathname === '/api/speak') {
      if (!openai) return send(res, 503, { error: 'voice needs an OpenAI key' });
      const parsed = SpeakInput.safeParse(await readJson(req));
      if (!parsed.success) return send(res, 400, { error: 'invalid speech request' });
      const audio = await speak(parsed.data.text, parsed.data.language);
      res.writeHead(200, { 'content-type': 'audio/mpeg', 'cache-control': 'no-store', 'content-length': audio.length });
      return res.end(audio);
    }
    if (req.method === 'POST' && url.pathname === '/api/planner') {
      const parsed = PlannerInput.safeParse(await readJson(req));
      if (!parsed.success) return send(res, 400, { error: 'invalid planner request' });
      return planner(parsed.data, res);
    }
    send(res, 404, { error: 'not found' });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    if (status === 500) console.error(error);
    if (!res.headersSent) send(res, status, { error: status === 500 ? 'server error' : (error as Error).message });
    else res.end();
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Heatline API on http://127.0.0.1:${PORT} · model: ${openai ? MODEL : 'none (rules-only)'}`);
});
