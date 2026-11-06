// Worker heat-strain model. This is a TEACHING model for the simulation, not validated
// physiology: it reproduces published behaviour ranges well enough to make decisions and
// their consequences legible, and nothing more. Coefficients are fixed by the calibration
// targets below, each enforced by tests/physiology.test.ts.
//
// Calibration targets (acclimatised unless stated, work clothes, starting at 37.0 °C):
//   T1  moderate work at WBGT 28 °C for 60 min stays below PSI 5          (ACGIH TLV region)
//   T2  heavy work at WBGT 34 °C without rest reaches PSI ≥ 7 in 30–50 min (above any TLV)
//   T3  heavy work in cool conditions (WBGT ≤ 25 °C) settles near 38.0 °C core
//   T4  an unacclimatised worker reaches the T2 threshold about 30% sooner
//   T5  20 min resting in an air-conditioned cabin lowers core by 0.4–0.6 °C from 38.3 °C
//   T6  each litre of water deficit adds about 0.15 °C to steady-state core temperature
//
// PSI follows Moran, Shitzer & Pandolf (1998) with baselines 37.0 °C and 70 bpm.

import type { Activity } from '@heatline/contracts';

/** Metabolic rate [W] by activity; class midpoints in the spirit of ISO 8996. */
export const METABOLIC_W: Record<Activity, number> = { rest: 115, light: 180, moderate: 300, heavy: 415 };

export const COEFF = {
  baseCoreC: 36.9,
  /** °C per 100 W above rest */
  metabolic: 0.367,
  /** WBGT above which environmental load adds to core temperature [°C] */
  wbgtOnset: 25,
  /** °C per °C of WBGT above onset, scaled by M/300 */
  environment: 0.0442,
  /** extra steady-state core for a fully unacclimatised worker [°C] */
  unacclimatised: 0.25,
  /** °C per litre of water deficit */
  dehydration: 0.15,
  /** time constants [min] */
  tauHeating: 20,
  tauCabin: 40,
  tauShade: 45,
  restingHr: 70,
  /** bpm per W above rest */
  hrMetabolic: 0.12,
  /** bpm per °C of core above 37 */
  hrCore: 45,
  /** bpm per litre of deficit */
  hrDehydration: 5,
  maxHr: 195,
} as const;

/** 0 on day 1, 1 from day 14 (linear), matching the 7–14 day acclimatisation guidance. */
export const acclimatisation = (day: number): number => Math.min(1, Math.max(0, (day - 1) / 13));

export interface PhysiologyInputs {
  activity: Activity;
  /** WBGT at the worker's location including any clothing adjustment [°C] */
  wbgt: number;
  /** is the worker resting inside the air-conditioned cabin */
  inCabin: boolean;
  /** resting in shade (tent or tower shadow) */
  inShade: boolean;
  acclimatisationDay: number;
  deficitL: number;
  susceptibility: number;
}

export function steadyStateCore(p: PhysiologyInputs): number {
  const m = METABOLIC_W[p.activity];
  return (
    COEFF.baseCoreC +
    COEFF.metabolic * (m / 100 - METABOLIC_W.rest / 100) +
    COEFF.environment * Math.max(0, p.wbgt - COEFF.wbgtOnset) * (m / 300) +
    COEFF.dehydration * p.deficitL +
    COEFF.unacclimatised * (1 - acclimatisation(p.acclimatisationDay)) +
    p.susceptibility
  );
}

/** Advance core temperature by `dt` minutes toward its steady state (exact first-order step). */
export function stepCore(coreC: number, p: PhysiologyInputs, dt = 1): number {
  const target = steadyStateCore(p);
  const cooling = target < coreC && p.activity === 'rest';
  const tau = cooling ? (p.inCabin ? COEFF.tauCabin : p.inShade ? COEFF.tauShade : COEFF.tauHeating) : COEFF.tauHeating;
  return target + (coreC - target) * Math.exp(-dt / tau);
}

export function heartRate(coreC: number, activity: Activity, deficitL: number): number {
  const hr =
    COEFF.restingHr +
    COEFF.hrMetabolic * (METABOLIC_W[activity] - METABOLIC_W.rest) +
    COEFF.hrCore * Math.max(0, coreC - 37) +
    COEFF.hrDehydration * deficitL;
  return Math.min(COEFF.maxHr, hr);
}

/** Physiological strain index (Moran et al. 1998), 0–10 (can exceed 10 under extreme strain). */
export function psi(coreC: number, hr: number): number {
  return Math.max(0, (5 * (coreC - 37)) / (39.5 - 37) + (5 * (hr - 70)) / (180 - 70));
}

/** Sweat rate [L/h]: grows with work and heat; small at rest in the cool. */
export function sweatRateLph(activity: Activity, wbgt: number): number {
  const m = METABOLIC_W[activity];
  return (0.3 + 0.0025 * (m - METABOLIC_W.rest)) * Math.max(0.3, (wbgt - 18) / 12);
}

/** Core temperature above which a worker becomes symptomatic (confusion) in the simulation. */
export const SYMPTOM_CORE_C = 39.0;
/** Minutes above the symptom threshold before symptoms appear. */
export const SYMPTOM_MINUTES = 3;
