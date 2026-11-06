import { describe, expect, it } from 'vitest';
import { walkPosition } from '../apps/web/src/scene/explorationState';

describe('playground walking boundaries', () => {
  it('blocks the ground-floor facade while allowing movement along it', () => {
    expect(walkPosition(39, -11, false, { x: 42, z: -10 })).toEqual({ x: 42, z: -11 });
  });
  it('keeps rooftop walkers inside edge protection', () => {
    expect(walkPosition(80, -90, true, { x: 37, z: -9 })).toEqual({ x: 38.8, z: -28.8 });
  });
  it('blocks the roof core without trapping the walker', () => {
    expect(walkPosition(10, -12, true, { x: 8, z: -11 })).toEqual({ x: 8, z: -12 });
    expect(walkPosition(7, -11, true, { x: 8, z: -11 })).toEqual({ x: 7, z: -11 });
  });
  it('does not mutate caller-owned positions and stays within the site', () => {
    const previous = Object.freeze({ x: 49, z: 14 });
    expect(walkPosition(200, 200, false, previous)).toEqual({ x: 112, z: 42 });
    expect(previous).toEqual({ x: 49, z: 14 });
  });
});
