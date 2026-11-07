// Noor, the site-safety agent: reads crew-level summaries (never individuals) and tells the
// supervisor which crews need what, in order of urgency.

import { z } from 'zod';
import type { CrewSummary } from './projections';

export const SafetyBrief = z.object({
  requests: z
    .array(
      z.object({
        crew: z.string().describe('Crew letter, e.g. "B".'),
        urgency: z.enum(['now', 'soon', 'watch']),
        text: z.string().describe('One sentence for the supervisor about this crew.'),
      }),
    )
    .describe('At most three requests, most urgent first.'),
  summary: z.string().describe('One sentence on the site overall.'),
});
export type SafetyBrief = z.infer<typeof SafetyBrief>;

export const SAFETY_SYSTEM = `This is a synthetic training simulation. All policy checks are demonstration assumptions, not TWL equivalents or UAE compliance certification. Never call a plan safe, lawful, or clinically validated. You are Noor, the heat-safety officer for a construction site in Abu Dhabi, advising the site supervisor.
You see crew-level counts only. You never see, ask for, or mention any individual worker's body readings or names.
From the crew summaries, write at most three short requests, most urgent first, then a one-sentence site summary.
- "now": a crew has people at amber or red, needs rest or water now, or is working above its zone's allowance.
- "soon": a crew is heading that way (yellow warnings, rising zone).
- "watch": nothing to do yet.
Each request is one plain sentence naming the crew and a concrete action (shade, rotation, water, stand down, delay a task). Use only numbers from the summaries.`;

export function safetyPrompt(clock: string, crews: CrewSummary[]): string {
  return [
    `Time ${clock}.`,
    ...crews.map(
      (c) =>
        `Crew ${c.crew} (${c.task}) at ${c.zoneLabel}${c.shaded ? ', shaded' : ''}: WBGT ${c.wbgt} °C, ${c.heatZone} risk zone (heavy work allowed ${c.workPerHourHeavy} min per hour, water ${c.waterRequiredLph} L/h). ` +
        `${c.headcount} people: ${c.working} working, ${c.resting} resting, ${c.inFirstAid} in first aid. Warning levels — green ${c.levels.green}, yellow ${c.levels.yellow}, amber ${c.levels.amber}, red ${c.levels.red}. ` +
        `${c.needRest} need rest now, ${c.needWater} need water.`,
    ),
  ].join('\n');
}

/** Rule-based brief used when the model is unavailable. */
export function fallbackSafetyBrief(crews: CrewSummary[]): SafetyBrief {
  const scored = crews
    .map((c) => {
      const urgent = c.levels.red + c.levels.amber;
      const urgency: SafetyBrief['requests'][number]['urgency'] = urgent > 0 || c.needRest > 0 ? 'now' : c.levels.yellow > 0 ? 'soon' : 'watch';
      const text =
        c.levels.red > 0
          ? `Crew ${c.crew}: ${c.levels.red} with serious warning signs. Stop work in ${c.zoneLabel} and get first aid there now.`
          : urgent > 0 || c.needRest > 0
            ? `Crew ${c.crew}: ${Math.max(urgent, c.needRest)} need rest now in ${c.zoneLabel} (${c.heatZone} risk); rotate and shade them.`
            : c.levels.yellow > 0
              ? `Crew ${c.crew}: ${c.levels.yellow} getting hot; give them ${c.waterRequiredLph} L of water an hour and plan the next rest.`
              : `Crew ${c.crew}: nothing extra needed right now.`;
      return { crew: c.crew, urgency, text, score: c.levels.red * 100 + urgent * 10 + c.needRest + c.levels.yellow };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const atRisk = crews.reduce((s, c) => s + Math.max(c.levels.amber + c.levels.red, c.needRest, c.needWater), 0);
  return {
    requests: scored.map(({ crew, urgency, text }) => ({ crew, urgency, text })),
    summary: atRisk ? `${atRisk} ${atRisk === 1 ? 'person needs' : 'people need'} action now across the site (crew-level estimate).` : 'Nothing extra needed right now.',
  };
}
