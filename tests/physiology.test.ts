import { describe, expect, it } from 'vitest';
import type { Activity } from '@heatline/contracts';
import { heartRate, psi, stepCore, steadyStateCore, type PhysiologyInputs } from '../packages/sim/src/physiology';

const base: PhysiologyInputs = { activity: 'moderate', wbgt: 28, inCabin: false, inShade: false, acclimatisationDay: 30, deficitL: 0, susceptibility: 0 };

function minutesToPsi(threshold: number, p: PhysiologyInputs, limit = 240): number {
  let core = 37;
  for (let t = 1; t <= limit; t++) {
    core = stepCore(core, p);
    if (psi(core, heartRate(core, p.activity, p.deficitL)) >= threshold) return t;
  }
  return Infinity;
}

function psiAfter(minutes: number, p: PhysiologyInputs): number {
  let core = 37;
  for (let t = 0; t < minutes; t++) core = stepCore(core, p);
  return psi(core, heartRate(core, p.activity, p.deficitL));
}

describe('physiology calibration targets (teaching model)', () => {
  it('T1: moderate work at WBGT 28 °C for an hour stays below PSI 5', () => {
    expect(psiAfter(60, base)).toBeLessThan(5);
  });

  it('T2: heavy work at WBGT 34 °C reaches PSI 7 within 30–50 minutes', () => {
    const t = minutesToPsi(7, { ...base, activity: 'heavy', wbgt: 34 });
    expect(t).toBeGreaterThanOrEqual(30);
    expect(t).toBeLessThanOrEqual(50);
  });

  it('T3: heavy work in cool conditions settles near 38 °C', () => {
    expect(steadyStateCore({ ...base, activity: 'heavy', wbgt: 22 })).toBeCloseTo(38.0, 1);
  });

  it('T4: an unacclimatised worker reaches the threshold about 30% sooner', () => {
    const acclimatised = minutesToPsi(7, { ...base, activity: 'heavy', wbgt: 34 });
    const newcomer = minutesToPsi(7, { ...base, activity: 'heavy', wbgt: 34, acclimatisationDay: 1 });
    const ratio = newcomer / acclimatised;
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(0.8);
  });

  it('T5: 20 minutes in the air-conditioned cabin lowers core by 0.4–0.6 °C', () => {
    let core = 38.3;
    for (let t = 0; t < 20; t++) core = stepCore(core, { ...base, activity: 'rest', wbgt: 21, inCabin: true });
    expect(38.3 - core).toBeGreaterThanOrEqual(0.4);
    expect(38.3 - core).toBeLessThanOrEqual(0.6);
  });

  it('T5b: shade cools more slowly than the cabin, and sun at rest cools least', () => {
    const cool = (inputs: Partial<PhysiologyInputs>) => {
      let core = 38.3;
      for (let t = 0; t < 20; t++) core = stepCore(core, { ...base, activity: 'rest', ...inputs });
      return 38.3 - core;
    };
    const cabin = cool({ wbgt: 21, inCabin: true });
    const shade = cool({ wbgt: 31, inShade: true });
    const sun = cool({ wbgt: 34 });
    expect(cabin).toBeGreaterThan(shade);
    expect(shade).toBeGreaterThan(0);
    expect(sun).toBeGreaterThan(0);
  });

  it('T6: each litre of deficit adds about 0.15 °C to steady-state core', () => {
    const delta = steadyStateCore({ ...base, deficitL: 2 }) - steadyStateCore(base);
    expect(delta).toBeCloseTo(0.3, 6);
  });

  it('strain is monotonic in activity and heat', () => {
    const order: Activity[] = ['rest', 'light', 'moderate', 'heavy'];
    const cores = order.map((activity) => steadyStateCore({ ...base, activity, wbgt: 33 }));
    for (let i = 1; i < cores.length; i++) expect(cores[i]!).toBeGreaterThan(cores[i - 1]!);
    expect(steadyStateCore({ ...base, wbgt: 35 })).toBeGreaterThan(steadyStateCore({ ...base, wbgt: 30 }));
  });
});
