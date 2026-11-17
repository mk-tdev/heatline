// Site station telemetry: a WBGT meter or gateway posts readings; the site-watch page reads them.
// A site is addressed by a random UUID (a bearer capability, like the shift links). Stored as
// one private JSON document per site and day, capped at 24 hours of minute readings.
// Concurrent writers can race (last write wins); one gateway per site is assumed for the pilot.

import { get, put } from '@vercel/blob';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

const MAX_READINGS = 1440;
const num = (min: number, max: number) => z.number().finite().min(min).max(max).optional();

export const TelemetryReading = z.strictObject({
  /** ISO local time on the site, e.g. 2026-11-18T10:05 or 2026-11-18T10:05:30 */
  at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/),
  wbgt: num(0, 50),
  ta: num(-10, 60),
  rh: num(0, 100),
  tg: num(-10, 90),
  tnwb: num(-10, 50),
  wind: num(0, 60),
  pm10: num(0, 5000),
  pm25: num(0, 2000),
});
export const TelemetryPost = z.strictObject({ readings: z.array(TelemetryReading).min(1).max(120) });
export type TelemetryReading = z.infer<typeof TelemetryReading>;

const useLocalStore = () => !process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN;
const localFile = (site: string, date: string) => join(tmpdir(), 'heatline-telemetry', site, `${date}.json`);
const blobPath = (site: string, date: string) => `telemetry/v1/${site}/${date}.json`;

export async function readTelemetry(site: string, date: string): Promise<TelemetryReading[]> {
  if (useLocalStore()) {
    try { return JSON.parse(await readFile(localFile(site, date), 'utf8')) as TelemetryReading[]; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
  const blob = await get(blobPath(site, date), { access: 'private', useCache: false });
  if (!blob || blob.statusCode !== 200 || !blob.stream) return [];
  return JSON.parse(await new Response(blob.stream).text()) as TelemetryReading[];
}

/** Add readings for their own dates; keeps the newest reading per minute. Returns the number stored. */
export async function recordTelemetry(site: string, readings: TelemetryReading[]): Promise<number> {
  const byDate = new Map<string, TelemetryReading[]>();
  for (const r of readings) {
    const date = r.at.slice(0, 10);
    byDate.set(date, [...(byDate.get(date) ?? []), r]);
  }
  let stored = 0;
  for (const [date, fresh] of byDate) {
    const merged = new Map<string, TelemetryReading>();
    for (const r of [...(await readTelemetry(site, date)), ...fresh]) merged.set(r.at.slice(0, 16), r);
    const list = [...merged.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-MAX_READINGS);
    const body = JSON.stringify(list);
    if (useLocalStore()) {
      await mkdir(join(tmpdir(), 'heatline-telemetry', site), { recursive: true });
      await writeFile(localFile(site, date), body);
    } else {
      await put(blobPath(site, date), body, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
    }
    stored += fresh.length;
  }
  return stored;
}
