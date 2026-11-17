// Curated replay days for the site-watch page, cut from the downloaded season data:
// reanalysis, the day-ahead forecast and hourly PM10 for each day. Run: npm run replay-days
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dayAheadRows, weatherRows, type OpenMeteoHourly } from '@heatline/sim';

const DAYS = [
  { date: '2026-08-25', title: 'The forecast was wrong', story: 'The forecast issued the day before ran up to 3.2 °C too cool. Only the site station shows how hot the deck really is.' },
  { date: '2026-08-22', title: 'Hottest day of summer 2026', story: 'WBGT in the sun reached 38 °C, with dust in the air through the afternoon.' },
  { date: '2026-07-13', title: 'Dust storm', story: 'PM10 reached 415 µg/m³ during the shift, the dustiest working day of either summer.' },
  { date: '2025-07-21', title: 'Hottest day of summer 2025', story: 'The hottest day in two summers of data, and the forecast was 2.5 °C too cool at its worst.' },
];
const load = (name: string) => JSON.parse(readFileSync(`data/weather/${name}`, 'utf8'));
const days = DAYS.map((d) => {
  const y = d.date.slice(0, 4);
  const aq = load(`abu-dhabi-airquality-${y}.json`);
  const pm10 = aq.hourly.time.flatMap((t: string, i: number) => (t.startsWith(d.date) ? [aq.hourly.pm10[i]] : []));
  return { ...d, reanalysis: weatherRows(load(`abu-dhabi-season-${y}.json`) as OpenMeteoHourly, d.date), dayAhead: dayAheadRows(load(`abu-dhabi-dayahead-${y}.json`), d.date), pm10 };
});
mkdirSync('data/watch', { recursive: true });
writeFileSync('data/watch/replay-days.json', JSON.stringify({ site: { label: 'Saadiyat Island, Abu Dhabi', latitude: 24.54, longitude: 54.43 }, days }));
console.log(`${days.length} days written`);
