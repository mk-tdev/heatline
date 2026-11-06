import * as THREE from 'three';

/** Engine metres (x east, y north, h up) → three.js (x east, y up, z south). */
export const toScene = (x: number, y: number, h = 0) => new THREE.Vector3(x, h, -y);

/** Deterministic pseudo-random in [0, 1) so scenery is the same on every load. */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const PALETTE = {
  sand: '#dcc59a',
  sandDark: '#c8ae80',
  pad: '#bfa983',
  asphalt: '#3f4246',
  concrete: '#cdc7bc',
  concreteDark: '#a9a397',
  rebar: '#7a4a30',
  hoarding: '#f1f3f4',
  hoardingBlue: '#1f5aa6',
  glass: '#6f9bb3',
  steelYellow: '#e5b23a',
  sea: '#4c9fb4',
};
