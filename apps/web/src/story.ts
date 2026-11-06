// The story: the people, and the beats that pause the shift, move the camera and tell the
// viewer what is happening. Characters are fictional; conditions are real (19 Aug 2025).

import type { Minute, RunResult } from '@heatline/contracts';
import { formatClock as clock } from '@heatline/contracts';
import type { CameraView } from './scene/CameraRig';

export interface Character {
  id: string;
  fullName: string;
  age: number;
  from: string;
  language: string;
  role: string;
  line: string;
}

export const CHARACTERS: Character[] = [
  { id: 'anwar', fullName: 'Anwar Hossain', age: 24, from: 'Sylhet, Bangladesh', language: 'Bengali', role: 'Crew B · deck', line: 'Second day on site. His body is not used to this heat yet. No wearable.' },
  { id: 'suresh', fullName: 'Suresh Nair', age: 41, from: 'Thrissur, Kerala', language: 'Malayalam', role: 'Crew B lead · deck', line: 'Eleven summers in the Gulf. Never leaves a pour half done. Started the afternoon short of water.' },
  { id: 'ravi', fullName: 'Ravi Kumar', age: 33, from: 'Siwan, Bihar', language: 'Hindi', role: 'Crew A · rebar yard', line: 'Third summer on the job. His wearable battery is at 6%.' },
  { id: 'bilal', fullName: 'Bilal Akhtar', age: 29, from: 'Sialkot, Pakistan', language: 'Urdu', role: 'Crew C · west façade', line: 'Fixes façade panels from the scaffold in the afternoon sun.' },
  { id: 'joel', fullName: 'Joel Santos', age: 36, from: 'Pampanga, Philippines', language: 'Tagalog', role: 'Crew C · west façade', line: 'Works the scaffold with Bilal. No wearable.' },
  { id: 'ahmed', fullName: 'Ahmed Saleh', age: 48, from: 'Asyut, Egypt', language: 'Arabic', role: 'Foreman', line: 'Relays your decisions to the crews. White helmet, tablet in hand.' },
];

export interface BeatContext {
  branch: 'original' | 'plan';
  run: RunResult;
}

export interface Beat {
  id: string;
  /** minute the beat fires; a function lets a beat follow an engine event */
  at: (ctx: BeatContext) => Minute | null;
  chapter?: string;
  title: string;
  view: CameraView;
  select?: string;
  body: (ctx: BeatContext) => string;
  decision?: boolean;
  ending?: boolean;
}

const eventMinute = (run: RunResult, kind: string, worker?: string) => run.events.find((e) => e.kind === kind && (!worker || e.worker === worker))?.minute ?? null;

const AFTERNOON_POUR: Beat[] = [
  {
    id: 'start',
    at: () => 900,
    chapter: 'Chapter 1',
    title: '15:00 · The break is over',
    view: 'overview',
    body: () =>
      'The midday break has just ended. Twenty workers walk back out into a WBGT of 34 °C, in the high-risk zone for heavy work. The ban covered the hottest hours; the heat did not leave at three o’clock. Every worker carries a phone with a guardian that speaks their language. You will see crews, never anyone’s body readings.',
  },
  {
    id: 'anwar',
    at: () => 902,
    title: '15:02 · Day two',
    view: 'store',
    select: 'anwar',
    body: () =>
      'Anwar arrived from Sylhet two days ago. His body is not used to this heat yet, so the rules do not allow him in a high-risk zone. At 15:00 his guardian told him, in Bengali, to stop heat work; he is now on indoor duties in the air-conditioned tool store. You were told only that crew B has one person stood down.',
  },
  {
    id: 'decision',
    at: () => 910,
    chapter: 'Chapter 2',
    title: '15:10 · The truck is coming',
    view: 'deck',
    decision: true,
    body: () =>
      'A concrete truck is booked for 15:30. Once a pour starts it cannot stop for 45 minutes, and the Level 12 deck is in full sun in the high-risk zone. Ask Omar, the planning assistant, what can be done. He can move the two shade tents, change the pour time and stand people down. The rules engine decides what is allowed. You decide what happens.',
  },
  {
    id: 'truck',
    at: (c) => eventMinute(c.run, 'truck-arrived'),
    title: '15:30 · Concrete',
    view: 'gate',
    body: (c) =>
      c.branch === 'plan'
        ? `The mixer is at the gate and the pump boom reaches the deck. The approved plan rotates the pour crew in groups, so a full team is always pouring and nobody stays in the sun longer than the rules allow.${c.run.pourStartedAt !== null ? ` The pour starts at ${clock(c.run.pourStartedAt)}.` : ''}`
        : 'The mixer is at the gate. The pour goes ahead as booked, with the whole of crew B on the deck in full sun. Their only breaks are the usual ten minutes before the hour.',
  },
  {
    id: 'battery',
    at: (c) => eventMinute(c.run, 'battery-died', 'ravi'),
    title: '15:40 · Six percent',
    view: 'yard',
    select: 'ravi',
    body: () => 'Ravi’s wearable has just died. His guardian does not go quiet: it switches to an estimate from where he is, what he is doing and the conditions, and his screen says so.',
  },
  {
    id: 'network',
    at: (c) => eventMinute(c.run, 'network-down'),
    title: '16:05 · No signal',
    view: 'overview',
    body: () => 'The site Wi-Fi drops for ten minutes. The phones keep warning from the rules and the forecast they already hold. Only the AI wording waits; no warning does.',
  },
  {
    id: 'suresh-red',
    at: (c) => (c.branch === 'original' ? eventMinute(c.run, 'red-flag', 'suresh') : null),
    chapter: 'Chapter 3',
    title: '16:43 · Suresh',
    view: 'deck',
    select: 'suresh',
    body: () =>
      'Suresh pushed through his guardian’s warnings to finish the pour. Now he is confused: a red flag. This is the one time a worker’s name and location reach you. The first-aider is already on the way, his phone shows the cooling steps, and it records that you were told.',
  },
  {
    id: 'suresh-ok',
    at: (c) => (c.branch === 'plan' ? 1003 : null),
    chapter: 'Chapter 3',
    title: '16:43 · Suresh',
    view: 'deck',
    select: 'suresh',
    body: (c) => `In this afternoon, Suresh’s group rotated off the deck on the plan’s schedule${c.run.pourFinishedAt !== null ? `, and the pour finished at ${clock(c.run.pourFinishedAt)}` : ''}. He is tired, not ill.`,
  },
  {
    id: 'dust',
    at: (c) => eventMinute(c.run, 'weather-modifier'),
    title: '17:20 · Dust',
    view: 'overview',
    body: () => 'A dust surge rolls in from the desert. There is less sun and more humidity, so the heat stress hardly changes. The twin recalculates every zone as it happens.',
  },
  {
    id: 'end',
    at: () => 1079,
    chapter: 'Chapter 4',
    title: '18:00 · End of shift',
    view: 'overview',
    ending: true,
    body: (c) =>
      c.branch === 'plan'
        ? 'The bus is waiting on the south road. Everyone walks to it. Same afternoon, same weather, same people. Go back to 15:10 and see what the other choice would have cost.'
        : 'The bus is waiting on the south road. One man is still in the first-aid room. Go back to 15:10 and see whether it had to happen.',
  },
];

const ban = (c: BeatContext) => c.run.violations.some((v) => v.rule === 'midday-ban');

const RACING_THE_BREAK: Beat[] = [
  {
    id: 'start',
    at: () => 570,
    chapter: 'Chapter 1',
    title: '09:30 · A morning in coveralls',
    view: 'facade',
    select: 'bilal',
    body: () =>
      'Crew C is sealing the west façade in polyolefin coveralls. The suits keep the sealant off their skin and keep their body heat in: the rules add 1 °C to the heat they feel. The morning will climb from low to high risk before the midday break begins at 12:30.',
  },
  {
    id: 'joel',
    at: () => 572,
    title: '09:32 · Back from leave',
    view: 'store',
    select: 'joel',
    body: () =>
      'Joel flew back from Pampanga yesterday after three weeks at home. More than 14 days away resets acclimatisation, so today he counts as new to the heat, capped at half a normal day’s exposure. His guardian has already moved him to indoor work in the tool store, in Tagalog.',
  },
  {
    id: 'decision',
    at: () => 680,
    chapter: 'Chapter 2',
    title: '11:20 · Concrete before the break',
    view: 'deck',
    decision: true,
    body: () =>
      'Concrete for the stair core arrives at 11:30 and needs 45 minutes. At 12:30 the midday break makes outdoor work in direct sun illegal, with a fine of AED 5,000 per worker. Can it be done in time, and safely? Ask Omar.',
  },
  {
    id: 'truck',
    at: (c) => eventMinute(c.run, 'truck-arrived'),
    title: '11:30 · Concrete',
    view: 'gate',
    body: (c) =>
      c.branch === 'plan'
        ? `The pour crew has cooled off in the cabin and starts on time, rotating so nobody overstays the zone limit.${c.run.pourFinishedAt !== null ? ` The plan has it finished by ${clock(c.run.pourFinishedAt)}.` : ''}`
        : 'The crew goes straight from heavy morning work onto the pour, with the usual break at ten to the hour.',
  },
  {
    id: 'ban',
    at: () => 750,
    chapter: 'Chapter 3',
    title: '12:30 · The midday break begins',
    view: 'overview',
    body: (c) =>
      ban(c)
        ? 'People are still working outdoors after 12:30. On a real site that is a fine of AED 5,000 per worker, and these are the hottest hours of the day. The rules engine has logged every breach.'
        : `Every outdoor crew has stopped by 12:30.${c.run.pourFinishedAt !== null ? ` The stair core was poured by ${clock(c.run.pourFinishedAt)}.` : ''} The midday break is respected without anyone having to argue for it.`,
  },
  {
    id: 'end',
    at: () => 779,
    chapter: 'Chapter 4',
    title: '13:00 · Lunch in the cabin',
    view: 'welfare',
    ending: true,
    body: () => 'The morning is over. Go back to 11:20 and see what the other choice would have meant for the crew and for the fine.',
  },
];

const NO_POUR_DAY: Beat[] = [
  {
    id: 'start',
    at: () => 900,
    chapter: 'Chapter 1',
    title: '15:00 · The heaviest afternoon',
    view: 'overview',
    body: () =>
      'Friday 1 August 2025 was the most humid afternoon of the month near Saadiyat. The sea breeze brings water, not relief: every zone on site is in the high-risk band, even in shade. Watch the labels.',
  },
  {
    id: 'decision',
    at: () => 910,
    chapter: 'Chapter 2',
    title: '15:10 · The client wants the slab',
    view: 'deck',
    decision: true,
    body: () => 'The truck is booked for 15:30 again and the client wants the slab finished today. Ask Omar whether a pour can start within the rules. Sometimes the right answer is no.',
  },
  {
    id: 'truck',
    at: () => 930,
    title: '15:30 · The truck at the gate',
    view: 'gate',
    body: (c) =>
      c.run.pourStartedAt === null
        ? 'The truck goes back. A new pour cannot start in a high-risk zone, and no tent brings the deck below it today. The crews rotate on short work periods with long rests in the cabin; the slab moves to an early-morning slot.'
        : 'The pour goes ahead in the high-risk zone with the whole crew in the sun.',
  },
  {
    id: 'suresh-red',
    at: (c) => (c.branch === 'original' ? eventMinute(c.run, 'red-flag', 'suresh') : null),
    chapter: 'Chapter 3',
    title: 'Suresh',
    view: 'deck',
    select: 'suresh',
    body: () => 'Earlier than on a normal day, Suresh is confused and has to stop. It is a red flag; his name and place reach you, and first aid is on the way.',
  },
  {
    id: 'end',
    at: () => 1079,
    chapter: 'Chapter 4',
    title: '18:00 · No slab today',
    view: 'overview',
    ending: true,
    body: (c) =>
      c.run.pourStartedAt === null
        ? 'No concrete was poured, and nobody was hurt. Go back to 15:10 and see what pouring anyway would have cost.'
        : 'The slab is done. Go back to 15:10 and see the afternoon where it wasn’t.',
  },
];

const EVERYTHING_FAILS: Beat[] = [
  {
    id: 'start',
    at: () => 900,
    chapter: 'Chapter 1',
    title: '15:00 · A milder day, a fragile site',
    view: 'overview',
    body: () => 'Tuesday 26 August 2025 is milder, easing towards evening. But today the technology will fail, one piece at a time. Watch whether the warnings do.',
  },
  {
    id: 'decision',
    at: () => 910,
    chapter: 'Chapter 2',
    title: '15:10 · Plan for failure',
    view: 'deck',
    decision: true,
    body: () => 'Three wearables are low on battery and IT warns that the network may drop. The concrete truck is still due at 15:30. Ask Omar how to run the afternoon safely.',
  },
  { id: 'battery-ravi', at: (c) => eventMinute(c.run, 'battery-died', 'ravi'), title: '15:40 · First battery', view: 'yard', select: 'ravi', body: () => 'Ravi’s wearable dies. His guardian switches to an estimate from the conditions and his work, and his screen says so.' },
  { id: 'battery-suresh', at: (c) => eventMinute(c.run, 'battery-died', 'suresh'), title: '16:00 · Second battery', view: 'deck', select: 'suresh', body: () => 'Suresh’s goes too. Two of the three wearables are gone; both guardians keep warning from estimates.' },
  {
    id: 'network',
    at: (c) => eventMinute(c.run, 'network-down'),
    chapter: 'Chapter 3',
    title: '16:05 · Thirty-five minutes without a network',
    view: 'overview',
    body: () => 'The site network goes down for 35 minutes. Every phone keeps the rules and the forecast on the device, so warnings continue. Only the AI wording waits until the network is back.',
  },
  { id: 'battery-bilal', at: (c) => eventMinute(c.run, 'battery-died', 'bilal'), title: '16:30 · Third battery', view: 'facade', select: 'bilal', body: () => 'Bilal’s wearable dies while the network is still down. Nobody on site has a working sensor now, and nobody is unprotected.' },
  {
    id: 'dust',
    at: (c) => eventMinute(c.run, 'weather-modifier'),
    title: '16:50 · Dust storm',
    view: 'overview',
    body: () => 'A dust storm halves the sunlight and adds humidity for almost an hour. The twin recomputes every zone; the rules use whatever they can still measure.',
  },
  {
    id: 'end',
    at: () => 1079,
    chapter: 'Chapter 4',
    title: '18:00 · Everything failed but the warnings',
    view: 'overview',
    ending: true,
    body: () => 'Batteries, network and sunlight all failed this afternoon. Go back to 15:10 and compare the other choice.',
  },
];

export const STORIES: Record<string, Beat[]> = {
  'afternoon-pour': AFTERNOON_POUR,
  'racing-the-break': RACING_THE_BREAK,
  'no-pour-day': NO_POUR_DAY,
  'everything-fails': EVERYTHING_FAILS,
};
