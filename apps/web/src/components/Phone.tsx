// The worker's own phone: their guardian's message in their language, and their own readings.
// Nobody else sees this screen; the banner says so.

import type { GuardianContext, GuardianMessage } from '@heatline/agents';
import { LANGUAGE_NAMES } from '@heatline/agents';
import type { WorkerProfile } from '@heatline/contracts';
import type { AgentSource } from '../model';
import { sourceLabel } from './Console';

const LEVEL_COLOURS = { green: '#3aa76d', yellow: '#e2c33b', amber: '#ef8a2e', red: '#e5484d' } as const;
const ACTION_TEXT: Record<string, string> = {
  continue: 'Keep going, keep drinking',
  drink: 'Drink water now',
  'rest-shade': 'Rest in the shade',
  'rest-cabin': 'Rest in the cool cabin',
  'stop-work': 'No more heat work today',
  emergency: 'Stop · help is coming',
};
const RTL = new Set(['ar', 'ur']);

export function Phone({
  workers,
  selected,
  onSelect,
  ctx,
  message,
  loading,
  stale,
}: {
  workers: WorkerProfile[];
  selected: string;
  onSelect: (id: string) => void;
  ctx: GuardianContext;
  message: (GuardianMessage & AgentSource) | null;
  loading: boolean;
  /** the message shown is from an earlier warning state while a new one is written */
  stale: boolean;
}) {
  return (
    <aside className="phone-wrap">
      <div className="tabs">
        {workers.map((w) => (
          <button key={w.id} className={w.id === selected ? 'active' : ''} onClick={() => onSelect(w.id)}>
            {w.name}
          </button>
        ))}
      </div>
      <div className="phone">
        <div className="phone-banner">Only {ctx.name} sees this screen</div>
        <div className="phone-head">
          <div>
            <strong>{ctx.name}</strong>
            <small>
              {LANGUAGE_NAMES[ctx.language]} · {ctx.acclimatised ? 'used to the heat' : `day ${ctx.daysOnSite} on site`}
            </small>
          </div>
          <span className="level" style={{ background: LEVEL_COLOURS[ctx.level] }}>
            {ctx.level}
          </span>
        </div>
        <div className="action" style={{ borderColor: LEVEL_COLOURS[ctx.level] }}>
          {ACTION_TEXT[ctx.action]}
        </div>
        <div className={`guardian lang-${ctx.language}${stale ? ' stale' : ''}`} dir={RTL.has(ctx.language) ? 'rtl' : 'ltr'}>
          {message ? message.message : <span className="muted">…</span>}
          {loading && <span className="spinner" />}
        </div>
        {message && <div className={`english${stale ? ' stale' : ''}`}>{stale ? 'Updating… ' : ''}{message.english}</div>}
        <div className="readings">
          <div>
            <span>Body temp</span>
            <b>{ctx.estCoreC.toFixed(1)}°C</b>
          </div>
          <div>
            <span>Heart rate</span>
            <b>{ctx.heartRate ?? '—'}</b>
          </div>
          <div>
            <span>Water short</span>
            <b>{ctx.waterDeficitL.toFixed(1)} L</b>
          </div>
          <div>
            <span>Worked</span>
            <b>{ctx.minutesWorkedWithoutRest} min</b>
          </div>
        </div>
        <small className="muted">
          {ctx.source === 'wearable' ? 'Readings from their wearable' : 'No wearable signal: estimated from conditions and work'} · {ctx.placeLabel}, {ctx.wbgt.toFixed(1)}°C
          <br />
          Guardian: {message ? sourceLabel(message) : '—'} · warning level set by the rules engine
        </small>
      </div>
    </aside>
  );
}
