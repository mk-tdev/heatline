// Noor's site-watch brief: reads the scheduler's crew-level state and alerts (never individuals)
// and tells the supervisor, in plain words, what matters most in the next fifteen minutes and
// why. The scheduler sets every break time and duration; the model only orders and explains,
// and its output is rejected if it introduces a time, a crew or a name that is not in the context.

import { z } from 'zod';

export interface WatchContext {
  clock: string;
  site: {
    wbgtSun: number;
    wbgtShade: number;
    /** where the heat numbers come from, in words */
    source: string;
    /** forecast WBGT in the sun now, and in an hour [°C] */
    forecastSun: number;
    forecastSunInHour: number;
    /** site minus forecast [°C] */
    biasC: number;
    marginC: number;
    dust: 'clear' | 'elevated' | 'unhealthy' | 'severe';
    pm10: number | null;
  };
  /** one entry per crew group */
  crews: {
    crew: string;
    /** which workers in the crew this entry covers */
    workers: 'whole crew' | 'acclimatised workers' | 'workers on the new-worker limit';
    task: string;
    status: 'working' | 'indoor rotation' | 'resting' | 'off shift' | 'indoor work';
    /** rolling-hour exposure as a share of the NIOSH limit [%] */
    limitSharePct: number;
    /** projected share in 30 minutes if the crew follows the scheduler [%] */
    limitShareIn30MinPct: number | null;
    nextBreak: string | null;
    /** how long the next break lasts [min] */
    breakLengthMin: number | null;
    /** whether the next break is rest or rotation to the crew's indoor task */
    nextBreakKind: 'rest' | 'indoor rotation' | null;
    /** the crew's indoor rotation task, if it has one */
    rotationTask: string | null;
    /** while on a break: when work is expected to resume */
    restingUntil: string | null;
    restPlace: string;
  }[];
  alerts: { time: string; level: 'info' | 'watch' | 'act' | 'urgent'; title: string; action: string }[];
}

export const WatchBrief = z.object({
  headline: z.string().describe('One sentence: the single most important thing on site right now.'),
  priorities: z
    .array(
      z.object({
        crew: z.string().describe('One crew letter (A, B, C…) or "site". For several crews, write one priority per crew.'),
        when: z.enum(['now', 'next 15 min', 'later']),
        text: z.string().describe('One plain sentence: what to do and why, using only times and numbers from the context.'),
      }),
    )
    .describe('At most three, most urgent first.'),
  trend: z.string().describe('One sentence on where conditions and crew exposure are heading over the next hour.'),
});
export type WatchBrief = z.infer<typeof WatchBrief>;

export const WATCH_SYSTEM = `You are Noor, the heat-safety officer for a construction site in the UAE, writing for the site supervisor.
You see crew-level information only (a crew may be split into acclimatised workers and workers on the new-worker limit, with different breaks: when an item is about one group, name that group): where each crew's rolling one-hour heat exposure stands against the NIOSH limit, the scheduler's next break, and the alerts the scheduler has raised. You never see, ask for, or mention any individual worker, name, or body reading.
The scheduler has already decided every break time and duration. Never change, invent or round a time, a duration or a number: copy them exactly from the context. If the context has no time for something, do not give one.
Write a one-sentence headline, at most three priorities (most urgent first; "now" for urgent or act alerts and anyone over 100% of the limit), and one sentence on the trend.
The trend sentence must rest only on the numbers given for it: the forecast now and in an hour, the site-versus-forecast difference, and each crew's projected share of its limit in 30 minutes. A crew near 99% is not in danger by itself: the scheduler holds crews just under the limit on purpose, so do not call it a danger unless an alert says so.
Give only instructions that are on the board (an alert's action or a scheduled break); never add new ones. Use the site-versus-forecast figure as given; do not recompute it.
Explain why in plain words a tired supervisor can act on (for example: "the deck is 1.4 °C hotter than forecast, so breaks come sooner"). No diagnosis, no medicine. Never say a plan is safe or compliant.`;

export function watchPrompt(c: WatchContext): string {
  const s = c.site;
  return [
    `Time ${c.clock}. Heat now: WBGT ${s.wbgtSun} °C in the sun, ${s.wbgtShade} °C in shade (${s.source}${s.marginC ? `, +${s.marginC} °C safety margin` : ''}). Forecast WBGT in the sun: ${s.forecastSun} °C now, ${s.forecastSunInHour} °C in an hour. Site vs forecast (station minus forecast, averaged over the last 30 min): ${s.biasC >= 0 ? '+' : ''}${s.biasC} °C. Dust: ${s.dust}${s.pm10 !== null ? ` (PM10 ${s.pm10} µg/m³)` : ''}.`,
    ...c.crews.map((x) => `Crew ${x.crew}${x.workers === 'whole crew' ? '' : `, ${x.workers}`} (${x.task}): ${x.status}, at ${x.limitSharePct}% of the heat limit${x.limitShareIn30MinPct !== null ? `, projected ${x.limitShareIn30MinPct}% in 30 min following the schedule` : ''}. ${x.status === 'resting' || x.status === 'indoor rotation' ? (x.restingUntil ? `${x.status === 'indoor rotation' ? `On indoor rotation (${x.rotationTask})` : `On a break in ${x.restPlace}`} until about ${x.restingUntil}, then back to the main task.` : x.status === 'indoor rotation' ? `On indoor rotation (${x.rotationTask}).` : `On a break in ${x.restPlace}.`) : x.nextBreak ? (x.nextBreakKind === 'indoor rotation' ? `Next relief starts ${x.nextBreak}: ${x.breakLengthMin} min of indoor rotation (${x.rotationTask}).` : `Next break starts ${x.nextBreak} and lasts ${x.breakLengthMin} min, in ${x.restPlace}.`) : x.status === 'working' ? 'No break due in the next 90 minutes.' : ''}`),
    c.alerts.length ? 'Recent alerts (newest last):' : 'No recent alerts.',
    ...c.alerts.map((a) => `${a.time} [${a.level}] ${a.title}. ${a.action}`),
  ].join('\n');
}

/** Rule-based brief when the model is unavailable or rejected. */
export function fallbackWatchBrief(c: WatchContext): WatchBrief {
  const rank = { urgent: 3, act: 2, watch: 1, info: 0 } as const;
  const top = [...c.alerts].sort((a, b) => rank[b.level] - rank[a.level] || b.time.localeCompare(a.time)).slice(0, 3);
  const hottest = [...c.crews].sort((a, b) => b.limitSharePct - a.limitSharePct)[0];
  const who = (x: (typeof c.crews)[number]) => `crew ${x.crew}${x.workers === 'whole crew' ? '' : ` (${x.workers})`}`;
  const priorities = top.map((a) => ({
    crew: a.title.match(/^Crew (\w+)/)?.[1] ?? 'site',
    when: (a.level === 'urgent' || a.level === 'act' ? 'now' : 'next 15 min') as WatchBrief['priorities'][number]['when'],
    text: `${a.title}. ${a.action}`,
  }));
  return {
    headline: top[0] ? `${top[0].title}.` : hottest ? `All crews within their heat limits; ${who(hottest)} is closest at ${hottest.limitSharePct}%.` : 'No crews on shift.',
    priorities,
    trend: `Heat now ${c.site.wbgtSun} °C WBGT in the sun from ${c.site.source}${c.site.biasC >= 1 ? `, running ${c.site.biasC} °C above the forecast` : ''}; the forecast ${c.site.forecastSunInHour > c.site.forecastSun + 0.3 ? 'rises' : c.site.forecastSunInHour < c.site.forecastSun - 0.3 ? 'falls' : 'holds steady'} over the next hour.`,
  };
}

const NAMES = /\b(anwar|suresh|ravi|ahmed|bilal|joel)\b/i;

/** Reject a brief that invents a time, a crew or a name, or claims safety. Returns a reason or null. */
export function checkWatchBrief(c: WatchContext, b: WatchBrief): string | null {
  const all = [b.headline, b.trend, ...b.priorities.map((p) => p.text)].join(' ');
  if (!b.headline.trim() || b.priorities.length > 3 || all.length > 900) return 'shape';
  if (NAMES.test(all)) return 'name';
  if (/\b(is|are) (safe|compliant)\b|guarantee/i.test(all)) return 'safety claim';
  const known = new Set([c.clock, ...c.crews.flatMap((x) => [x.nextBreak, x.restingUntil]).filter(Boolean), ...c.alerts.flatMap((a) => [a.time, ...(`${a.title} ${a.action}`.match(/\b\d{1,2}:\d{2}\b/g) ?? [])])] as string[]);
  for (const t of all.match(/\b\d{1,2}:\d{2}\b/g) ?? []) if (!known.has(t.padStart(5, '0'))) return `unknown time ${t}`;
  const crews = new Set(c.crews.map((x) => x.crew));
  for (const p of b.priorities) if (p.crew !== 'site' && !crews.has(p.crew)) return `unknown crew ${p.crew}`;
  return null;
}
