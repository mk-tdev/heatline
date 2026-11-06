// Scenario catalog: the same Saadiyat site on different real days and shifts, each built to
// exercise a different part of the Climate-Resilient Worker Health brief. Shared by the
// server (for the planner) and the web app (for the story).

import type { Minute, Scenario, WorkerProfile } from '@heatline/contracts';
import { buildScenario, type OpenMeteoHourly, type ScenarioTemplate } from './scenario';

export interface ScenarioSpec {
  id: string;
  title: string;
  tagline: string;
  date: string;
  start: Minute;
  end: Minute;
  decision: { at: Minute; question: string };
  /** which of the challenge's six desired outcomes this scenario demonstrates */
  covers: string[];
  /** changes to the site template for this scenario (absolute minutes) */
  adjust: (s: Scenario) => Scenario;
}

const patchWorkers = (s: Scenario, patch: Record<string, Partial<WorkerProfile>>): WorkerProfile[] =>
  s.workers.map((w) => (patch[w.id] ? { ...w, ...patch[w.id] } : w));

export const SCENARIOS: ScenarioSpec[] = [
  {
    id: 'afternoon-pour',
    title: 'The afternoon pour',
    tagline: 'A concrete truck at 15:30, a deck in full sun, a crew lead who never stops.',
    date: '2025-08-19',
    start: 900,
    end: 1080,
    decision: { at: 910, question: 'The concrete truck is booked for 15:30. Can we still pour today without putting anyone at risk?' },
    covers: ['Dynamic heat-risk assessment', 'Supervisor decision support', 'Graded multilingual warnings', 'Worker-first governance', 'Red-flag escalation'],
    adjust: (s) => s,
  },
  {
    id: 'racing-the-break',
    title: 'Racing the midday break',
    tagline: 'Coveralls on the façade, a worker back from leave, and a stair-core pour that would run past 12:30.',
    date: '2025-08-12',
    start: 570,
    end: 780,
    decision: {
      at: 680,
      question: 'Concrete for the stair core arrives at 11:30 and needs 45 minutes. The midday break starts at 12:30, Joel is back from three weeks’ leave and crew C is in coveralls. What do we do?',
    },
    covers: ['UAE midday-break compliance', 'Protective clothing (PPE) adjustment', 'Re-acclimatisation after leave', 'Supervisor decision support'],
    adjust: (s) => ({
      ...s,
      tasks: s.tasks.map((t) => (t.crew === 'C' ? { ...t, label: 'Façade sealant and waterproofing (coveralls)' } : t)),
      pour: { ...s.pour, truckArrives: 690 },
      networkOutage: undefined,
      weatherModifiers: [],
      workers: patchWorkers(s, {
        joel: { acclimatisationDay: 1, experienced: true, priorExposureMin: 60, startDeficitL: 0.4, clothingAdjustC: 1, ppe: 'polyolefin coverall' },
        bilal: { clothingAdjustC: 1, ppe: 'polyolefin coverall', startDeficitL: 0.6, priorExposureMin: 60 },
        c3: { clothingAdjustC: 1, ppe: 'polyolefin coverall', priorExposureMin: 60 },
        ravi: { batteryDiesAt: undefined, priorExposureMin: 60 },
        suresh: { priorExposureMin: 60, startDeficitL: 0.6 },
        anwar: { priorExposureMin: 30, acclimatisationDay: 2 },
      }).map((w) => (w.priorExposureMin === 180 ? { ...w, priorExposureMin: 60 } : w)),
    }),
  },
  {
    id: 'no-pour-day',
    title: 'The day nobody should pour',
    tagline: 'The most humid afternoon of August. Every zone stays high-risk, even in shade.',
    date: '2025-08-01',
    start: 900,
    end: 1080,
    decision: { at: 910, question: 'The truck is booked for 15:30 again and the client wants this slab done today. Can we pour?' },
    covers: ['Dynamic heat-risk assessment', 'Decision support that can say no', 'Safety over productivity'],
    adjust: (s) => ({ ...s, weatherModifiers: [] }),
  },
  {
    id: 'everything-fails',
    title: 'When everything fails',
    tagline: 'Three wearables die, the network is down for half an hour and a dust storm rolls in.',
    date: '2025-08-26',
    start: 900,
    end: 1080,
    decision: { at: 910, question: 'Three wearables are low on battery and IT warns the network may drop this afternoon. How do we run the shift safely?' },
    covers: ['Field-ready operation', 'Safe fallback without sensors or network', 'Escalation when signals are missing'],
    adjust: (s) => ({
      ...s,
      networkOutage: { from: 965, to: 1000 },
      weatherModifiers: [{ from: 1010, to: 1065, label: 'Dust storm', rhDelta: 15, radiationFactor: 0.5, directFraction: 0.15 }],
      workers: patchWorkers(s, {
        ravi: { batteryDiesAt: 940 },
        suresh: { batteryDiesAt: 960, skipsBreaks: false },
        bilal: { batteryDiesAt: 990 },
        a2: { susceptibility: 0.35, startDeficitL: 1.6, skipsBreaks: true },
      }),
    }),
  },
];

export const scenarioSpec = (id: string): ScenarioSpec => {
  const spec = SCENARIOS.find((s) => s.id === id);
  if (!spec) throw new Error(`Unknown scenario ${id}`);
  return spec;
};

export function buildCatalogScenario(id: string, template: ScenarioTemplate, weather: OpenMeteoHourly): Scenario {
  const spec = scenarioSpec(id);
  const base = buildScenario(template, weather, { date: spec.date, start: spec.start, end: spec.end });
  // The template's timed events are written for the 15:00 shift; morning scenarios set their own.
  const adjusted = spec.adjust(base);
  return { ...adjusted, id: spec.id, title: spec.title, decision: spec.decision };
}
