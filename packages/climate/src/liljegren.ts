// Liljegren et al. (2008) outdoor wet-bulb globe temperature from standard weather data.
//
// Scalar TypeScript port of ECMWF thermofeel 2.3.0 `thermofeel/liljegren.py` and
// `calculate_wbgt_liljegren` ((C) Copyright 1996- ECMWF, Apache Licence 2.0; see NOTICE).
// thermofeel transcribes Liljegren's reference C code; this port keeps its constants,
// guards and iteration scheme so results match to the golden file in tests/.
//
// Reference: Liljegren et al. (2008) https://doi.org/10.1080/15459620802310770
// See also:  Kong and Huber (2022)   https://doi.org/10.1029/2021EF002334

const STEFANB = 5.6696e-8; // Stefan-Boltzmann constant [W m-2 K-4]
const CP = 1003.5; // specific heat of dry air [J kg-1 K-1]
const M_AIR = 28.97; // molar mass of dry air [g mol-1]
const M_H2O = 18.015; // molar mass of water [g mol-1]
const R_GAS = 8314.34; // universal gas constant [J kmol-1 K-1]
const R_AIR = R_GAS / M_AIR;
const PR = CP / (CP + 1.25 * R_AIR); // Prandtl number
const RATIO = (CP * M_AIR) / M_H2O;
const EMIS_WICK = 0.95;
const ALB_WICK = 0.4;
const D_WICK = 0.007; // wick diameter [m]
const L_WICK = 0.0254; // wick length [m]
const EMIS_GLOBE = 0.95;
const ALB_GLOBE = 0.05;
const D_GLOBE = 0.0508; // globe diameter [m]
const EMIS_SFC = 0.999;
const ALB_SFC = 0.45;
const CZA_MIN = 0.00873; // cos(89.5°): below this the sun is treated as down
const MIN_SPEED = 0.13; // floor on wind speed in the Reynolds number [m/s]
const CONVERGENCE = 0.02; // iteration tolerance [K]
const MAX_ITER = 500;
export const MIN_WIND_10M = 0.62; // KNMI minimum 10 m wind [m/s]

// Pasquill-Gifford stability lookup for the 10 m → 2 m wind profile.
const LSRDT = [
  [1, 1, 2, 4, 0, 5, 6, 0],
  [1, 2, 3, 4, 0, 5, 6, 0],
  [2, 2, 3, 4, 0, 4, 4, 0],
  [3, 3, 4, 4, 0, 0, 0, 0],
  [3, 4, 4, 4, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
];
// Power-law exponent per stability class (urban terrain). Class 0 wraps to the last entry,
// matching numpy's negative indexing in the reference implementation.
const URBAN_EXP = [0.15, 0.15, 0.2, 0.25, 0.3, 0.3];

/** Saturation vapour pressure over liquid water [hPa], Buck (1981). */
const esat = (tk: number) => {
  const y = (tk - 273.15) / (tk - 32.18);
  return 1.004 * 6.1121 * Math.exp(17.502 * y);
};

/** Dew-point temperature [K] from vapour pressure [hPa]. */
const dewPoint = (e: number) => {
  const z = Math.log(e / (6.1121 * 1.004));
  return 273.15 + (240.97 * z) / (17.502 - z);
};

/** Dynamic viscosity of air [kg m-1 s-1]. */
const viscosity = (tk: number) => {
  const sigma = 3.617;
  const omega = ((tk / 97.0 - 2.9) / 0.4) * -0.034 + 1.048;
  return (2.6693e-6 * Math.sqrt(M_AIR * tk)) / (sigma * sigma * omega);
};

const thermalCond = (tk: number) => (CP + 1.25 * R_AIR) * viscosity(tk);

/** Diffusivity of water vapour in air [m2 s-1]; pair in hPa. */
const diffusivity = (tk: number, pair: number) => {
  const pcrit13 = (36.4 * 218.0) ** (1 / 3);
  const tcrit512 = (132.0 * 647.3) ** (5 / 12);
  const tcrit12 = Math.sqrt(132.0 * 647.3);
  const mmix = Math.sqrt(1 / M_AIR + 1 / M_H2O);
  const patm = pair / 1013.25;
  return ((3.64e-4 * (tk / tcrit12) ** 2.334 * pcrit13 * tcrit512 * mmix) / patm) * 1e-4;
};

/** Latent heat of vaporisation [J kg-1]. */
const evap = (tk: number) => ((313.15 - tk) / 30.0) * -71100.0 + 2.4073e6;

/** Clear-sky atmospheric emissivity; rh as a fraction. */
const emisAtm = (tk: number, rh: number) => 0.575 * (rh * esat(tk)) ** 0.143;

const hSphere = (tk: number, pair: number, speed: number) => {
  const density = (pair * 100) / (R_AIR * tk);
  const re = (Math.max(speed, MIN_SPEED) * density * D_GLOBE) / viscosity(tk);
  const nu = 2.0 + 0.6 * Math.sqrt(re) * PR ** 0.3333;
  return (nu * thermalCond(tk)) / D_GLOBE;
};

const hCylinder = (tk: number, pair: number, speed: number) => {
  const density = (pair * 100) / (R_AIR * tk);
  const re = (Math.max(speed, MIN_SPEED) * density * D_WICK) / viscosity(tk);
  const nu = 0.281 * re ** (1 - 0.4) * PR ** (1 - 0.56);
  return (nu * thermalCond(tk)) / D_WICK;
};

interface Inputs {
  ta: number; // air temperature [K]
  rh: number; // relative humidity, fraction
  pair: number; // pressure [hPa]
  speed: number; // 2 m wind [m/s]
  solar: number; // downward shortwave [W m-2]
  fdir: number; // direct-beam fraction (guarded)
  cza: number; // cos(solar zenith)
}

/** Globe temperature [°C], or NaN if the iteration does not converge. */
function solveGlobe({ ta, rh, pair, speed, solar, fdir, cza }: Inputs): number {
  const tsfc = ta;
  const emis = emisAtm(ta, rh);
  const czaSafe = cza > CZA_MIN ? cza : 1.0;
  const beam = fdir > 0 ? fdir * (1 / (2 * czaSafe) - 1) : 0;
  let prev = ta;
  for (let i = 0; i < MAX_ITER; i++) {
    const h = hSphere(0.5 * (prev + ta), pair, speed);
    const next =
      (0.5 * (emis * ta ** 4 + EMIS_SFC * tsfc ** 4) -
        (h / (STEFANB * EMIS_GLOBE)) * (prev - ta) +
        (solar / (2 * STEFANB * EMIS_GLOBE)) * (1 - ALB_GLOBE) * (beam + 1 + ALB_SFC)) **
      0.25;
    if (Math.abs(next - prev) < CONVERGENCE) return next - 273.15;
    prev = 0.9 * prev + 0.1 * next;
  }
  return Number.NaN;
}

/** Natural (rad = 1) or psychrometric (rad = 0) wet-bulb temperature [°C], or NaN. */
function solveWetBulb({ ta, rh, pair, speed, solar, fdir, cza }: Inputs, rad: number): number {
  const tsfc = ta;
  const czaSafe = cza > CZA_MIN ? cza : 1.0;
  const sza = Math.acos(Math.min(1, Math.max(-1, czaSafe)));
  const emis = emisAtm(ta, rh);
  const eair = rh * esat(ta);
  let prev = dewPoint(eair);
  for (let i = 0; i < MAX_ITER; i++) {
    const tref = 0.5 * (prev + ta);
    const h = hCylinder(tref, pair, speed);
    const fatm =
      STEFANB * EMIS_WICK * (0.5 * (emis * ta ** 4 + EMIS_SFC * tsfc ** 4) - prev ** 4) +
      (1 - ALB_WICK) *
        solar *
        ((1 - fdir) * (1 + (0.25 * D_WICK) / L_WICK) +
          fdir * (Math.tan(sza) / Math.PI + (0.25 * D_WICK) / L_WICK) +
          ALB_SFC);
    const ewick = esat(prev);
    const density = (pair * 100) / (R_AIR * tref);
    const sc = viscosity(tref) / (density * diffusivity(tref, pair));
    const next = ta - ((evap(tref) / RATIO) * (ewick - eair)) / (pair - ewick) * (PR / sc) ** 0.56 + (fatm / h) * rad;
    if (Math.abs(next - prev) < CONVERGENCE) return next - 273.15;
    prev = 0.9 * prev + 0.1 * next;
  }
  return Number.NaN;
}

/** 10 m → 2 m wind via the Liljegren stability-dependent profile, floored at 0.13 m/s. */
export function windSpeed2m(va10: number, cossza: number, ssrd: number): number {
  const daytime = cossza > 0;
  const col = daytime ? (ssrd >= 925 ? 0 : ssrd >= 675 ? 1 : ssrd >= 175 ? 2 : 3) : 5;
  const row = daytime
    ? va10 >= 6 ? 4 : va10 >= 5 ? 3 : va10 >= 3 ? 2 : va10 >= 2 ? 1 : 0
    : va10 >= 2.5 ? 2 : va10 >= 2 ? 1 : 0;
  const stabilityClass = LSRDT[row]![col]!;
  const exponent = URBAN_EXP.at(stabilityClass - 1)!;
  return Math.max(va10 * (2 / 10) ** exponent, MIN_SPEED);
}

export interface WbgtInputs {
  /** 2 m air temperature [°C] */
  airC: number;
  /** relative humidity [%] */
  rhPct: number;
  /** surface pressure [hPa] */
  pressureHpa: number;
  /** 10 m wind speed [m/s] */
  wind10: number;
  /** downward shortwave radiation [W m-2] */
  ssrd: number;
  /** fraction of ssrd that is direct beam [0–1] */
  fdir: number;
  /** cosine of the solar zenith angle */
  cossza: number;
}

export interface WbgtResult {
  wbgt: number; // °C
  globe: number; // °C
  naturalWetBulb: number; // °C
}

/** Outdoor WBGT [°C] by Liljegren (KNMI guards applied). NaN fields mean no convergence. */
export function wbgtLiljegren(input: WbgtInputs): WbgtResult {
  const ta = input.airC + 273.15;
  const va = Math.max(input.wind10, MIN_WIND_10M);
  const speed = windSpeed2m(va, input.cossza, input.ssrd);
  let fdir = Math.min(0.9, Math.max(0, input.fdir));
  if (input.cossza < CZA_MIN) fdir = 0;
  const inputs: Inputs = { ta, rh: input.rhPct / 100, pair: input.pressureHpa, speed, solar: input.ssrd, fdir, cza: input.cossza };
  const globe = solveGlobe(inputs);
  const naturalWetBulb = solveWetBulb(inputs, 1);
  return { wbgt: 0.1 * input.airC + 0.2 * globe + 0.7 * naturalWetBulb, globe, naturalWetBulb };
}
