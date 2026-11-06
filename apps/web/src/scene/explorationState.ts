// Deliberately separate from the simulation: no plans, workers, clocks or API clients.
import { createContext } from 'react';
export interface PlaygroundMachinery { lift: number; slew: number; trolley: number; cable: number }
export const PlaygroundContext = createContext<PlaygroundMachinery | null>(null);
export const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
export function walkPosition(x: number, z: number, deck: boolean, previous: { x: number; z: number }) {
  const nx = clamp(x, deck ? 1.2 : -14, deck ? 38.8 : 112);
  const nz = clamp(z, deck ? -28.8 : -48, deck ? -1.2 : 42);
  // Ground-floor facade and roof stair core are solid. Slide along their edges.
  const cabins = [[88, 22], [86, -38], [100, 28]];
  const blocked = (a: number, b: number) => deck
    ? a > 8.7 && a < 19.3 && b > -17.8 && b < -8.2
    : (a > -1 && a < 41 && b > -31 && b < 1) || cabins.some(([cx, cz]) => Math.abs(a - cx!) < 6.7 && Math.abs(b - cz!) < 2.7);
  const nextX = blocked(nx, previous.z) ? previous.x : nx;
  return { x: nextX, z: blocked(nextX, nz) ? previous.z : nz };
}
