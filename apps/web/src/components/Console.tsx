// Supervisor console: crew-level information only (the privacy boundary), Noor's brief, the
// decision with Omar's streamed reasoning, and the site log.

import type { CrewSummary, RedFlagDisclosure, SafetyBrief } from '@heatline/agents';
import type { SimEvent } from '@heatline/contracts';
import { formatClock } from '@heatline/contracts';
import type { AgentSource, PlannerEvent } from '../model';
import { CREW_COLOURS } from '../scene/Site';

const ZONE_COLOURS: Record<string, string> = { unrestricted: '#3aa76d', low: '#b8c43a', medium: '#e8a33d', high: '#e5484d' };
const LEVEL_COLOURS = { green: '#3aa76d', yellow: '#e2c33b', amber: '#ef8a2e', red: '#e5484d' } as const;

export function CrewCards({ crews }: { crews: CrewSummary[] }) {
  return (
    <div className="crews">
      {crews.map((c) => (
        <div key={c.crew} className="crew">
          <div className="crew-head">
            <span className="crew-badge" style={{ background: CREW_COLOURS[c.crew] }}>
              {c.crew}
            </span>
            <div>
              <strong>{c.task}</strong>
              <small>
                {c.zoneLabel} · {c.wbgt.toFixed(1)}°C <span className="chip" style={{ background: ZONE_COLOURS[c.heatZone] }}>{c.heatZone}</span>
                {c.shaded && <span className="chip muted">shade</span>}
              </small>
            </div>
          </div>
          <div className="levelbar" title="Warning levels in this crew (counts only)">
            {(['green', 'yellow', 'amber', 'red'] as const).map((l) =>
              c.levels[l] ? <span key={l} style={{ flex: c.levels[l], background: LEVEL_COLOURS[l] }}>{c.levels[l]}</span> : null,
            )}
          </div>
          <small className="crew-foot">
            {c.working} working · {c.resting} resting{c.inFirstAid ? ` · ${c.inFirstAid} first aid` : ''} · heavy work {c.workPerHourHeavy} min/h · water {c.waterRequiredLph} L/h
          </small>
        </div>
      ))}
    </div>
  );
}

export function NoorBrief({ brief, loading }: { brief: (SafetyBrief & AgentSource & { clock: string }) | null; loading: boolean }) {
  return (
    <section className="card">
      <header>
        <span className="avatar noor">N</span>
        <div>
          <strong>Noor · site safety</strong>
          <small>{brief ? `${brief.clock} · ${sourceLabel(brief)}` : 'Reads crew counts, never individuals'}</small>
        </div>
        {loading && <span className="spinner" />}
      </header>
      {brief ? (
        <>
          <ul className="requests">
            {brief.requests.map((r, i) => (
              <li key={i} className={`urgency-${r.urgency}`}>
                <span className="crew-badge small" style={{ background: CREW_COLOURS[r.crew] ?? '#777' }}>
                  {r.crew}
                </span>
                {r.text}
              </li>
            ))}
          </ul>
          <p className="muted">{brief.summary}</p>
        </>
      ) : (
        <p className="muted">Waiting for the first brief…</p>
      )}
    </section>
  );
}

export function RedFlags({ flags }: { flags: RedFlagDisclosure[] }) {
  if (!flags.length) return null;
  return (
    <section className="card redflag">
      {flags.map((f) => (
        <div key={f.worker}>
          <strong>Red flag · {f.name}</strong> at {f.zoneLabel}, {f.clock}. First aid is on the way; cooling steps on screen. This disclosure is logged on {f.name}'s phone.
        </div>
      ))}
    </section>
  );
}

export interface DecisionState {
  ask: string;
  events: PlannerEvent[];
  running: boolean;
  error?: string;
}

export function DecisionCard({
  state,
  onAsk,
  onApprove,
  onKeep,
  setAsk,
  clock,
}: {
  clock: string;
  state: DecisionState;
  onAsk: () => void;
  onApprove: () => void;
  onKeep: () => void;
  setAsk: (s: string) => void;
}) {
  const final = state.events.find((e): e is Extract<PlannerEvent, { type: 'final' }> => e.type === 'final');
  const steps = state.events.filter((e) => e.type === 'tool') as Extract<PlannerEvent, { type: 'tool' }>[];
  const status = [...state.events].reverse().find((e) => e.type === 'status') as Extract<PlannerEvent, { type: 'status' }> | undefined;
  return (
    <section className="card decision">
      <header>
        <span className="avatar omar">O</span>
        <div>
          <strong>{clock} · Decision</strong>
          <small>Review a simulated plan. Policy checks are not a safety certification.</small>
        </div>
      </header>
      <div className="ask">
        <textarea aria-label="Ask the planning assistant" value={state.ask} onChange={(e) => setAsk(e.target.value)} rows={2} disabled={state.running} />
        <button onClick={onAsk} disabled={state.running || !state.ask.trim()}>
          {state.running ? 'Omar is working…' : 'Ask Omar'}
        </button>
      </div>
      {(steps.length > 0 || state.running) && (
        <ol className="steps">
          {steps.map((s, i) => (
            <li key={i}>
              <code>{s.name}</code> {describeTool(s)}
            </li>
          ))}
          {state.running && status && <li className="muted">{status.text}</li>}
        </ol>
      )}
      {state.error && <p className="error">{state.error}</p>}
      {final && (
        <div className={`plan ${final.check.ok ? 'ok' : 'refused'}`}>
          <div className="plan-head">
            <strong>{final.check.ok ? 'Passes demonstration policy' : 'Plan refused by the rules'}</strong>
            <small>{final.source === 'model' ? `by ${final.model}` : `rules-only (${final.reason})`}</small>
          </div>
          <p>{final.rationale}</p>
          {final.check.exposureScreen && <p className="science-note"><b>Independent NIOSH screen</b><br />{final.check.exposureScreen.exceededWindows} of {final.check.exposureScreen.assessedWindows} rolling worker-hour windows exceed the screening limit (maximum {final.check.exposureScreen.maxExcessC.toFixed(1)} °C above). Full-shift screen includes pre-decision exposure; first 59 minutes lack prior history. {final.check.exposureScreen.exceededWindows > 0 ? 'Further controls and professional review are needed before real work.' : 'Passing this screen does not certify safety.'}</p>}
          <ul className="levers">
            <li>Tents: {(final.check.plan.tents.map((t) => `${t.zone} at ${formatClock(t.readyAt)}`).join(', ')) || 'none'}</li>
            <li>Pour: {final.check.plan.pourStart === null ? 'not today' : `starts ${formatClock(final.check.plan.pourStart)}`}</li>
            <li>Stand down: {((final.levers.standDown as string[] | undefined) ?? []).join(', ') || 'rules decide (anyone not yet used to the heat)'}</li>
          </ul>
          {final.check.forecast && (
            <div className="forecast">
              <span>Teaching-model outcome to shift end</span>
              <b>{final.check.forecast.minutesPsi7}</b> high-strain worker-min · <b>{final.check.forecast.redFlags}</b> red flags · pour {final.check.forecast.pourStart ?? '—'}–{final.check.forecast.pourFinish ?? '—'}
            </div>
          )}
          <div className="buttons">
            <button className="primary" onClick={onApprove} disabled={!final.check.ok}>
              Run this simulated plan
            </button>
            <button onClick={onKeep}>Keep original schedule</button>
          </div>
        </div>
      )}
      {!final && !state.running && (
        <div className="buttons">
          <button onClick={onKeep}>Keep original schedule</button>
        </div>
      )}
    </section>
  );
}

function describeTool(s: Extract<PlannerEvent, { type: 'tool' }>): string {
  const r = s.result as Record<string, unknown>;
  if (s.name === 'get_conditions') return `→ ${String(s.args.zone)} forecast`;
  if (s.name === 'get_roster') return '→ crews and capability tags';
  const args = s.args as { tents?: string[]; pourStart?: string | null; standDown?: string[] };
  const lever = `tents ${args.tents?.join('+') || 'none'}, pour ${args.pourStart ?? 'none'}${args.standDown?.length ? `, stand down ${args.standDown.join(', ')}` : ''}`;
  if (r && r.ok === false) return `${lever} → refused (${((r.violations as { rule: string }[]) ?? []).map((v) => v.rule).join(', ') || String(r.note ?? '')})`;
  const f = r?.forecast as { minutesPsi7: number; redFlags: number } | null;
  return `${lever} → allowed${f ? `, ${f.minutesPsi7} high-strain min, ${f.redFlags} red flags` : ''}`;
}

export function SiteLog({ events, minute }: { events: SimEvent[]; minute: number }) {
  const shown = events.filter((e) => e.minute <= minute && e.kind !== 'warning-changed').slice(-9).reverse();
  return (
    <section className="card log">
      <header>
        <strong>Site log</strong>
      </header>
      <ul>
        {shown.map((e) => (
          <li key={e.id} className={`ev-${e.kind}`}>
            <time>{formatClock(e.minute)}</time> {e.detail}
          </li>
        ))}
      </ul>
    </section>
  );
}

export const sourceLabel = (s: AgentSource) => (s.source === 'model' ? `${s.model}${s.ms ? ` · ${(s.ms / 1000).toFixed(1)} s` : ''}` : 'rules fallback');
