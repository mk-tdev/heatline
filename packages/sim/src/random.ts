// Order-independent seeded noise: the same (seed, key, minute) always gives the same value,
// so replays and branches stay identical wherever their inputs are identical.

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform noise in [-1, 1]. */
export const noise = (seed: number, key: string, minute = 0): number => mulberry32(hash(`${seed}|${key}|${minute}`)) * 2 - 1;
