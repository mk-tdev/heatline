import { describe, expect, it } from 'vitest';
import { dubaiFlag, heatIndexC, sunPosition, wbgtLiljegren, windSpeed2m } from '@heatline/climate';
import golden from '../data/weather/wbgt-golden.json';

interface GoldenRow {
  time: string;
  midUtc: string;
  airC: number;
  rhPct: number;
  pressureHpa: number;
  wind10: number;
  ssrd: number;
  fdir: number;
  cossza: number;
  expectedWbgt: number | null;
}
const rows = golden.rows as GoldenRow[];
const { latitude, longitude } = golden.meta;

describe('Liljegren WBGT port', () => {
  it('matches ECMWF thermofeel on all 744 August 2025 hours within 0.15 °C', () => {
    let worst = 0;
    for (const r of rows) {
      const { wbgt } = wbgtLiljegren(r);
      expect(r.expectedWbgt, r.time).not.toBeNull();
      worst = Math.max(worst, Math.abs(wbgt - (r.expectedWbgt as number)));
    }
    expect(worst).toBeLessThan(0.15);
  });

  it('is cooler in shade (no direct beam, diffuse only) than in full sun at midday', () => {
    const noon = rows.find((r) => r.time === '2025-08-15T13:00')!;
    const sun = wbgtLiljegren(noon).wbgt;
    const shade = wbgtLiljegren({ ...noon, ssrd: noon.ssrd * (1 - noon.fdir), fdir: 0 }).wbgt;
    expect(shade).toBeLessThan(sun - 1);
  });

  it('applies the KNMI guards: night ignores radiation, and weak wind is floored', () => {
    const night = rows.find((r) => r.time === '2025-08-15T02:00')!;
    expect(wbgtLiljegren({ ...night, fdir: 0.9 }).wbgt).toBeCloseTo(wbgtLiljegren(night).wbgt, 6);
    expect(wbgtLiljegren({ ...night, wind10: 0 }).wbgt).toBeCloseTo(wbgtLiljegren({ ...night, wind10: 0.62 }).wbgt, 6);
    expect(windSpeed2m(0, 0.5, 800)).toBeCloseTo(0.13, 6);
  });
});

describe('solar position', () => {
  it('reproduces the cosine of the zenith used for the golden file', () => {
    for (const r of rows) {
      expect(sunPosition(new Date(r.midUtc), latitude, longitude).cosZenith).toBeCloseTo(r.cossza, 6);
    }
  });

  it('puts the afternoon sun in the west and the morning sun in the east', () => {
    const afternoon = sunPosition(new Date('2025-08-01T12:00:00Z'), latitude, longitude); // 16:00 GST
    const morning = sunPosition(new Date('2025-08-01T04:00:00Z'), latitude, longitude); // 08:00 GST
    expect(afternoon.azimuth).toBeGreaterThan(240);
    expect(afternoon.azimuth).toBeLessThan(300);
    expect(morning.azimuth).toBeGreaterThan(60);
    expect(morning.azimuth).toBeLessThan(120);
    expect(sunPosition(new Date('2025-08-01T08:30:00Z'), latitude, longitude).elevation).toBeGreaterThan(75);
  });
});

describe('heat index and Dubai flags', () => {
  it('matches the NWS regression and uses the simple formula below 80 °F', () => {
    // NWS heat index chart: 96 °F at 65% RH reads 121 °F.
    expect(heatIndexC((96 - 32) * (5 / 9), 65)).toBeCloseTo((121 - 32) * (5 / 9), 0);
    // Below ~80 °F the NWS simple formula applies: 0.5·(T + 61 + (T − 68)·1.2 + 0.094·RH).
    const simpleF = 0.5 * (75 + 61 + (75 - 68) * 1.2 + 0.094 * 50);
    expect(heatIndexC((75 - 32) * (5 / 9), 50)).toBeCloseTo((simpleF - 32) * (5 / 9), 6);
  });

  it('maps to the Dubai Municipality bands at their boundaries', () => {
    expect(dubaiFlag(34.9)).toBe('green');
    expect(dubaiFlag(35)).toBe('yellow');
    expect(dubaiFlag(40)).toBe('amber');
    expect(dubaiFlag(46)).toBe('red');
  });
});
