// Supervisor console: crew-level information only (the privacy boundary), Noor's brief, the
// decision with Omar's streamed reasoning, and the site log.

import type { CrewSummary, PlanCheck, RedFlagDisclosure, SafetyBrief } from '@heatline/agents';
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

export function NoorBrief({ brief, loading, ended = false }: { brief: (SafetyBrief & AgentSource & { clock: string }) | null; loading: boolean; ended?: boolean }) {
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
      {ended ? (
        <p className="muted">Shift over. Everyone is heading to the bus; anyone in first aid stays with the first-aider.</p>
      ) : brief ? (
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
  baseline,
  workers,
}: {
  clock: string;
  /** the original schedule's exposure screen, for "down from" */
  baseline: { exceededWindows: number; assessedWindows: number };
  workers: { id: string; name: string }[];
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
            <li key={i}>{describeTool(s)}</li>
          ))}
          {state.running && status && <li className="muted">{status.text}</li>}
        </ol>
      )}
      {state.error && <p className="error">{state.error}</p>}
      {final && (
        <div className={`plan ${final.check.ok ? 'ok' : 'refused'}`}>
          <div className="plan-head">
            <strong>{verdict(final.check)}</strong>
            <small>{final.source === 'model' ? `by ${final.model}` : `rules-only (${final.reason})`}</small>
          </div>
          {final.check.ok && final.check.exposureScreen && (
            <p className="verdict-detail">
              {final.check.exposureScreen.exceededWindows === 0
                ? 'Every worker stays under the safe heat-exposure limit for their workload.'
                : `Workers are over the safe heat-exposure limit for ${pct(final.check.exposureScreen)} of their working time, down from ${pct(baseline)} on the original schedule. It needs more shade or rest, and a professional review, before real work.`}
            </p>
          )}
          <p>{final.rationale}</p>
          <ul className="levers">
            <li>Shade tents: {(final.check.plan.tents.map((t) => `${ZONE_NAMES[t.zone] ?? t.zone}, up by ${formatClock(t.readyAt)}`).join('; ')) || 'none'}</li>
            <li>Concrete pour: {final.check.plan.pourStart === null ? 'not today' : `starts ${formatClock(final.check.plan.pourStart)}`}</li>
            <li>Indoor duties instead: {((final.levers.standDown as string[] | undefined) ?? []).map((id) => workers.find((w) => w.id === id)?.name ?? id).join(', ') || 'anyone not yet used to the heat'}</li>
          </ul>
          {final.check.forecast && (
            <div className="forecast">
              <span>If you run it (simulation, to the end of the shift)</span>
              <b>{final.check.forecast.redFlags}</b> {final.check.forecast.redFlags === 1 ? 'person' : 'people'} with signs of serious heat illness · <b>{final.check.forecast.minutesPsi7}</b> worker-minutes in high heat strain{final.check.forecast.pourStart ? ` · pour ${final.check.forecast.pourStart}–${final.check.forecast.pourFinish ?? '—'}` : ' · no pour'}
            </div>
          )}
          <details className="how-checked">
            <summary>How this is checked</summary>
            The site rules (UAE midday break, work and rest limits, shade, water, no working alone) decide whether a plan is allowed. Separately, each worker&apos;s average heat over every hour is compared with the US NIOSH exposure limit for their workload. This is a simulation with made-up workers, not a safety certificate.
          </details>
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

const ZONE_NAMES: Record<string, string> = { deck: 'level 12 deck', yard: 'rebar yard', facade: 'façade scaffold' };
const pct = (s: { exceededWindows: number; assessedWindows: number }) => `${Math.round((100 * s.exceededWindows) / Math.max(1, s.assessedWindows))}%`;

function verdict(check: PlanCheck): string {
  if (!check.ok) return 'The site rules refused this plan';
  if (check.exposureScreen && check.exposureScreen.exceededWindows > 0) return 'Allowed, and safer, but still too hot for part of the shift';
  return 'Allowed by the site rules';
}

function describeTool(s: Extract<PlannerEvent, { type: 'tool' }>): string {
  const r = s.result as Record<string, unknown>;
  if (s.name === 'get_conditions') return `Checked the heat on the ${ZONE_NAMES[String(s.args.zone)] ?? String(s.args.zone)}`;
  if (s.name === 'get_roster') return 'Read the crew list (who is used to the heat)';
  const args = s.args as { tents?: string[]; pourStart?: string | null; standDown?: string[] };
  const lever = `tents on ${args.tents?.map((t) => ZONE_NAMES[t] ?? t).join(' and ') || 'nothing'}, pour ${args.pourStart ?? 'not today'}${args.standDown?.length ? `, indoor duties for ${args.standDown.map((id) => id.charAt(0).toUpperCase() + id.slice(1)).join(', ')}` : ''}`;
  const verb = s.name === 'submit_plan' ? 'Proposed' : 'Tested';
  if (r && r.ok === false) return `${verb}: ${lever}. Refused (${((r.violations as { rule: string }[]) ?? []).map((v) => v.rule.replaceAll('-', ' ')).join(', ') || String(r.note ?? '')})`;
  const f = r?.forecast as { minutesPsi7: number; redFlags: number } | null;
  return `${verb}: ${lever}. Allowed${f ? `; ${f.redFlags} serious heat-illness signs in the simulation` : ''}`;
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
