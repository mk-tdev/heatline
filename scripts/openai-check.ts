// M0 spike: one structured-output call and one strict tool call with the configured model.
// Run: node --env-file=.env --import tsx scripts/openai-check.ts
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const model = process.env.OPENAI_MODEL || 'gpt-6-luna';
const openai = new OpenAI();

const Note = z.object({ message: z.string(), english: z.string() });
let t0 = performance.now();
const parsed = await openai.responses.parse({
  model,
  reasoning: { effort: 'low' },
  input: [
    { role: 'system', content: 'Write one short, calm heat-safety instruction for a construction worker. message: in Bengali. english: the same in English.' },
    { role: 'user', content: 'Worker: Anwar, day 2 on site. Action: rest 20 minutes in the air-conditioned cabin and drink one bottle of water.' },
  ],
  text: { format: zodTextFormat(Note, 'note') },
});
console.log(`structured (${model}, low): ${(performance.now() - t0).toFixed(0)} ms`, parsed.output_parsed);

t0 = performance.now();
const tools = [
  {
    type: 'function' as const,
    name: 'check_plan',
    description: 'Check a proposed pour start time against site heat rules.',
    parameters: { type: 'object', properties: { pourStart: { type: 'string', description: 'HH:MM' } }, required: ['pourStart'], additionalProperties: false },
    strict: true,
  },
];
const r = await openai.responses.create({
  model,
  reasoning: { effort: 'low' },
  tools,
  input: [{ role: 'user', content: 'Use check_plan to test starting the concrete pour at 15:30.' }],
});
const call = r.output.find((o) => o.type === 'function_call');
console.log(`tool call (${model}, low): ${(performance.now() - t0).toFixed(0)} ms`, call && 'name' in call ? { name: call.name, arguments: call.arguments } : r.output_text);
