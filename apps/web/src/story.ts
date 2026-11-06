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

export const BEATS: Beat[] = [
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
