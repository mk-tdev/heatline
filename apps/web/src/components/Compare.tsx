// Rewind: the same afternoon with one decision changed, side by side.

import { formatClock } from '@heatline/contracts';
import type { Branch } from '../model';

const rows: { label: string; get: (b: Branch) => string | number; better: 'lower' | 'higher' | 'none' }[] = [
  { label: 'Worker-minutes at high strain (PSI ≥ 7)', get: (b) => b.metrics.minutesPsi7, better: 'lower' },
  { label: 'Worker-minutes at severe strain (PSI ≥ 9)', get: (b) => b.metrics.minutesPsi9, better: 'lower' },
  { label: 'Red flags', get: (b) => b.metrics.redFlags, better: 'lower' },
  { label: 'Minutes to cooling after a red flag', get: (b) => (b.metrics.minutesToCooling.length ? b.metrics.minutesToCooling.join(', ') : '—'), better: 'none' },
  { label: 'Rule-violation episodes after 15:10', get: (b) => b.run.violations.filter((v) => v.minute >= 910).length, better: 'lower' },
  { label: 'Unacclimatised exposure over cap (min)', get: (b) => b.metrics.unacclimatisedOverCapMin, better: 'lower' },
  { label: 'Pour', get: (b) => (b.metrics.pourStartedAt === null ? 'not poured' : `${formatClock(b.metrics.pourStartedAt)}–${b.metrics.pourFinishedAt === null ? 'unfinished' : formatClock(b.metrics.pourFinishedAt)}`), better: 'none' },
  { label: 'Rest worker-minutes (the cost)', get: (b) => b.metrics.restMinutes, better: 'none' },
];

export function Compare({ a, b, onClose, onWatch }: { a: Branch; b: Branch; onClose: () => void; onWatch: (id: Branch['id']) => void }) {
  return (
    <div className="overlay">
      <div className="compare">
        <header>
          <div>
            <strong>Rewind · 19 Aug 2025, decision at 15:10</strong>
            <small>Same weather, same people, same events. One decision changed. Simulation outcomes from a teaching model, not clinical predictions.</small>
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
