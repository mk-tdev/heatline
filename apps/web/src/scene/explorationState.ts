// Deliberately separate from the simulation: no plans, workers, clocks or API clients.
import { obstacles, clearPath, type Rect } from './worksiteRoutes';
import { createContext } from 'react';
export interface PlaygroundMachinery { groundEquipment: Rect[]; lift: number; slew: number; trolley: number; cable: number }
export const PlaygroundContext = createContext<PlaygroundMachinery | null>(null);
export const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
export function walkPosition(x: number, z: number, deck: boolean, previous: { x: number; z: number }, equipment:readonly Rect[] = []) {
  const nx = clamp(x, deck ? 1.2 : -14, deck ? 38.8 : 112);
  const nz = clamp(z, deck ? -28.8 : -48, deck ? -1.2 : 42);
  const blocks=deck || !equipment.length ? obstacles(deck ? 12 : 0) : [...obstacles(0),...equipment];
  const nextX=clearPath(previous,{x:nx,z:previous.z},blocks) ? nx : previous.x;
  const nextZ=clearPath({x:nextX,z:previous.z},{x:nextX,z:nz},blocks) ? nz : previous.z;
  return {x:nextX,z:nextZ};
}
