import fs from 'node:fs';
import template from '../data/scenario/saadiyat-tower.json' with { type: 'json' };
import { runWatch, conditionsFrom, dayAheadRows, siteTruth, stationFrom, shiftsFor, defaultCrews, weatherRows, type OpenMeteoHourly } from '@heatline/sim';
const date = process.argv[2] ?? '2026-08-10';
const y = date.slice(0,4);
const re = JSON.parse(fs.readFileSync(`data/weather/abu-dhabi-season-${y}.json`,'utf8'));
const da = JSON.parse(fs.readFileSync(`data/weather/abu-dhabi-dayahead-${y}.json`,'utf8'));
const truth = siteTruth(conditionsFrom(weatherRows(re as OpenMeteoHourly, date), date), date);
const fc = conditionsFrom(dayAheadRows(da, date), date);
const run = runWatch({ date, shifts: shiftsFor(date), crews: defaultCrews(date, template.workers, { rotation: true }), forecast: fc, truth, readings: stationFrom(truth,date,300,1200), policy: 'follow' });
const byStatus: Record<string, number> = {};
for (const m of run.minutes) for (const g of m.groups) if ((g.truthRatio ?? 0) > 1) { const k = `${g.crew}${g.tier[0]}:${g.status}`; byStatus[k] = (byStatus[k] ?? 0) + 1; }
console.log(byStatus);
const g = run.minutes.filter(m => m.minute >= 600 && m.minute < 700).map(m => { const x = m.groups.find(q=>q.crew==='A')!; return `${m.minute} ${x.status} est ${x.ratio.toFixed(3)} truth ${(x.truthRatio??0).toFixed(3)} sunE ${m.estimate.sun.toFixed(1)} sunT ${m.truth!.sun.toFixed(1)} shE ${m.estimate.shade.toFixed(1)} shT ${m.truth!.shade.toFixed(1)}`; });
console.log(g.filter((_,i)=>i%4===0).join('\n'));
