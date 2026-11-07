// Rewind: the same afternoon with one decision changed, side by side.

import { formatClock } from '@heatline/contracts';
import type { Branch } from '../model';

const rowsFor = (at: number): { label: string; get: (b: Branch) => string | number; better: 'lower' | 'higher' | 'none' }[] => [
  { label: 'Minutes in high heat strain (all workers)', get: (b) => b.metrics.minutesPsi7, better: 'lower' },
  { label: 'Minutes in severe heat strain (all workers)', get: (b) => b.metrics.minutesPsi9, better: 'lower' },
  { label: 'Share of working time over the safe heat-exposure limit', get: (b) => `${Math.round((100 * b.screen.exceededWindows) / Math.max(1, b.screen.assessedWindows))}%`, better: 'none' },
  { label: 'Worst hour: how far over the limit', get: (b) => `${b.screen.maxExcessC.toFixed(1)} °C`, better: 'none' },
  { label: 'People with signs of serious heat illness', get: (b) => b.metrics.redFlags, better: 'lower' },
  { label: 'Minutes until they were being cooled', get: (b) => (b.metrics.minutesToCooling.length ? b.metrics.minutesToCooling.join(', ') : '—'), better: 'none' },
  { label: `Times a site rule was broken after ${formatClock(at)}`, get: (b) => b.run.violations.filter((v) => v.minute >= at).length, better: 'lower' },
  { label: 'Minutes new workers spent over their heat limit', get: (b) => b.metrics.unacclimatisedOverCapMin, better: 'lower' },
  { label: 'Concrete pour', get: (b) => (b.metrics.pourStartedAt === null ? 'not poured' : `${formatClock(b.metrics.pourStartedAt)}–${b.metrics.pourFinishedAt === null ? 'unfinished' : formatClock(b.metrics.pourFinishedAt)}`), better: 'none' },
  { label: 'Minutes spent resting (the cost)', get: (b) => b.metrics.restMinutes, better: 'none' },
];

export function Compare({ a, b, onClose, onWatch, title, decisionAt }: { a: Branch; b: Branch; onClose: () => void; onWatch: (id: Branch['id']) => void; title: string; decisionAt: number }) {
  const rows = rowsFor(decisionAt);
  return (
    <div className="overlay">
      <div className="compare">
        <header>
          <div>
            <strong>
              Rewind · {title}, decision at {formatClock(decisionAt)}
            </strong>
            <small>Same weather, same people, same events. One decision changed. These are simulation results with made-up workers, not medical predictions. The safe exposure limit is the US NIOSH limit, checked hour by hour from the second hour of the shift. Not a UAE safety certificate.</small>
          </div>
          <button onClick={onClose}>Close</button>
        </header>
        <table>
          <thead>
            <tr>
              <th />
              <th>{a.label}</th>
              <th>{b.label}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const x = r.get(a);
              const y = r.get(b);
              const win = r.better === 'none' || typeof x !== 'number' || typeof y !== 'number' || x === y ? null : (r.better === 'lower' ? y < x : y > x) ? 'b' : 'a';
              return (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className={win === 'a' ? 'win' : ''}>{x}</td>
                  <td className={win === 'b' ? 'win' : ''}>{y}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="buttons">
          <button onClick={() => onWatch(a.id)}>Watch “{a.label}”</button>
          <button className="primary" onClick={() => onWatch(b.id)}>
            Watch “{b.label}”
          </button>
        </div>
      </div>
    </div>
  );
}
