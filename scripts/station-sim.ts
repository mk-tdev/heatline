// A stand-in WBGT station: posts minute readings to the telemetry API, so the site-watch "Live
// today" board can be tried without a meter. It plays a real summer day's site conditions at
// today's clock time (so a November evening reads like an August evening).
//
//   npm run station:sim -- --site <station id> [--url https://heatline-plum.vercel.app]
//                          [--day 2026-08-25] [--every 20] [--backfill]
//
// --backfill first posts every minute from 06:00 to now, so the board has a morning to work with.
import { readFileSync } from 'node:fs';
import { conditionsFrom, siteTruth, stationFrom } from '@heatline/sim';

const args = new Map<string, string>();
process.argv.slice(2).forEach((a, i, all) => { if (a.startsWith('--')) args.set(a.slice(2), all[i + 1] && !all[i + 1]!.startsWith('--') ? all[i + 1]! : 'true'); });
const site = args.get('site');
if (!site || !/^[0-9a-f-]{36}$/i.test(site)) {
  console.error('Usage: npm run station:sim -- --site <station id from the Live today board> [--url URL] [--day YYYY-MM-DD] [--every SECONDS] [--backfill]');
  process.exit(1);
}
const url = (args.get('url') ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const replay = JSON.parse(readFileSync('data/watch/replay-days.json', 'utf8')) as { days: { date: string; title: string; reanalysis: never[]; pm10: (number | null)[] }[] };
const day = replay.days.find((d) => d.date === (args.get('day') ?? '2026-08-25')) ?? replay.days[0]!;
const every = Math.max(5, Number(args.get('every') ?? 20));
const truth = siteTruth(conditionsFrom(day.reanalysis, day.date), day.date);
const series = stationFrom(truth, day.date, 0, 1440, [], (m) => day.pm10[Math.floor(m / 60)] ?? null);

const local = () => {
  const d = new Date(Date.now() + 4 * 3_600_000); // Gulf Standard Time
  return { date: d.toISOString().slice(0, 10), minute: d.getUTCHours() * 60 + d.getUTCMinutes() };
};
const reading = (date: string, minute: number) => {
  const r = series.find((x) => x.minute === minute)!;
  const clock = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  return { at: `${date}T${clock}`, wbgt: Math.round(r.wbgt * 10) / 10, ...(r.pm10 !== undefined ? { pm10: Math.round(r.pm10) } : {}) };
};
async function post(readings: ReturnType<typeof reading>[]) {
  const r = await fetch(`${url}/api/telemetry`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-heatline-site': site! }, body: JSON.stringify({ readings }) });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
}

console.log(`Station ${site} → ${url}, playing ${day.title} (${day.date}) at today's clock. Ctrl+C to stop.`);
if (args.has('backfill')) {
  const { date, minute } = local();
  const all = [];
  for (let m = 360; m < minute; m++) all.push(reading(date, m));
  for (let i = 0; i < all.length; i += 120) await post(all.slice(i, i + 120));
  console.log(`Backfilled ${all.length} readings from 06:00.`);
}
let last = -1;
for (;;) {
  const { date, minute } = local();
  if (minute !== last) {
    const r = reading(date, minute);
    try { await post([r]); console.log(`${r.at}  WBGT ${r.wbgt} °C${'pm10' in r ? `  PM10 ${r.pm10}` : ''}`); }
    catch (e) { console.warn(`post failed: ${(e as Error).message}`); }
    last = minute;
  }
  await new Promise((resolve) => setTimeout(resolve, every * 1000));
}
