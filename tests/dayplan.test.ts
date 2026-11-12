import { describe, expect, it } from 'vitest';
import weather from '../data/weather/abu-dhabi-2025-08.json' with { type: 'json' };
import { BRIEFING_LANGUAGES, briefing, briefingFacts, buildDayPlan, maxWorkMinutes, nioshLimitC, weatherRows, type DayPlanInput, type OpenMeteoHourly } from '@heatline/sim';

const SITE = { latitude: 24.54, longitude: 54.43, utcOffsetHours: 4 };
const august = (date: string, extra: Partial<DayPlanInput> = {}) => buildDayPlan({ ...SITE, date, weather: weatherRows(weather as OpenMeteoHourly, date), ...extra });
/** A mild day: the same August weather shape, 12 °C cooler and drier. */
const mildDay = () => {
  const rows = weatherRows(weather as OpenMeteoHourly, '2025-08-19').map((h) => ({ ...h, time: h.time.replace('2025-08-19', '2025-11-12'), airC: h.airC - 12, rhPct: 40 }));
  return buildDayPlan({ ...SITE, date: '2025-11-12', weather: rows });
};

describe('NIOSH work and rest minutes', () => {
  it('allows the whole hour at or below the limit and nothing when even rest is too hot', () => {
    const limit = nioshLimitC(300, true);
    expect(maxWorkMinutes(limit - 0.1, limit - 0.1, 300, true)).toBe(60);
    expect(maxWorkMinutes(36, 34, 300, true)).toBe(0);
  });
  it('never allows more work for harder work, hotter conditions or unacclimatised workers', () => {
    for (const wbgt of [27, 29, 31, 33, 35]) {
      const light = maxWorkMinutes(wbgt, 21, 180, true);
      const moderate = maxWorkMinutes(wbgt, 21, 300, true);
      const heavy = maxWorkMinutes(wbgt, 21, 415, true);
      expect(light).toBeGreaterThanOrEqual(moderate);
      expect(moderate).toBeGreaterThanOrEqual(heavy);
      expect(heavy).toBeGreaterThanOrEqual(maxWorkMinutes(wbgt + 1, 21, 415, true));
      expect(heavy).toBeGreaterThanOrEqual(maxWorkMinutes(wbgt, 21, 415, false));
      expect(heavy).toBeGreaterThanOrEqual(maxWorkMinutes(wbgt, 30, 415, true));
    }
  });
  it('keeps the allowed hour within the limit and the next step over it', () => {
    const [work, rest, watts] = [34, 21, 415];
    const allowed = maxWorkMinutes(work, rest, watts, true);
    const twa = (minutes: number) => ({ wbgt: (minutes * work + (60 - minutes) * rest) / 60, watts: (minutes * watts + (60 - minutes) * 115) / 60 });
    expect(twa(allowed).wbgt).toBeLessThanOrEqual(nioshLimitC(twa(allowed).watts, true));
    expect(twa(allowed + 5).wbgt).toBeGreaterThan(nioshLimitC(twa(allowed + 5).watts, true));
  });
});

describe('day plan from real August weather', () => {
  const plan = august('2025-08-19');
  it('covers the working day hour by hour and marks the midday break', () => {
    expect(plan.hours).toHaveLength(14);
    expect(plan.hours.filter((h) => h.banned).map((h) => h.from)).toEqual([780, 840]);
    expect(plan.hours.find((h) => h.from === 720)!.partlyBanned).toBe(true);
    expect(plan.seasonBan).toBe(true);
  });
  it('finds the afternoon still over the limit after the break', () => {
    expect(plan.peak.wbgtSun).toBeGreaterThan(33);
    expect(plan.afterBreakHours).toBe(4);
    expect(plan.afterBreakOverLimitHours).toBe(4);
    expect(plan.limited).not.toBeNull();
  });
  it('gives more heavy-work time with a cooled rest room than with shade alone', () => {
    const shade = august('2025-08-19', { rest: 'shade' });
    for (const [i, h] of plan.hours.entries()) expect(h.work.heavy).toBeGreaterThanOrEqual(shade.hours[i]!.work.heavy);
    expect(plan.tightestHeavy).toBeGreaterThan(shade.tightestHeavy);
    // The risk level describes the hour, not the rest area chosen.
    expect(plan.hours.map((h) => h.level)).toEqual(shade.hours.map((h) => h.level));
  });
  it('tightens the limits for heavier clothing', () => {
    const coveralls = august('2025-08-19', { clothingAdjustC: 3 });
    expect(coveralls.tightestHeavy).toBeLessThan(plan.tightestHeavy);
  });
  it('places the pour in the coolest window and never inside the break', () => {
    const best = plan.pour.best!;
    expect(best.to - best.from).toBe(45);
    expect(best.meanWbgtSun).toBeLessThan(plan.pour.worst!.meanWbgtSun);
    expect(best.to <= 750 || best.from >= 900).toBe(true);
    const long = august('2025-08-19', { pourMinutes: 120 });
    expect(long.pour.best!.to - long.pour.best!.from).toBe(120);
  });
  it('drops the midday break outside the season and outside the UAE', () => {
    expect(mildDay().seasonBan).toBe(false);
    expect(august('2025-08-19', { middayBan: false }).hours.some((h) => h.banned)).toBe(false);
  });
  it('builds a plan for every day of the month', () => {
    for (let d = 1; d <= 31; d++) expect(() => august(`2025-08-${String(d).padStart(2, '0')}`)).not.toThrow();
  });
  it('refuses incomplete weather', () => {
    expect(() => weatherRows(weather as OpenMeteoHourly, '2024-01-01')).toThrow(/No complete weather/);
  });
});

describe('crew briefing', () => {
  const hot = august('2025-08-19');
  const scripts: Record<string, RegExp> = { ar: /[؀-ۿ]/, ur: /[؀-ۿ]/, hi: /[ऀ-ॿ]/, bn: /[ঀ-৿]/, ml: /[ഀ-ൿ]/ };
  it('says the same things in every language, with no unfilled placeholders', () => {
    for (const plan of [hot, august('2025-08-19', { rest: 'shade' }), mildDay()]) {
      const english = briefing(plan, 'en');
      for (const language of BRIEFING_LANGUAGES) {
        const lines = briefing(plan, language);
        expect(lines).toHaveLength(english.length);
        for (const line of lines) {
          expect(line).not.toMatch(/[{}]/);
          if (scripts[language]) expect(line).toMatch(scripts[language]!);
        }
        // Every number in the English line appears in the translation.
        english.forEach((line, i) => { for (const n of line.match(/\d+(?::\d+)?/g) ?? []) expect(lines[i]).toContain(n); });
      }
    }
  });
  it('gives the heavy-work limit from the plan, the break in season and the symptoms line always', () => {
    const lines = briefingFacts(hot).map((f) => f.line);
    expect(lines).toEqual(['hot', 'heavy', 'water', 'ban', 'symptoms', 'newWorkers']);
    expect(briefing(hot, 'en')[1]).toContain(`${hot.tightestHeavy} minutes`);
    expect(briefingFacts(august('2025-08-19', { rest: 'shade' })).map((f) => f.line)).toContain('noHeavy');
  });
  it('does not raise an alarm on a mild day', () => {
    const lines = briefingFacts(mildDay()).map((f) => f.line);
    expect(lines.slice(0, 3)).toEqual(['mild', 'waterMild', 'symptoms']);
    expect(lines).not.toContain('ban');
  });
});
